# M16 — Daily run

## Why

The sim is seeded and the leaderboard is global, so a shared daily seed is cheap: everyone plays the same map,
drafts and fire patterns once a day and compares on one table. It gives a reason to come back and makes the
leaderboard a fair contest for a day instead of an all-time grind.

## Design

- Title menu gains **DAILY RUN** (second entry). One attempt per UTC day; the row reads `DONE` afterwards and
  selecting it shows today's table instead of starting a run.
- The daily seed is FNV-1a of the UTC date (`YYYY-MM-DD`). Everyone gets the same route map, drafts, shop offers,
  events and enemy rolls. (Field width still follows the screen, so formation widths can differ between devices.)
- Daily runs use the **base ship**: no hangar upgrades, no rerolls, Beat Lock off. Credits are still earned.
- The attempt is spent when the run starts (a refresh does not give it back).
- Leaderboard board id `daily:<YYYY-MM-DD>`; the title screen cycles a `DAILY HIGH SCORES` page when today's
  table has rows. Offline, the local daily table shows only entries from today.
- Save v4: `dailyHighscores` and `dailyPlayed` (the day of the last attempt).
- Supabase: the `mode` check constraint becomes a pattern (`rogue` or `daily:<date>`); re-run
  `supabase/leaderboard.sql` once (safe to re-run).

## Open questions

- Should the daily run also be a fixed field width so the formations match exactly?
- Weekly boards (M11 open item) follow the same shape: `weekly:<YYYY-Www>`.
