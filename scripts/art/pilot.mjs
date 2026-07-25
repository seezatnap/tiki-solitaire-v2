import { mkdir, writeFile } from 'node:fs/promises';
import { cardPrompt, matchPrompt, edit, generate, readCard } from './lib.mjs';

const OUT = process.env.ART_DIR || './art-pilot';
await mkdir(OUT, { recursive: true });
const started = Date.now();

console.log('1/3  anchor card — A of spades (medium)');
const anchor = await generate({ prompt: cardPrompt('A', 'S'), quality: 'medium' });
await writeFile(`${OUT}/AS-medium.png`, anchor);
console.log('     ', JSON.stringify(await readCard(anchor)));

console.log('2/3  derived from the anchor — 7 of hearts');
const seven = await edit({ prompt: matchPrompt('7', 'H'), references: [anchor], quality: 'medium' });
await writeFile(`${OUT}/7H-medium.png`, seven);
console.log('     ', JSON.stringify(await readCard(seven)));

console.log('3/3  derived from the anchor — K of clubs');
const king = await edit({ prompt: matchPrompt('K', 'C'), references: [anchor], quality: 'medium' });
await writeFile(`${OUT}/KC-medium.png`, king);
console.log('     ', JSON.stringify(await readCard(king)));

console.log(`done in ${Math.round((Date.now() - started) / 1000)}s → ${OUT}`);
