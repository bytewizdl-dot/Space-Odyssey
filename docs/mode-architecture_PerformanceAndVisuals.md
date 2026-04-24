# Architecture: Performance & Visuals (FR-007 & FR-008)

**Date:** 2026-04-24
**Architect:** VibeCode Architect

## Overview

This architecture document covers two major future enhancements to Project SPOILER: **120fps Object Pooling (FR-007)** and **Enhanced Visuals & Shaders (FR-008)**. These upgrades aim to eliminate Garbage Collection (GC) stutters during extreme "Adrenaline Surge" bullet hell moments and introduce a stunning, lightweight "High-End Bloom" effect without relying on expensive full-screen filters.

## Goals

- **Zero Allocations Mid-Game:** Pre-allocate all high-frequency entities (`LaserBullet`, `EnemyBullet`, `Particle`) during the loading phase.
- **Maintain Lock at 50-90fps+:** Prevent memory sawtooth patterns to ensure buttery-smooth performance.
- **Modern Lighting:** Introduce localized, pre-rendered glow sprites using additive blending (`lighter`).
- **Scalability:** Ensure the object pooling system allows for expanding max entity counts if needed.

## Non-Goals

- Replacing the entire rendering engine with WebGL/Three.js.
- Implementing realistic dynamic lighting or shadows.
- Modifying enemy spawning logic (already handled by FR-006).

## Architecture

### 1. Object Pooling System (FR-007)

Instead of using `new Object()` and `.splice()` dynamically, we will maintain two arrays for each entity type: `active` and `dead`.
Or, more efficiently, pre-allocate a fixed-size array and manage `active` flags, maintaining an index or "Dead" stack for O(1) retrieval.

**Data Flow:**
1. **Init:** Generate arrays of pre-instantiated objects (e.g., `LaserPool = []`, `ParticlePool = []`). Fill them with deactivated instances.
2. **Spawn:** Instead of `new LaserBullet(...)`, call `LaserPool.get(x, y, angle)`. This pops a dead instance from the pool and resets its state.
3. **Update:** Only loop over the `active` list or objects with `active == true`.
4. **Die:** Instead of `array.splice()`, mark the object as dead (`active = false`) and push it back to the `Dead` stack.

### 2. Enhanced Glow Sprites (FR-008)

Instead of using `ctx.filter = 'blur(10px)'`, which forces the browser to do a heavy convolution pass over the canvas, we will pre-render a radial gradient to an offscreen canvas at startup and draw it behind glowing objects.

**Rendering Pipeline:**
1. Generate `glowSpriteCore` (cyan/blue) and `glowSpriteEnemy` (orange/red) during `preRenderAssets()`.
2. Inside the entity's `draw()` method, enable `ctx.globalCompositeOperation = 'lighter'`.
3. Draw the glow sprite.
4. Revert `ctx.globalCompositeOperation = 'source-over'`.
5. Draw the actual laser/particle sprite.

## Data Models

### Pool Manager

```javascript
class ObjectPool {
  constructor(ObjectCreator, size) {
    this.pool = []; // Dead objects
    this.active = []; // Alive objects
    
    // Pre-allocate
    for (let i = 0; i < size; i++) {
      this.pool.push(ObjectCreator());
    }
  }

  get(...args) {
    if (this.pool.length > 0) {
      let obj = this.pool.pop();
      obj.spawn(...args); // Reset state
      this.active.push(obj);
      return obj;
    }
    // Optional: Expand pool if empty
    return null;
  }

  recycle(obj) {
    obj.active = false;
    this.pool.push(obj);
  }
}
```

### Entity Additions

```javascript
// Additions to Bullet / Particle Classes
class LaserBullet {
  constructor() {
    this.active = false;
    // ... basic init
  }
  
  spawn(x, y, angle) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.active = true;
    this.dead = false;
  }
}
```

## Implementation Plan

### Phase 1: Glow Sprites (FR-008)
- [ ] Add `glowSprite` and `glowSpriteEnemy` rendering logic to `preRenderAssets()`.
- [ ] Update `LaserBullet.draw()`, `EnemyBullet.draw()`, and `Particle.draw()` to draw the glow sprite behind themselves using `lighter` composite operation.
- [ ] Add a `gameSettings.bloomEnabled` toggle to completely bypass glow drawing for low-end devices.

### Phase 2: Refactoring Entities for Pooling (FR-007)
- [ ] Update `LaserBullet`, `EnemyBullet`, and `Particle` classes to separate `constructor` (one-time setup) from `spawn` (state reset).
- [ ] Ensure all properties (timers, velocities, health) are explicitly reset in `spawn()`.

### Phase 3: Implementing the Pools
- [ ] Instantiate `playerLaserPool`, `enemyBulletPool`, and `particlePool` at startup.
- [ ] Replace all instances of `missilesArray.push(new LaserBullet(...))` with pool retrievals.
- [ ] Replace `.splice(i, 1)` garbage collection in the main loop with `recycle(obj)` calls.

## Open Questions

- What should be the initial pool sizes? (e.g., 200 Player Lasers, 1000 Particles, 500 Enemy Bullets)
- Should the pool automatically expand if we run out of objects, or just ignore new spawns (drop frames vs drop bullets)?
- Will the `lighter` composite operation cause performance drops on older mobile devices, and should it be disabled by default?
