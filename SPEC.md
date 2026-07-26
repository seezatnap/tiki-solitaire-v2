# Tiki Solitaire — specification

Rules are carried over from the original game unchanged. The interface is new.
Items marked ✅ are covered by an automated check; the check is named beside them.

---

## Rules (unchanged)

### Values
- ✅ A = 1, 2–10 face value, J = 11, Q = 12, K = 13 — `rules.test.js`
- ✅ Cards pair to fourteen: A+K, 2+Q, 3+J, 4+10, 5+9, 6+8, 7+7 — `rules.test.js`

### Table
- ✅ Eight columns, 52 cards, six or seven per column, all face up — `rules.test.js`
- ✅ Only the top card of a column moves — `state.test.js`
- ✅ A card may land on the same rank, or on a card that sums to fourteen — `state.test.js`
- ✅ Any card may take an empty column — `state.test.js`

### Pairs
- ✅ One red and one black card summing to fourteen — `rules.test.js`
- ✅ Stored red-first — `state.test.js`
- ✅ Six pairs held at a time — `state.test.js`
- ✅ Pairs never return to the table — by construction (no transition exists)

### Dominos — the four-suit rule
- ✅ Two pairs forge a domino when between them they show all four suits — `rules.test.js`
- ✅ Their values need not match: 3♥+J♣ with 5♦+9♠ is valid — `rules.test.js`
- ✅ A♥+K♣ with 2♥+Q♣ is invalid — `rules.test.js`
- ✅ Halves are ordered lower value first, so 5-9 and 9-5 are one domino — `rules.test.js`

### Chains
- ✅ A domino joins a chain where a value matches, flipping itself to fit — `state.test.js`
- ✅ It may join at either end — `state.test.js`
- ✅ Chains are permanent; nothing comes back out — `state.test.js`
- ✅ Several chains may exist at once — `state.test.js`
- ✅ Two chains splice at the junction the player picks, turning one if needed — `state.test.js`
- ✅ A chain is circular when its ends carry the same value — `rules.test.js`

### Winning
- ✅ One chain, thirteen dominos, fifty-two cards, circular — `rules.test.js`
- ✅ The win sheet appears on that state — `shoot.mjs` (`win-fixture.mjs`)

### Undo
- ✅ Restores table, pairs and dominos; never rewinds a chain — `state.test.js`
- ✅ Fifty steps deep — `state.test.js`
- ✅ Retires when a domino is committed to a chain (see README) — `state.test.js`, `play.mjs`
- ✅ Reordering the workyard costs neither a move nor a history slot — `state.test.js`

### Persistence
- ✅ Saved on every change, restored on load — `state.test.js`, `App.test.jsx`, `play.mjs`
- ✅ Corrupt or missing data starts a fresh deal — `state.test.js`
- ✅ A new deal clears the board — `play.mjs`

---

## Interface

### Layout
- ✅ One `100dvh` column: bar, stage, chain reef — the page itself never scrolls — `probe.mjs`
- ✅ Wide: table beside the workyard rail, chains along the bottom
- ✅ Narrow: workyard docks under the table, chains below it
- ✅ Short and wide: workyard returns beside the table
- ✅ Verified at 1440, 1180, 900, 768, 430, 375 and 844×390 — `shoot.mjs`
- ✅ Nothing spills past the viewport at any of them — `shoot.mjs`, `probe.mjs`

### Table
- Card size derives from the measured pane, capped at 104px, so eight columns
  always fit without horizontal scrolling
- Column overlap tightens as a column grows; the pane scrolls only past that
- Court cards wear a carved mask; aces and courts print their value
- ✅ Valid destinations light up — teal to stack, gold with a "14" badge to pair —
  `play.mjs`, `App.test.jsx`
- Unreachable columns step back while a card is in hand

### Workyard
- Six pair slots; filled slots fan their two chips and show the pair's label
- A pair that can forge with another carries a gold mark
- Dominos show both halves, their labels, and a spine of three studs
- ✅ Dominos that can reach a chain end glow — `play.mjs`

### Chains
- ✅ Each chain reads between two sockets showing the value that end wants — `play.mjs`
- ✅ Dominos in a chain never shrink below tray size — `shoot.mjs`
- ✅ A chain too wide for the panel wraps onto more rows — `shoot.mjs`
- ✅ Each wrap draws a return line from the end of one row to the start of the next — `shoot.mjs`
- ✅ Closed loops take a teal cast and a "closed loop" badge — `shoot.mjs`
- ✅ With a chain in hand, only the junctions that fit light up — `play.mjs`

### Interaction
- ✅ Tap a card, then a column, to move or pair — `play.mjs`, `App.test.jsx`
- ✅ Tap two pairs to forge — `play.mjs`, `App.test.jsx`
- ✅ Tap a domino to open a new chain — `play.mjs`, `App.test.jsx`
- ✅ Tap a socket to arm it, then tap a domino to place it there — `play.mjs`, `App.test.jsx`
- ✅ Tap a chain, then tap the socket on another it should join — `play.mjs`
- ✅ Or drag a chain onto that socket — `play.mjs`
- ✅ Drag cards between columns — `play.mjs`
- ✅ Drag a pair onto a pair to forge — `play.mjs`
- ✅ Drag a domino onto a socket, or onto the reef to open a chain — `play.mjs`
- ✅ A drag renders a tilted ghost and only starts past a click's distance — `play.mjs`
- Drag also reorders pairs, dominos and chains
- Mouse, pen and touch share one pointer-based implementation. Touch waits for a
  short hold, then takes the gesture over outright so a page scroll cannot tear a
  drag away; the page auto-scrolls near the edges while dragging
- Keyboard: `Esc` clears, `U` undoes, `?` opens the rules; cards are focusable

### Feedback
- ✅ An illegal move shakes the target and thuds — `App.test.jsx`
- ✅ Cards animate continuously between table, pair, domino and chain — `play.mjs`
- Synthesised sounds per action, mutable, remembered
- A progress line under the bar tracks dominos chained out of thirteen
- Win: confetti of suit pips, "The circle closes", the run's numbers

### Starting up
- A splash — mask and title — is painted in the markup, so it shows before any
  script runs, and hands over to the board once React has mounted
- Installed copies use the same artwork for their icons and iOS startup screens

### Sheets
- ✅ Rules sheet, four numbered sections — `shoot.mjs`, `App.test.jsx`
- ✅ Win sheet with dominos, cards and moves — `shoot.mjs`
- ✅ A played board asks before being swept away — `play.mjs`, `App.test.jsx`
- ✅ `Esc` and a click outside close a sheet — `play.mjs`

### Artwork
- ✅ 52 painted card faces, one visual family, drawn from a single anchor card — `deck.mjs`
- ✅ Every card shows the right rank and suit — `verify.mjs`
- ✅ Every numbered card shows the right number of pips — `recount.mjs`
- ✅ The corner index stays legible, because it is all a stacked card shows — `verify.mjs`
- A missing image falls back to the drawn CSS face
- Painted table under the tableau, washed down so the cards stay brightest
- Installed-app icons, maskable icon and iOS startup screens, all from one source

### Manners
- Honours `prefers-reduced-motion`
- Dark by design, `theme-color` set, safe-area insets respected
- Focus rings on everything reachable; live region on the readouts
