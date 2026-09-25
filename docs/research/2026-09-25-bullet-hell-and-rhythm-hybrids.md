# Bullet-hell elements, roguelite structure, and optional-beat modes

Date: 2026-09-25
Question: Should Space Alliance add (a) bullet-hell (danmaku) elements, (b) a roguelite run structure, and (c) a separate mode for the beat mechanic, given that players often play with the sound off and the game plays differently without it?

Context: Space Alliance is a neon Space-Invaders-style shooter with a deterministic 60 Hz sim. The player moves only in a bottom zone. Shots on the beat build a multiplier up to x4, and off-beat shots make the music go sour. Formations sway and morph on the beat. There are 3 worlds × 5 stages with bosses, then an endless loop.

Source quality: community wikis (Touhou Wiki, Shmups Wiki, official game wikis) and developer interviews in trade press are the best sources available. I found no GDC talk dedicated to danmaku pattern readability. Where a claim comes from a fan wiki or a review rather than the developer, it is marked *(secondary)*.

---

## 1. Bullet-hell design fundamentals

### Hitbox smaller than the sprite
- Touhou player hitboxes are about 5 px across, much smaller than the character sprite. Bullets also have hitboxes smaller than their graphics, and larger bullets have a proportionally larger "safe" margin. https://en.touhouwiki.net/wiki/Hitbox
- Boghog's shmup guide says players track their ship's position from their own shot stream rather than by looking at the ship. It recommends generous player-shot hitboxes and enemy hurtboxes, plus perfectly centered player hitboxes. https://shmups.wiki/library/Boghog's_bullet_hell_shmup_101
- Soundodger's arrow bullets have hitboxes much smaller than they look, placed at the tip rather than the center. *(secondary)* https://www.pcgamesn.com/indie/soundodger-glorious-minimalist-music-based-bullet-hell

### Focus / slow mode
- In Touhou, holding Shift slows movement, shows the hitbox (from Perfect Cherry Blossom on), and concentrates fire. Focus also shows a graze radius and an item-collection radius. https://en.touhouwiki.net/wiki/Hitbox , https://en.touhouwiki.net/wiki/Graze

### Graze
- Touhou counts a graze when a bullet overlaps the sprite but misses the hitbox, with a distinct sound and particle pop. How much graze is worth varies a lot between entries. Embodiment of Scarlet Devil makes it central to cancel value, Mountain of Faith removed any reward, and Legacy of the Lunatic Kingdom lets you "farm" graze from a lingering bullet. https://en.touhouwiki.net/wiki/Graze
- Danmaku Unlimited 3 makes graze the multiplier. The graze counter *is* the score multiplier, a graze gauge drains when you stop grazing (and resets the counter when empty), and grazing fills a Hyper gauge that triggers "Trance". *(secondary)* https://toucharcade.com/2017/09/14/danmaku-unlimited-3-review/ , https://shmups.wiki/library/Danmaku_Unlimited_3

### Pattern types and composition
- The three basic families are **aimed** (reacts to the player's position and forces movement), **static** (preset trajectories the designer fully controls), and **random** (needs care to stay fair). A classic combination pairs static and aimed: the aimed bullets force the player to move, and the static field makes moving harder. https://shmups.wiki/library/Boghog's_bullet_hell_shmup_101
- Grid and line patterns are the most readable and feel fairest, but get monotonous. Rotating a ring's angle over time keeps flower and spiral patterns from being trivial. *(secondary)* https://note.com/npaka/n/n5d38b7d84173?hl=en
- "There should always be a way out": design every formation so a route through is guaranteed. https://www.gamedeveloper.com/design/the-anatomy-of-a-shmup

### Density and speed budgets
- Bullet count does not equal difficulty. Many bullets can be easy if the gaps are clear, and a few well-timed or accelerating bullets can be brutal. https://sparen.github.io/ph3tutorials/ddsga4.html
- Speed changes the kind of dodging. Fast bullets need wide attention (**macrododging**, moving far around a formation). Slow bullets from several directions need focus on a small area (**micrododging**). Negative space comes from firing spawners in sequence rather than all at once, and the gaps become visible paths. https://sparen.github.io/ph3tutorials/ddsga4.html
- Large play areas push designers toward very high projectile counts. *(Relevant: Space Alliance's playfield width follows the screen, so ultra-wide screens need a width-scaled density budget.)* https://shmups.wiki/library/Boghog's_bullet_hell_shmup_101

### Readability and telegraphing
- Use high-contrast bullets (bright core, dark rim), "chunk" bullets into lines, and draw small fast bullets on top of big slow ones. https://shmups.wiki/library/Boghog's_bullet_hell_shmup_101
- Bullets whose sprite points along their direction of travel make patterns readable at a glance. https://sparen.github.io/ph3tutorials/ddsga2.html
- Housemarque (Returnal): enemy animations must make it certain when an attack is building up. https://www.thesixthaxis.com/2021/02/25/returnal-housemarque-ps5-interview-bullet-hell-roguelike-third-person/

### Bullet cancel as a reward
- On player death, clear the bullets and give a few seconds of invulnerability, so one mistake doesn't cascade into several deaths. https://shmups.wiki/library/Boghog's_bullet_hell_shmup_101
- In DoDonPachi DaiFukkatsu, a Hyper lets your shot cancel bullets, and cancelled bullets feed the combo gauge. In SaiDaiOuJou exA, activating a Hyper cancels all bullets on screen into score Stars, and rank rises with Hyper use (a risk/reward loop). SaiDaiOuJou deliberately dropped Hyper bullet-cancelling to focus on "raw bullet dodging". https://shmups.wiki/library/DoDonPachi_DaiFukkatsu , https://shmups.wiki/library/DoDonPachi_SaiDaiOuJou_exA_Label , https://en.wikipedia.org/wiki/DoDonPachi_SaiDaiOuJou
- Ikaruga: same-color bullets are absorbed and charge a homing-laser meter, opposite-color bullets kill you, and opposite-polarity shots do double damage. Chains require killing enemies of one color in groups of three. Director Iuchi cut the color count from Radiant Silvergun's three to two to simplify chaining and put more weight on aimed shots. https://en.wikipedia.org/wiki/Ikaruga , https://shmuplations.com/ikaruga/
- Danmaku Unlimited 3 Spirit mode: a killed enemy's bullets turn into harmless "spirit" bullets that count as grazes when touched. That creates a deliberate "let them fire, then kill them" tension. *(secondary)* https://toucharcade.com/2017/09/14/danmaku-unlimited-3-review/

---

## 2. Shmup and bullet-hell roguelite hybrids: upgrade models

| Game | Upgrade model | Source |
|---|---|---|
| **Enter the Gungeon** | Guns and items drop from loot. Defense is a dodge roll with i-frames (inspired partly by Ikaruga's polarity) plus **Blanks**: a separate button that clears all bullets in the room and briefly stops enemies firing, topped back up to 2 per chamber. | https://en.wikipedia.org/wiki/Enter_the_Gungeon , https://enterthegungeon.wiki.gg/wiki/Blank |
| **Nova Drift** | XP-driven level-ups. Each level lets you either swap one of three **Gear** slots (Weapon / Body / Shield, one of each) or buy a permanent **Mod**. Mods are unlimited, stay when you swap Gear, and often trade a downside for power. Super Mods sit on top. | https://nova-drift.fandom.com/wiki/Basics , https://nova-drift.fandom.com/wiki/Gears |
| **Tyrian** | Shop between levels. Front and rear weapon slots, each upgradable 10 times at exponential cost. A **generator** limits weapon power. Arcade Mode removes the shop in favor of in-level pickups. | https://tyrian.fandom.com/wiki/Full_Story_Mode , https://tyrian.fandom.com/wiki/Arcade_Mode |
| **Jets'n'Guns** | Almost everything happens in the between-mission shop (few in-level pickups). Many slots, and items resell at **full price**, so experimenting costs nothing. Income comes from kills, which rewards firepower early. *(secondary)* | https://www.hardcoregaming101.net/jets-n-guns/ , https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/JetsNGuns |
| **Returnal** | Pitched as "bullet hell, arcade adventure, enriched with roguelike elements". Each biome has its own enemies, hazards and "flavours of bullet hell patterns". Each biome boss uses all the tricks introduced earlier in it. | https://www.thesixthaxis.com/2021/02/25/returnal-housemarque-ps5-interview-bullet-hell-roguelike-third-person/ , https://mobilesyrup.com/2021/02/25/returnal-ps5-housemarque-interview/ |
| **Monolith** (Team D-13) | Hand-built rooms arranged procedurally, so no unbeatable room can be generated. More generous than traditional shmups (guaranteed health, regenerating bombs). Runs under 30 minutes. | https://www.gamedeveloper.com/design/mixing-bullet-hell-shmup-with-roguelike-in-team-d-13-s-i-monolith-i- |

Patterns that recur across these games:
1. A **panic button** that cancels bullets (Gungeon Blanks, Monolith bombs) is standard once density rises.
2. **Short runs** with authored content arranged procedurally.
3. **Biome identity through pattern flavor**, with bosses as the final exam for each biome.
4. **Trade-off mods** rather than flat stat boosts. Nova Drift's "swap one core slot or add one mod" choice is a compact model.

---

## 3. Rhythm-action hybrids and optional-beat design

### How strict is the beat?
- **Crypt of the NecroDancer.** Designer Ryan Clark says he widened the beat window a lot during development because under stress the precision requirement was just frustrating. He wanted the challenge to come from tactics, not timing accuracy. He also added **autocalibration** that nudges the beat position toward the player's actual timing, so players don't get "MISS" when they felt on-beat. https://www.gamedeveloper.com/audio/game-design-deep-dive-finding-the-beat-in-i-crypt-of-the-necrodancer-i-
- NecroDancer offers two off-ramps from the rhythm. The **Bard** character (enemies act only when you act, and songs loop forever) is available from the start. v3.0 (2022) added **No Beat Mode**, which gives Bard-style play to any character. Using it through custom rules disables achievements. https://necrodancer.miraheze.org/wiki/Bard , https://www.pcgamer.com/rhythm-roguelike-crypt-of-the-necrodancer-gets-massive-update-after-5-year-hiatus/ , https://cogconnected.com/2022/07/crypt-of-the-necrodancer-no-beat-mode/
- **BPM: Bullets Per Minute.** **Auto-rhythm** buffers your input and performs it on the next beat, plus a loose/strict detection setting and a slowed practice mode. One reviewer argued auto-rhythm "kills the novelty" and turns it into a regular shooter. https://www.familygamingdatabase.com/en-us/accessibility/BPM+Bullets+Per+Minute , https://news.xbox.com/en-us/2021/10/04/rhythm-action-roguelike-bpm-bullets-per-minute-available-now/ , https://onemoregame.ph/2021/10/bpm-bullets-per-minute-review/
- **Metal: Hellsinger.** The Fury multiplier (1x–16x) scales damage and score and adds layers to the music. Off-beat shots do reduced damage and reset the hit streak, and taking damage lowers Fury. Dashes and reloads on the beat also build Fury. The November 2022 accessibility patch added **Beat Assist** ("always on beat, no penalties", which removes you from leaderboards) and a color picker for the rhythm indicator. https://metalhellsinger.wiki.gg/wiki/Tutorials , https://techraptor.net/gaming/news/metal-hellsinger-accessibility-update-is-totally-metal , https://x.com/MetalHellsinger/status/1587444615694671879
- **Hi-Fi Rush.** Director John Johanas says they rejected "miss the beat, nothing happens" as frustrating. Animations always land on the beat whatever the input timing. You are rewarded for playing with the music but "aren't punished". https://www.ungeek.ph/2023/02/full-interview-hi-fi-rush-director-john-johanas-on-the-games-development-and-surprise-reveal/ , https://www.digitaltrends.com/gaming/hi-fi-rush-john-johanas-interview/

### The music drives the attacks (dodge-only games)
- **Just Shapes & Beats.** Bullet hell with the shooting removed: the music drives the attacks and the player only dodges, with a dash that has i-frames. It began as a jam prototype. *(Dash i-frames: secondary.)* https://berzerkstudio.com/presskit/jsbpresskit/ , https://www.destructoid.com/just-shapes-beats-is-bullet-hell-without-the-shooter/ , https://justshapesandbeats.fandom.com/wiki/Game_Mechanics
- **Soundodger+.** Every bullet is hand-choreographed to the track. There is a slow-mo button for hard passages and a no-fail Zen mode. https://store.steampowered.com/app/247140/ , https://www.moddb.com/games/soundodger

### Playing without sound
- Accessibility guidelines: "Ensure no essential information is conveyed by sounds alone" (GAG Basic). Xbox XAG 103 says critical audio must be expressed through at least one other sense. Haptics can be *in addition to* visuals, never the only channel, because some controllers lack vibration. https://gameaccessibilityguidelines.com/basic/ , https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/103
- **Hi-Fi Rush** shows the beat in several places at once: Chai walks on the beat and the world bobs to it, 808 can act as a visual metronome (3 styles), and there is an optional beat bar. Johanas: "people see beats in different ways". The game also has Auto-Action and single-button modes. https://www.digitaltrends.com/gaming/hi-fi-rush-john-johanas-interview/ , https://support.krafton.com/hc/en-us/articles/52371575035801-Hi-Fi-RUSH-Accessibility-Settings , https://caniplaythat.com/2023/01/25/hi-fi-rush-drops-the-beat-and-an-accessibility-guide/
- **Metal: Hellsinger** players report using the visual indicator to start a combo and then following by ear. https://steamcommunity.com/app/1061910/discussions/0/4615641482998065798/
- **Thumper** is widely reported as playable by sight, because every obstacle is visible on the track. Some reviewers found sight *more* reliable than audio in loud sections. *(secondary)* https://unwinnable.com/2016/10/12/thumper-review-a-song-without-a-melody/ , https://www.appunwrapper.com/2018/07/03/thumper-pocket-edition-some-thoughts-on-accessibility/

### What these games have in common
1. Reward the beat, but don't make it a hard gate (NecroDancer's wide window, Hi-Fi Rush, Hellsinger's Beat Assist).
2. Offer a sanctioned no-beat path, usually fenced off from leaderboards or achievements (NecroDancer No Beat, Hellsinger Beat Assist, BPM auto-rhythm).
3. Show the beat visually in several places (world motion, a HUD bar, an optional metronome), with calibration.
4. With the beat removed, the game needs **another source of depth**. Otherwise it's "a regular shooter" (BPM review).

---

## Recommendations for Space Alliance

### A. Mode structure: two runs, separate leaderboards
**1. Rhythm Run** (the current game, and the flagship). On-beat shots → multiplier up to x4, and off-beat shots sour the music. Keep the beat track, the fire button that pulses on the beat, and the formation sway, which already follow the Hi-Fi Rush "world moves on the beat" approach. Add an **autocalibration nudge** in the NecroDancer style on top of the manual calibration. This mode stays the fixed 3 worlds × 5 stages campaign plus the endless loop.

**2. Arcade Run** (sound optional, and the roguelite home). There is no beat judging and no sour music, and the music is decorative. Formations can keep swaying on the beat because it reads well visually, but nothing is scored on it. **The multiplier comes from graze plus bullet-cancel**, following Danmaku Unlimited 3:
- A graze meter fills when an enemy bullet passes within a ring around the ship's (small, visible) hitbox. It drains over time, and when it is full the multiplier steps up (x1 → x4, the same cap as Rhythm so the score scales are comparable).
- Killing an elite or formation leader converts its live bullets into pickups that count as grazes, like DU3 Spirit mode. That creates the "let it fire, then kill it" tension.
- Taking a hit drops the multiplier one step rather than to zero. This matches Hellsinger's graded Fury loss and is less punishing on touch controls.

This follows the lesson from BPM's reviews: taking the beat out must *replace* the depth, not just delete it. Graze is the natural replacement because it rewards risky positioning, which is exactly what the Invaders core lacks.

A third, lower-priority option: a **"Beat Assist" toggle inside Rhythm Run** (every shot counts as on-beat, and the run is flagged or unranked), as Hellsinger does. It's cheap and helps players who want the music-reactive presentation without the timing test.

### B. Layering bullet-hell without overwhelming the Invaders core
- **Keep standard stages Invaders-first.** Popcorn formations fire sparse, **aimed** shots and occasional **static lines**. Budget roughly ≤ 30–40 enemy bullets on screen, scaled by playfield width. Treat this as a tuning target, not a sourced number: Sparen's point is that the spacing between bullets matters more than their count.
- **Put danmaku in elites and bosses.** Elites (one per stage from world 2 on) fire one readable signature pattern: a rotating ring with a gap, a spiral, or a wall with a gap. Bosses get 2–3 phases that combine a static field with aimed shots (Boghog's pairing). Each world gets its own pattern flavor, as Returnal gives each biome its own bullet-hell patterns: Earth orbit = lines and walls, Moon = rings and spirals, Mars = aimed plus static mixes.
- **Design for a bottom-zone player.** The player moves only in a strip, so favor **macrododge** patterns (walls with gaps, slow rings) and avoid dense micrododge clouds, which need full-screen freedom to be fair. Always guarantee a gap.
- **Readability:** bullets need a bright core and dark rim, and should point along their direction of travel. Draw enemy bullets above everything except the player hitbox. Enemy bullets must use a color the player's lasers never use. Telegraph patterns with a wind-up flash. **In Rhythm Run, fire patterns on the beat.** The music then works as an extra telegraph without being required, because the visual wind-up still carries the timing.
- **Hitbox:** make the player hitbox much smaller than the ship sprite and show it as a dot (always in Arcade, optional in Rhythm). A Touhou-style focus key (slow movement while held) is optional. Test first whether the bottom-zone constraint already covers it.
- **Mercy rules:** clear bullets on death and give 2–3 s of invulnerability. Consider one bullet-clearing "Blank" per stage (Gungeon/Monolith), refilled per stage.
- **Determinism:** make patterns data-driven emitters (angle, count, speed, spin, beat-lock flag) run by the 60 Hz sim with the seeded RNG. Rhythm Run can then beat-lock emission ticks while Arcade uses fixed timers, from the same data.

### C. Roguelite structure (Arcade Run first)
- **Map:** keep 3 worlds, and within each pick a branching route of about 5 nodes (normal / elite / shop / event → boss). Target runs under 30 minutes (Monolith). Build encounters by hand and arrange them procedurally, so no unwinnable combinations can come up.
- **Upgrades:** after each node, pick 1 of 3. Use Nova Drift's split: a few **core slots** (Weapon, Hull, Module) that you *swap*, plus unlimited **mods** that stack and often carry a downside (e.g. "+1 laser, −15% fire rate", "bigger graze radius, bigger hitbox"). Shops use Jets'n'Guns full-refund resale so experimenting feels free. Keep the existing cosmetic credit shop as meta progression, and don't add permanent power (so leaderboards stay fair).
- **Rhythm roguelite later:** once Arcade roguelite works, allow the same map in Rhythm Run with beat-themed mods (e.g. PERFECT shots pierce, OFF shots don't sour the music for one bar). Ship the structure in the sound-optional mode first, since that serves the players who can't play with audio.

### Suggested order
1. Visible hitbox, bullet cancel on death, and the data-driven emitter.
2. Arcade Run with the graze multiplier.
3. Elite and boss patterns per world.
4. Roguelite map and upgrades for Arcade.
5. Beat Assist toggle and autocalibration nudge.
6. Rhythm roguelite.
