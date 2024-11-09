import { Client } from '@langchain/langgraph-sdk';

// only set the apiUrl if you changed the default port when calling langgraph up
const client = new Client({ apiUrl: 'http://localhost:58931' });
// Using the graph deployed with the name "agent"
const assistantId = 'agent';
const thread = await client.threads.create();

const input = { messages: [{ role: 'user', content: 'What part of the day is it now?' }] };

const streamResponse = client.runs.stream(thread['thread_id'], assistantId, {
    input: input,
    streamMode: 'updates',
});
for await (const chunk of streamResponse) {
    console.log(`Receiving new event of type: ${chunk.event}...`);
    console.log(JSON.stringify(chunk.data));
    console.log('\n\n');
}
