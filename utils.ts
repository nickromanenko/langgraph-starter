import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

import { writeFileSync } from 'fs';

export async function saveGraphPic(graph: any) {
    const fp = path.join(__dirname, 'graph.png');
    const gr = await graph.getGraphAsync();
    const image = await gr.drawMermaidPng();
    const arrayBuffer = await image.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    writeFileSync(fp, buffer);
}
