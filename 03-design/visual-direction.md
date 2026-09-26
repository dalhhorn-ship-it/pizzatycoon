# Pizza D visual direction

**Direction in one line:** a warm, early 90s VGA management game. Chunky bevelled windows on a wooden desk, a pixel display face for headings, and a hand built pixel art pizzeria (terracotta floors, brick walls, gingham tables, glowing ovens) that feels of that era without borrowing anything from it. Every asset is original and drawn in code.

The player is an adult on an iPad in landscape who wants a cosy evening with numbers that matter. So the charm lives in the frame and the world, while every number and sentence stays in a clean, large system font.

## Palette

Light is the default. Dark keeps the same warm family with darker panels.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | #e8d3ad | #1c1310 | Parchment desk |
| `--panel` | #f6ead0 | #33241d | Window body |
| `--panel-2` | #ecdab5 | #291c16 | Recessed wells, chips, inactive tabs |
| `--field` | #fffaf0 | #1f1612 | Cards, inputs, reading surfaces |
| `--ink` | #2b1b17 | #f6e6c8 | Text and every 2 px outline |
| `--muted` | #6a5242 | #c9ae93 | Secondary text (AA on panel and field) |
| `--accent` | #b8321f | #d2472f | Tomato: primary buttons, selected keys |
| `--accent-text` | #a82d1b | #f08a6c | Accent used as text (headings, active tab) |
| `--title` / `--title-2` | #7a2a1c / #5c1d13 | #6e2418 / #4d170f | Oxblood title bars |
| `--wood` / `--wood-2` | #5a3421 / #4a2a1a | same | HUD shelf, tab strip, toasts |
| `--lcd` / `--lcd-ink` | #1f1510 / #ffd66b | same | Amber readouts: cash, clock, prices |
| `--good` / `--bad` / `--warn` | #2f6f2a / #a3261b / #9a4a10 | #8cc47e / #f07a6a / #eb9a5e | Feedback, always paired with words or signs |
| `--focus` | #1d5fbf | #8ec5ff | Focus ring, the one cool colour so it never hides |

Sprite palette (exported as `PALETTE` in `src/ui/sprites.ts`): terracotta #c3673e and #b65c36 with grout #7a3a22; brick #a8452c on mortar #d6bb8f; woods #5a321f, #8a5431, #b57a48, #dca76a; tomato #d33a26; basil #3f8a36; gold #e7b035; steels #65707a, #9aa4ab, #cfd6da; marble #ece8df; fire #ff8c1a and #ffd84a; ink outline #2b1b17.

## Typography

* Display: **Pixelify Sans** (Google Fonts, `display=swap`) for h1 to h3, the logo, tabs, primary buttons, the clock, prices and HUD values. Fallback is a monospace stack so it still reads as "screen type" offline.
* Body: the system UI face at 16 px, secondary text at 15 px. Labels in the HUD are 12 px uppercase with tracking, the only exception, and they sit on high contrast readouts.
* Numbers use tabular figures wherever they line up (kv tables, P&L).

## Panels and buttons

* **Bevel rule:** light comes from the top left. Raised surfaces get `inset 2px 2px` highlight and `inset -2px -2px` shade inside a 2 px ink border. Pressed or inset surfaces swap them. Corners are square (2 px radius at most).
* **Buttons** are raised keys, 44 px minimum. Pressed state sinks 1 px. Primary is a tomato key with pixel type. Disabled drops the bevel, goes dashed and muted, and shows a not allowed cursor, so it never looks clickable.
* **Selected** things (tier keys, palette tiles, districts) are pressed in with a tomato inner ring.
* **Readouts** (HUD stats, clock, price) are black LCD wells with amber digits.
* **Meters** are inset troughs filled with LED segments.
* Hard offset shadows (3 px, no blur) instead of soft drop shadows.

## Iconography

Text first. Where a symbol helps, use a small square pixel glyph built from CSS (the save status lamp) or the sprite set. No icon on every row. Colour always travels with a word, a sign or a star.

## Sprite rules

* One tile is 16 x 16 logical pixels; one logical pixel is tile / 16 screen pixels. Every edge snaps to the device pixel grid, so tiles from 24 to 72 px stay crisp.
* Gentle 3/4 top down view: lit top surface, darker front face, 1 px ink outline, a translucent shadow one pixel right and down.
* Flat colour from the palette only; no gradients inside sprites. Glow is stacked translucent pixel discs.
* People are 16 x 16 character maps, front facing, with a back view for guests sitting below a table. Segment colour is the shirt; `variant` varies hair, skin and trousers.
* Animation is cheap and slow: flame columns, belt links, lantern flicker, fountain ripples and steam, all driven by one `t` in seconds, only while service runs.
* Unknown ids draw a wooden crate so nothing ever vanishes.

## Screen mapping

* **HUD:** a wooden shelf with the pixel logo (gold with tomato and ink offset shadow) and a row of LCD readouts. Cloud status is a small LCD with a coloured lamp.
* **Tabs:** folder tabs on a wood strip. The active tab is the panel colour, merges into the window below and uses accent text.
* **Side panel:** parchment window. The panel h2 is accent pixel type.
* **Cards:** framed mini windows. A leading h3 becomes an oxblood title bar; cards that are off the menu or locked get a grey title bar.
* **Modals:** the big framed window with a striped title strip and three coloured lamps, a dithered backdrop, and a 320 ms rise in. Day report, new game, conflict and settings all share it.
* **Day report:** the modal treatment, big pixel profit figure in good or bad colour, reviews as notes with a hard shadow.
* **Floor:** dark dithered stage like an old monitor. Brick wall band along the top, terracotta tiles, gingham tables with a candle bottle, sprites for decor, guests and staff.
* **Kitchen:** cream and sage checkerboard, white tile wall band, equipment sprites that come alive in service.
* **Toasts:** small wooden windows; green for good, rust for warnings.

Motion honours `prefers-reduced-motion`: modal, backdrop and toast animations and the press offset switch off.

## Follow ups for the engineer

In `floor.ts` the tile size is `this.tile`; below it is called `tile`, and `secs` is real time in seconds (for example `ts / 1000`).

* Replace `drawItem` and `drawChairs` with `drawFurniture(g, item.id, x, y, w, h, tile, secs)`.
* Replace the checker loop with `drawFloorTile(g, x, y, tile, 'dining', tx, ty)` and draw `drawWall(g, ox, oy - wallH, W * tile, wallH)` above the room (and `drawWall(..., 'tile')` above the kitchen).
* Replace the kitchen strip rectangles with `drawEquipment(g, id, x, y, w, h, tile, inService, secs)` on `drawFloorTile(..., 'kitchen', ...)`.
* Replace guest dots with `drawGuest(g, x, y, tile * 0.62, SEG_COLORS[seg], true, secs, { variant: partyIndex + i, back: seatIsBelowTable })`, using `seatSpots(item.id, w, h, seats, tile)` so booth guests sit on the benches. Queues use `seated: false` with `walking: true`.
* Draw staff with `drawStaff(g, role, x, y, tile, secs)` in the kitchen and at the pass.
* Use `drawPizza` for the food marker and `drawDoormat` for the entrance.
* Keep redrawing while any lamp, lantern or fountain is placed if the ambient flicker should move outside service; otherwise pass `secs = 0` and the art is static.
* Keep the selection and placement outlines, but make them square (no `roundRect`) and 2 px, in `--accent`, `--good` or `--bad`.
