# M13 — Retire the Beat Run, add Beat Lock

## Why

Since M9 the beat mechanic lives inside the main run as beat stages (stage 3 of every world, x8, power shots, ranks).
The separate BEAT RUN duplicated that with a second table, a second title-screen page and a `mode` branch in the sim
(hurtbox, graze, streak, stage bonus). Fewer modes, clearer game: one run, one table.

Rhythm purists keep a home: **BEAT LOCK** (Settings) makes every stage of the run a beat stage.

## Design

- Title menu: START RUN, HANGAR, SHOP, SETTINGS. One high score table (title page cycle: tagline, table).
- `RunMode` and `SimState.mode` are gone; every run is a rogue run (`SimState.rogue` is no longer nullable).
  `BeatMode` is `'off' | 'master'` (`classic` had no producer left).
- **Beat Lock** (`settings.beatLock`, default off): every stage, bosses included, is a beat stage. Off-beat
  shots cost two levels, hits and grazes do not build the streak, PERFECT shots are power shots, S/A ranks
  still earn drafts. Scores go on the same table: the cap is x8 everywhere but the streak only comes from
  timing, so it is a higher-skill, higher-ceiling way to play rather than a separate game.
- Save v3: drops the `highscores` (beat run) table; v1/v2 saves migrate silently. Adds `settings.beatLock`.
- Leaderboard: boards are keyed by a `Board` id (`'rogue'` for now, more later); the `rhythm` board is
  no longer fetched. Old `rhythm` rows stay in Supabase and are ignored (the SQL constraint is unchanged).
- Credits: `creditMultiplier(save)` always applies SALVAGE.

## Open questions

- Should Beat Lock runs be tagged on the leaderboard (a `beatlock` column or a marker) once playtests show
  whether x8-everywhere out-scores the streak game?
