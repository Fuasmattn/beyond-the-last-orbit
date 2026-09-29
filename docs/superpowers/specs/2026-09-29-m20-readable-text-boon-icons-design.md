# M20 — Readable text and boon pictograms

## Why

Playtest (2026-09-29): "reading is a little hard (maybe a font improvement needed too)" and "I'd wish for some
recognizable boon pictograms". The whole game is set in a 3×5 pixel font. At the run's logical scale a glyph is
3 px wide and 5 px tall; on a phone in landscape that is about 6 pt. Worse, 3×5 letterforms are ambiguous
(B/8, S/5, M/W/N, O/0/D). Now that every stage ends in a draft, players read cards thirty times a run.

## Design

### Font

One font, swapped everywhere: 5×7 glyphs, 6 px advance (`GLYPH_W/H/ADVANCE` in `src/data/font.ts`). Glyphs are
the classic LCD/terminal forms with distinct B/8, S/5, O/0, M/W, plus `,` and `'` which the old set lacked (so
"FIRE +40%, HIT: X1" no longer swallows the comma).

Width budget at 6 px per glyph: card lines ≤ 22 chars = 131 px; event choices ≤ 24 chars = 143 px; highscore
rows 19–22 chars = 113–131 px. All fit the narrowest frames (touch menu 160 px, portrait view ≈ 148 px).
Height budget: rows spaced 8 px (HUD, hangar/settings blurbs) become 10 px; 9 px rows (results, highscores) stay
(2 px gap); menus (14–16 px) stay.

### Boon pictograms

Every boon gets an 8×8 one-colour icon (`src/data/boonIcons.ts`, a `PixelGrid` per `BoonId`), tinted with the
boon's rarity colour. Icons read as the effect, not the name: TWIN = two vertical bars, SPREAD = three diverging
bolts, PIERCE = an arrow through a bar, MAGNET = a horseshoe, DEFLECTOR = a shield, SECOND WIND = a heart,
curses carry a skull-ish or a downward mark, and so on. A test asserts every boon has an 8×8 icon.

### Draft card

Cards grow to 44 px. Line 1: the icon at 2× (16 px) on the left, the name beside it in the rarity colour (yellow
when selected). Line 2: the effect, centred over the card. Line 3: the synergy/curse tag or the shop price. Card
width grows to `min(200, viewW − 8)`.

### HUD build strip

Under SCRAP, the run's owned boons as a row of 1× icons (touch: 1.5×), tinted by rarity, in pick order. Stacks
show a small count. The build is visible at a glance without a menu.

### Not in scope

Ship, enemy and boss art stay vector; backgrounds unchanged. The "break the Space Invaders loop" question is
answered in the session summary as a proposal, not built here.

## Open for playtest

- 10 px HUD rows on touch at 1.5× (15 px) may crowd the boss bar; move the bar to y = 34 × k if so.
- Whether icons alone (without names) would do for the HUD strip on very narrow views.
