import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { edit, matchPrompt, readCard } from './lib.mjs';

const OUT = process.env.ART_DIR || './art-pilot';
await mkdir(OUT, { recursive: true });
const anchor = await readFile(`${OUT}/AS-medium.png`);

for (const [rank, suit] of [['7', 'H'], ['10', 'D'], ['9', 'C']]) {
  const png = await edit({ prompt: matchPrompt(rank, suit), references: [anchor], quality: 'medium' });
  await writeFile(`${OUT}/${rank}${suit}-v2.png`, png);
  const seen = await readCard(png);
  const want = /^\d+$/.test(rank) ? Number(rank) : null;
  const pipsOk = want === null || seen.centre_symbols === want;
  console.log(`${rank}${suit}: rank=${seen.rank} suit=${seen.suit} pips=${seen.centre_symbols} ${pipsOk ? 'OK' : 'WRONG COUNT'}`);
}
