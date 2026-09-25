# Rhythm timing and latency: hit windows, Web Audio clocks, input and display lag

Date: 2026-09-25. Scope: why the beat judgement and the beat visuals in Space Alliance feel slightly off, and what to change.

## Code this was checked against

- `src/audio/engine.ts`: `heardTime = ctx.currentTime - ctx.outputLatency - 12 ms` (warble delay line). Both judging and `currentBeat()` read it.
- `src/audio/rhythmJudge.ts` + `RHYTHM.windowSec = 0.07`: a shot is on-beat when |delta| <= 70 ms.
- `src/view/beatJudge.ts`: PERFECT <= 35 ms, GOOD <= 70 ms, otherwise OFF.
- `src/view/beatTrack.ts`: markers reach the gate at `engine.currentBeat()`, which is sampled at render time.
- `src/input/keyboard.ts`: judges when the `keydown` handler runs and ignores `event.timeStamp`.
- `src/scenes/calibrationScene.ts` / `src/meta/calibration.ts`: tap along to a 120 BPM click and store the median delta as one `latencyOffsetMs`. That offset shifts judging only, not the visuals.

Note: while this was being written, the working tree already had in-progress edits to `engine.ts` and `app.ts`: a `sync` smoother, `heardTime(perfMs)`, `VISUAL_LEAD_SEC`, and `judgeFire(offset, timeStamp)`. The recommendations below agree with that direction.

## 1. Hit windows in popular rhythm games

All values are ± around the note.

| Game | Tightest | Middle | Loosest hit | Source |
|---|---|---|---|---|
| osu! (OD 5) | 300: 50 ms | 100: 100 ms | 50: 150 ms | [osu! wiki](https://osu.ppy.sh/wiki/en/Gameplay/Judgement/osu%21) (formula 80−6·OD / 140−8·OD / 200−10·OD) |
| osu! (OD 8) | 32 ms | 76 ms | 120 ms | same |
| Etterna J4 (default) | Marvelous 22.5 | Perfect 45 / Great 90 | Good 135, Bad 180 | [etterna crate judge.rs](https://docs.rs/etterna/latest/src/etterna/judge.rs.html), [Etterna wiki](https://wiki.etternaonline.com/doku.php?id=timingwindows) |
| ITG | Fantastic 21.5 | Excellent 43 / Great 102 | Decent 135, Way Off 180 | [ZIv thread](https://zenius-i-vanisher.com/v5.2/thread?threadid=9728) (community-derived) |
| DDR A (community estimate) | Marvelous 16.7 | Perfect 33 / Great 92 | Good 142, Boo 225 | [ZIv thread](https://zenius-i-vanisher.com/v5.2/thread?threadid=9728), [StepMania forum](https://www.stepmania.com/forums/general-questions/show/586) |
| Rift of the NecroDancer | Super perfect 7.5 | Perfect 37.5 | n/a | [Steam discussion](https://steamcommunity.com/app/2073250/discussions/0/600770015625551529) (player report) |
| Crypt of the NecroDancer | n/a | n/a | about ±half a beat (±250 ms at 120 BPM) | [NecroDancer wiki: Sub-beat mechanics](https://crypt-of-the-necrodancer.fandom.com/wiki/Sub-beat_Mechanics) |
| Rhythm Doctor | "hard hit" range about ±40 ms | n/a | n/a | [Steam calibration guide](https://steamcommunity.com/sharedfiles/filedetails/?id=2716696968) |

Takeaways:
- In the rhythm-core games (Etterna, ITG, DDR), the top grade sits at about ±17–23 ms, the "good hit" band at about ±33–50 ms, and a hit still counts out to about ±90–180 ms.
- Casual games where rhythm is secondary to moving through the game are far looser. NecroDancer accepts anything closer to the current beat than to the next one. Hi-Fi Rush lets attacks auto-sync and only rewards good timing with bonus damage; its Easy mode loosens timing further ([GameSpot review](https://www.gamespot.com/reviews/hi-fi-rush-review-good-vibes-only/1900-6418023/), [Can I Play That](https://caniplaythat.com/2023/04/11/hi-fi-rush-update-addresses-qte-accessibility/)). I found no official ms figure for Hi-Fi Rush.
- Space Alliance's ±70 ms "on-beat" window is about the width of osu! OD 8's 100 window. That is mid-tight for a player who is also aiming and dodging. PERFECT at ±35 ms is close to Etterna/ITG "Perfect/Excellent" (±43–45 ms). Those are rhythm-core values.

## 2. Web Audio timing accuracy

- **`currentTime` moves in steps.** The spec says it "is updated by the rendering thread in uniform increments, corresponding to one render quantum" (128 frames, about 2.9 ms at 44.1 kHz) ([W3C Web Audio](https://www.w3.org/TR/webaudio-1.1/)). In practice it moves once per hardware callback. In Chromium, a 512-frame platform buffer makes `currentTime` advance 4 quanta at once ([Chromium CL 2060833002](https://codereview.chromium.org/2060833002)), which is a step of about 10.7 ms at 48 kHz. On macOS with AirPlay output, Chromium has shown `currentTime` stalling for about 0.5 s after resume ([crbug 41302928](https://issues.chromium.org/issues/41302928)). Firefox chose not to interpolate `currentTime` either ([bug 901247](https://bugzilla.mozilla.org/show_bug.cgi?id=901247)). Chrome and Safari add no timer coarsening to it ([MDN currentTime](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/currentTime)).
  - Effect on Space Alliance: `currentBeat()` sampled at 60 fps goes up in 3–11 ms steps, so markers visibly judder. A press judged against a stale `currentTime` picks up the same amount of error.
- **`outputLatency`** is the time from the UA handing a buffer to the OS until the first sample reaches the device ([W3C](https://www.w3.org/TR/webaudio-1.1/), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/outputLatency)).
  - Support: Firefox 70 ([bug 1324552](https://bugzilla.mozilla.org/show_bug.cgi?id=1324552)), Chrome 102, Safari 18.4 (Baseline March 2025) ([caniuse](https://caniuse.com/mdn-api_audiocontext_outputlatency)).
  - WebKit returns 0 while the context is not running, and returns a fixed 512/sampleRate when fingerprinting protection is on ([WebKit AudioContext.cpp](https://github.com/WebKit/webkit/blob/main/Source/WebCore/Modules/webaudio/AudioContext.cpp)).
  - Drivers can misreport it, and it can change without any event ([Paul Adenot](https://blog.paul.cx/post/audio-video-synchronization-with-the-web-audio-api/)). Read it every time, never cache it, and treat it as an estimate.
- **`baseLatency`** covers processing inside the context. Firefox always reports 0 ([Adenot](https://blog.paul.cx/post/audio-video-synchronization-with-the-web-audio-api/)).
- **`getOutputTimestamp()`** returns `{contextTime, performanceTime}`: the sample frame the device is currently outputting, and when that happened on the `performance.now()` clock ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/getOutputTimestamp)). Baseline since April 2021.
  - In Firefox, output latency is already included: `outputLatency*1000 ≈ now − performanceTime`.
  - Chrome's values were reported to fluctuate ([WebAudio issue #2461](https://github.com/WebAudio/web-audio-api/issues/2461)).
  - Apple platforms have had a bug where `contextTime` came back about 10,000× too small ([Apple forums](https://developer.apple.com/forums/thread/696356)).
  - Conclusion: cross-browser semantics are inconsistent, so sanity-check the values before using them. `contextTime + (performance.now() − performanceTime)/1000` gives a smooth clock ([wavesurfer #1007](https://github.com/katspaugh/wavesurfer.js/issues/1007)).
- **Smoothing that works everywhere.** Rhythm Quest has the same stepped-clock problem with Unity's `dspTime`. It fixes it with a rolling 15-sample linear regression that maps a smooth game clock to DSP time, then reads the smoothed value ([Rhythm Quest devlog 4](https://rhythmquestgame.com/devlog/04.html)). On the web, the same idea is: sample `(performance.now(), currentTime)` each frame, fit or slew a line, and read `line(performance.now())`.
- **Bluetooth.** AirPods over AAC measure roughly 150–220 ms, and the figure drifts during the first 20–30 min ([Apple dev forums](https://developer.apple.com/forums/thread/679274)). osu! players on Bluetooth report needing +80 to +250 ms ([osu! forum](https://osu.ppy.sh/community/forums/topics/2176758)). Where `outputLatency` is supported it should cover most of this, but a manual offset is still needed.

## 3. Input timing

- `Event.timeStamp` records when the event was created. It uses the same origin as `performance.now()` and is coarsened to 0.1 ms in Chrome and 1 ms in Firefox and Safari. With Firefox's resistFingerprinting it can be as coarse as 16.7 ms ([MDN Event.timeStamp](https://developer.mozilla.org/en-US/docs/Web/API/Event/timeStamp)).
- The Event Timing spec treats `timeStamp` as the hardware input time and defines input delay as `processingStart − timeStamp` ([W3C Event Timing](https://www.w3.org/TR/event-timing/), [explainer](https://github.com/w3c/event-timing)). Handler time therefore overstates lateness by however long the main thread was busy (Pixi render, sim steps, GC). That can be several ms and sometimes more than a frame.
- Keyboard hardware adds 15–60 ms (median about 30 ms) before the OS sees the key ([Dan Luu](https://danluu.com/keyboard-latency/)). No API can see that part, so it can only be calibrated out, and it varies between keyboards.
- Chrome and Firefox align continuous events (pointermove) to rAF. keydown is discrete and is not listed as rAF-aligned ([Nolan Lawson](https://nolanlawson.com/2019/08/14/browsers-input-events-and-frame-throttling/)).
- Back-dating: convert `event.timeStamp` to audio time with the same smoothed mapping, i.e. `audioAt(timeStamp)`. Reject ages that are negative or implausibly large (clock skew, or events queued during a tab switch).

## 4. Display latency and separate offsets

- A rAF-drawn canvas typically reaches the glass one or more frames after the callback because of double buffering and the compositor queue. Chrome's `desynchronized` canvas hint exists specifically to skip that queue ([Chrome blog](https://developer.chrome.com/blog/desynchronized)). Rhythm Quest lists double-buffering and monitor processing as the causes of visual latency ([devlog 10](https://rhythmquestgame.com/devlog/10.html)). I found no authoritative cross-browser photon measurement, so treat "about 1–3 frames (17–50 ms at 60 Hz)" as an engineering estimate that needs a user-facing trim.
- Tolerance is asymmetric. Viewers first notice sound arriving early at about 45 ms and sound arriving late at about 125 ms ([ITU-R BT.1359](https://www.itu.int/dms_pubrec/itu-r/rec/bt/R-REC-BT.1359-1-199811-I!!PDF-E.pdf)). Visuals that lag audio are the more noticeable error, which is the current failure mode because visuals are drawn for "now" and shown later.
- Rhythm games split the offsets:
  - StepMania/Etterna have `GlobalOffsetSeconds` (audio/judging) and a separate `VisualDelaySeconds` ([StepMania forum](https://www.stepmania.com/forums/general-questions/show/1673), [Etterna metrics.ini](https://github.com/etternagame/etterna/blob/master/Themes/_fallback/metrics.ini)).
  - Rhythm Doctor calibrates audio/video sync first, then measures input with a tap test ([Rhythm Quest devlog 10](https://rhythmquestgame.com/devlog/10.html), [Steam](https://steamcommunity.com/app/774181/discussions/0/3200370144982666969/)).
  - osu! lazer exposes an audio/visual offset that does not change judging ([ppy/osu discussion #20365](https://github.com/ppy/osu/discussions/20365)). Stable's universal offset shifts the audio against everything else ([osu! wiki](https://osu.ppy.sh/wiki/en/Offset/Universal_offset)).
- Calibration theory ([Rhythm Quest devlog 10](https://rhythmquestgame.com/devlog/10.html)):
  - Tapping to audio measures audio latency + input latency.
  - Tapping to a visual measures video latency + input latency.
  - Subtracting the two gives the A/V offset.
  - Rhythm Quest calibrates A/V by eye, because "the eye is very keen" at comparing flashes, and lets players absorb their remaining input lag naturally.

## Recommendations for Space Alliance

1. **Windows.** Rhythm is secondary to aiming and dodging here, so widen the windows:
   - On-beat (counts for the multiplier): `RHYTHM.windowSec = 0.10` (±100 ms). That equals osu! OD 5's 100 window and is about 1/5 of a beat at 120 BPM.
   - PERFECT: ±45 ms (Etterna J4 Perfect / ITG Excellent). GOOD: ±100 ms. OFF: beyond that.
   - Cap the window at 0.25 beat so it cannot swallow sub-beats at the sped-up endless BPMs.
   - Optionally add an "Easy timing" setting at ±130 ms, following Hi-Fi Rush's approach.
2. **Clock.** Don't depend on `getOutputTimestamp()` alone, because its behaviour differs across browsers and has an Apple bug. Instead:
   - Keep a smoothed map from `performance.now()` to `currentTime`. Every frame, sample the pair and slew a linear model with rate 1 whose offset only moves toward the new samples (or run a Rhythm Quest-style regression over about 15 samples). Snap on resume, seek, or errors over about 50 ms.
   - Subtract `outputLatency` freshly on every read.
   - `getOutputTimestamp()` is fine as an optional cross-check: if `contextTime` is not within about 0.5 s of `currentTime`, ignore it.
   - The in-progress `sync.sample`/`sync.at` in `engine.ts` is this approach. Keep it.
3. **Back-date presses.** Judge at `heardAt(event.timeStamp)`, not at handler time. Apply this to keyboard, pointer, and touch input, and to calibration taps. Clamp the accepted age to 0–100 ms and fall back to now outside that range. (`app.ts` already passes `timeStamp`, so confirm that keyboard.ts forwards `e.timeStamp`.)
4. **Visual lead.** Draw beat visuals for the time at which the frame will be *seen*: `beatAt(heardTime(now) + VISUAL_LEAD_SEC)` with a default of about 0.025 s (1.5 frames at 60 Hz). Add the user's visual trim on top.
   - Also drive the beat track from the rAF timestamp (or `performance.now()` read once per frame) through the smoothed map, so markers move evenly between audio callbacks.
5. **Split calibration.** Store two numbers:
   - `inputOffsetMs`, as today: tap along to the click with audio only, using back-dated timestamps. This one shifts judging.
   - `visualOffsetMs`: a flash-vs-click alignment screen where the player nudges with ←/→ until the gate flash lands on the tick (the Rhythm Quest / osu! wizard style). This one shifts only rendering (`VISUAL_LEAD_SEC + visualOffsetMs`) and never judging.
   - Show a hint when `outputLatency` exceeds 100 ms (likely Bluetooth).
   - Keep the median-of-8 method, but show a live early/late histogram in the run results (Rhythm Doctor community practice) so players can fine-tune.
6. Show early/late (sign) next to GOOD/OFF so players can tell a systematic offset from sloppiness.
