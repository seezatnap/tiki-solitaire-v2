/**
 * The artwork around the cards: the table the game is played on, the app icon,
 * and the splash used while an installed copy starts up.
 *
 * Each one carries the anchor card as a reference so the palette, the carving
 * and the tapa geometry stay the same family as the deck.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { edit, inspect } from './lib.mjs';

const OUT = process.env.ART_DIR || './public/art';
const QUALITY = process.env.ART_QUALITY || 'medium';
await mkdir(OUT, { recursive: true });

const anchor = await readFile('./public/art/cards/AS.png');

const PALETTE = `
Palette and craft must match the reference card exactly: hand-carved Polynesian tiki
folk art, flat screen-print shapes with no gradients, no photography, no 3D rendering.
Deep volcanic teal-black (#0C2B26), lagoon green (#14493E), aged gold (#C9973F),
vermilion (#C0392B) used sparingly, warm ivory (#FAF3E2) used sparingly.
`.trim();

const PIECES = [
  {
    name: 'table.png',
    size: '1536x1024',
    check: 'Return JSON {"any_text": true|false, "objects_on_surface": true|false, "centre_is_quiet": true|false, "overall": "one short sentence"}. The image should be an empty dark tabletop with a quiet middle.',
    prompt: `A dark tabletop surface for a card game, seen straight from above, filling the
whole frame with no objects on it.

${PALETTE}

Almost the entire surface is deep volcanic teal-black, close to flat, with a very faint
woven tapa texture and a soft pool of warmer lagoon green light in the upper middle.
A restrained carved border of tapa chevrons and small tiki marks runs around the outer
edge in aged gold at low contrast, well away from the centre.
The middle two thirds must stay quiet and almost empty — playing cards will be laid on
top and must remain easy to read. No cards, no text, no figures, no bright areas, no
vignette burn-in, no border outside the surface.`
  },
  {
    name: 'icon.png',
    size: '1024x1024',
    check: 'Return JSON {"any_text": true|false, "subject": "what is depicted, few words", "reads_at_small_size": true|false, "overall": "one short sentence"}.',
    prompt: `A square app icon: one carved tiki mask badge, centred, facing forward.

${PALETTE}

The mask is aged gold on a deep volcanic teal-black ground, with a heavy carved brow,
two almond eyes, a broad nose and a wide carved mouth — the same mask language as the
reference card's carvings. A thin gold keyline ring frames it, with tapa notches at
the four corners of the square.
Bold and simple enough to read at 32 pixels: few shapes, thick strokes, high contrast.
Fills the square edge to edge. No text, no letters, no numbers, no drop shadow, no
rounded-rectangle frame drawn inside the image.`
  },
  {
    name: 'splash.png',
    size: '1024x1536',
    check: 'Return JSON {"any_text": true|false, "subject": "what is depicted, few words", "edges_are_plain": true|false, "overall": "one short sentence"}.',
    prompt: `A portrait splash screen artwork for a card game, centred composition on a deep
volcanic teal-black ground.

${PALETTE}

A tall carved tiki totem stands in the centre in aged gold, flanked by two small carved
palm fronds, with a faint tapa-chevron band across the lower third and a soft lagoon
green glow behind the totem's head.
The outer sixth of the frame on every side is plain dark ground with nothing in it, so
the image can be cropped to different screen shapes without losing anything.
No text, no letters, no numbers, no playing cards, no logo lettering.`
  }
];

for (const piece of PIECES) {
  console.log(`drawing ${piece.name} (${piece.size})`);
  const png = await edit({
    prompt: piece.prompt,
    references: [anchor],
    size: piece.size,
    quality: QUALITY
  });
  await writeFile(`${OUT}/${piece.name}`, png);
  const seen = await inspect(png, piece.check);
  console.log(`   check: ${JSON.stringify(seen)}`);
  if (seen.any_text) console.log('   ⚠ text appeared in the artwork — worth a look');
}

console.log(`\nscenery done → ${OUT}`);
