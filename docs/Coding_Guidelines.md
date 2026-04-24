# Coding Guidelines for Space Odyssey

> "Code with the flow. Code with the vibe."

## Core Philosophy
1. **Performance First**: We are targeting a buttery smooth Canvas experience. Memory leaks and garbage collection stutters are the enemy.
2. **Organic Feel**: Hardcoded, linear transitions are forbidden. Use lerps, sine waves, and noise functions (like the `cameraBreathe` system) to make the game feel alive.
3. **No Frameworks**: We are building a pure, vanilla HTML5 Canvas engine. No React, no Three.js, just raw JavaScript.

## Architecture Rules

### 1. The Game Loop
- Use `requestAnimationFrame` exclusively.
- All drawing must happen inside `drawGame()`.
- All logic must happen inside `updateGame()`.
- Keep the `ctx.save()` and `ctx.restore()` strictly balanced. If you push a transform, pop it before the next entity draws.

### 2. Entity Management
- Avoid `new Object()` inside the game loop where possible. 
- Use object pooling for high-frequency entities like `LaserBullet` and `Particles`.
- Entities must have an `update()` and `draw()` method.

### 3. Audio Handling
- NEVER use `.cloneNode(true).play()` in rapid succession. It crashes the browser audio context.
- Use the `AudioMixer` class for all sound effects to ensure throttling and voice-stealing.
- Use `AudioManager.js` for BGM crossfading and state management.

### 4. Code Structure
- No `var`. Use `let` for mutable state and `const` for constants.
- Global variables should be kept to an absolute minimum. Group game state into objects (e.g., `game.level`, `game.surgePhase`).
- Keep classes isolated. `PlayerObject` should not directly manipulate the DOM.

### 5. UI and DOM
- The Canvas is for gameplay. Complex UI (Main Menu, Settings) should be overlaid using HTML/CSS.
- CSS transitions are preferred over JS animations for DOM elements.
- Never use `z-index: 99999` arbitrarily. Maintain a structured layer system in `Style.css`.
