import 'dotenv/config';

import { AIMessage, BaseMessage, HumanMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { Annotation, END, MessagesAnnotation, StateGraph } from '@langchain/langgraph';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';

// Define the graph state
// See here for more info: https://langchain-ai.github.io/langgraphjs/how-tos/define-state/
const StateAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
    }),
});

const timeTool = tool(
    async () => {
        const date = new Date();
        const hour = date.getHours();
        let partOfDay = 'night';

        if (hour >= 5 && hour < 12) {
            partOfDay = 'morning';
        } else if (hour >= 12 && hour < 17) {
            partOfDay = 'afternoon';
        } else if (hour >= 17 && hour < 21) {
            partOfDay = 'evening';
        }
        return partOfDay;
    },
    {
        name: 'partOfDay',
        description: 'Call to get the current part of the day',
    },
);

const tools = [timeTool];

const model = new ChatOpenAI({
    model: 'gpt-4o',
}).bindTools(tools);

const toolNode = new ToolNode(tools);

async function callModel(state: typeof StateAnnotation.State) {
    const messages = state.messages;
    const response = await model.invoke(messages.slice(-10));

    return { messages: [response] };
}

function routeModelOutput(state: typeof MessagesAnnotation.State) {
    const messages = state.messages;
    const lastMessage: AIMessage = messages[messages.length - 1];

    if ((lastMessage?.tool_calls?.length ?? 0) > 0) {
        return 'tools';
    }
    return END;
}

const workflow = new StateGraph(StateAnnotation)
    .addNode('agent', callModel)
    .addNode('tools', toolNode)
    .addEdge('__start__', 'agent')
    .addConditionalEdges('agent', routeModelOutput, ['tools', END])
    .addEdge('tools', 'agent');

const checkpointer = PostgresSaver.fromConnString('postgres://postgres:postgres@localhost:5432/langchain');
// You must call .setup() the first time you use the checkpointer:
// await checkpointer.setup();

export const graph = workflow.compile({ checkpointer });

const finalState = await graph.invoke(
    { messages: [new HumanMessage('My name is Nick')] },
    {
        configurable: {
            thread_id: '2',
        },
    },
);

// await saveGraphPic(graph);
console.log(finalState.messages[finalState.messages.length - 1].content);

const nextState = await graph.invoke({ messages: [new HumanMessage('What is my name')] }, { configurable: { thread_id: '2' } });
console.log(nextState.messages[nextState.messages.length - 1].content);
