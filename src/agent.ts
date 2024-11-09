import 'dotenv/config';

import { AIMessage, BaseMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { Annotation, END, MemorySaver, START, StateGraph } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import readlineSync from 'readline-sync';
import { saveGraphPic } from 'utils';

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
const toolNode = new ToolNode(tools);

const model = new ChatOpenAI({
    model: 'gpt-4o-mini',
}).bindTools(tools);

async function callModel(state: typeof StateAnnotation.State) {
    const messages = state.messages;
    const response = await model.invoke(messages.slice(-10));
    return { messages: [response] };
}

function routeModelOutput(state: typeof StateAnnotation.State) {
    const messages = state.messages;
    const lastMessage: AIMessage = messages[messages.length - 1];
    if (lastMessage && !lastMessage.tool_calls?.length) {
        return END;
    }
    return 'tools';
}

function askHuman(state: typeof StateAnnotation.State): Partial<typeof StateAnnotation.State> {
    return state;
}

const workflow = new StateGraph(StateAnnotation)
    .addNode('agent', callModel)
    .addNode('tools', toolNode)
    .addNode('askHuman', askHuman)
    .addEdge(START, 'askHuman')
    .addEdge('askHuman', 'agent')
    .addConditionalEdges('agent', routeModelOutput, ['tools', END])
    .addEdge('tools', 'agent');

const checkpointer = new MemorySaver();
export const graph = workflow.compile({ checkpointer, interruptBefore: ['askHuman'] });

const input = { messages: [{ role: 'user', content: 'Hey' }] };
const config: any = {
    streamMode: 'values',
    configurable: {
        thread_id: '11',
    },
};

for await (const chunk of await graph.stream(input, config)) {
    const recentMsg = chunk.messages[chunk.messages.length - 1];
    console.log('[-]', recentMsg.content);
}

console.log('==Interrupted===');

// const rl = Readline.createInterface({
//     input: process.stdin,
//     output: process.stdout,
// });
// let userInput = '';
// rl.question(`What is your question`, (answer: string) => {
//     userInput = answer;
//     rl.close();
// });

const userInput = readlineSync.question('What is your question?\n');

// const userInput = 'What part of the day is it now? Recommend me a song about it';

await graph.updateState(config, { messages: [{ role: 'user', content: userInput }] }, 'askHuman');

for await (const chunk of await graph.stream(null, config)) {
    const recentMsg = chunk.messages[chunk.messages.length - 1];
    console.log('[-]', recentMsg.content);
}

await saveGraphPic(graph);
