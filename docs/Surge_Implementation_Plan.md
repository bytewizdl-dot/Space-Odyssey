# Project Space Odyssey: VibeCode Genesis Blueprint

## 1. What to Expect from this Visual & Scrolling Implementation
- **Visceral Speed Validation:** The player will no longer feel like they are scrolling over a static JPEG. The combination of Micro-Debris (Foreground), Kinetic Drag (Midground), and Parallax (Background) tricks the human brain into feeling immense physical speed by providing necessary depth cues.
- **Organic Combat Feedback:** Biological emissives and lightweight heat distortions will make enemies feel like dangerous, living entities rather than flat hitboxes.
- **Physical Weight:** The Spring-Damped Camera Lag will give the ship a profound sense of inertia, making acceleration feel heavy and deeply satisfying.

## 2. Core Gameplay Loop Perception & Replayability
Is this game fun to be replayable like *Left 4 Dead 2*? **Yes, because we are targeting the subconscious.** 
In L4D2, the "AI Director" manipulates tension (peaks of chaos and valleys of calm). In *Space Odyssey*, the **Adrenaline Surge** acts as our tension peak. By combining visual and kinetic feedback (screen shake, camera lag, warp stretching), we trigger a genuine physiological adrenaline response in the player. Replayability in arcade shooters isn't just about high scores; it's about the *craving* for that perfectly tuned sensory feedback loop. Players will replay just to experience the dopamine hit of surviving the Surge.

## 3. Implementation Strategy (Phased Approach)

### Phase 1: Early (Safe, Low-Risk, High-Impact)
These features are math-only, touching core variables without adding new draw layers.
- **Feature #6 (Relative Kinetic Drag):** Apply downward Y-velocity to all entities during Surge. (Fixes the "Treadmill Effect").
- **Feature #10 (Spring-Damped Camera Lag):** Implement `lerp` on the camera Y-offset during sudden acceleration/deceleration.
- **Feature #5 (Biological Emissives):** Add sine-wave alpha pulsing to enemy sprites to give them a "heartbeat."

### Phase 2: Mid (Moderate Complexity, Layering)
These features require managing new arrays or drawing additional canvas layers.
- **Feature #4 (Deep-Space Parallax & Haze):** Separate the background into multi-speed layers and draw subtle shadow masks beneath ships.
- **Feature #8 (Foreground Micro-Debris):** Create a highly-transparent `spaceDustArray` that moves extremely fast over the player ship to sell the speed illusion.
- **Feature #9 (High-Frequency Turbulence):** Implement a micro-shake (1-2 pixels max) using `Math.random()` offset during damage, heavy firing, or massive explosions.

### Phase 3: Final (Heavy/Advanced Features)
These are computationally intensive and require strict performance guarding.
- **Feature #3 (Heat Distortion - Lightweight Version):** *Crucial Restriction:* Instead of a full `getImageData` pixel displacement (which kills CPU), we will use overlapping, highly-transparent radial gradients (`ctx.globalCompositeOperation = 'overlay'` or `'color-dodge'`) scaled dynamically to simulate a shockwave ripple without actual pixel warping.
- **Feature #7 (Radial Edge-Stretching):** *Crucial Restriction:* ONLY implemented here in the final phase. We will draw dynamic line primitives (streaks) strictly at the extreme left/right edges of the canvas, scaling their length based on Surge speed. The center of the screen remains completely clear to prevent motion sickness.

## 4. Risks & Recommendations

### What Could Go Wrong
- **Feature #7 (Edge-Stretching) Performance Stall:** If we draw too many lines, the `ctx.beginPath()` overhead will stall the CPU. We must hard-cap the number of warp lines (e.g., max 40).
- **Feature #8 (Micro-Debris) Clarity Loss:** If the space dust is too bright, players won't be able to distinguish it from enemy bullets, leading to cheap deaths and frustration.
- **Feature #9 (Turbulence) Sickness:** Continuous screen shake will cause nausea. It *must* be tied to discrete events, NEVER a constant rumble during the Surge.

### What to Avoid
- **Avoid `getImageData` at all costs:** True displacement distortion is a trap in 2D Canvas. Stick to the additive blending tricks (Lightweight Feature #3) to fake it.
- **Avoid Uncapped Arrays:** The `spaceDustArray` and `warpLinesArray` must use the same `ObjectPool` architecture we built for bullets to prevent Garbage Collection stutters.

### Recommendations for "Peak Indie Arcade Feel"
- **Hit-Stop (Micro-Pause):** When a boss dies or the player takes critical damage, forcibly freeze the entire `requestAnimationFrame` loop for exactly 30ms-50ms before resuming. This adds devastating weight to impacts and is a hallmark of premium Japanese arcade design (e.g., *Street Fighter*, *Touhou*).
- **Audio-Visual Sync:** Tie the visual intensity (like the emissive heartbeat frequency or the camera shake amplitude) directly to the specific volume peaks managed by your `AudioMixer`.
