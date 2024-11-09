import 'dotenv/config';

import { BaseMessage } from '@langchain/core/messages';
import { Annotation } from '@langchain/langgraph';

// Define the graph state
// See here for more info: https://langchain-ai.github.io/langgraphjs/how-tos/define-state/
const StateAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
    }),
});

// Define a tool

// Define a model

// Define functions for nodes

// Define the graph

// Invoke the graph

// Save the graph as a picture
// await saveGraphPic(graph);
