/**
 * Thin wrapper around the OpenAI image API, plus a vision check that reads a
 * generated card back and says what it actually shows.
 */
import { readFile } from 'node:fs/promises';
import { KEY } from './env.mjs';

const IMAGE_MODEL = 'gpt-image-2';
const VISION_MODEL = 'gpt-5.4-mini';

export const SUITS = {
  S: { glyph: '♠', name: 'spades', colour: 'black' },
  H: { glyph: '♥', name: 'hearts', colour: 'red' },
  D: { glyph: '♦', name: 'diamonds', colour: 'red' },
  C: { glyph: '♣', name: 'clubs', colour: 'black' }
};

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retries on rate limits and transient failures, honouring Retry-After. */
const call = async (url, init, { attempts = 5, label = '' } = {}) => {
  let wait = 3000;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(url, init);
    if (response.ok) return response.json();

    const body = await response.text();
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === attempts) {
      throw new Error(`${label} ${response.status}: ${body.slice(0, 300)}`);
    }
    const after = Number(response.headers.get('retry-after')) * 1000;
    const pause = Number.isFinite(after) && after > 0 ? after : wait;
    console.log(`   ${label} ${response.status}, waiting ${Math.round(pause / 1000)}s`);
    await sleep(pause);
    wait = Math.min(wait * 2, 60000);
  }
  throw new Error(`${label}: out of attempts`);
};

export const generate = async ({ prompt, size = '1024x1536', quality = 'medium', format = 'png' }) => {
  const data = await call(
    'https://api.openai.com/v1/images/generations',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: IMAGE_MODEL, prompt, size, quality, n: 1, output_format: format })
    },
    { label: 'generate' }
  );
  return Buffer.from(data.data[0].b64_json, 'base64');
};

/** Edits carry reference images, which is what keeps the deck consistent. */
export const edit = async ({ prompt, references, size = '1024x1536', quality = 'medium', format = 'png' }) => {
  const form = new FormData();
  form.append('model', IMAGE_MODEL);
  form.append('prompt', prompt);
  form.append('size', size);
  form.append('quality', quality);
  form.append('n', '1');
  form.append('output_format', format);
  for (const reference of references) {
    const bytes = typeof reference === 'string' ? await readFile(reference) : reference;
    form.append('image[]', new Blob([bytes], { type: 'image/png' }), 'reference.png');
  }

  const data = await call(
    'https://api.openai.com/v1/images/edits',
    { method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: form },
    { label: 'edit' }
  );
  return Buffer.from(data.data[0].b64_json, 'base64');
};

/** Reads the card back off the image — the check that it says what it should. */
export const readCard = async (png) => {
  const data = await call(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VISION_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: [
                  'This is one playing card. Report exactly what is printed on it.',
                  'Count the suit symbols in the central panel one by one, ignoring the',
                  'corner indices and any symbol worn on a figure.',
                  'Return JSON: {"rank": "A|2|3|4|5|6|7|8|9|10|J|Q|K|unclear",',
                  '"suit": "spades|hearts|diamonds|clubs|unclear",',
                  '"centre_symbols": <integer count of suit symbols in the central panel>,',
                  '"court_figure": true|false,',
                  '"corner_index_legible": true|false,',
                  '"stray_text": "any text other than the rank and suit, else empty",',
                  '"notes": "one short sentence"}',
                  'Judge the rank from the corner index. Be strict: if the corner rank is',
                  'malformed, misspelled or ambiguous, say unclear.'
                ].join(' ')
              },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${png.toString('base64')}` } }
            ]
          }
        ]
      })
    },
    { label: 'read' }
  );
  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return { rank: 'unclear', suit: 'unclear', notes: 'unparseable reply' };
  }
};

/** A general-purpose look at an image, for the pieces that aren't cards. */
export const inspect = async (png, instructions) => {
  const data = await call(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VISION_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: instructions },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${png.toString('base64')}` } }
            ]
          }
        ]
      })
    },
    { label: 'inspect' }
  );
  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return { error: 'unparseable reply' };
  }
};

/**
 * A second, stricter opinion on the pip count. Counting by eye is where the
 * small model slips, so this one has to enumerate the symbols by position
 * before it is allowed to total them.
 */
export const countCentre = async (png, suitName, model = 'gpt-5.4') => {
  const data = await call(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: [
                  `List every ${suitName} symbol printed in the central panel of this playing card.`,
                  'Ignore the two small corner indices entirely — those are not part of the count.',
                  'Work down the card in reading order and give each symbol a short position label',
                  'such as "top-left", "upper-middle", "centre", "bottom-right".',
                  'Then count the list.',
                  'Return JSON: {"symbols": ["...", "..."], "count": <length of that list>}'
                ].join(' ')
              },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${png.toString('base64')}` } }
            ]
          }
        ]
      })
    },
    { label: 'count' }
  );
  try {
    const parsed = JSON.parse(data.choices[0].message.content);
    return { count: parsed.symbols?.length ?? parsed.count, symbols: parsed.symbols || [] };
  } catch {
    return { count: null, symbols: [] };
  }
};

/* ------------------------------------------------------------- prompting -- */

const HOUSE_STYLE = `
STYLE — follow exactly, this deck must look like one set:
Hand-carved Polynesian tiki folk art printed on warm ivory card stock (#FAF3E2) with a
faint woven tapa texture. Flat screen-print look: bold shapes, clean edges, no gradients,
no photography, no 3D rendering, no drop shadows, no glossy highlights.
Ink palette: deep volcanic teal-black (#0C2B26) for spades and clubs, vermilion (#C0392B)
for hearts and diamonds, aged gold (#C9973F) for ornament only.
A thin aged-gold keyline border sits just inside the card edge, with small carved tapa
notches at the corners.

LAYOUT — strict, the same on every card:
- Top-left corner: the rank, then the suit symbol directly beneath it, in a heavy
  slab serif. This corner index is large and unmistakable — it occupies about a sixth of
  the card's width — because it is the only part seen when cards overlap.
- Bottom-right corner: the same rank and suit again, rotated 180 degrees.
- Centre: the illustration described below, contained well inside the keyline border.
- Nothing else. No captions, no titles, no signatures, no borders outside the card,
  no background beyond the card itself — the card fills the whole frame.
`.trim();

const COURT = {
  J: 'a carved tiki warrior totem holding a paddle',
  Q: 'a carved tiki moon-goddess totem wearing a frangipani crown',
  K: 'a carved tiki volcano-chief totem wearing a rayed headdress'
};

// The traditional pip layouts, spelled out — left to its own devices the model
// loses count somewhere around six.
const PIPS = {
  2: 'one at top centre and one at bottom centre (the lower one upside down). Two symbols in total.',
  3: 'one at top centre, one in the exact middle, one at bottom centre (the lower one upside down). Three symbols in total.',
  4: 'one in each corner of the panel — top-left, top-right, bottom-left, bottom-right (the lower pair upside down). Four symbols in total.',
  5: 'one in each of the four corners of the panel plus one in the exact middle. Five symbols in total.',
  6: 'a left column of three evenly spaced and a right column of three evenly spaced. Six symbols in total.',
  7: 'a left column of three and a right column of three, plus one extra centred between the top-left and top-right symbols. Seven symbols in total.',
  8: 'a left column of three and a right column of three, plus two extra centred — one between the top pair and one between the bottom pair. Eight symbols in total.',
  9: 'a left column of four and a right column of four, plus one in the exact middle. Nine symbols in total.',
  10: 'a left column of four and a right column of four, plus two extra centred — one between the first pair and one between the last pair. Ten symbols in total.'
};

const centrepiece = (rank, suit) => {
  const { glyph, name } = SUITS[suit];
  if (COURT[rank]) {
    return `${COURT[rank]}, drawn full height and symmetrical, carved in the ink colour of ${name}, with one large ${name} symbol (${glyph}) set into its chest.`;
  }
  if (rank === 'A') {
    return `one very large ${name} symbol (${glyph}) as a carved totem medallion, filled with tapa-cloth chevrons and framed by a gold ring.`;
  }
  const count = Number(rank);
  return `exactly ${count} ${name} symbols (${glyph}), each carved and filled with a small tapa pattern, laid out as ${PIPS[count]} Count them as you draw: there must be ${count}, not ${count - 1} and not ${count + 1}. The lower half of the layout is drawn upside down, as on a real playing card.`;
};

export const cardPrompt = (rank, suit) => {
  const { glyph, name, colour } = SUITS[suit];
  return `A single playing card face: the ${rank} of ${name}.

${HOUSE_STYLE}

THIS CARD:
- Corner index rank: "${rank}" (${rank === '10' ? 'the two characters one and zero' : 'a single character'}), printed in ${colour} ink.
- Corner index suit: ${name} (${glyph}), printed in ${colour} ink.
- Centre: ${centrepiece(rank, suit)}`;
};

export const matchPrompt = (rank, suit) => `${cardPrompt(rank, suit)}

Match the reference images exactly in card stock colour, border treatment, corner index
size and placement, carving style and line weight. Only the rank, the suit and the centre
illustration change. Do not copy the reference's rank or suit.`;
