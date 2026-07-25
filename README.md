# Tiki Solitaire

A patience game built entirely out of **fourteen**. Pair cards to fourteen, forge
pairs into dominos, chain the dominos, and try to close the circle.

This is a ground-up rebuild of the original game. **The rules are unchanged** —
every predicate in `src/game/rules.js` is a faithful port. Everything you can see
and touch is new.

```bash
npm install
npm run dev        # http://localhost:5273
npm test           # 74 unit + component tests
npm run build
```

## The game in one screen

| Zone | What lives there |
| --- | --- |
| **Table** | Eight columns, all face up. Only the top card of a column moves. |
| **Pairs** | Six slots. Two top cards of opposite colour summing to fourteen. |
| **Dominos** | Two pairs showing all four suits between them forge one domino. |
| **Chains** | Dominos link where their values match. Chains are permanent. |

A perfect game is one closed loop: thirteen dominos, fifty-two cards, both ends
meeting.

## How it's put together

```
src/
  game/rules.js        pure predicates — pairing, forging, linking, winning
  game/state.js        transitions + reducer + localStorage
  lib/flip.js          cross-component FLIP animation
  lib/DragProvider.jsx one pointer-based drag system for mouse, pen and touch
  lib/sound.js         synthesised sound kit (no audio files)
  lib/hooks.js         element size, media query, fit-to-width, flash
  components/          Card, Tableau, Workyard, Chains, Chrome
  styles/              tokens + board
```

### Ideas worth knowing about

**A refused move is a returned state.** Every transition returns the *same object*
when the rules say no. The UI compares identities, so an illegal move answers with
a shake and a thud instead of silently doing nothing.

**Cards keep their identity everywhere.** Any element tagged `data-flip="<id>"` is
measured before a state change and animated from its old box to its new one after.
Because a tableau card, a chip in a pair, a chip in a domino and a chip in a chain
all share the card's id, a single card glides — and shrinks — across four
completely different components without any of them knowing about each other.
Nested animations are filtered so a domino and the chips inside it never travel
twice.

**One drag system, three input devices.** Sources arm a drag on `pointerdown` and
it only wakes once the pointer has moved past a click's worth of distance. Targets
are plain DOM nodes tagged `data-drop-kind`, so any component can become droppable
without threading handlers. Touch scrolling is left to the browser: draggable
surfaces declare which axis belongs to the page (`touch-action: pan-y` on cards,
`pan-x` on the domino shelf) and the browser hands the other one back.

**Every drag has a tap equivalent.** Tap a card then a column; tap two pairs; tap
a chain socket to arm it, then tap the domino you want there. Nothing in the game
requires a mouse.

**Chains wrap; they never shrink.** Dominos in a chain stay at a readable size
whatever the screen. When a chain outgrows the width it packs onto more rows,
and a return line carries the eye from the end of one row back to the start of
the next:

```
      … (domino) ─┐
    ┌─────────────┘
    └─ (domino) …
```

The packing is measured against the room the whole list has rather than the
chain's own width — a chain is as wide as its rows, so measuring itself would
chase its own tail.

**The layout never scrolls the page.** The app is one `100dvh` column; the table,
the workyard and the chain reef each scroll internally. On short-and-wide
viewports the workyard moves back beside the table, because there height is the
scarce resource.

## One deliberate departure

The original spec says undo never rewinds a chain. It also kept the undo history
across chain commits — which meant undoing after chaining could restore pairs whose
cards were *already* sitting inside a chain, duplicating them. Since chains are
permanent, so are the moves that produced them: committing a domino to a chain now
retires the undo history, and the Undo button greys out. Chains still can't be
rewound; the cards just can't be conjured any more either.

## Checks

`npm test` covers the rules, the transitions, persistence, and the component
behaviour in jsdom.

Three browser harnesses run against `npm run dev` (they need Chromium:
`npx playwright install chromium`):

```bash
npm run shots        # screenshots at 7 viewports + the win state; flags overflow
npm run check:play   # drives a seeded board through the whole game loop
npm run check:layout # reports any element spilling past the viewport
```

`scripts/win-fixture.mjs` builds a genuine perfect game — an Eulerian circuit over
the seven pair values — which is how the win sheet and the closed-loop chain get
verified.
