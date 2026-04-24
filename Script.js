

// === PLANET ASSETS ===
var planetImages = [];

var cockpitImg = new Image();
cockpitImg.onload = function () {
  console.log("Cockpit image loaded successfully!");
};
cockpitImg.onerror = function () {
  console.error("FAILED to load cockpit image!");
};
cockpitImg.src = "img/cockpit_family.png";


const DEBUG_HITBOX = false;



var canvasWidth = 1280;
var canvasHeight = 720;
var worldHeight = 900;
var c, ctx;
var gameStarted = false;


let vignetteCanvas = null;

let lastFrameTime = 0;
const frameInterval = 1000 / 90;

let cameraY = 0;

let respawnCounter = 0;
let damageFlash = 0;

let currentWave = null;
let waveCooldown = 0;

let abilityCharges = 1; // Starter Kit: 1 Bomb
let bombCooldown = 0; // Cooldown timer for bomb (2.5s)
let missileAmmo = 0;    // Starter Kit: 3 Missiles

// === CHAOS BALANCE SYSTEM ===
let grazeCount = 0;        // Total grazes this run
let grazeScore = 0;        // Bonus points from grazing
let swarmTimer = 0;        // Timer for swarm mode spawns
const SWARM_INTERVAL = 900; // ~10 seconds at 90fps

var game = {
  level: 1,
  speed: 1,
  gameOver: false,
  frames: 0,
  timer: 0,
  surge: 1.0,
  surgePhase: 0,
  surgeTimer: 0,
  // Surge Scheduler System
  surgeSchedulerState: 'INITIAL_COOLDOWN', // Start with 15s cooldown
  surgeSchedulerTimer: 1350, // 15s * 90fps
  surgeWindowTargetTime: 0,
  surgeWindowTimer: 0,
  surgeCooldown: 2400,
  // Ending Sequence State
  endingSequence: false,
  endingTimer: 0,
};

// Keys state
var keys = {
  up: false,
  down: false,
  left: false,
  right: false,
  fire: false,
};

// Mouse State
let mousePos = { x: 0, y: 0 };
let mouseButtons = { left: false, right: false };

window.addEventListener('mousemove', (e) => {
  if (gameSettings.inputMode === 'mouse') {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mousePos.x = (e.clientX - rect.left) * scaleX;
    mousePos.y = (e.clientY - rect.top) * scaleY;
  }
});

window.addEventListener('mousedown', (e) => {
  if (gameSettings.inputMode === 'mouse') {
    if (e.button === 0) mouseButtons.left = true;
    if (e.button === 2) {
      mouseButtons.right = true;
      if (!game.gameOver && !gamePaused && !player1.dead) {
        firePlayerMissile();
      }
    }
  }
});

window.addEventListener('mouseup', (e) => {
  if (gameSettings.inputMode === 'mouse') {
    if (e.button === 0) mouseButtons.left = false;
    if (e.button === 2) mouseButtons.right = false;
  }
});

// --- LOAD IMAGES ---
var playerShipImg = new Image();
playerShipImg.src = "img/Player/pesawat22.png";

// --- GAMBAR PICKUP SKILLS ---
var missilePickupImg = new Image();
missilePickupImg.src = "img/Skills/missile.png";

var laserPickupImg = new Image();
laserPickupImg.src = "img/Skills/double-missile.png";

// *** GAMBAR BARU UNTUK PICKUP BOMB ***
var bombPickupImg = new Image();
bombPickupImg.src = "img/Skills/bomb.png?v=" + new Date().getTime();

var livesImg = new Image();
livesImg.src = "img/Player/lives.png";

// SpellBomb Animation Sprite
var spellBombImg = new Image();
spellBombImg.src = "img/SpellBomb.png";

var bg0 = new Image();
bg0.src = "img/bg_0.png";
var bg1 = new Image();
bg1.src = "img/bg_1.png";
var bg2 = new Image();
bg2.src = "img/bg_2.png";

var enemyImgArray = [];
enemyImgArray.length = 4;



// Separate Click Listener for Game Over Restart
canvas.addEventListener('click', (e) => {
  if (game.gameOver && game.restartBtn) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    if (clickX >= game.restartBtn.x && clickX <= game.restartBtn.x + game.restartBtn.w &&
      clickY >= game.restartBtn.y && clickY <= game.restartBtn.y + game.restartBtn.h) {
      // Save score then reload
      submitScore(player1.score, game.level).then(() => {
        window.location.reload();
      });
    }
  }
});

for (var i = 0; i < enemyImgArray.length; i++) {
  enemyImgArray[i] = new Image();
  enemyImgArray[i].src = "img/SpritesShips/alien_" + [i] + ".png";
}

var missilesArray = [];
var playerMissilesArray = [];
var enemyShipArray = [];
var enemyBulletsArray = [];
var explosions = [];
var abilityTokens = [];
var particles = [];



// === OFFSCREEN BUFFERS (For high-end effects) ===
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d');

// === FORMATION MATH UTILITY (FR-006) ===
const FormationMath = {
  getSine: (time, freq, amp) => Math.sin(time * freq) * amp,
  getCircle: (time, freq, amp) => ({
    x: Math.cos(time * freq) * amp,
    y: Math.sin(time * freq) * amp
  }),
  getLissajous: (time, freqX, freqY, ampX, ampY) => ({
    x: Math.sin(time * freqX) * ampX,
    y: Math.sin(time * freqY) * ampY
  })
};


for (let i = 1; i <= 4; i++) {
  let img = new Image();
  img.src = `img/SpritesPlanet/planet_${i}.png`;
  planetImages.push(img);
}

let currentPlanet = null;

let laserSprite, enemyBulletSprite, missileSprite, enemyBulletSpriteGreen;
let glowSpriteCore, glowSpriteEnemy, glowSpriteEnemyGreen, glowSpriteEnemyPurple, glowSpriteEnemyBlue;

function preRenderAssets() {
  // === GLOW SPRITES (FR-008) ===
  const createGlowSprite = (innerColor, midColor, outerColor) => {
    const canvas = document.createElement("canvas");
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    let gradient = ctx.createRadialGradient(25, 25, 0, 25, 25, 25);
    gradient.addColorStop(0, innerColor);
    gradient.addColorStop(0.5, midColor);
    gradient.addColorStop(1, outerColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 50, 50);
    return canvas;
  };

  glowSpriteCore = createGlowSprite("rgba(0, 225, 255, 0.6)", "rgba(0, 100, 255, 0.2)", "rgba(0, 50, 255, 0)");
  glowSpriteEnemy = createGlowSprite("rgba(255, 100, 0, 0.6)", "rgba(255, 50, 0, 0.2)", "rgba(255, 0, 0, 0)");
  glowSpriteEnemyGreen = createGlowSprite("rgba(0, 255, 0, 0.6)", "rgba(0, 204, 0, 0.2)", "rgba(0, 255, 0, 0)");
  glowSpriteEnemyPurple = createGlowSprite("rgba(170, 0, 255, 0.6)", "rgba(170, 0, 255, 0.2)", "rgba(170, 0, 255, 0)");
  glowSpriteEnemyBlue = createGlowSprite("rgba(0, 136, 255, 0.6)", "rgba(0, 136, 255, 0.2)", "rgba(0, 136, 255, 0)");


  const lPad = 20;
  const lW = 13 + lPad * 2;
  const lH = 4 + lPad * 2;
  laserSprite = document.createElement("canvas");
  laserSprite.width = lW;
  laserSprite.height = lH;
  const lCtx = laserSprite.getContext("2d");

  let lg = lCtx.createLinearGradient(lPad, lPad, lPad + 13, lPad);
  lg.addColorStop(0, "#00e1ff");
  lg.addColorStop(0.5, "#ffffff");
  lg.addColorStop(1, "#00e1ff");

  lCtx.fillStyle = lg;
  lCtx.shadowColor = "#00ffff";
  lCtx.shadowBlur = 15;
  lCtx.fillRect(lPad, lPad, 13, 4);


  const ePad = 15;
  const eW = 10 + ePad * 2;
  const eH = 4 + ePad * 2;
  enemyBulletSprite = document.createElement("canvas");
  enemyBulletSprite.width = eW;
  enemyBulletSprite.height = eH;
  const eCtx = enemyBulletSprite.getContext("2d");

  let eg = eCtx.createLinearGradient(ePad + 10, ePad, ePad, ePad);
  eg.addColorStop(0, "#ff9900");
  eg.addColorStop(0.5, "#ffffff");
  eg.addColorStop(1, "#ff3300");

  eCtx.fillStyle = eg;
  eCtx.shadowColor = "#ff6600";
  eCtx.shadowBlur = 10;
  eCtx.fillRect(ePad, ePad, 10, 4);

  // === GREEN BULLET (For MiniBoss Spiral) ===
  enemyBulletSpriteGreen = document.createElement("canvas");
  enemyBulletSpriteGreen.width = eW;
  enemyBulletSpriteGreen.height = eH;
  const egCtx = enemyBulletSpriteGreen.getContext("2d");

  let egg = egCtx.createLinearGradient(ePad + 10, ePad, ePad, ePad);
  egg.addColorStop(0, "#33ff33");
  egg.addColorStop(0.5, "#ffffff");
  egg.addColorStop(1, "#00cc00");

  egCtx.fillStyle = egg;
  egCtx.shadowColor = "#00ff00";
  egCtx.shadowBlur = 10;
  egCtx.fillRect(ePad, ePad, 10, 4);


  const mPad = 5;
  const mW = 30 + mPad * 2;
  const mH = 12 + mPad * 2;
  missileSprite = document.createElement("canvas");
  missileSprite.width = mW;
  missileSprite.height = mH;
  const mCtx = missileSprite.getContext("2d");

  let mg = mCtx.createLinearGradient(mPad, mPad, mPad + 30, mPad);
  mg.addColorStop(0, "#00008b");
  mg.addColorStop(0.5, "#4169e1");
  mg.addColorStop(1, "#ffffff");

  mCtx.fillStyle = mg;
  mCtx.beginPath();
  mCtx.moveTo(mPad, mPad);
  mCtx.lineTo(mPad + 30, mPad + 6);
  mCtx.lineTo(mPad, mPad + 12);
  mCtx.fill();
}

window.onload = async function () {
  try {
    const res = await fetch('api/me.php');
    const data = await res.json();
    if (!data.ok || !data.user) {
      window.location.href = 'Login1.html';
      return;
    }
    console.log("Logged in as: " + data.user.username);
  } catch (e) {
    console.error("Auth check failed:", e);
    // If strict processing is needed, redirect here too
    // window.location.href = 'Login1.html';
  }

  init();
};

var playerLaserPool = null;
var enemyBulletPool = null;
var particlePool = null;

function init() {
  preRenderAssets();
  playerLaserPool = new ObjectPool(() => new LaserBullet(), 200);
  enemyBulletPool = new ObjectPool(() => new EnemyBullet(), 1000);
  particlePool = new ObjectPool(() => new Particle(), 2000);

  c = document.getElementById("canvas");

  ctx = c.getContext("2d", { alpha: false });

  c.width = canvasWidth;
  c.height = canvasHeight;

  document.addEventListener("keydown", keyDownPressed, false);
  document.addEventListener("keyup", keyUpPressed, false);

  document.addEventListener("contextmenu", (event) => event.preventDefault());

  gameStarted = true;
  pickRandomBGM();
  currentBGM.volume = BGM_VOLUME; // Use global constant
  if (gameSettings.musicEnabled) {
    currentBGM.play().catch(() => { });
  }

  requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
  if (!gameStarted) return;

  // Game over is now handled by endingSequence
  if (game.endingSequence) {
    clearGame();
    drawEndingSequence();
    return;
  }

  if (game.gameOver) {
    // This shouldn't happen anymore, but just in case
    clearGame();
    return;
  }

  if (timestamp - lastFrameTime >= frameInterval) {
    lastFrameTime = timestamp;

    if (!gamePaused) {
      clearGame();
      updateGame();
      drawGame();
    } else {
      // PAUSED STATE - Draw frozen game underneath
      clearGame();
      drawGame();

      // Update Fade Animation (Approx 90fps)
      if (pauseFadeState === 'in') {
        pauseFadeTimer += 1 / 90;
        if (pauseFadeTimer >= 1) {
          pauseFadeTimer = 1;
          pauseFadeState = 'active';
        }
      } else if (pauseFadeState === 'out') {
        pauseFadeTimer += (1 / 90) / 0.3; // 0.3s duration (Fast)
        if (pauseFadeTimer >= 1) {
          // RESUME COMPLETE
          gamePaused = false;
          pauseFadeState = 'none';

          // Resume Audio & Cursor
          if (!musicMuted && audioStarted) {
            currentBGM.play().catch(() => { });
            lastFrameTime = performance.now ? performance.now() : Date.now();
            document.body.style.cursor = 'none';
          }
        }
      }

      if (gamePaused) drawPauseOverlay();
    }

    // Draw Surge Warning Overlay on top of everything (even pause if desired, but below pause overlay usually)
    // Only draws if in WARNING_PHASE
    drawSurgeWarningOverlay();
  }

  requestAnimationFrame(gameLoop);
}

let gamePaused = false;
let pauseFadeState = 'none'; // 'none', 'in', 'active', 'out'
let pauseFadeTimer = 0;

function keyDownPressed(e) {
  if (e.keyCode === 87 || e.keyCode === 38) keys.up = true;
  else if (e.keyCode === 83 || e.keyCode === 40) keys.down = true;
  if (e.keyCode === 65 || e.keyCode === 37) keys.left = true;
  if (e.keyCode === 68 || e.keyCode === 39) keys.right = true;

  if (e.keyCode === 32) {
    if (gameSettings.inputMode === 'keyboard') {
      // Space is Fire in Keyboard Mode
      keys.fire = true;
      if (!player1.dead) {
        fireBullet();
      }
    }
  }

  if (e.keyCode === 80) togglePause();

  if (e.keyCode === 16) {
    if (abilityCharges > 0 && !game.gameOver && !gamePaused && !player1.dead) {
      if (useAbility()) {
        abilityCharges--;
      }
    }
  }

  if (e.keyCode === 81) {
    // Q - Only for keyboard mode as requested
    if (gameSettings.inputMode === 'keyboard' && !game.gameOver && !gamePaused && !player1.dead) {
      firePlayerMissile();
    }
  }

  // CHEATS
  if (e.keyCode === 49) { // 1
    abilityCharges += 10;
  }
  if (e.keyCode === 50) { // 2
    missileAmmo += 30;
  }
  if (e.keyCode === 51) { // 3 - FORCE ADRENALINE SURGE
    if (game.surgePhase === 0 && game.surgeSchedulerState !== 'BGM_FADE_OUT' && game.surgeSchedulerState !== 'WARNING_PHASE' && game.surgeSchedulerState !== 'EVENT_RUNNING') {
      console.log("CHEAT: Force BGM Fade Out (Pre-Pre-Surge)!");
      // Switch to PRE-PRE-SURGE (BGM Fade Out)
      game.surgeSchedulerState = 'BGM_FADE_OUT';
      game.warningStartTime = Date.now();
    }
  }
}

function keyUpPressed(e) {
  if (e.keyCode === 87 || e.keyCode === 38) keys.up = false;
  else if (e.keyCode === 83 || e.keyCode === 40) keys.down = false;
  if (e.keyCode === 65 || e.keyCode === 37) keys.left = false;
  if (e.keyCode === 68 || e.keyCode === 39) keys.right = false;
  if (e.keyCode === 32) keys.fire = false;
}

function fireBullet() {
  const fireX = player1.x + player1.width;
  const fireY = player1.y + player1.height / 2;

  // === SURGE OVERHEAT: SPREAD MECHANIC ===
  let baseAngle = 0;
  if (game.surgePhase >= 1) {
    // Random jitter between -5 and +5 degrees (converted to radians)
    baseAngle = (Math.random() * 0.1) - 0.05;
  }

  // === DEFAULT: Always fire 2 parallel bullets (stacked vertically) ===
  missilesArray.push(playerLaserPool.get(fireX, fireY - 8, baseAngle));  // Top bullet
  missilesArray.push(playerLaserPool.get(fireX, fireY + 8, baseAngle));  // Bottom bullet

  // === LASER POWER-UP: Add angled spread bullets ===
  if (player1.doubleLaserTimer > 0) {
    const spreadAngle = 0.6; // ~35 degrees in radians
    missilesArray.push(playerLaserPool.get(fireX, fireY - 5, -spreadAngle + baseAngle)); // Angled up
    missilesArray.push(playerLaserPool.get(fireX, fireY + 5, spreadAngle + baseAngle));  // Angled down
  }

  // Use pooled audio instead of cloneNode (much better performance during rapid fire)
  // AudioMixer handles throttling so we don't spam 100+ sounds
  laserPool.play(0.2);

  createParticles(
    player1.x + player1.width,
    player1.y + player1.height / 2,
    5,
    (game.surgePhase >= 1) ? "#ff3300" : "#00e1ff" // Red particles for Surge
  );
}

function firePlayerMissile() {
  if (missileAmmo > 0) {
    missileAmmo--;
    playerMissilesArray.push(
      new PlayerMissile(
        player1.x + player1.width,
        player1.y + player1.height / 2 - 10
      )
    );

    // Use AudioMixer-aware sound playback (throttled automatically)
    playSfxWithVolume("music/sfx/missileaway.mp3", 0.3);
  }
}

function clearGame() {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
}

// === SPELL BOMB ANIMATION SYSTEM ===
// === SPELL BOMB ANIMATION SYSTEM ===
const spellBombAnimation = {
  active: false,
  timer: 0,
  duration: 160,

  x: -500,
  y: 0,
  scale: 1,
  alpha: 0,
  rotation: 0,
  textX: 0,
  textY: 0,
  textAlpha: 0,

  activate() {
    this.active = true;
    this.timer = 0;

    this.x = -500;
    this.y = canvasHeight - 250;
    this.scale = 0.25;
    this.alpha = 0;
    this.rotation = -0.26;

    this.textX = canvasWidth + 200;
    this.textY = canvasHeight - 130;
    this.textAlpha = 0;
  },

  easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); },
  easeInQuad(t) { return t * t; },

  update() {
    if (!this.active) return;
    this.timer++;

    // PHASE 1: ENTER (Frames 0-50 / 0.55s)
    if (this.timer <= 50) {
      const t = this.timer / 50;
      const ease = this.easeOutCubic(t);

      // Ship slides in from left
      this.x = -500 + (370 - (-500)) * ease;
      this.alpha = ease;
      this.scale = 0.25;
      this.rotation = -0.26;

      // Text slides in from right (synchronized)
      this.textX = (canvasWidth + 200) + (170 - (canvasWidth + 200)) * ease;
      this.textAlpha = ease;
    }
    // PHASE 2: HOLD (Frames 50-90 / 0.45s)
    else if (this.timer <= 90) {
      this.x = 370;
      this.alpha = 1.0;
      this.scale = 0.25;
      this.rotation = -0.26;

      this.textX = 170;
      this.textAlpha = 1.0;
    }
    // PHASE 3: EXIT (Frames 90-180 / 1.0s) - EXTENDED
    else if (this.timer <= 180) {
      const t = (this.timer - 90) / 90; // 90 frames for exit
      const ease = this.easeInQuad(t);

      // Ship: Grow & Fade
      this.scale = 0.25 + (0.15) * ease;
      this.alpha = 1.0 - ease;
      this.y = (canvasHeight - 250) - (80 * ease);
      this.rotation = -0.26 + (-0.1 * ease);

      // Text: Slide Down & Fade
      this.textY = (canvasHeight - 130) + (200 * ease); // Increased distance
      this.textAlpha = 1.0 - ease;
    } else {
      this.active = false;
    }
  },

  draw() {
    if (!this.active) return;

    ctx.save();
    // FORCE SCREEN SPACE & BLENDING
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";

    // 1. Draw Ship (First)
    if (spellBombImg.complete && spellBombImg.naturalWidth !== 0) {
      ctx.save();
      ctx.globalAlpha = this.alpha;

      // Transform Context
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.scale(this.scale, this.scale);

      // Draw centered
      ctx.shadowBlur = 10;
      ctx.shadowColor = "rgba(0,0,0,0.5)"; // Neutral shadow
      ctx.drawImage(spellBombImg, -spellBombImg.width / 2, -spellBombImg.height / 2);
      ctx.restore();
    }

    // 2. Draw Text (Second - On Top)
    if (this.textAlpha > 0) {
      ctx.globalAlpha = this.textAlpha;
      ctx.font = "italic bold 28px 'Orbitron', sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      // Multi-layer red glow effect
      // Outer glow (large, soft)
      ctx.shadowBlur = 20;
      ctx.shadowColor = "rgba(255, 50, 50, 0.8)";
      ctx.fillStyle = "white";
      ctx.fillText("Taboo - Extinction forcefield", this.textX, this.textY);

      // Mid glow (medium, bright)
      ctx.shadowBlur = 10;
      ctx.shadowColor = "rgba(255, 0, 0, 1)";
      ctx.fillText("Taboo - Extinction forcefield", this.textX, this.textY);

      // Inner glow (tight, intense)
      ctx.shadowBlur = 5;
      ctx.shadowColor = "rgba(255, 100, 100, 1)";
      ctx.fillText("Taboo - Extinction forcefield", this.textX, this.textY);

      // Final pass (no shadow, crisp white)
      ctx.shadowBlur = 0;
      ctx.fillStyle = "white";
      ctx.fillText("Taboo - Extinction forcefield", this.textX, this.textY);
    }

    ctx.restore();
  }
};

// === SURGE SPELL CARD ANIMATION (It's for my Daughter.') ===
const surgeSpellCardAnimation = {
  active: false,
  timer: 0,
  duration: 160,

  x: -500,
  y: 0,
  scale: 1,
  alpha: 0,
  rotation: 0,
  textX: 0,
  textY: 0,
  textAlpha: 0,

  activate() {
    console.log("SURGE DEBUG: It's for my Daughter.' activated!");
    this.active = true;
    this.timer = 0;

    this.x = -500;
    this.y = canvasHeight - 250;
    this.scale = 0.25;
    this.alpha = 0;
    this.rotation = -0.26;

    this.textX = canvasWidth + 200;
    this.textY = canvasHeight - 130;
    this.textAlpha = 0;
  },

  easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); },
  easeInQuad(t) { return t * t; },

  update() {
    if (!this.active) return;
    this.timer++;

    if (this.timer % 30 === 0) console.log("SURGE DEBUG: Animation Frame " + this.timer);

    // PHASE 1: ENTER (Frames 0-50 / 0.55s)
    if (this.timer <= 50) {
      const t = this.timer / 50;
      const ease = this.easeOutCubic(t);

      // Ship slides in from left
      this.x = -500 + (370 - (-500)) * ease;
      this.alpha = ease;
      this.scale = 0.25;
      this.rotation = -0.26;

      // Text slides in from right (synchronized)
      this.textX = (canvasWidth + 200) + (170 - (canvasWidth + 200)) * ease;
      this.textAlpha = ease;
    }
    // PHASE 2: HOLD (Frames 50-90 / 0.45s)
    else if (this.timer <= 90) {
      this.x = 370;
      this.alpha = 1.0;
      this.scale = 0.25;
      this.rotation = -0.26;

      this.textX = 170;
      this.textAlpha = 1.0;
    }
    // PHASE 3: EXIT (Frames 90-180 / 1.0s) - EXTENDED
    else if (this.timer <= 180) {
      const t = (this.timer - 90) / 90;
      const ease = this.easeInQuad(t);

      // Ship: Grow & Fade
      this.scale = 0.25 + (0.15) * ease;
      this.alpha = 1.0 - ease;
      this.y = (canvasHeight - 250) - (80 * ease);
      this.rotation = -0.26 + (-0.1 * ease);

      // Text: Slide Down & Fade
      this.textY = (canvasHeight - 130) + (200 * ease);
      this.textAlpha = 1.0 - ease;
    } else {
      console.log("SURGE DEBUG: Animation Finished.");
      this.active = false;
    }
  },

  draw() {
    if (!this.active) return;

    ctx.save();
    // FORCE SCREEN SPACE & BLENDING
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";

    // 1. Draw Ship (First)
    if (spellBombImg.complete && spellBombImg.naturalWidth !== 0) {
      ctx.save();
      ctx.globalAlpha = this.alpha;

      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.scale(this.scale, this.scale);

      ctx.shadowBlur = 10;
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.drawImage(spellBombImg, -spellBombImg.width / 2, -spellBombImg.height / 2);
      ctx.restore();
    }

    // 2. Draw Text (Second - On Top)
    if (this.textAlpha > 0) {
      ctx.globalAlpha = this.textAlpha;
      ctx.font = "italic bold 28px 'Orbitron', sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";

      // Multi-layer red glow effect (Same as SpellBomb)
      ctx.shadowBlur = 20;
      ctx.shadowColor = "rgba(255, 50, 50, 0.8)";
      ctx.fillStyle = "white";
      ctx.fillText("It's for my Daughter.'", this.textX, this.textY); // CHANGED TEXT

      ctx.shadowBlur = 10;
      ctx.shadowColor = "rgba(255, 0, 0, 1)";
      ctx.fillText("It's for my Daughter.'", this.textX, this.textY); // CHANGED TEXT

      ctx.shadowBlur = 5;
      ctx.shadowColor = "rgba(255, 100, 100, 1)";
      ctx.fillText("It's for my Daughter.'", this.textX, this.textY); // CHANGED TEXT

      // Final pass
      ctx.shadowBlur = 0;
      ctx.fillStyle = "white";
      ctx.fillText("It's for my Daughter.'", this.textX, this.textY); // CHANGED TEXT
    }

    ctx.restore();
  }
};

let lastBombHitTimeGlobal = 0;

// === BOMB SYSTEM (TOUHOU STYLE) ===
const bombSystem = {
  active: false,
  timer: 0,
  rects: [],
  particles: [],
  originX: 0,
  originY: 0,
  currentWidth: 0,

  activate(x, y) {
    this.active = true;
    this.timer = 0;
    this.originX = x;
    this.originY = y;
    this.rects = [];
    this.particles = [];
    this.currentWidth = 200; // Initialize

    // 0. Trigger SpellBomb entrance animation
    spellBombAnimation.activate();

    cameraShake.startBomb();

    // CRITICAL EVENT: Maximum impact - single call
    playSfxWithVolume("music/sfx/BombMerged.wav", 1.0);

    // AUDIO OPTIMIZATION: Suppress individual explosion sounds during bomb
    // The bomb sound itself is enough - we don't need 90 explosion SFX!
    AudioMixer.startBombMode();

    for (let i = 0; i < 80; i++) {
      let angle = Math.random() * Math.PI * 2;
      let speed = Math.random() * 10 + 5;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 3 + 2,
        alpha: 1,
        life: 120
      });
    }
  },

  update() {
    if (!this.active) return;
    this.timer++;

    if (this.timer > 150) {
      this.active = false;
      return;
    }

    // 1. Calculate Beam Width
    const easeIn = t => t * t;
    const easeOut = t => t * (2 - t);
    let baseWidth = 200;
    let targetWidth = canvasWidth * 4.0;

    if (this.timer < 56) {
      this.currentWidth = baseWidth;
    } else if (this.timer < 132) {
      let t = (this.timer - 56) / 76;
      this.currentWidth = baseWidth + (targetWidth - baseWidth) * easeOut(t);
    } else {
      this.currentWidth = targetWidth;
    }

    // 2. Progressive Collision Check
    let centerX = player1.x + player1.width / 2;
    let beamLeft = centerX - this.currentWidth / 2;
    let beamRight = centerX + this.currentWidth / 2;

    // Check Enemies
    for (let i = enemyShipArray.length - 1; i >= 0; i--) {
      let e = enemyShipArray[i];
      if (e.x + e.width > beamLeft && e.x < beamRight) {
        if (e.health > 0) {
          e.health -= 90000;
          if (e.health <= 0) {
            // SOUND: Bomb Hit - Now using FULL VOLUME for maximum impact
            AudioMixer.playImmediate('impact', "music/sfx/BombHIT.wav", 1.0);

            player1.score += (e.isMiniBoss ? 1000 : 100) + game.level * 10;
            if (e.isMiniBoss) {
              bigExplosions.push(new BigExplosion(e.x + e.width / 2, e.y + e.height / 2));
              if (Math.random() < 0.2) abilityTokens.push(new AbilityToken(e.x, e.y, "life"));
            } else {
              explosions.push(new BigExplosion(e.x + e.width / 2, e.y + e.height / 2, 0.4));
              createParticles(e.x + e.width / 2, e.y + e.height / 2, 30, "#ff5500");
            }
            enemyShipArray.splice(i, 1);
          }
        }
      }
    }

    // Check Enemy Bullets - BULLET CANCEL MECHANIC (Touhou style)
    // Bullets caught in bomb beam are converted to score!
    for (let i = enemyBulletsArray.length - 1; i >= 0; i--) {
      let b = enemyBulletsArray[i];
      if (b.x + b.width > beamLeft && b.x < beamRight) {
        createParticles(b.x + b.width / 2, b.y + b.height / 2, 5, "#ffff00"); // Yellow particles
        player1.score += 5; // +5 points per cancelled bullet!
        { let ___eb = enemyBulletsArray.splice(i, 1)[0]; enemyBulletPool.recycle(___eb); }
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.life--;
      p.alpha = Math.min(1, p.life / 30);
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  },

  draw() {
    if (!this.active) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // Calculate Alpha for visuals
    const easeIn = t => t * t;
    let alpha = 0;

    if (this.timer < 36) {
      let t = this.timer / 36;
      alpha = easeIn(t);
    } else if (this.timer < 96) {
      alpha = 1;
    } else {
      let t = (this.timer - 96) / 30;
      alpha = Math.max(0, 1 - easeIn(t));
    }

    if (alpha <= 0) {
      ctx.restore();
      return;
    }

    let centerX = player1.x + player1.width / 2;
    let width = this.currentWidth; // Calculated in update()

    let grad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    grad.addColorStop(0, `rgba(255, 100, 150, ${alpha * 0.0})`);
    grad.addColorStop(0.2, `rgba(255, 50, 100, ${alpha * 0.8})`);
    grad.addColorStop(0.5, `rgba(255, 50, 100, ${alpha * 0.9})`);
    grad.addColorStop(0.8, `rgba(255, 50, 100, ${alpha * 0.8})`);
    grad.addColorStop(1, `rgba(255, 100, 150, ${alpha * 0.0})`);

    ctx.fillStyle = grad;
    ctx.fillRect(centerX - width / 2, -500, width, canvasHeight + 1000);

    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.fillRect(centerX - width / 4, -500, width / 2, canvasHeight + 1000);

    for (let p of this.particles) {
      if (p.alpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore(); // End 'lighter' mode

    // === HEROIC BLACK SILHOUETTE PLAYER ===
    if (player1 && !player1.dead) {
      ctx.save();
      ctx.filter = "brightness(0%)";

      if (player1.spriteWidth > 0 && player1.image) {
        ctx.drawImage(
          player1.image,
          player1.frameIndex * player1.spriteWidth,
          0, // Source Y
          player1.spriteWidth,
          player1.sourceHeight,
          player1.x,
          player1.y,
          player1.width,
          player1.height
        );
      } else {
        ctx.fillStyle = "black";
        ctx.fillRect(player1.x, player1.y, player1.width, player1.height);
      }
      ctx.restore();
    }
  }
};

function updateGame() {
  if (bombCooldown > 0) bombCooldown--;
  bombSystem.update();
  spellBombAnimation.update();
  surgeSpellCardAnimation.update(); // FIXED: Now updates every frame
  game.frames++;

  updateSurge();

  // Base speed + Surge
  let rawLevel = 1 + Math.floor(player1.score / 500);
  game.level = Math.min(rawLevel, 40);

  let baseSpeed = 1 + game.level * 0.1;
  game.speed = baseSpeed * game.surge;

  updateStarField();

  addShips();
  maybeSpawnAbilityToken();

  // === keyword: SWARM MODE  ===
  // NB Normal: Every ~10 seconds. Surge: ENDLESS STREAM (Every 10 frames / 0.11s -> ~80 enemies/sec)
  let currentSwarmInterval = (game.surgePhase >= 1) ? 10 : SWARM_INTERVAL;
  swarmTimer++;

  if (swarmTimer >= currentSwarmInterval) {
    // SURGE CHAOS: Endsless Stream (Runs at Any Level!)
    if (game.surgePhase >= 1) {
      swarmTimer = 0;
      const randomShip = Math.floor(Math.random() * enemyImgArray.length);
      const startX = canvasWidth + 200;
      const centerY = 100 + Math.random() * (canvasHeight - 200); // Random height

      const formationSize = 4; // buat 4 up, and 4 down + 1 center = 9 enemies per batch
      const xStep = 60;
      const yStep = 50;



      for (let i = -formationSize; i <= formationSize; i++) {
        // Calculate ">" shape position
        // Abs(i) means top and bottom are further back (left)
        // i=0 is the Apex (furthest right/forward)

        // Invert X logic: We want Apex (i=0) to be at startX, others behind it (startX - offset)
        // Actually, if they spawn off screen right, "behind" means +X if they move left? No, +X is further right.
        // If they spawn at X=1500, and move left...
        // Apex at 1500. i=4 at 1500 + 4*60 = 1740. 
        // So Apex arrives first. Perfect.

        let xPos = startX + Math.abs(i) * xStep;
        let yPos = centerY + i * yStep;

        // Boundary Check (Don't spawn too far off vertical screen)
        if (yPos > 50 && yPos < canvasHeight - 50) {
          let swarmEnemy = new EnemyObj(
            xPos,
            yPos,
            7.0 + Math.random() * 3.0, // EXTREME SPEED (7-10)
            enemyImgArray[randomShip],
            "straight"
          );
          swarmEnemy.health = 1; // 1 HP
          swarmEnemy.isSwarmEnemy = true;
          swarmEnemy.isEliteTank = false;
          swarmEnemy.guaranteedDrop = false;
          // Slightly smaller to fit pattern
          swarmEnemy.width = 90;
          swarmEnemy.height = 55;
          enemyShipArray.push(swarmEnemy);
        }
      }

    } else if (game.level >= 2) {
      swarmTimer = 0;
      // --- NORMAL SWARM (Regular Gameplay) ---
      let swarmCount = 8 + Math.floor(Math.random() * 5);
      const startY = 100 + Math.random() * (canvasHeight - 200);
      let randomShip = Math.floor(Math.random() * enemyImgArray.length);

      for (let s = 0; s < swarmCount; s++) {
        let swarmEnemy = new EnemyObj(
          canvasWidth + 50 + s * 40,
          startY + Math.sin(s * 0.5) * 60,
          1.5 + Math.random() * 0.5,
          enemyImgArray[randomShip],
          "straight"
        );
        swarmEnemy.health = 1;
        swarmEnemy.isSwarmEnemy = true;
        swarmEnemy.isEliteTank = false;
        swarmEnemy.guaranteedDrop = false;
        swarmEnemy.width = 100;
        swarmEnemy.height = 62;
        enemyShipArray.push(swarmEnemy);
      }
      console.log("SWARM MODE ACTIVATED! " + swarmCount + " enemies spawned!");
    }
  }

  // === SURGE OVERDRIVE: DOUBLE FIRE RATE & AUTO LASER ===
  // Normal: 8 frames. Surge: 4 frames.
  let fireRate = (game.surgePhase >= 1) ? 4 : 8;

  // AUTO-GRANT DOUBLE LASER DURING SURGE
  if (game.surgePhase >= 1) {
    player1.doubleLaserTimer = 10; // Keep it active constantly
  }

  if ((keys.fire || (gameSettings.inputMode === 'mouse' && mouseButtons.left)) && !player1.dead && game.frames % fireRate === 0) {
    fireBullet();
  }

  if (!player1.dead) {
    player1.update();
    if (player1.invincible > 0) player1.invincible--;
    updateCamera();
  } else {
    if (respawnCounter > 0) {
      respawnCounter--;
      if (respawnCounter <= 0 && player1.lives > 0) {
        player1.dead = false;
        player1.invincible = 120;
        player1.x = 100;
        player1.y = canvasHeight / 2 - player1.height / 2;
        player1.vx = 0;
        player1.vy = 0;
        player1.doubleLaserTimer = 0;
      }
    }
  }

  spawnPlanet();
  if (currentPlanet) currentPlanet.update();

  updateParticles();

  // Update Camera Breathe (Organic Drift)
  cameraBreathe.update();

  // Update Camera Shake
  cameraShake.update(1000 / 60); // approximate delta time

  // Update Surge Shake & Flash & Clock
  surgeShake.update();
  surgeFlash.update();
  wrathClock.update();

  // Update Big Explosions
  for (let i = 0; i < bigExplosions.length; i++) {
    bigExplosions[i].update();
    if (bigExplosions[i].done) {
      bigExplosions.splice(i, 1);
      i--;
    }
  }

  // === AUDIO FRAME PROCESSING ===
  // Process all queued audio events with coalescing and voice limits
  AudioMixer.processFrame();
}

function drawGame() {
  ctx.save();

  // === CAMERA BREATHE (Base Layer — AE Null Parent) ===
  // Applied first so all other effects layer on top
  ctx.translate(
    canvasWidth / 2 + cameraBreathe.offsetX,
    canvasHeight / 2 + cameraBreathe.offsetY
  );
  ctx.rotate(cameraBreathe.rotation);
  ctx.translate(
    -(canvasWidth / 2),
    -(canvasHeight / 2)
  );

  // Apply Camera Shake Offset
  if (cameraShake.active) {
    ctx.translate(cameraShake.offsetX, cameraShake.offsetY);
  }

  // Apply Surge Shake (X/Y Translation Only - High Performance)
  if (surgeShake.active) {
    ctx.translate(surgeShake.offsetX, surgeShake.offsetY);
  }

  ctx.translate(0, cameraY);

  drawStarField();

  if (currentPlanet) currentPlanet.draw();

  drawParticles();

  for (let i = 0; i < abilityTokens.length; i++) {
    const t = abilityTokens[i];
    t.draw();

    if (!gamePaused) {
      t.update();

      if (
        !player1.dead &&
        Tabrakan(player1.getHitbox(), {
          x: t.x,
          y: t.y,
          width: t.width,
          height: t.height,
        })
      ) {
        if (t.type === "bomb") {
          abilityCharges++;
          createParticles(t.x, t.y, 15, "#ffff00");
          // bomb-get.mp3 - Single clean trigger
          playSfxWithVolume("music/sfx/bomb-get.mp3", 1.0);
        } else if (t.type === "double") {
          player1.doubleLaserTimer = 600;
          createParticles(t.x, t.y, 15, "#ff0000");
          if (gameSettings.sfxEnabled) {
            weaponGetSound.currentTime = 0;
            weaponGetSound.play().catch(() => { });
          }
        } else if (t.type === "missile") {
          missileAmmo += Math.floor(Math.random() * 4) + 4; // 4 to 7
          createParticles(t.x, t.y, 15, "#0000ff");
          if (gameSettings.sfxEnabled) {
            missileGetSound.currentTime = 0;
            missileGetSound.play().catch(() => { });
          }
        } else if (t.type === "life") {
          if (player1.lives < 5) {
            player1.lives++;
          }
          createParticles(t.x, t.y, 20, "#ff3366");
          if (gameSettings.sfxEnabled) {
            playSfxWithVolume("music/sfx/lifeup.wav", 0.375);
          }
        }

        abilityTokens.splice(i, 1);
        i--;
        continue;
      }

      if (t.x + t.width < 0) {
        abilityTokens.splice(i, 1);
        i--;
      }
    }
  }

  if (!player1.dead) {
    // Draw Wrath Clock / God Effect behind the ship
    wrathClock.draw(ctx, player1.x, player1.y, player1.width, player1.height);

    player1.draw();
    if (DEBUG_HITBOX) drawDebugHitbox(player1.getHitbox(), "lime");
  }

  for (let i = 0; i < enemyShipArray.length; i++) {
    let s = enemyShipArray[i];
    s.draw();

    if (!gamePaused) {
      s.update();

      if (DEBUG_HITBOX) drawDebugHitbox(s.getHitbox(), "red");

      if (s.x < -200) {
        enemyShipArray.splice(i, 1);
        i--;
        continue;
      }

      let shootChance = 0.001 + game.level * 0.0005; // Reduced trigger rate significantly
      if (shootChance > 0.015) shootChance = 0.015; // Lower cap

      // Prevent shooting backwards: Only shoot if enemy is > 10px to the right of player
      // Elite tanks (isEliteTank) don't shoot at all!
      if (!player1.dead && s.x > player1.x + 10 && !s.isEliteTank) {

        // === MINI-BOSS SPIRAL BULLET PATTERN ===
        if (s.isMiniBoss) {
          // === MINI-BOSS SHOOTING (Surge Aware) ===
          // Normal: ~1.3s (120 frames). Surge: ~4s (360 frames) - Slower!
          let cooldown = (game.surgePhase >= 1) ? 360 : 120;

          if (game.frames % cooldown === 0) {
            // Play Boss Attack Sound
            playSfxWithVolume("music/sfx/BossAttack.wav", 0.1);

            const centerX = s.x + s.width / 2;
            const centerY = s.y + s.height / 2;
            const bulletCount = 8 + Math.floor(game.level / 10);
            const spiralOffset = (game.frames * 0.02) % (Math.PI * 2);

            for (let b = 0; b < bulletCount; b++) {
              const angle = (b / bulletCount) * Math.PI * 2 + spiralOffset;
              const targetX = centerX + Math.cos(angle) * 500;
              const targetY = centerY + Math.sin(angle) * 500;
              let bullet = enemyBulletPool.get(centerX, centerY, targetX, targetY, "green");
              bullet.vx *= 0.5;
              bullet.vy *= 0.5;
              enemyBulletsArray.push(bullet);
            }
          }
        } else {
          // === REGULAR ENEMY SHOOTING ===
          // ADRENALINE SURGE: Basic enemies DO NOT SHOOT!
          // We check 'spawnedInSurge' so they don't start shooting if they survive the event
          if (game.surgePhase === 0 && !s.spawnedInSurge) {
            if (Math.random() < shootChance) {
              const ex = s.x;
              const ey = s.y + s.height / 2;
              const px = player1.x + player1.width / 2;
              const py = player1.y + player1.height / 2;

              let bulletType = "default";
              if (s.isSwarmEnemy) {
                bulletType = Math.random() < 0.5 ? "purple" : "blue";
              }

              enemyBulletsArray.push(enemyBulletPool.get(ex, ey, px, py, bulletType));
            }
          }
        }
      }

      if (!player1.dead && Tabrakan(player1.getHitbox(), s.getHitbox())) {
        // Trigger Strong Camera Shake on Damage
        cameraShake.start(1.5);

        if (s.isMiniBoss) {
          bigExplosions.push(new BigExplosion(s.x + s.width / 2, s.y + s.height / 2));
        } else {
          explosions.push(new BigExplosion(s.x + s.width / 2, s.y + s.height / 2, 0.4));
          createParticles(s.x + s.width / 2, s.y + s.height / 2, 20, "#ff6600");
        }

        enemyShipArray.splice(i, 1);
        i--;
        handlePlayerHit();
        continue;
      }
    }
  }

  for (let i = 0; i < missilesArray.length; i++) {
    let m = missilesArray[i];
    m.draw();

    if (!gamePaused) {
      m.update();

      if (DEBUG_HITBOX) drawDebugHitbox(m.getHitbox(), "cyan");

      let hit = false;
      for (let j = 0; j < enemyShipArray.length; j++) {
        let en = enemyShipArray[j];

        if (Tabrakan(m.getHitbox(), en.getHitbox())) {
          // 50% damage per bullet (two bullets default)
          let playerDamage = (100 + game.level * 5) * 0.5;
          en.health -= playerDamage;

          createParticles(
            en.x + en.width / 2,
            en.y + en.height / 2,
            5,
            "#ff9900"
          );
          { let ___b = missilesArray.splice(i, 1)[0]; playerLaserPool.recycle(___b); }
          hit = true;

          // Hit effect for MiniBoss
          if (en.isMiniBoss) {
            cameraShake.start(0.3); // Light shake on hit
          }

          if (en.health <= 0) {
            player1.score += (en.isMiniBoss ? 500 : (en.isEliteTank ? 300 : 100)) + game.level * 10;

            if (en.isMiniBoss) {
              // EPIC DEATH for MiniBoss
              bigExplosions.push(new BigExplosion(en.x + en.width / 2, en.y + en.height / 2));
              cameraShake.start(1.5); // Strong shake on death

              // 10% Chance to drop LIFE (Rare!)
              // User requested 1 out of 10 chance
              if (Math.random() < 0.1) {
                abilityTokens.push(new AbilityToken(en.x, en.y, "life"));
              }
            } else if (en.isEliteTank) {
              // ELITE TANK DEATH - No longer guaranteed drop (Too easy)
              bigExplosions.push(new BigExplosion(en.x + en.width / 2, en.y + en.height / 2, 0.7));
              cameraShake.start(0.8);
              // abilityTokens.push(new AbilityToken(en.x, en.y)); // DISABLED
            } else {
              // Regular enemy death
              explosions.push(
                new BigExplosion(en.x + en.width / 2, en.y + en.height / 2, 0.4)
              );

              // === PANIC SCATTER DEATH BURST (2% chance) ===
              // Rarely, dying enemies release slow revenge bullets
              if (Math.random() < 0.02) {
                const cx = en.x + en.width / 2;
                const cy = en.y + en.height / 2;
                const scatterCount = 4 + Math.floor(Math.random() * 3); // 4-6 bullets
                for (let s = 0; s < scatterCount; s++) {
                  const angle = Math.random() * Math.PI * 2;
                  const targetX = cx + Math.cos(angle) * 300;
                  const targetY = cy + Math.sin(angle) * 300;
                  let scatterBullet = enemyBulletPool.get(cx, cy, targetX, targetY);
                  scatterBullet.vx *= 0.3; // Very slow (30% speed)
                  scatterBullet.vy *= 0.3;
                  enemyBulletsArray.push(scatterBullet);
                }
              }
            }
            enemyShipArray.splice(j, 1);
          }
          break;
        }
      }

      if (hit) {
        i--;
        continue;
      }

      // Remove bullets that go off-screen (including angled shots)
      if (m.x > canvasWidth + 50 || m.y < -50 || m.y > worldHeight + 50) {
        { let ___b = missilesArray.splice(i, 1)[0]; playerLaserPool.recycle(___b); }
        i--;
      }
    }
  }

  for (let i = 0; i < playerMissilesArray.length; i++) {
    let pm = playerMissilesArray[i];
    pm.draw();

    if (!gamePaused) {
      pm.update();

      let hit = false;
      for (let j = 0; j < enemyShipArray.length; j++) {
        let en = enemyShipArray[j];

        if (Tabrakan(pm.getHitbox(), en.getHitbox())) {
          let missileDmg = 400 + game.level * 20;
          en.health -= missileDmg;

          createParticles(pm.x + pm.width, pm.y, 20, "#ff6600"); // Fixed blue particle to orange
          explosions.push(new Explosion(pm.x + pm.width, pm.y, 0.5));

          // Missile Impact Shake
          cameraShake.start(0.8);

          // Check for kill
          if (en.health <= 0) {
            player1.score += (en.isMiniBoss ? 500 : (en.isEliteTank ? 300 : 100)) + game.level * 10;

            if (en.isMiniBoss) {
              bigExplosions.push(new BigExplosion(en.x + en.width / 2, en.y + en.height / 2));
              cameraShake.start(1.5);

              // 15% Chance to drop LIFE
              if (Math.random() < 0.15) {
                abilityTokens.push(new AbilityToken(en.x, en.y, "life"));
              }
            } else if (en.isEliteTank) {
              // ELITE TANK DEATH - Guaranteed power-up drop!
              bigExplosions.push(new BigExplosion(en.x + en.width / 2, en.y + en.height / 2, 0.7));
              cameraShake.start(0.8);
              abilityTokens.push(new AbilityToken(en.x, en.y)); // Random power-up
            } else {
              explosions.push(
                new BigExplosion(en.x + en.width / 2, en.y + en.height / 2, 0.4)
              );

              // === PANIC SCATTER DEATH BURST (2% chance) ===
              if (Math.random() < 0.02) {
                const cx = en.x + en.width / 2;
                const cy = en.y + en.height / 2;
                const scatterCount = 4 + Math.floor(Math.random() * 3);
                for (let s = 0; s < scatterCount; s++) {
                  const angle = Math.random() * Math.PI * 2;
                  const targetX = cx + Math.cos(angle) * 300;
                  const targetY = cy + Math.sin(angle) * 300;
                  let scatterBullet = enemyBulletPool.get(cx, cy, targetX, targetY);
                  scatterBullet.vx *= 0.3;
                  scatterBullet.vy *= 0.3;
                  enemyBulletsArray.push(scatterBullet);
                }
              }
            }
            enemyShipArray.splice(j, 1);
          }

          playerMissilesArray.splice(i, 1);
          hit = true;
          break;
        }
      }

      if (hit) {
        i--;
        continue;
      }

      if (pm.x > canvasWidth + 200 || pm.y < -200 || pm.y > worldHeight + 200) {
        playerMissilesArray.splice(i, 1);
        i--;
      }
    }
  }

  for (let i = 0; i < enemyBulletsArray.length; i++) {
    let b = enemyBulletsArray[i];
    b.draw();

    if (!gamePaused) {
      b.update();

      if (DEBUG_HITBOX) drawDebugHitbox(b.getHitbox(), "orange");

      if (!player1.dead && Tabrakan(b.getHitbox(), player1.getHitbox())) {
        explosions.push(
          new Explosion(
            player1.x + player1.width / 2,
            player1.y + player1.height / 2
          )
        );
        createParticles(
          player1.x + player1.width / 2,
          player1.y + player1.height / 2,
          12,
          "#ff3300"
        );
        { let ___eb = enemyBulletsArray.splice(i, 1)[0]; enemyBulletPool.recycle(___eb); }
        i--;
        handlePlayerHit();
        continue;
      }

      // === GRAZE SYSTEM (Touhou style) ===
      // If bullet is close but not hitting, award graze points!
      if (!player1.dead && !b.grazed) {
        const playerCenterX = player1.x + player1.width / 2;
        const playerCenterY = player1.y + player1.height / 2;
        const bulletCenterX = b.x + b.width / 2;
        const bulletCenterY = b.y + b.height / 2;
        const dist = Math.sqrt(
          Math.pow(playerCenterX - bulletCenterX, 2) +
          Math.pow(playerCenterY - bulletCenterY, 2)
        );

        // Graze radius: 25-50px from player center (outside hitbox, inside graze zone)
        if (dist < 50 && dist > 15) {
          b.grazed = true; // Mark so we don't graze same bullet twice
          grazeCount++;
          player1.score += 2; // +2 points per graze
          // Play graze sound using AudioMixer
          playSfxWithVolume("music/sfx/grazedezpz.wav", 0.2);
          // Small white spark at bullet position
          createParticles(bulletCenterX, bulletCenterY, 2, "#ffffff");
        }
      }

      if (
        b.x + b.width < -100 ||
        b.x > canvasWidth + 100 ||
        b.y + b.height < -100 ||
        b.y > worldHeight + 100
      ) {
        { let ___eb = enemyBulletsArray.splice(i, 1)[0]; enemyBulletPool.recycle(___eb); }
        i--;
      }
    }
  }

  for (let i = 0; i < explosions.length; i++) {
    let ex = explosions[i];
    ex.draw();
    if (!gamePaused) {
      ex.update();
      if (ex.done) {
        explosions.splice(i, 1);
        i--;
      }
    }
  }

  // Draw Big Explosions (Platypus style)
  for (let i = 0; i < bigExplosions.length; i++) {
    bigExplosions[i].draw();
  }

  // Draw Bomb Effects
  bombSystem.draw();

  // Apply Surge Flash (Brightness Overlay)
  surgeFlash.apply(ctx);

  ctx.restore();

  // Draw SpellBomb Animation (UI Layer - Screen Space)
  spellBombAnimation.draw();
  surgeSpellCardAnimation.draw(); // FIXED: Added missing draw call

  drawScreenShading();
  drawUI();

  if (game.endingSequence) {
    drawEndingSequence();
  }
}

function drawDebugHitbox(hitboxData, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;

  // If it has complex sub-shapes, draw them!
  if (hitboxData.shapes && hitboxData.shapes.length > 0) {
    for (let shape of hitboxData.shapes) {
      ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
    }
    // Optional: Draw faint bounding box
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.strokeRect(hitboxData.x, hitboxData.y, hitboxData.width, hitboxData.height);
  } else {
    // Fallback for simple objects (bullets, etc)
    ctx.strokeRect(hitboxData.x, hitboxData.y, hitboxData.width, hitboxData.height);
  }

  ctx.restore();
}

function drawUI() {
  // Score (Moved to Top Left)
  drawNewText(
    player1.score,
    90, // Changed x from 30 to 60
    80,
    "white",
    "40px"
  );

  // Level text removed as requested

  // Lives (Stacked Icons) - Updated with Dynamic Aspect Ratio
  const lifeHeight = 45;
  const lifePadding = 10;

  if (livesImg.complete && livesImg.width > 0) {
    // Calculate aspect ratio to prevent deformation
    const ratio = livesImg.width / livesImg.height;
    const lifeWidth = lifeHeight * ratio;

    for (let i = 0; i < player1.lives; i++) {
      ctx.drawImage(livesImg, 30 + i * (lifeWidth + lifePadding), canvasHeight - 60, lifeWidth, lifeHeight);
    }
  } else {
    let livesText = "Lives:  ";
    for (let i = 0; i < player1.lives; i++) {
      livesText += "♥ ";
    }
    drawNewText(livesText, 30, canvasHeight - 50, "#ff3366");
  }

  // Bombs (Shift)
  // Bombs & Missiles (Moved to Bottom Left, above Lives)
  const iconSize = 32;
  const padding = 10;

  // Lives are at canvasHeight - 60 (height 40). We stack upwards.
  const missileY = canvasHeight - 110;
  const bombY = canvasHeight - 150;

  // Bombs (Shift)
  if (bombPickupImg.complete) {
    ctx.drawImage(bombPickupImg, 30, bombY, iconSize, iconSize);
    drawNewText("x " + abilityCharges, 30 + iconSize + padding, bombY + 24, "#ffff00");
  } else {
    drawNewText("Bombs: " + abilityCharges, 30, bombY + 24, "#ffff00");
  }

  // Missiles (Q)
  if (missilePickupImg.complete) {
    ctx.drawImage(missilePickupImg, 30, missileY, iconSize, iconSize);
    drawNewText("x " + missileAmmo, 30 + iconSize + padding, missileY + 24, "#00ccff");
  } else {
    drawNewText("Missiles: " + missileAmmo, 30, missileY + 24, "#00ccff");
  }
}

class PlayerObject {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 100;
    this.height = 64;
    this.image = playerShipImg;

    this.vx = 0;
    this.vy = 0;
    this.acceleration = 0.8;
    this.friction = 0.92;
    this.maxSpeed = 10;

    this.lives = 1;
    this.score = 0;
    this.health = 100;
    this.invincible = 0;
    this.dead = false;

    this.doubleLaserTimer = 0;

    this.image.onload = () => {
      this.totalFrames = 5;
      this.spriteWidth = Math.floor(this.image.width / this.totalFrames);
      this.sourceHeight = this.image.height;

      // Dynamic Scaling: Always make the ship ~115px wide on screen, regardless of source image size
      const targetWidth = 115;
      this.scale = targetWidth / this.spriteWidth;

      this.width = targetWidth;
      this.height = this.sourceHeight * this.scale;

      this.y = canvasHeight / 2 - this.height / 2;
    };
  }

  getHitbox() {
    // Touhou-style tight hitbox (Core only)
    // Roughly 16% of width/height centered
    const h = this.height * 0.16;
    const w = this.width * 0.16;

    const x = this.x + (this.width - w) / 2;
    const y = this.y + (this.height - h) / 2;

    return { x, y, width: w, height: h };
  }
  draw() {
    if (this.invincible > 0 && game.frames % 10 < 5) {
      return;
    }

    ctx.save();

    if (this.spriteWidth > 0) {
      // Draw regular sprite (Automatic slicing based on 1/5th width)
      ctx.drawImage(
        this.image,
        this.frameIndex * this.spriteWidth,
        0,
        this.spriteWidth,
        this.sourceHeight,
        this.x,
        this.y,
        this.width,
        this.height
      );
    } else {
      ctx.fillStyle = "red";
      ctx.fillRect(this.x, this.y, 50, 50);
    }

    ctx.restore();
  }

  update() {
    if (gameSettings.inputMode === 'keyboard') {
      if (keys.up) this.vy -= this.acceleration;
      if (keys.down) this.vy += this.acceleration;
      if (keys.left) this.vx -= this.acceleration;
      if (keys.right) this.vx += this.acceleration;

      this.vx *= this.friction;
      this.vy *= this.friction;

      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (speed > this.maxSpeed) {
        const scale = this.maxSpeed / speed;
        this.vx *= scale;
        this.vy *= scale;
      }

      this.x += this.vx;
      this.y += this.vy;
    } else {
      // Mouse Control
      // Mouse is in Screen Coordinates, but Ship is in World Coordinates.
      // We must compare them in the same space (Screen Space).
      // Ship Screen Y = (World Y) + cameraY

      const screenShipX = this.x + this.width / 2;
      const screenShipY = (this.y + this.height / 2) + cameraY;

      const dx = mousePos.x - screenShipX;
      const dy = mousePos.y - screenShipY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 1) {
        let moveSpeed = dist * 0.84; // responsive mouse config
        const mouseMaxSpeed = this.maxSpeed * 1.2; // 1.5x faster than keyboard

        if (moveSpeed > mouseMaxSpeed) {
          moveSpeed = mouseMaxSpeed;
        }

        const angle = Math.atan2(dy, dx);
        this.vx = Math.cos(angle) * moveSpeed;
        this.vy = Math.sin(angle) * moveSpeed;

        this.x += this.vx;
        this.y += this.vy;
      } else {
        this.vx = 0;
        this.vy = 0;
      }
    }

    const bleedY = this.height * 0.4;
    const bleedX = this.width * 0.4;

    if (this.y < -bleedY) {
      this.y = -bleedY;
      if (this.vy < 0) this.vy = 0;
    }
    if (this.y > worldHeight - this.height + bleedY) {
      this.y = worldHeight - this.height + bleedY;
      if (this.vy > 0) this.vy = 0;
    }

    if (this.x < -bleedX) {
      this.x = -bleedX;
      if (this.vx < 0) this.vx = 0;
    }
    if (this.x > canvasWidth - this.width + bleedX) {
      this.x = canvasWidth - this.width + bleedX;
      if (this.vx > 0) this.vx = 0;
    }

    if (this.vy < -2.5) {
      this.frameIndex = 4;
    } else if (this.vy < -0.5) {
      this.frameIndex = 3;
    } else if (this.vy > 2.5) {
      this.frameIndex = 0;
    } else if (this.vy > 0.5) {
      this.frameIndex = 1;
    } else {
      this.frameIndex = 2;
    }

    if (this.doubleLaserTimer > 0) {
      this.doubleLaserTimer--;
    }
  }
}

let player1 = new PlayerObject(100, 300);

function handlePlayerHit() {
  if (player1.invincible > 0 || player1.dead || game.gameOver) return;

  // === SURGE AUDIO TRANSITION (Linear / No Ease) ===
  let vol = 0.35; // Normal Baseline (User specified 0.35)
  if (game.surgePhase >= 1) {
    if (game.surgePhase === 3) {
      // Linear transition from Chaos (0.15) to Normal (0.35) over 2.5s
      let t = (7.0 - game.surge) / 6.0; // Linear progress 0 -> 1
      vol = 0.15 + (0.35 - 0.15) * t;
    } else {
      vol = 0.15; // Chaos Volume
    }
  }

  // Use Pool for player hit too, to be safe
  explosionPool.play(vol);
  damageFlash = 20;
  // DEFEATED.wav - Use AudioMixer for consistency
  if (gameSettings.sfxEnabled) {
    playSfxWithVolume("music/sfx/DEFEATED.wav", 0.375);
  }

  player1.lives--;

  if (player1.lives <= 0) {
    if (!game.endingSequence) {
      console.log("TRIGGERING ENDING SEQUENCE");
      game.endingSequence = true;
      game.endingTimer = 0;
      game.endingStartTime = Date.now(); // Start real-time clock
    }
    player1.dead = true; // Ensure ship disappears/explodes
    return;
  }

  player1.dead = true;
  respawnCounter = 80 * 3;
}

function drawNewText(txt, x, y, color, fontSize = "20px") {
  ctx.font = fontSize + " 'Orbitron', sans-serif";
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.fillText(txt, x, y);
}

class backgroundObj {
  constructor(img, x, y, speed) {
    this.x = x;
    this.y = y;
    this.width = 2000;
    this.height = 900;
    this.img = img;
    this.img = img;
    this.factor = speed;
  }
  draw() {
    ctx.save();
    ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
    ctx.restore();
  }

  update() {
    this.x -= this.factor * game.speed;
    if (this.x <= -this.width) {
      this.x += this.width * 2;
    }
  }
}

let background1 = new backgroundObj(bg0, 0, 0, 3);
let background1a = new backgroundObj(bg0, 2000, 0, 3);
let background2 = new backgroundObj(bg1, 0, 0, 2);
let background2a = new backgroundObj(bg1, 2000, 0, 2);
let background3 = new backgroundObj(bg2, 0, 0, 1);
let background3a = new backgroundObj(bg2, 2000, 0, 1);

function updateStarField() {
  background3.update();
  background3a.update();
  background2.update();
  background2a.update();
  background1.update();
  background1a.update();
}

function drawStarField() {
  background3.draw();
  background3a.draw();
  background2.draw();
  background2a.draw();
  background1.draw();
  background1a.draw();
}

function updateCamera() {
  const offset = player1.y + player1.height / 2 - canvasHeight / 2;
  const target = -offset * 0.7;
  const bgHeight = worldHeight;
  const minY = canvasHeight - bgHeight;
  const maxY = 0;

  const clamped = Math.max(minY, Math.min(maxY, target));
  cameraY += (clamped - cameraY) * 0.1;
}

class ObjectPool {
  constructor(createFn, initialSize) {
    this.pool = [];
    this.createFn = createFn;
    for (let i = 0; i < initialSize; i++) {
      let obj = createFn();
      obj.active = false;
      this.pool.push(obj);
    }
  }

  get(...args) {
    let obj;
    if (this.pool.length > 0) {
      obj = this.pool.pop();
    } else {
      obj = this.createFn();
    }
    obj.spawn(...args);
    return obj;
  }

  recycle(obj) {
    obj.active = false;
    this.pool.push(obj);
  }
}

class LaserBullet {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.width = 13;
    this.height = 4;
    this.speed = 16;
    this.angle = 0;
    this.isPlasma = false;
    this.vx = 0;
    this.vy = 0;
    this.active = false;
  }

  spawn(x, y, angle = 0) {
    this.x = x;
    this.y = y;
    this.width = 13;
    this.height = 4;
    this.speed = 16;
    this.angle = angle; // 0 = straight, positive = up, negative = down

    // Capture the state at creation time!
    // If born in surge, it stays a Plasma Bullet forever.
    // If born normal, it stays Blue forever.
    this.isPlasma = (game.surgePhase >= 1);

    // Calculate velocity components based on angle
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.active = true;
  }

  getHitbox() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  draw() {
    const padding = 20;
    ctx.save();

    if (typeof gameSettings === 'undefined' || gameSettings.bloomEnabled !== false) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glowSpriteCore, this.x + this.width / 2 - 25, this.y + this.height / 2 - 25);
      ctx.globalCompositeOperation = 'source-over';
    }

    // === SURGE OVERHEAT: PLASMA BULLET VISUAL ===
    if (this.isPlasma) {
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      ctx.rotate(this.angle);

      // Plasma Core (White hot)
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Plasma Glow (Intense Red/Orange)
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#ff3300";
      ctx.fillStyle = "rgba(255, 50, 0, 0.8)";
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Outer Plasma Field (Faint)
      ctx.shadowBlur = 25;
      ctx.shadowColor = "#ffaa00";
      ctx.fillStyle = "rgba(255, 150, 0, 0.4)";
      ctx.beginPath();
      ctx.ellipse(0, 0, 20, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // === REGULAR BLUE LASERS ===
      // No logic needed for fading anymore - it's per-bullet persistence now!

      // Rotate bullet sprite if angled
      if (this.angle !== 0) {
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(this.angle);
        ctx.drawImage(laserSprite, -this.width / 2 - padding, -this.height / 2 - padding);
      } else {
        ctx.drawImage(laserSprite, this.x - padding, this.y - padding);
      }
    }
    ctx.restore();
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
  }
}

class PlayerMissile {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 30;
    this.height = 12;
    this.speed = 2;
    this.maxSpeed = 18;
    this.vx = 2;
    this.vy = 0;
    this.target = null;
  }

  getHitbox() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  draw() {
    ctx.save();

    // Translate to center of missile
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    ctx.translate(cx, cy);

    // Rotate towards velocity
    const angle = Math.atan2(this.vy, this.vx);
    ctx.rotate(angle);

    // Draw Platypus-style Missile (Red Body, Fins)
    // Body (Red Cylinder)
    ctx.fillStyle = "#cc0000"; // Darker red main body
    ctx.beginPath();
    // Main fuselage
    ctx.moveTo(-10, -5);
    ctx.lineTo(8, -5);
    ctx.lineTo(15, 0); // Nose cone tip
    ctx.lineTo(8, 5);
    ctx.lineTo(-10, 5);
    ctx.closePath();
    ctx.fill();

    // Highlight (Shiny top)
    ctx.fillStyle = "#ff4444";
    ctx.fillRect(-8, -3, 14, 2);

    // Fins (Dark Red)
    ctx.fillStyle = "#880000";
    // Top Fin
    ctx.beginPath();
    ctx.moveTo(-10, -5);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-12, -10);
    ctx.lineTo(-12, -5);
    ctx.fill();
    // Bottom Fin
    ctx.beginPath();
    ctx.moveTo(-10, 5);
    ctx.lineTo(-5, 5);
    ctx.lineTo(-12, 10);
    ctx.lineTo(-12, 5);
    ctx.fill();

    ctx.restore();

    // SMOKE TRAIL (Thick grey/white puff)
    // Add puff occasionally
    if (Math.random() < 0.8) { // Frequent puffs for thick trail
      createParticles(this.x, this.y + this.height / 2 + (Math.random() - 0.5) * 4, 1, Math.random() < 0.5 ? "#dddddd" : "#aaaaaa");
      // Note: We're reusing 'createParticles' which makes small squares appearing for a split second. 
      // Ideally we want lingering smoke. But I'll stick to particles for now to save performance/logic.
      // Or I can spawn a specific "Smoke" particle if class exists?
      // No specific smoke class, but I can use createParticles with size/color.
    }
  }

  update() {
    this.speed *= 1.08;
    if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;

    if (!this.target || !enemyShipArray.includes(this.target)) {
      let minDist = 100000;
      let closest = null;
      for (let e of enemyShipArray) {
        let dx = e.x - this.x;
        let dy = e.y - this.y;
        let d = Math.sqrt(dx * dx + dy * dy);
        if (d < minDist) {
          minDist = d;
          closest = e;
        }
      }
      this.target = closest;
    }

    if (this.target) {
      let tx = this.target.x + this.target.width / 2;
      let ty = this.target.y + this.target.height / 2;
      let dx = tx - this.x;
      let dy = ty - this.y;
      let angle = Math.atan2(dy, dx);

      this.vx = Math.cos(angle) * this.speed;
      this.vy = Math.sin(angle) * this.speed;
    } else {
      this.vx = this.speed;
      this.vy = 0;
    }

    this.x += this.vx;
    this.y += this.vy;
  }
}

// === EASING FUNCTIONS ===
function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

function easeInQuad(t) {
  return t * t;
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

class EnemyObj {
  constructor(x, y, speed, img, pattern = "straight", imgIndex = 0) {
    this.x = x;
    this.y = y;
    this.width = 145;
    this.height = 90;
    this.image = img;
    this.speed = speed;
    this.health = 100;
    this.damage = 10;
    this.pattern = pattern;
    this.isMiniBoss = false;

    // Tag if spawned during surge (for shooting logic)
    // If spawned during surge, they NEVER shoot, even after surge ends
    this.spawnedInSurge = (game.surgePhase >= 1);

    // Glow Color based on Ship Type
    const colors = [
      "rgba(50, 255, 50, 0.8)",   // 0: Green
      "rgba(255, 100, 0, 0.8)",   // 1: Orange
      "rgba(0, 255, 255, 0.8)",   // 2: Cyan
      "rgba(255, 215, 0, 0.8)"    // 3: Gold
    ];
    this.glowColor = colors[imgIndex] || "white";

    // Pattern-specific state
    this.angle = Math.random() * Math.PI * 2;
    this.baseY = y;
    this.baseX = x;
    this.time = 0;
    this.maxTime = 300; // For easing calculations

    // Dive pattern state (LESS AGGRESSIVE)
    this.diveState = "approach";
    this.diveStartY = y;
    this.diveTargetY = 0;
    this.diveProgress = 0;

    // Swoop pattern state (GENTLER)
    this.swoopPhase = 0;
    this.swoopDirection = Math.random() > 0.5 ? 1 : -1;
    this.swoopAmplitude = 80; // Reduced from 120

    // Hover pattern state
    this.hoverX = canvasWidth * (0.6 + Math.random() * 0.2); // Further right, safer
    this.hoverReached = false;
    this.hoverTime = 0;

    // Zigzag pattern state (SLOWER)
    this.zigzagPhase = 0;

    // Wave pattern
    this.waveAmplitude = 100; // Reduced from 150

    // === FR-006: ADVANCED AI SPAWNS ===
    this.isFollower = false;
    this.leader = null;
    this.followerDelay = 0; // delay in frames
    this.patternSpeed = 0.05;
    this.ampX = 100;
    this.ampY = 100;
    this.freqX = 0.05;
    this.freqY = 0.03;
  }

  getHitbox() {
    // === SURGE OPTIMIZATION: USE SIMPLE RECTANGLE ===
    // During Surge, we sacrifice accuracy for performance
    if (game.surgePhase >= 1) {
      // Simple, slightly smaller box
      const w = this.width * 0.6;
      const h = this.height * 0.5;
      const x = this.x + (this.width - w) / 2;
      const y = this.y + (this.height - h) / 2;
      return { x, y, width: w, height: h };
    }

    // === RIEMANN SUM STYLE HITBOXES (Normal Play) ===

    // Check if this enemy is one of the "Alien" types (Big Nose, Small Tail)
    const isAlien = this.image && (this.image.src.includes("alien_1.png") || this.image.src.includes("alien_2.png"));

    let shapes = [];

    if (isAlien) {
      // === ALIEN SHAPE (Inverse: Big Front, Small Back) ===
      // 1. Hammerhead Nose (Huge, Front)
      shapes.push({
        x: this.x,
        y: this.y + this.height * 0.1, // Tall coverage
        width: this.width * 0.4,       // Wide nose
        height: this.height * 0.8
      });

      // 2. Body (Tapering)
      shapes.push({
        x: this.x + this.width * 0.4,
        y: this.y + this.height * 0.25,
        width: this.width * 0.3,
        height: this.height * 0.5
      });

      // 3. Tail (Tiny)
      shapes.push({
        x: this.x + this.width * 0.7,
        y: this.y + this.height * 0.4,
        width: this.width * 0.3,
        height: this.height * 0.2
      });

    } else {
      // === STANDARD SHIP SHAPE (Small Front, Big Back) ===
      // 1. Nose (Small, Front)
      shapes.push({
        x: this.x,
        y: this.y + this.height * 0.35,
        width: this.width * 0.25,
        height: this.height * 0.3
      });

      // 2. Main Body (Thick, Middle)
      shapes.push({
        x: this.x + this.width * 0.25,
        y: this.y + this.height * 0.2, // Tighter top/bottom
        width: this.width * 0.45,
        height: this.height * 0.6
      });

      // 3. Engine/Wings (Tall, Back)
      shapes.push({
        x: this.x + this.width * 0.7,
        y: this.y + this.height * 0.1,
        width: this.width * 0.3,
        height: this.height * 0.8
      });
    }

    // Return object containing BOTH the main bounding box (for rough checks if needed)
    // AND the granular shapes array for the precision collision check.
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height,
      shapes: shapes
    };
  }

  draw() {
    ctx.save();

    // Draw Nose Glow (Left side, facing player)
    // Only for standard enemies (MiniBoss has its own draw)
    // OPTIMIZATION: Fade glow based on surge intensity
    if (!this.isMiniBoss) {
      let surgeFactor = Math.max(0, game.surge - 1.0);
      let alpha = 0.8 * Math.max(0, 1 - (surgeFactor * 0.5)); // Fades back over ramp down

      if (alpha > 0.05) {
        let noseX = this.x + 15;
        noseX = Math.max(noseX, this.x + 5); // Safety
        let noseY = this.y + this.height / 2;

        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = alpha;

        // Light Bulb Gradient
        let g = ctx.createRadialGradient(noseX, noseY, 2, noseX, noseY, 25);
        g.addColorStop(0, this.glowColor);
        g.addColorStop(1, "rgba(0,0,0,0)");

        ctx.fillStyle = g;
        // Draw glow rect
        ctx.fillRect(this.x - 20, this.y, 60, this.height);

        // Reset composite
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1.0;
      }
    }

    ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    ctx.restore();
  }

  update() {
    this.time++;

    switch (this.pattern) {
      case "straight":
        // Simple left movement with slight ease-out at start
        let straightProgress = Math.min(this.time / 60, 1);
        let straightEase = easeOutQuad(straightProgress);
        this.x -= this.speed * (0.5 + straightEase * 0.5);
        break;

      case "sine":
        // Smooth sine wave with eased amplitude
        this.x -= this.speed;
        this.angle += 0.04; // Slower oscillation
        let sineEase = easeInOutSine(Math.abs(Math.sin(this.angle)));
        this.y = this.baseY + Math.sin(this.angle) * 50 * sineEase;
        break;

      case "dive":
        // GENTLER dive: approach slowly, dive with easing, exit smoothly
        if (this.diveState === "approach") {
          // Ease-in approach
          let approachProgress = Math.min(this.time / 90, 1);
          this.x -= this.speed * 0.5 * easeInQuad(approachProgress);

          if (this.x < canvasWidth * 0.65) {
            this.diveState = "dive";
            this.diveStartY = this.y;
            // Target near player but not exactly on them (offset by 50-100px)
            let offset = (Math.random() > 0.5 ? 1 : -1) * (50 + Math.random() * 50);
            this.diveTargetY = Math.max(60, Math.min(canvasHeight - 150, player1.y + offset));
            this.diveProgress = 0;
          }
        } else if (this.diveState === "dive") {
          this.diveProgress += 0.015; // Slower dive
          let eased = easeInOutCubic(Math.min(this.diveProgress, 1));

          this.y = this.diveStartY + (this.diveTargetY - this.diveStartY) * eased;
          this.x -= this.speed * 0.8;

          if (this.diveProgress >= 1) {
            this.diveState = "exit";
            this.time = 0;
          }
        } else {
          // Smooth exit with ease-out
          let exitProgress = Math.min(this.time / 60, 1);
          this.x -= this.speed * (1 + easeOutQuad(exitProgress) * 0.5);
        }
        break;

      case "swoop":
        // Gentle swooping arc with eased motion
        this.x -= this.speed * 0.9;
        this.swoopPhase += 0.02; // Slower swoop

        // Eased swoop motion
        let swoopT = (Math.sin(this.swoopPhase) + 1) / 2; // 0 to 1
        let easedSwoop = easeInOutSine(swoopT);
        this.y = this.baseY + (easedSwoop * 2 - 1) * this.swoopAmplitude * this.swoopDirection;
        break;

      case "hover":
        // Smooth approach, gentle hover, eased retreat
        if (!this.hoverReached) {
          let approachDist = this.baseX - this.hoverX;
          let currentDist = this.x - this.hoverX;
          let progress = 1 - (currentDist / approachDist);

          // Ease-out as approaching stop point
          let moveSpeed = this.speed * (1 - easeOutQuad(Math.min(progress * 1.5, 1)) * 0.7);
          this.x -= Math.max(moveSpeed, 0.5);

          if (this.x <= this.hoverX) {
            this.hoverReached = true;
            this.hoverTime = 0;
            this.baseY = this.y;
          }
        } else {
          this.hoverTime++;
          // Gentle bobbing with eased motion
          let bobPhase = this.hoverTime * 0.03;
          let easedBob = easeInOutSine((Math.sin(bobPhase) + 1) / 2);
          this.y = this.baseY + (easedBob * 2 - 1) * 15;

          // After 2.5 seconds, ease out retreat
          if (this.hoverTime > 225) {
            let retreatProgress = (this.hoverTime - 225) / 120;
            this.x -= this.speed * 0.3 * easeInQuad(Math.min(retreatProgress, 1));
          }
        }
        break;

      case "zigzag":
        // Smooth zigzag with eased direction changes
        this.x -= this.speed * 0.85;
        this.zigzagPhase += 0.04; // Slower zigzag

        // Smooth sine-based zigzag instead of harsh direction changes
        let zigzagEase = easeInOutSine((Math.sin(this.zigzagPhase) + 1) / 2);
        this.y = this.baseY + (zigzagEase * 2 - 1) * 40;
        break;

      case "wave":
        // Large gentle wave with eased peaks
        this.x -= this.speed * 0.8;
        this.angle += 0.015; // Very slow wave

        let waveT = (Math.sin(this.angle) + 1) / 2;
        let easedWave = easeInOutCubic(waveT);
        this.y = this.baseY + (easedWave * 2 - 1) * this.waveAmplitude;
        break;

      case "circle":
        {
          const t = (this.time - this.followerDelay) * this.patternSpeed;
          const pos = FormationMath.getCircle(t, 1, this.ampY);
          this.x = this.baseX - (this.time * this.speed) + pos.x;
          this.y = this.baseY + pos.y;
        }
        break;

      case "lissajous":
        {
          const t = (this.time - this.followerDelay);
          const pos = FormationMath.getLissajous(t, this.freqX, this.freqY, this.ampX, this.ampY);
          this.x = this.baseX - (this.time * this.speed) + pos.x;
          this.y = this.baseY + pos.y;
        }
        break;

      default:
        this.x -= this.speed;
    }

    // Keep within vertical bounds with soft clamping
    if (this.y < 30) this.y = 30 + (30 - this.y) * 0.1;
    if (this.y > canvasHeight - this.height - 30) {
      let overflow = this.y - (canvasHeight - this.height - 30);
      this.y = canvasHeight - this.height - 30 - overflow * 0.1;
    }

    // Hard clamp as safety
    this.y = Math.max(20, Math.min(this.y, canvasHeight - this.height - 20));
  }
}

// === MINI-BOSS ENEMY CLASS ===
// Larger, tougher enemies with smooth eased figure-8 AI
class MiniBoss extends EnemyObj {
  constructor(x, y, img) {
    super(x, y, 2, img, "figure8");
    this.isMiniBoss = true;

    this.width = 260;
    this.height = 162;
    this.health = 3900;

    // AI State
    this.aiState = "entering";
    this.enterStartX = x;
    this.stopX = canvasWidth * 0.55;
    this.enterProgress = 0;

    this.figure8Time = 0;
    this.figure8Speed = 0.012; // Slower, more graceful
    this.baseY = y;
    this.amplitude = 70; // Reduced vertical movement
    this.horizontalAmplitude = 50;
  }

  update() {
    if (this.aiState === "entering") {
      // Smooth ease-out entrance
      this.enterProgress += 0.008;
      let eased = easeOutCubic(Math.min(this.enterProgress, 1));

      this.x = this.enterStartX - (this.enterStartX - this.stopX) * eased;

      if (this.enterProgress >= 1) {
        this.aiState = "intercepting";
        this.baseY = this.y;
        this.figure8Time = 0;
      }
    } else if (this.aiState === "intercepting") {
      this.figure8Time += this.figure8Speed;

      // Eased horizontal oscillation
      let horzT = (Math.sin(this.figure8Time) + 1) / 2;
      let easedHorz = easeInOutSine(horzT);
      this.x = this.stopX + (easedHorz * 2 - 1) * this.horizontalAmplitude;

      // Eased vertical figure-8 motion
      let vertT = (Math.sin(this.figure8Time * 2) + 1) / 2;
      let easedVert = easeInOutCubic(vertT);
      this.y = this.baseY + (easedVert * 2 - 1) * this.amplitude;

      // Soft bounds
      if (this.y < 60) this.y = 60;
      if (this.y > canvasHeight - this.height - 60) {
        this.y = canvasHeight - this.height - 60;
      }
    }
  }

  draw() {
    ctx.save();
    ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
    ctx.restore();
  }
}

// === CAMERA SHAKE SYSTEM ===
// === CAMERA BREATHE SYSTEM (Ported from IdleSway.lua) ===
// Figure-8 breathing pattern with Perlin-like noise modulation.
// Mimics natural head movement: sin(t) for X, sin(2t) for Y
// creates an infinity-loop sway. Noise varies breath depth
// so no two cycles feel identical.
const cameraBreathe = {
  // Internal state
  clock: 0,
  _currentX: 0,
  _currentY: 0,
  _currentRoll: 0,

  // Output (read by drawGame)
  offsetX: 0,
  offsetY: 0,
  rotation: 0,

  // === TUNING KNOBS ===
  intensity: 1.0,      // Master amplitude multiplier
  frequency: 0.75,     // Oscillation speed (matches Roblox script)
  baseAmplitudeX: 14,  // Base horizontal sway in pixels
  baseAmplitudeY: 9,   // Base vertical sway in pixels
  rollFactor: 0.0015,  // How much X-sway tilts the camera (radians per pixel)
  lerpSpeed: 0.05,     // Blend rate (lower = smoother/laggier, 0.05 = silky)

  // --- Deterministic value noise (replaces math.noise from Lua) ---
  _hash(n) {
    const x = Math.sin(n * 127.1) * 43758.5453;
    return x - Math.floor(x);
  },

  // Smooth interpolated 1D noise, returns 0..1
  _smoothNoise(t) {
    const i = Math.floor(t);
    const f = t - i;
    // Hermite smoothstep for buttery interpolation
    const u = f * f * (3.0 - 2.0 * f);
    return this._hash(i) * (1.0 - u) + this._hash(i + 1) * u;
  },

  // Convenience: returns -1..1 with seed offset
  _noise(t, seed) {
    return this._smoothNoise(t + seed) * 2.0 - 1.0;
  },

  update() {
    const dt = 1 / 90;
    this.clock += dt * this.frequency;

    // 1. Perlin-like noise injection (the "human" element)
    //    Slow clock multiplier (0.15) = changes over several seconds
    const noiseWanderX = this._noise(this.clock * 0.15, 0);
    const noiseWanderY = this._noise(this.clock * 0.15, 1000);

    // 2. Modulate amplitude: ±30% variation per axis
    //    Some breaths are deeper, some shallower
    const amplitudeX = this.baseAmplitudeX * this.intensity * (1 + noiseWanderX * 0.3);
    const amplitudeY = this.baseAmplitudeY * this.intensity * (1 + noiseWanderY * 0.3);

    // 3. Figure-8 pattern: X = sin(t), Y = sin(2t)
    //    Plus tiny noise offset to break the perfect infinity loop
    const targetX = Math.sin(this.clock) * amplitudeX
                   + noiseWanderX * 2.0 * this.intensity;
    const targetY = Math.sin(this.clock * 2) * amplitudeY
                   + noiseWanderY * 2.0 * this.intensity;

    // 4. Roll tied to horizontal sway (sells the head-tilt)
    const targetRoll = targetX * this.rollFactor;

    // 5. Smooth lerp blend (CFrame:Lerp equivalent)
    //    This prevents any jarring snaps and creates that
    //    buttery, organic lag feel
    this._currentX += (targetX - this._currentX) * this.lerpSpeed;
    this._currentY += (targetY - this._currentY) * this.lerpSpeed;
    this._currentRoll += (targetRoll - this._currentRoll) * this.lerpSpeed;

    // 6. Publish to output
    this.offsetX = this._currentX;
    this.offsetY = this._currentY;
    this.rotation = this._currentRoll;
  }
};

const cameraShake = {
  active: false,
  duration: 0,
  elapsed: 0,
  amplitude: 0,
  frequency: 3,
  offsetX: 0,
  offsetY: 0,

  start(intensity = 1) {
    // intensity: 0.5 = light, 1 = medium, 1.5 = strong
    let newAmp = 10 * intensity;

    // Priority Check: If a strong shake (like Bomb) is active, don't override with a weak one
    if (this.active && this.amplitude > newAmp && (this.duration - this.elapsed) > 100) {
      return;
    }

    this.active = true;
    this.duration = 150 * intensity; // milliseconds
    this.elapsed = 0;
    // Amplitude multiplier: 10 pixels per intensity unit
    this.amplitude = newAmp;
    this.frequency = 3; // Default frequency
  },

  startBomb() {
    this.active = true;
    this.duration = 2200; // EXACTLY 2.2s
    this.elapsed = 0;
    this.amplitude = 80; // Even MORE Aggressive (Doubled)
    this.frequency = 60; // Higher frequency for violent shake
  },

  update(deltaTime) {
    if (!this.active) {
      this.offsetX = 0;
      this.offsetY = 0;
      return;
    }

    this.elapsed += deltaTime;

    if (this.elapsed >= this.duration) {
      this.active = false;
      this.offsetX = 0;
      this.offsetY = 0;
      return;
    }

    // Calculate shake using sine wave with decay
    const progress = this.elapsed / this.duration;
    // Ease Out: (1 - progress)^2 makes it drop faster initially? 
    // Actually, "Ease Out" for a value dropping from 1 to 0 usually means it slows down as it reaches 0.
    // So 1 - progress^2? No.
    // Let's use a simple power curve that feels "gradual".
    const decay = Math.pow(1 - progress, 2);
    const shakeAmount = this.amplitude * decay;

    // Oscillate based on frequency
    // frequency * elapsed (ms) -> scaling factor needs to be right. 
    // sin(time * freq).
    const oscillation = Math.sin(this.elapsed * 0.01 * this.frequency);

    // Random direction for more organic feel
    this.offsetX = oscillation * shakeAmount * (Math.random() * 0.4 + 0.8);
    this.offsetY = Math.cos(this.elapsed * 0.012 * this.frequency) * shakeAmount * (Math.random() * 0.4 + 0.8);
  }
};

// === 🔥 VIOLENT SURGE SHAKE SYSTEM ===
// Creates intense, chaotic screen shake during Adrenaline Surge
const surgeShake = {
  active: false,
  startTime: 0,
  duration: 0,
  fadeOutStart: 0,

  amplitude: 15, // Increased from 10 (compensate for no rotation)
  frequency: 50, // 40-60 Hz

  offsetX: 0,
  offsetY: 0,
  offsetRotation: 0,

  directionChangeTimer: 0,
  directionChangeInterval: 2,
  currentDirectionX: 0,
  currentDirectionY: 0,
  currentDirectionRot: 0,

  blurIntensity: 0,

  start() {
    this.active = true;
    this.startTime = Date.now();
    // Duration: 1.5s delay + 18.5s effect = 20s total surge cycle
    this.duration = 18500;
    this.fadeOutStart = this.duration - 4000; // Starts fade exactly when Ramp Down begins
    this.amplitude = 15; // Increased for more visible shake
    this.frequency = 50;
    this.directionChangeTimer = 0;
    console.log("SURGE SHAKE: ACTIVATED");
  },

  stop() {
    this.active = false;
    this.offsetX = 0;
    this.offsetY = 0;
    this.offsetRotation = 0;
    this.blurIntensity = 0;
    console.log("SURGE SHAKE: DEACTIVATED");
  },

  update() {
    if (!this.active) {
      this.offsetX = 0;
      this.offsetY = 0;
      this.offsetRotation = 0;
      this.blurIntensity = 0;
      return;
    }

    let elapsed = Date.now() - this.startTime;

    if (elapsed >= this.duration) {
      this.stop();
      return;
    }

    // Intensity with fade out (4s duration)
    let intensity = 1.0;
    if (elapsed >= this.fadeOutStart) {
      let fadeProgress = (elapsed - this.fadeOutStart) / 4000;
      intensity = 1.0 - fadeProgress;
    }

    // Rapid direction changes (every 2 frames)
    this.directionChangeTimer++;
    if (this.directionChangeTimer >= this.directionChangeInterval) {
      this.directionChangeTimer = 0;
      this.currentDirectionX = (Math.random() - 0.5) * 2;
      this.currentDirectionY = (Math.random() - 0.5) * 2;
      this.currentDirectionRot = (Math.random() - 0.5) * 2;
    }

    // High-frequency oscillation
    let timeScale = elapsed * 0.001;
    let oscillationX = Math.sin(timeScale * this.frequency * (1 + Math.random() * 0.2));
    let oscillationY = Math.cos(timeScale * this.frequency * (1 + Math.random() * 0.2));
    let oscillationRot = Math.sin(timeScale * this.frequency * 0.5) * (Math.random() * 0.4 + 0.8);

    // Jitter
    let jitter = 0.8 + Math.random() * 0.4;
    let effectiveAmplitude = this.amplitude * intensity * jitter;

    // Multi-axis movement
    this.offsetX = this.currentDirectionX * oscillationX * effectiveAmplitude;
    this.offsetY = this.currentDirectionY * oscillationY * effectiveAmplitude;
    this.offsetRotation = this.currentDirectionRot * oscillationRot * 0.015 * intensity;

    this.blurIntensity = intensity * 8;
  }
};

// === 🔥 SURGE BRIGHTNESS FLASH ===
const surgeFlash = {
  active: false,
  intensity: 0,
  pulseSpeed: 3,

  start() {
    this.active = true;
    this.intensity = 0;
    this.startTime = Date.now();
    this.duration = 18500; // Sync with surge cycle (1.5s delay -> 20s end)
    this.fadeOutStart = this.duration - 4000; // 4s fade (starts at surge ramp down)
    console.log("SURGE FLASH: ACTIVATED");
  },

  stop() {
    this.active = false;
    this.intensity = 0;
    console.log("SURGE FLASH: DEACTIVATED");
  },

  update() {
    if (!this.active) {
      this.intensity = 0;
      return;
    }

    let now = Date.now();
    let time = now * 0.001;
    let elapsed = now - this.startTime;

    // Safety duration stop (1.5s delay + 18.5s total = 20s life)
    if (elapsed >= this.duration) {
      this.stop();
      return;
    }

    // Base pulsing intensity
    let baseIntensity = 0.15 + Math.sin(time * this.pulseSpeed) * 0.1;

    // Phase 1: 5.5s Cubic Ease In for smooth build-up
    let easeInDuration = 5500;
    let easeInFactor = Math.min(1.0, elapsed / easeInDuration);
    easeInFactor = easeInFactor * easeInFactor * easeInFactor; // Cubic curve

    // Phase 2: Smooth Linear Fade Out (starts 4s before duration end)
    let fadeOutFactor = 1.0;
    if (elapsed >= this.fadeOutStart) {
      fadeOutFactor = 1.0 - (elapsed - this.fadeOutStart) / 4000;
      fadeOutFactor = Math.max(0, fadeOutFactor);
    }

    this.intensity = baseIntensity * easeInFactor * fadeOutFactor;
  },

  apply(ctx) {
    if (!this.active || this.intensity <= 0) return;

    ctx.save();

    // === COLOR GRADING (Brightness Boost) ===
    // Layer 1: SCREEN (Brightens everything, preserves colors)
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = this.intensity * 0.4; // 40% max
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasWidth, worldHeight); // Use worldHeight

    // Layer 2: OVERLAY (High Contrast Highlights)
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = this.intensity * 0.5; // 50% max
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasWidth, worldHeight); // Use worldHeight
    ctx.restore();
  }
};

let wrathClock = {
  active: false,
  intensity: 0,
  rotation: 0,
  starRotation: 0, // Independent rotation for stars
  startTime: 0,
  duration: 18500,
  fadeOutStart: 14500,

  start() {
    this.active = true;
    this.startTime = Date.now();
    this.intensity = 0;
    this.rotation = 0;
    this.starRotation = 0;

    // Play Surge/Divine Aura Sounds
    playSfxWithVolume("music/sfx/ClockAura.wav", 0.7);
    playSfxWithVolume("music/sfx/SpiralPlayer.wav", 0.7);

    console.log("WRATH CLOCK: DIVINE OVERDRIVE ACTIVATED");
  },

  stop() {
    this.active = false;
    this.intensity = 0;
  },

  update() {
    if (!this.active) return;
    let elapsed = Date.now() - this.startTime;

    if (elapsed >= this.duration) {
      this.stop();
      return;
    }

    let easeIn = Math.min(1.0, elapsed / 1200);
    let fadeOut = 1.0;
    if (elapsed >= this.fadeOutStart) {
      fadeOut = 1.0 - (elapsed - this.fadeOutStart) / 4000;
    }

    this.intensity = easeIn * Math.max(0, fadeOut);

    // Simple steady rotation for the divine symbol
    this.rotation += 0.012 * (0.5 + this.intensity * 0.5);

    // Stars and Collision logic removed by user request
  },

  draw(ctx, px, py, pw, ph) {
    if (!this.active || this.intensity <= 0) return;

    ctx.save();
    const centerX = px + pw / 2;
    const centerY = py + ph / 2;

    // === PART 1: The Central Dial (PULSING) ===
    ctx.save();
    ctx.translate(centerX, centerY);

    // Scale pulse for "divine breathing"
    let pulseScale = 1.0 + Math.sin(Date.now() * 0.004) * 0.06 * this.intensity;
    ctx.scale(pulseScale, pulseScale);

    const baseRadius = 65;
    ctx.globalCompositeOperation = "screen";

    // --- 1. THE STAR STRETCH (Huge Luminous God Rays) ---
    ctx.save();
    ctx.rotate(this.rotation * 0.8);
    // Intense Bloom for rays
    ctx.shadowBlur = 60 * this.intensity;
    ctx.shadowColor = `rgba(255, 255, 200, ${this.intensity})`;

    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      let rayGrad = ctx.createLinearGradient(0, 0, 0, baseRadius * 5); // Extended reach
      rayGrad.addColorStop(0, `rgba(255, 255, 255, ${this.intensity * 0.9})`); // Blinding white start
      rayGrad.addColorStop(0.3, `rgba(255, 220, 100, ${this.intensity * 0.6})`); // Godly gold mid
      rayGrad.addColorStop(1, "rgba(255, 215, 0, 0)"); // Fade out

      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(20, 0);
      ctx.lineTo(4, baseRadius * 5);
      ctx.lineTo(-4, baseRadius * 5);
      ctx.fill();
    }
    ctx.restore();

    // --- 2. THE SQUARE FRAME (Divine Square "[ ]") ---
    ctx.save();
    ctx.rotate(-this.rotation * 1.5);
    ctx.shadowBlur = 30 * this.intensity;
    ctx.shadowColor = "white";
    ctx.strokeStyle = `rgba(255, 255, 255, ${this.intensity * 0.9})`;
    ctx.lineWidth = 4;
    const sqSize = 35;
    ctx.strokeRect(-sqSize, -sqSize, sqSize * 2, sqSize * 2);
    ctx.restore();

    // --- 3. MAIN DIAL (Circular Face & Spikes) ---
    ctx.save();
    ctx.rotate(this.rotation);

    // Core Ring
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${this.intensity * 0.5})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Radial Spikes
    for (let i = 0; i < 12; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI * 2) / 12);
      ctx.fillStyle = `rgba(255, 255, 255, ${this.intensity * 0.8})`;
      ctx.fillRect(baseRadius - 8, -2, 16, 4);
      ctx.restore();
    }
    ctx.restore();

    // --- 4. EXTREME CENTER BLOOM ---
    ctx.shadowBlur = 100 * this.intensity;
    ctx.shadowColor = "rgba(255, 215, 0, 1)";
    let coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius * 1.5);
    coreGrad.addColorStop(0, `rgba(255, 255, 255, ${this.intensity})`);
    coreGrad.addColorStop(0.2, `rgba(255, 255, 200, ${this.intensity * 0.8})`);
    coreGrad.addColorStop(0.5, `rgba(255, 215, 0, ${this.intensity * 0.4})`);
    coreGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(0, 0, baseRadius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // End of Pulsing Central Transform

    ctx.restore(); // Final Restore
  }
};

// === BIG EXPLOSION (Platypus Style) ===
// For mini-boss deaths, missiles, bombs - with debris, smoke, fire
let lastExplosionTime = 0; // Throttle tracker

class BigExplosion {
  constructor(x, y, scale = 1.0) {
    this.x = x;
    this.y = y;
    this.scale = scale;
    this.frame = 0;
    this.maxFrames = 60; // Longer than normal explosion

    // Create debris particles
    this.debris = [];
    for (let i = 0; i < 12; i++) {
      this.debris.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 12 * scale,
        vy: (Math.random() - 0.5) * 12 * scale,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.3,
        size: (8 + Math.random() * 15) * scale,
        color: Math.random() > 0.5 ? "#555" : "#777"
      });
    }

    // Create smoke particles (Only for Mini-Boss / Large Scale)
    this.smoke = [];
    if (scale >= 1.0) {
      for (let i = 0; i < 8; i++) {
        this.smoke.push({
          x: x + (Math.random() - 0.5) * 40 * scale,
          y: y + (Math.random() - 0.5) * 40 * scale,
          size: (20 + Math.random() * 30) * scale,
          alpha: 0.6,
          vx: (Math.random() - 0.5) * 2 * scale,
          vy: (-1 - Math.random() * 2) * scale
        });
      }
    }

    // Create fire particles
    this.fire = [];
    for (let i = 0; i < 15; i++) {
      this.fire.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 8 * scale,
        vy: (Math.random() - 0.5) * 8 * scale,
        size: (15 + Math.random() * 25) * scale,
        life: 1
      });
    }

    // Play explosion sound
    if (gameSettings.sfxEnabled) {
      if (scale >= 1.0) {
        miniBossDeadSound.currentTime = 0;
        miniBossDeadSound.volume = 0.5; // Mid-tier impactful event
        miniBossDeadSound.play().catch(() => { });
      } else {
        // Volume baseline for small explosions
        let vol = 0.4; // Increased from 0.22 for meatier impact
        if (game.surgePhase >= 1) {
          if (game.surgePhase === 3) {
            // Linear transition from Chaos (0.2) to Normal (0.4) over 2.5s
            let t = (7.0 - game.surge) / 6.0;
            vol = 0.2 + (0.4 - 0.2) * t;
          } else {
            vol = 0.1; // Chaos Volume (Reduced by 50%)
          }
        }

        // --- ! Claude FIX: AudioMixer.queueSound() was broken because processFrame() 
        // was NEVER CALLED anywhere in the game loop. The queue filled up but
        // sounds were never played. Changed to playImmediate() which directly
        // uses the pre-loaded audio pool and respects the volume parameter.
        // This fixes the surge volume reduction not taking effect.
        AudioMixer.playImmediate('explosion', null, vol);
      }
    }

    // Trigger camera shake
    cameraShake.start(1.2 * scale);
  }



  update() {
    this.frame++;

    // Update debris
    for (let d of this.debris) {
      d.x += d.vx;
      d.y += d.vy;
      d.vy += 0.2; // Gravity
      d.rotation += d.rotSpeed;
      d.vx *= 0.98; // Air resistance
    }

    // Update smoke
    for (let s of this.smoke) {
      s.x += s.vx;
      s.y += s.vy;
      s.size += 0.5;
      s.alpha -= 0.01;
    }

    // Update fire
    for (let f of this.fire) {
      f.x += f.vx;
      f.y += f.vy;
      f.life -= 0.03;
      f.size *= 0.96;
    }
  }

  draw() {
    const progress = this.frame / this.maxFrames;

    // Draw main explosion flash (first few frames)
    if (this.frame < 10) {
      const flashProgress = this.frame / 10;
      const flashRadius = (50 + 100 * flashProgress) * this.scale;
      ctx.save();
      ctx.globalAlpha = 1 - flashProgress;
      if (typeof gameSettings === 'undefined' || gameSettings.bloomEnabled !== false) {
        ctx.globalCompositeOperation = 'lighter';
      }
      let gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, flashRadius);
      gradient.addColorStop(0, "#ffffff");
      gradient.addColorStop(0.3, "#ffff00");
      gradient.addColorStop(0.6, "#ff6600");
      gradient.addColorStop(1, "#ff0000");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, flashRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw smoke (behind debris)
    for (let s of this.smoke) {
      if (s.alpha > 0) {
        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = "#444";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Draw fire
    for (let f of this.fire) {
      if (f.life > 0 && f.size > 2) {
        ctx.save();
        ctx.globalAlpha = f.life;
        let fireGradient = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size);
        fireGradient.addColorStop(0, "#ffff00");
        fireGradient.addColorStop(0.5, "#ff6600");
        fireGradient.addColorStop(1, "rgba(255, 0, 0, 0)");
        ctx.fillStyle = fireGradient;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Draw debris
    for (let d of this.debris) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rotation);
      ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.fillStyle = d.color;
      ctx.fillRect(-d.size / 2, -d.size / 2, d.size, d.size * 0.6);
      ctx.restore();
    }
  }

  get done() {
    return this.frame >= this.maxFrames;
  }
}

// Array for big explosions
let bigExplosions = [];

class EnemyBullet {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.width = 10;
    this.height = 4;
    this.colorType = "default";
    this.vx = 0;
    this.vy = 0;
    this.active = false;
  }

  spawn(x, y, targetX, targetY, colorType = "default") {
    this.x = x;
    this.y = y;
    this.width = 10;
    this.height = 4;
    this.colorType = colorType; // default, green, purple, blue

    const dx = targetX - x;
    const dy = targetY - y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    // bullet speedd - mark
    const speed = 5;

    this.vx = (dx / len) * speed;
    this.vy = (dy / len) * speed;
    this.active = true;
  }

  getHitbox() {
    const padding = 1;
    return {
      x: this.x + padding,
      y: this.y + padding,
      width: this.width - padding * 2,
      height: this.height - padding * 2,
    };
  }

  draw() {
    ctx.save();

    let glowSprite = glowSpriteEnemy;
    if (this.colorType === "green" || this.colorType === true) {
      glowSprite = glowSpriteEnemyGreen;
    } else if (this.colorType === "purple") {
      glowSprite = glowSpriteEnemyPurple;
    } else if (this.colorType === "blue") {
      glowSprite = glowSpriteEnemyBlue;
    }

    if (typeof gameSettings === 'undefined' || gameSettings.bloomEnabled !== false) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glowSprite, this.x - 25, this.y - 25);
      ctx.globalCompositeOperation = 'source-over';
    }

    // Choose Colors
    let glowColor, fillColor;

    if (this.colorType === "green" || this.colorType === true) {
      glowColor = "#00ff00";
      fillColor = "#33ff33";
    } else if (this.colorType === "purple") {
      glowColor = "#aa00ff";
      fillColor = "#d67aff";
    } else if (this.colorType === "blue") {
      glowColor = "#0088ff";
      fillColor = "#66b2ff";
    } else {
      // Default Orange/Red
      glowColor = "#ff3300";
      fillColor = "#ff5500";
    }

    // Neon Circle Bullet
    ctx.shadowBlur = 10;
    ctx.shadowColor = glowColor;
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
    ctx.fill();

    // Core (lighter)
    ctx.fillStyle = "#ffffaa";
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
  }
}

class Planet {
  constructor(img, isGigantic = false, imgIndex = 0) {
    this.image = img;
    this.isGigantic = isGigantic;

    // Custom Glow Colors based on Planet Type
    if (imgIndex === 2) {
      // Planet 3: Mars-like (Red)
      this.glowColor = "rgba(255, 50, 50, 0.4)";
    } else if (imgIndex === 3) {
      // Planet 4: Saturn-like (Gold)
      this.glowColor = "rgba(255, 215, 0, 0.4)";
    } else {
      // Default: Blue (or Orange if Gigantic)
      this.glowColor = isGigantic ? "rgba(255, 80, 40, 0.3)" : "rgba(100, 200, 255, 0.2)";
    }

    // PLANET SCALE UPDATE: Planets are now 2.5x larger on average
    // Normal planets: 1.0 -> 2.5 (400px)
    // Gigantic planets: 5.0 -> 12.0 (1920px)
    let scale = isGigantic ? 6.0 : 2.5;

    this.width = 160 * scale;
    this.height = 160 * scale;

    this.x = canvasWidth + 50;
    // Allow spawning slightly out of vertical bounds for variety, especially giants
    const yRange = canvasHeight + this.height;
    this.y = Math.random() * yRange - (this.height * 0.5);

    this.speed = isGigantic ? 0.8 : 1.2; // Giants move slightly slower
    this.floatX = canvasWidth + 200; // Start further out
    this.x = Math.round(this.floatX);
    this.active = true;
  }

  draw() {
    // Prep Offscreen Buffer
    offscreenCanvas.width = this.width;
    offscreenCanvas.height = this.height;
    offscreenCtx.clearRect(0, 0, this.width, this.height);

    let localCx = this.width / 2;
    let localCy = this.height / 2;
    let radius = this.width / 2;

    // 1. Draw Image to Offscreen
    offscreenCtx.drawImage(this.image, 0, 0, this.width, this.height);

    // 2. Draw Shader Overlay (Inner Shadow for spherical effect)
    let shadowGrad = offscreenCtx.createRadialGradient(
      localCx - radius * 0.3, localCy - radius * 0.3, radius * 0.1,
      localCx, localCy, radius
    );
    shadowGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
    shadowGrad.addColorStop(0.7, "rgba(0, 0, 0, 0)");
    shadowGrad.addColorStop(1, "rgba(0, 0, 0, 0.6)");
    offscreenCtx.fillStyle = shadowGrad;
    offscreenCtx.fillRect(0, 0, this.width, this.height);

    // 3. APPLY FEATHER MASK (The 'Pro' Trick)
    // This softly fades the alpha at the edges to remove rough pixels
    // We use a safe offscreen context so it doesn't clip the main game background.
    offscreenCtx.globalCompositeOperation = "destination-in";
    let feather = offscreenCtx.createRadialGradient(localCx, localCy, radius * 0.94, localCx, localCy, radius);
    feather.addColorStop(0, "rgba(0,0,0,1.0)");
    feather.addColorStop(1, "rgba(0,0,0,0.0)");

    offscreenCtx.fillStyle = feather;
    offscreenCtx.beginPath();
    offscreenCtx.arc(localCx, localCy, radius, 0, Math.PI * 2);
    offscreenCtx.fill();
    offscreenCtx.globalCompositeOperation = "source-over";

    // 4. Draw Buffer to Main Canvas (Whole Pixels)
    ctx.drawImage(offscreenCanvas, Math.round(this.x), Math.round(this.y));
  }

  update() {
    // Smooth fractional position
    this.floatX -= this.speed * game.speed;
    this.x = this.floatX; // Keep raw for math, rounded for draw

    if (this.x < -this.width) {
      this.active = false;
    }
  }
}

let planetSpawnDelay = 0;

function spawnPlanet() {
  if (currentPlanet && currentPlanet.active) return;

  // 10% less often logic (Simulated via delay)
  if (planetSpawnDelay > 0) {
    planetSpawnDelay--;
    return;
  }

  // Chance to set a delay instead of spawning
  if (Math.random() < 0.1) {
    planetSpawnDelay = 60; // Skip spawning for 1 second
    return;
  }

  let imgIndex = Math.floor(Math.random() * planetImages.length);
  let randomImg = planetImages[imgIndex];

  // Gigantic Planet: 5% chance
  let isGigantic = Math.random() < 0.05;

  currentPlanet = new Planet(randomImg, isGigantic, imgIndex);
}

function addShips() {
  if (game.frames < 200) return;

  if (currentWave) {
    if (currentWave.spawned < currentWave.count) {
      if (currentWave.spawnTimer <= 0) {
        spawnEnemyFromWave(currentWave);
        currentWave.spawned++;
        let randomSpacing =
          currentWave.spacing + Math.floor(Math.random() * 30);
        currentWave.spawnTimer = randomSpacing;
      } else {
        currentWave.spawnTimer--;
      }
    } else {
      if (enemyShipArray.length === 0) {
        currentWave = null;
        waveCooldown = Math.max(60, 120 - game.level * 2);

        // === CHAOS: Surge Cooldown Reduction ===
        // If surge is active, waves spawn almost instantly!
        if (game.surgePhase >= 1) {
          waveCooldown = 20; // ~0.2s cooldown!
        }
      }
    }
  } else {
    if (waveCooldown > 0) {
      waveCooldown--;
    } else {
      startNewWave();
    }
  }
}

function startNewWave() {
  // --- CHAOS WAVE MODE ---

  let baseCount = 3;
  let scalingCount = Math.floor(game.level / 2);
  let rawCount = baseCount + scalingCount + Math.floor(Math.random() * 5);

  // === CHAOS: Surge Multiplier (5.0x !!!) ===
  // EXTREME MODE REQUESTED
  if (game.surgePhase >= 1) {
    rawCount = Math.floor(rawCount * 5.0);
  }

  // Increased cap for chaos
  let count = Math.min(60, rawCount);

  // Spacing dasar (nanti diacak lagi per musuh)
  let spacing = Math.max(15, 40 - game.level);

  // Faster spacing during surge
  if (game.surgePhase >= 1) {
    spacing = Math.max(8, Math.floor(spacing / 2.5));
  }

  currentWave = {
    count: count,
    spacing: spacing,
    spawned: 0,
    spawnTimer: 0,
  };
}

function spawnEnemyFromWave(wave) {
  // --- POSISI MUSUH ACAK ---
  const minY = 60;
  const maxY = canvasHeight - 120;

  const y = Math.random() * (maxY - minY) + minY;

  const xOffset = Math.random() * 200;

  const randomShip = Math.floor(Math.random() * enemyImgArray.length);

  // === MINI-BOSS SPAWN CHANCE (8% -> 25% during Surge) ===
  // Only spawn if there isn't already a mini-boss on screen
  const hasMiniBoss = enemyShipArray.some(e => e.isMiniBoss);
  let mbChance = (game.surgePhase >= 1) ? 0.25 : 0.08;

  if (!hasMiniBoss && Math.random() < mbChance && game.level >= 2) {
    // Spawn a mini-boss instead!
    let miniBoss = new MiniBoss(
      canvasWidth + 100,
      canvasHeight / 2 - 81, // Center vertically
      enemyImgArray[randomShip]
    );
    // ADRENALINE SURGE: MiniBoss spawns with 60% HP
    if (game.surgePhase >= 1) {
      miniBoss.health *= 0.6;
    }
    enemyShipArray.push(miniBoss);
    console.log("MINI-BOSS SPAWNED!");
    return;
  }

  // === ELITE TANK ENEMY (10% chance) ===
  // Red tint, tanks 8 hits, doesn't shoot, guaranteed power-up drop
  if (Math.random() < 0.10 && game.level >= 3) {
    let rawSpeed = 2.0 + Math.random() * 1; // Slower than normal
    let eliteTank = new EnemyObj(
      canvasWidth + 50 + xOffset,
      y,
      rawSpeed * 0.6, // 40% slower
      enemyImgArray[randomShip],
      "straight" // Simple movement
    );
    eliteTank.isEliteTank = true;
    eliteTank.health = 800; // ~8 hits to kill
    eliteTank.guaranteedDrop = true;
    enemyShipArray.push(eliteTank);
    console.log("ELITE TANK SPAWNED!");
    return;
  }

  // === SQUADRON SPAWN CHANCE (15%) ===
  if (Math.random() < 0.15 && game.level >= 4) {
    const type = Math.random() < 0.5 ? "circle" : "lissajous";
    spawnSquadron(type);
    return;
  }

  // Scaling Speed per 5 Level (0.2 factor) - SLOWED DOWN 40%
  let rawSpeed = (2.0 + Math.random() * 1.5 + game.level * 0.15) * 0.6; // 40% slower
  const speed = Math.min(rawSpeed, 5); // Lower max speed

  // === PLATYPUS-STYLE MOVEMENT PATTERNS ===
  // Weighted random selection - BALANCED for fair gameplay
  let roll = Math.random();
  let movementType;
  if (roll < 0.35) {
    movementType = "straight";      // 35% - Basic straight movement (safe, predictable)
  } else if (roll < 0.55) {
    movementType = "sine";          // 20% - Classic wave pattern (gentle)
  } else if (roll < 0.65) {
    movementType = "swoop";         // 10% - Swooping arc movement (telegraphed)
  } else if (roll < 0.75) {
    movementType = "wave";          // 10% - Large wave pattern (slow, easy to read)
  } else if (roll < 0.85) {
    movementType = "zigzag";        // 10% - Smooth zigzag pattern
  } else if (roll < 0.93) {
    movementType = "hover";         // 8% - Hover and retreat (stationary target)
  } else {
    movementType = "dive";          // 7% - Dive toward player (RARE, less punishing now)
  }

  let enemy = new EnemyObj(
    canvasWidth + 50 + xOffset,
    y,
    speed,
    enemyImgArray[randomShip],
    movementType,
    randomShip // Pass index for color mapping
  );

  // ENEMY HEALTH
  enemy.health = 60 + game.level * 10;

  // SURGE CHAOS: +50% HP
  if (game.surgePhase >= 1) {
    enemy.health *= 1.5;
  }

  enemy.isEliteTank = false;
  enemy.guaranteedDrop = false;

  enemyShipArray.push(enemy);
}

// === FR-006: SQUADRON SPAWNING SYSTEM ===
function spawnSquadron(type = "circle") {
  const count = 5 + Math.floor(Math.random() * 3);
  const startY = 100 + Math.random() * (canvasHeight - 200);
  const randomShip = Math.floor(Math.random() * enemyImgArray.length);
  const spacing = 40;
  const speed = 2 + Math.random() * 2;

  for (let i = 0; i < count; i++) {
    let enemy = new EnemyObj(
      canvasWidth + 100 + (i * spacing),
      startY,
      speed,
      enemyImgArray[randomShip],
      type,
      randomShip
    );
    
    enemy.followerDelay = i * 10;
    enemy.isFollower = (i > 0);
    
    // Pattern tuning
    if (type === "circle") {
      enemy.ampY = 80;
      enemy.patternSpeed = 0.04;
    } else if (type === "lissajous") {
      enemy.ampX = 120;
      enemy.ampY = 100;
      enemy.freqX = 0.03;
      enemy.freqY = 0.05;
    }
    
    enemy.health = 80 + game.level * 10;
    enemyShipArray.push(enemy);
  }
  console.log(`SQUADRON SPAWNED: ${type} with ${count} ships`);
}

// --- CLASS ORB UPDATE: SUPPORT IMAGE & OUTLINE ---
class AbilityToken {
  constructor(x, y, type = null) {
    this.x = x;
    this.y = y;
    this.width = 40;
    this.height = 40;
    this.speed = 4;

    if (type) {
      this.type = type;
    } else {
      let r = Math.random();
      // Bombs: 23%
      if (r < 0.23) this.type = "bomb";
      // Double Laser: 20% Rarer -> ~31% (Range 0.23 to 0.54)
      else if (r < 0.54) this.type = "double";
      // Missile: Remainder (~46%)
      else this.type = "missile";
    }
  }

  draw() {
    ctx.save();

    // Draw Glow
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.type === 'life' ? '#ff3366' : '#ffffff';

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    const padding = 4;
    let imgToDraw = null;

    if (this.type === "missile") {
      imgToDraw = missilePickupImg;
    } else if (this.type === "double") {
      imgToDraw = laserPickupImg;
    } else if (this.type === "bomb") {
      imgToDraw = bombPickupImg;
    } else if (this.type === "life") {
      imgToDraw = livesImg;
    }

    if (imgToDraw && imgToDraw.complete) {
      ctx.drawImage(
        imgToDraw,
        this.x + padding,
        this.y + padding,
        this.width - padding * 2,
        this.height - padding * 2
      );
    } else if (this.type === "life") {
      // Fallback for life
      ctx.fillStyle = "#ff3366";
      ctx.font = "24px Arial";
      ctx.fillText("♥", this.x + 8, this.y + 28);
    }

    ctx.restore();
  }

  update() {
    this.x -= this.speed;
  }
}

function maybeSpawnAbilityToken() {
  // --- 0.2% (0.002) ---
  if (Math.random() < 0.002 && abilityTokens.length < 3) {
    const y = Math.random() * (canvasHeight - 120) + 60;
    abilityTokens.push(new AbilityToken(canvasWidth + 40, y));
  }
}

function useAbility() {
  if (bombCooldown > 0) return false;

  // DIRECT TRIGGER (Redundancy Check)
  spellBombAnimation.activate();
  // Activate Touhou Bomb logic
  bombSystem.activate(player1.x + player1.width / 2, player1.y + player1.height / 2);

  // Set cooldown: 2.5 seconds * 90 FPS = 225 frames
  bombCooldown = 130;
  return true;
}


class Particle {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.life = 0;
    this.maxLife = 30;
    this.color = "#fff";
    this.size = 2;
    this.active = false;
  }

  spawn(x, y, color) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 8;
    this.vy = (Math.random() - 0.5) * 8;
    this.life = 30;
    this.maxLife = 30;
    this.color = color;
    this.size = Math.random() * 3 + 2;
    this.active = true;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.95;
    this.vy *= 0.95;
    this.life--;
  }

  draw() {
    const alpha = this.life / this.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (typeof gameSettings === 'undefined' || gameSettings.bloomEnabled !== false) {
      ctx.globalCompositeOperation = "lighter"; // Additive blending for "Bloom"
    }
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  get isDead() {
    return this.life <= 0;
  }
}

function createParticles(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    particles.push(particlePool.get(x, y, color));
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    if (particles[i].isDead) {
      { let ___p = particles.splice(i, 1)[0]; particlePool.recycle(___p); }
    }
  }
}

function drawParticles() {
  particles.forEach((p) => p.draw());
}

function Tabrakan(o, p) {
  // Helper to check single rect vs single rect
  const checkRects = (r1, r2) => {
    return (
      r1.x + r1.width > r2.x &&
      r1.x < r2.x + r2.width &&
      r1.y + r1.height > r2.y &&
      r1.y < r2.y + r2.height
    );
  };

  // 1. Normalize inputs to arrays of shapes
  // If object has a 'shapes' property, use it. Otherwise, treat the object itself as a single shape.
  const shapesO = o.shapes || [o];
  const shapesP = p.shapes || [p];

  // 2. Cartesian Product Check (Check every shape of O against every shape of P)
  for (let s1 of shapesO) {
    for (let s2 of shapesP) {
      if (checkRects(s1, s2)) {
        return true; // Collision confirmed on at least one sub-part
      }
    }
  }

  return false;
}

class Explosion {
  constructor(x, y, scale = 1) {
    this.x = x;
    this.y = y;
    this.frame = 0;
    this.maxFrames = 30;
    this.scale = scale;
  }

  update() {
    this.frame++;
  }

  draw() {
    let progress = this.frame / this.maxFrames;
    let radius = (20 + 60 * progress) * this.scale;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    if (typeof gameSettings === 'undefined' || gameSettings.bloomEnabled !== false) {
      ctx.globalCompositeOperation = 'lighter';
    }
    let gradient = ctx.createRadialGradient(
      this.x,
      this.y,
      0,
      this.x,
      this.y,
      radius
    );
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.2, "#ffe066");
    gradient.addColorStop(0.5, "#ff8c42");
    gradient.addColorStop(1, "#ff0000");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  get done() {
    return this.frame >= this.maxFrames;
  }
}

// Old drawGameOver function removed - now using drawEndingSequence

function drawPauseOverlay() {
  // Calculate Alpha based on Ease Out
  let t = (pauseFadeState === 'active') ? 1 : pauseFadeTimer;
  if (pauseFadeState === 'out') t = 1 - t; // Fade out

  // Ease Out Cubic: 1 - pow(1-t, 3)
  let ease = 1 - Math.pow(1 - t, 3);
  let alpha = Math.max(0, Math.min(1, ease));

  // Dark overlay 70% opacity max
  ctx.save();
  ctx.globalAlpha = 0.7 * alpha;
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.restore();

  if (alpha <= 0.01) return;

  ctx.save();
  ctx.textAlign = "center";
  ctx.globalAlpha = alpha; // Fade text as well

  // Use Pulse for animation
  const pulseTime = Date.now() / 1000;
  const pulse = Math.sin(pulseTime * 2) * 0.15 + 0.85;

  // "PAUSED" main title with glowing effect (BLUE THEME)
  ctx.font = "900 100px Orbitron, Arial";

  // Outer glow layers
  for (let i = 30; i > 0; i -= 3) {
    ctx.shadowColor = `rgba(50, 100, 255, ${(30 - i) / 100})`;
    ctx.shadowBlur = i;
    ctx.fillStyle = `rgba(0, 50, 255, ${(30 - i) / 100})`;
    ctx.fillText("PAUSED", canvasWidth / 2, canvasHeight / 2);
  }

  // Main title gradient
  const titleGradient = ctx.createLinearGradient(
    canvasWidth / 2 - 200, 0, canvasWidth / 2 + 200, 0
  );
  titleGradient.addColorStop(0, "#0066ff");
  titleGradient.addColorStop(0.5, "#00eaff");
  titleGradient.addColorStop(1, "#0066ff");

  ctx.shadowColor = "rgba(0, 234, 255, 0.8)";
  ctx.shadowBlur = 40 * pulse;
  ctx.fillStyle = titleGradient;
  ctx.fillText("PAUSED", canvasWidth / 2, canvasHeight / 2);

  // Resume Instruction
  ctx.font = "20px font1, Arial";
  ctx.fillStyle = "rgba(100, 200, 255, 0.8)";
  ctx.fillText("Press P or ESC to Resume", canvasWidth / 2, canvasHeight - 100);

  ctx.restore();
}

function drawSurgeWarningOverlay() {
  if (game.surgeSchedulerState !== 'WARNING_PHASE') return;

  let elapsed = Date.now() - game.warningStartTime;
  // Times in ms
  const T1 = 800;   // Fade In
  const T2 = 4000;  // Hold
  const T3 = 800;   // Fade Out

  let alpha = 0;

  if (elapsed < T1) {
    // Fade In (Ease In)
    let prog = elapsed / T1;
    alpha = prog * prog;
  } else if (elapsed < T1 + T2) {
    // Hold
    alpha = 1.0;
  } else if (elapsed < T1 + T2 + T3) {
    // Fade Out (Ease In)
    let prog = (elapsed - (T1 + T2)) / T3;
    alpha = 1.0 - (prog * prog);
  } else {
    alpha = 0;
  }

  if (alpha <= 0) return;

  ctx.save();

  // === 1. COLOR GRADING (True Filter Look) ===
  // Layer 1: MULTIPLY (Darkens everything, tints it dark blood red)
  // Turns white startfield -> Red, Empty Space -> Pitch Black/Dark Red
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = `rgba(180, 0, 0, ${alpha})`;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Layer 2: OVERLAY (High Contrast Red)
  // Makes the reds popping and vivid
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = `rgba(255, 0, 0, ${alpha * 0.6})`;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // === 2. TEXT (Drawn On Top) ===
  ctx.globalCompositeOperation = "source-over";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 60px Orbitron, Arial";

  // Intense Red Glow (Traffic Light Effect)
  ctx.shadowColor = `rgba(255, 0, 0, ${alpha})`;
  ctx.shadowBlur = 40;
  ctx.fillStyle = `rgba(255, 50, 50, ${alpha})`;

  ctx.fillText("Here they come...", canvasWidth / 2, canvasHeight / 2);

  // Extra Bloom Pass for Text
  ctx.globalCompositeOperation = "lighter";
  ctx.shadowBlur = 60;
  ctx.fillStyle = `rgba(255, 0, 0, ${alpha * 0.5})`;
  ctx.fillText("Here they come...", canvasWidth / 2, canvasHeight / 2);

  ctx.restore();
}


function drawScreenShading() {
  if (!vignetteCanvas) {
    vignetteCanvas = document.createElement("canvas");
    vignetteCanvas.width = canvasWidth;
    vignetteCanvas.height = canvasHeight;
    const vCtx = vignetteCanvas.getContext("2d");

    let grd = vCtx.createRadialGradient(
      canvasWidth / 2,
      canvasHeight / 2,
      200,
      canvasWidth / 2,
      canvasHeight / 2,
      canvasWidth
    );
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(1, "rgba(0,0,0,0.6)");
    vCtx.fillStyle = grd;
    vCtx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  ctx.drawImage(vignetteCanvas, 0, 0);

  // === FILM GRAIN / NOISE ===
  // Generates a static noise overlay for gritty realism
  if (!game.noiseCanvas) {
    game.noiseCanvas = document.createElement('canvas');
    game.noiseCanvas.width = 200; // Small pattern to tile
    game.noiseCanvas.height = 200;
    let nCtx = game.noiseCanvas.getContext('2d');
    let imgData = nCtx.createImageData(200, 200);
    for (let i = 0; i < imgData.data.length; i += 4) {
      let val = Math.random() * 255;
      imgData.data[i] = val;   // R
      imgData.data[i + 1] = val; // G
      imgData.data[i + 2] = val; // B
      imgData.data[i + 3] = 20;  // Alpha (Very transparent)
    }
    nCtx.putImageData(imgData, 0, 0);
  }

  // Draw Noise tiled
  ctx.save();
  ctx.globalCompositeOperation = "overlay"; // Blend nicely
  ctx.globalAlpha = 0.08; // Very subtle
  let pattern = ctx.createPattern(game.noiseCanvas, 'repeat');
  ctx.fillStyle = pattern;
  ctx.translate(Math.random() * 50, Math.random() * 50); // Jitter grain
  ctx.fillRect(-50, -50, canvasWidth + 50, canvasHeight + 50);
  ctx.restore();

  if (damageFlash > 0) {
    let alpha = (damageFlash / 20) * 0.6;
    ctx.fillStyle = "rgba(255,0,0," + alpha.toFixed(2) + ")";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    damageFlash--;
  }

  // --- ADRENALINE SURGE EFFECT (CS:O Style Concussion + Bloom) ---
  // Combines tunnel vision, animated concentric rings, and subtle glow
  if (game.surge > 1.0) {
    let intensity = (game.surge - 1.0) / (7.0 - 1.0);
    if (intensity > 0) {
      ctx.save();

      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;
      const maxRadius = Math.max(canvasWidth, canvasHeight) * 0.9;
      const time = Date.now() * 0.002; // Animation timer

      // === PART 1: Dark Tunnel Vision Edge ===  
      // Creates the dark brownish edge vignette
      ctx.globalCompositeOperation = "source-over";
      let tunnelGradient = ctx.createRadialGradient(
        centerX, centerY, maxRadius * 0.3,
        centerX, centerY, maxRadius
      );
      tunnelGradient.addColorStop(0, "rgba(0, 0, 0, 0)"); // Center is clear
      tunnelGradient.addColorStop(0.5, `rgba(30, 20, 15, ${intensity * 0.3})`);
      tunnelGradient.addColorStop(0.8, `rgba(50, 35, 25, ${intensity * 0.5})`);
      tunnelGradient.addColorStop(1, `rgba(40, 25, 20, ${intensity * 0.7})`);
      ctx.fillStyle = tunnelGradient;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      // === PART 2: Animated Concentric Rings (Pulse Effect) ===
      // Multiple rings expanding outward like shockwaves
      ctx.globalCompositeOperation = "source-over";
      const numRings = 4;
      for (let i = 0; i < numRings; i++) {
        // ADDED 1s DURATION: Changed cycle from 6 to 8 (4 seconds @ 2 units/sec)
        // Spacing adjusted from 1.5 to 2.0 to match
        let ringPhase = (time + i * 2.0) % 8;
        let ringRadius = (ringPhase / 8) * maxRadius;
        let ringAlpha = (1 - ringPhase / 8) * intensity * 0.25; // Fade as it expands

        if (ringAlpha > 0.02) {
          // Draw ring as a thick stroke
          ctx.beginPath();
          ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(80, 60, 50, ${ringAlpha})`;
          ctx.lineWidth = 15 + (ringPhase / 8) * 30; // Rings get thicker as they expand
          ctx.stroke();
        }
      }

      // === PART 3: Subtle Center Glow (Adrenaline Rush) ===
      ctx.globalCompositeOperation = "screen";
      let glowGradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, maxRadius * 0.6
      );
      // Very subtle warm glow in center
      glowGradient.addColorStop(0, `rgba(255, 220, 180, ${intensity * 0.15})`);
      glowGradient.addColorStop(0.4, `rgba(255, 180, 120, ${intensity * 0.08})`);
      glowGradient.addColorStop(1, "rgba(200, 100, 50, 0)");
      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      ctx.restore();
    }
  }
}

function updateSurge() {
  const RAMP_UP_FRAMES = 240;
  // Hold-time (12s), Ramp-Down (4s)
  const HOLD_FRAMES = 720;
  const RAMP_DOWN_FRAMES = 240; // Synchronized with 4s visual fade-out
  const MAX_SURGE_SPEED = 7.0;

  // constants for scheduler (90fps assumed)
  const WINDOW_DURATION = 8100; // 90 seconds
  const POST_COOLDOWN = 1800;   // 20 seconds

  // Phase 0: Scheduler / Idle
  if (game.surgePhase === 0) {

    // 1. Initial Cooldown (at start of game)
    if (game.surgeSchedulerState === 'INITIAL_COOLDOWN') {
      game.surgeSchedulerTimer--;
      if (game.surgeSchedulerTimer <= 0) {
        // Enter Main Window Phase
        game.surgeSchedulerState = 'WINDOW_ACTIVE';
        game.surgeWindowTimer = 0;
        game.surgeWindowTargetTime = Math.floor(Math.random() * WINDOW_DURATION);
        console.log("SURGE SYSTEM: Window Started. Target: " + game.surgeWindowTargetTime);
      }
    }
    // 2. Window Active (Waiting for random trigger)
    else if (game.surgeSchedulerState === 'WINDOW_ACTIVE') {
      game.surgeWindowTimer++;

      // Trigger event when we hit the randomly chosen time
      if (game.surgeWindowTimer >= game.surgeWindowTargetTime) {
        // Switch to PRE-PRE-SURGE (BGM Fade Out)
        console.log("SURGE SYSTEM: Fading BGM...");
        game.surgeSchedulerState = 'BGM_FADE_OUT';
        game.warningStartTime = Date.now(); // Reuse this variable for fade timer start
      }
    }
    // 1.5 PRE-PRE-SURGE: Fade Out BGM (1.2s)
    else if (game.surgeSchedulerState === 'BGM_FADE_OUT') {
      let elapsed = Date.now() - game.warningStartTime;
      let duration = 1200; // 1.2s

      if (elapsed < duration) {
        // Linear Fade Out
        let vol = BGM_VOLUME * (1.0 - (elapsed / duration));
        if (vol < 0) vol = 0;
        currentBGM.volume = vol;
      } else {
        // Fade Done
        currentBGM.pause();
        savedBgmTime = currentBGM.currentTime; // Save position!
        currentBGM.volume = BGM_VOLUME; // Reset volume for later resume

        // Now Start Warning Phase
        console.log("SURGE SYSTEM: Warning Phase Started!");
        game.surgeSchedulerState = 'WARNING_PHASE';
        game.warningStartTime = Date.now(); // Reset start time for warning phase

        // Play Hordescream instantly
        if (gameSettings.sfxEnabled) {
          hordeScreamSound.currentTime = 0;
          hordeScreamSound.play().catch(() => { });
        }
      }
    }

    // 2.5 WARNING PHASE (5.6s Pre-Surge)
    // Timeline: 0.8s Fade In -> 4.0s Hold -> 0.8s Fade Out
    else if (game.surgeSchedulerState === 'WARNING_PHASE') {
      let elapsed = Date.now() - game.warningStartTime;
      let totalDuration = (0.8 + 4.0 + 0.8) * 1000; // 5600ms

      if (elapsed >= totalDuration) {
        // WARNING FINISHED -> START ACTUAL EVENT
        console.log("SURGE SYSTEM: Chaos Begins!");
        game.surgePhase = 1; // Start Ramp Up
        game.surge = 1.0;
        game.surgeSchedulerState = 'EVENT_RUNNING';

        // NOW play the mechanic sound
        playSfxWithVolume("music/sfx/Warning.wav", 1.0);

        // TRIGGER SPELL CARD INTRO (It's for my Daughter.')
        // Silent (no bomb sound), just the visual flare!
        surgeSpellCardAnimation.activate();

        // EXTREME SHAKE START
        cameraShake.startBomb();

        // DIVINE OVERDRIVE START
        wrathClock.start();

        // Reset Music Timer for 1.5s delay
        surgeMusicTimer = 0;
      }
    }
    // 3. Post-Surge Wait (1s before BGM resume)
    else if (game.surgeSchedulerState === 'POST_SURGE_WAIT') {
      let elapsed = Date.now() - game.warningStartTime;
      if (elapsed >= 1000) {
        // Start BGM Resume with Fade In
        if (gameSettings.musicEnabled) {
          currentBGM.currentTime = savedBgmTime;
          currentBGM.volume = 0;
          currentBGM.play().catch(() => { });
          game.surgeSchedulerState = 'BGM_FADE_IN';
          game.fadeStartTime = Date.now();
          console.log("BGM RESUMING with Fade In...");
        } else {
          game.surgeSchedulerState = 'POST_EVENT_COOLDOWN';
          game.surgeSchedulerTimer = POST_COOLDOWN;
        }
      }
    }
    // 3.5 BGM Fade In (1s)
    else if (game.surgeSchedulerState === 'BGM_FADE_IN') {
      let elapsed = Date.now() - game.fadeStartTime;
      let duration = 1000; // 1s
      if (elapsed < duration) {
        currentBGM.volume = BGM_VOLUME * (elapsed / duration);
      } else {
        currentBGM.volume = BGM_VOLUME;
        game.surgeSchedulerState = 'POST_EVENT_COOLDOWN';
        game.surgeSchedulerTimer = POST_COOLDOWN;
        console.log("SURGE SYSTEM: Cooldown 20s started.");
      }
    }
    // 4. Post-Event Cooldown (20s after event)
    else if (game.surgeSchedulerState === 'POST_EVENT_COOLDOWN') {
      game.surgeSchedulerTimer--;
      if (game.surgeSchedulerTimer <= 0) {
        // Cycle Restarts
        game.surgeSchedulerState = 'WINDOW_ACTIVE';
        game.surgeWindowTimer = 0;
        game.surgeWindowTargetTime = Math.floor(Math.random() * WINDOW_DURATION);
        console.log("SURGE SYSTEM: Cycle Restarted. Target: " + game.surgeWindowTargetTime);
      }
    }
  }

  // Phase 1: Ramping Up (Ease In)
  else if (game.surgePhase === 1) {
    let step = (MAX_SURGE_SPEED - 1.0) / RAMP_UP_FRAMES;
    game.surge += step;
    // Safety Clamp
    if (game.surge >= MAX_SURGE_SPEED) {
      game.surge = MAX_SURGE_SPEED;
      game.surgePhase = 2;
      game.surgeTimer = HOLD_FRAMES;
    }
  }

  // === SURGE MUSIC TRIGGER (1.5s delay) ===
  // Runs during Phase 1 and 2 to trigger music after 1.5s
  if ((game.surgePhase === 1 || game.surgePhase === 2) && currentSurgeMusic === null) {
    surgeMusicTimer++;
    if (surgeMusicTimer >= 90) { // 90 frames @ 60fps = 1.5s
      // Pick Random Track
      let trackSrc = surgeTracks[Math.floor(Math.random() * surgeTracks.length)];

      if (gameSettings.musicEnabled) {
        currentSurgeMusic = new Audio(trackSrc);
        // --- ! FIX: This volume value controls surge event music loudness.
        // If changes have no effect, hard-refresh browser (Ctrl+Shift+R) to clear cache.
        // The audio files themselves may also have been mastered at different levels.
        currentSurgeMusic.volume = 0.7;
        currentSurgeMusic.play().catch(() => { });
        console.log("SURGE MUSIC START: " + trackSrc + " | Volume: " + currentSurgeMusic.volume);

        // TRIGGER SURGE SHAKE & FLASH
        surgeShake.start();
        surgeFlash.start();
      } else {
        // Just mark as played so we don't try again
        currentSurgeMusic = "muted";
      }
    }
  }

  // Phase 2: Holding Speed
  else if (game.surgePhase === 2) {
    game.surgeTimer--;
    if (game.surgeTimer <= 0) {
      game.surgePhase = 3;
    }
  }

  // Phase 3: Ramping Down (Ease Out)
  else if (game.surgePhase === 3) {
    let step = (MAX_SURGE_SPEED - 1.0) / RAMP_DOWN_FRAMES;
    game.surge -= step;
    if (game.surge <= 1.0) {
      game.surge = 1.0;
      game.surgePhase = 0;

      // Clear Surge Music reference (don't pause, they finish naturally)
      currentSurgeMusic = null;

      // REMOVED: surgeShake.stop() and surgeFlash.stop()
      // We let them finish their internal 4s fade-out logic naturally.

      // Enter Post-Surge Wait (1s before resuming BGM)
      game.surgeSchedulerState = 'POST_SURGE_WAIT';
      game.warningStartTime = Date.now(); // Reuse timer variable
      console.log("SURGE SYSTEM: Event Finished. Waiting 1s before BGM resume...");
    }
  }
}

function togglePause() {
  if (game.gameOver || !gameStarted) return;

  // If currently running, Pause it
  if (!gamePaused) {
    gamePaused = true;
    pauseFadeState = 'in'; // Start Fade In
    pauseFadeTimer = 0;

    currentBGM.pause();
    document.body.style.cursor = 'default';
  }
  // If currently Paused (and not already fading out), Resume it
  else if (pauseFadeState === 'active' || pauseFadeState === 'in') {
    pauseFadeState = 'out'; // Start Fade Out
    pauseFadeTimer = 0;
  }
}



// Game settings moved to top of file for initialization safety

function saveSettings() {
  localStorage.setItem('blockShooterSettings', JSON.stringify(gameSettings));
}

// === DOM ELEMENTS ===
const mainMenu = document.getElementById('mainMenu');
const optionsMenu = document.getElementById('optionsMenu');
const gameContainer = document.getElementById('gameContainer');

const startBtn = document.getElementById('startBtn');
const optionBtn = document.getElementById('optionBtn');
const exitBtn = document.getElementById('exitBtn');
const backBtn = document.getElementById('backBtn');

// Toggle Buttons
const musicBtns = document.querySelectorAll('[data-music]');
const sfxBtns = document.querySelectorAll('[data-sfx]');
const controlBtns = document.querySelectorAll('[data-control]');

// === DYNAMIC CONTROLS UI ===
function updateControlsUI() {
  const guide = document.getElementById('controlGuide');
  if (!guide) return;

  if (gameSettings.inputMode === 'mouse') {
    guide.innerHTML = `
      <div class="control-item">
        <span class="control-key">Mouse Movement</span>
        <span class="control-desc">Move Your Ship</span>
      </div>
      <div class="control-item">
        <span class="control-key">Left Click</span>
        <span class="control-desc">Fire Main Laser</span>
      </div>
      <div class="control-item">
        <span class="control-key">SHIFT</span>
        <span class="control-desc">Activate Bomb Ability</span>
      </div>
      <div class="control-item">
        <span class="control-key">Right Click</span>
        <span class="control-desc">Fire Homing Missile</span>
      </div>
      <div class="control-item">
        <span class="control-key">P</span>
        <span class="control-desc">Pause Game</span>
      </div>
    `;
  } else {
    guide.innerHTML = `
      <div class="control-item">
        <span class="control-key">WASD / Arrow Keys</span>
        <span class="control-desc">Move Your Ship</span>
      </div>
      <div class="control-item">
        <span class="control-key">SPACE</span>
        <span class="control-desc">Fire Main Laser</span>
      </div>
      <div class="control-item">
        <span class="control-key">SHIFT</span>
        <span class="control-desc">Activate Bomb Ability</span>
      </div>
      <div class="control-item">
        <span class="control-key">Q</span>
        <span class="control-desc">Fire Homing Missile</span>
      </div>
      <div class="control-item">
        <span class="control-key">P</span>
        <span class="control-desc">Pause Game</span>
      </div>
    `;
  }
}



// === PREVENT DEFAULT GAME START ===
window.addEventListener('DOMContentLoaded', () => {
  gameStarted = false;
  updateControlsUI(); // Set initial controls UI
});

// === START BUTTON ===
startBtn.addEventListener('click', () => {
  playMenuSound(menuClickSound);

  // Prevent double-clicking
  startBtn.disabled = true;

  // === FADE OUT MUSIC over 2 seconds ===
  const fadeOutDuration = 2000; // 2 seconds
  const fadeSteps = 40;
  const fadeInterval = fadeOutDuration / fadeSteps;
  const volumeStep = mainMenuBGM.volume / fadeSteps;

  const musicFadeInterval = setInterval(() => {
    if (mainMenuBGM.volume > volumeStep) {
      mainMenuBGM.volume -= volumeStep;
    } else {
      mainMenuBGM.volume = 0;
      mainMenuBGM.pause();
      mainMenuBGM.currentTime = 0;
      clearInterval(musicFadeInterval);
    }
  }, fadeInterval);

  // === CREATE FADE-TO-BLACK OVERLAY ===
  const fadeOverlay = document.createElement('div');
  fadeOverlay.id = 'launchFadeOverlay';
  fadeOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: black;
      opacity: 0;
      z-index: 9999;
      pointer-events: none;
      transition: opacity 0.8s ease-in;
    `;
  document.body.appendChild(fadeOverlay);

  // === LAUNCH THE SHIP ===
  if (typeof window.launchShip === 'function') {
    window.launchShip(() => {
      // Ship has left the screen!
      console.log("Launch complete! Fading to black...");

      // Fade to black first
      fadeOverlay.style.opacity = '1';

      // Wait for fade to complete, then show LOADING SCREEN
      setTimeout(() => {
        // Create Loading Screen
        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loadingOverlay';
        loadingOverlay.innerHTML = '<div class="loading-dots"><span>.</span><span>.</span><span>.</span></div>';
        document.body.appendChild(loadingOverlay);

        // Fade it in
        requestAnimationFrame(() => {
          loadingOverlay.style.opacity = '1';
        });

        // Fake loading for 2.5 seconds
        setTimeout(() => {
          // Start the game first to update flags
          if (!gameStarted) {
            gameStarted = true;
            init();
          }

          // Apply settings after gameStarted is true
          applySettings();

          // Hide menu
          mainMenu.style.display = 'none';
          gameContainer.style.display = 'block';
          document.body.style.cursor = 'none';

          // Fade out everything
          loadingOverlay.style.opacity = '0';
          fadeOverlay.style.opacity = '0';

          setTimeout(() => {
            loadingOverlay.remove();
            fadeOverlay.remove();

            // Re-enable button for if they return to menu
            startBtn.disabled = false;
          }, 800);
        }, 2500); // 2.5s Loading time

      }, 800); // Wait for initial fade-to-black manually
    });
  } else {
    // Fallback if launchShip not available - just start normally
    console.warn("launchShip not available, starting normally");
    mainMenu.style.display = 'none';
    gameContainer.style.display = 'block';
    document.body.style.cursor = 'none';
    applySettings();
    if (!gameStarted) {
      init();
    }
    startBtn.disabled = false;
    fadeOverlay.remove();
  }
});

// === OPTION BUTTON ===
optionBtn.addEventListener('click', () => {
  playMenuSound(menuClickSound);
  mainMenu.style.display = 'none';
  optionsMenu.style.display = 'flex';
});

// === HOW TO PLAY BUTTON ===
const howToPlayMenu = document.getElementById('howToPlayMenu');
const htpBackBtn = document.getElementById('htpBackBtn');

if (exitBtn) {
  exitBtn.addEventListener('click', () => {
    playMenuSound(menuClickSound);
    mainMenu.style.display = 'none';
    howToPlayMenu.style.display = 'flex';
  });
}

// === HOW TO PLAY BACK BUTTON ===
if (htpBackBtn) {
  htpBackBtn.addEventListener('click', () => {
    playMenuSound(menuClickSound);
    howToPlayMenu.style.display = 'none';
    mainMenu.style.display = 'flex';
  });
}


// === BACK BUTTON ===
backBtn.addEventListener('click', () => {
  playMenuSound(menuClickSound);
  optionsMenu.style.display = 'none';
  mainMenu.style.display = 'flex';
});

// === MUSIC BUTTONS ===
musicBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    playMenuSound(menuClickSound);
    musicBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    gameSettings.musicEnabled = (btn.dataset.music === 'on');
    saveSettings();
    applySettings(); // Use the global unified logic
  });
});

// === SFX BUTTONS ===
sfxBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    playMenuSound(menuClickSound);
    sfxBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    gameSettings.sfxEnabled = (btn.dataset.sfx === 'on');
    saveSettings();
    applySettings(); // Sync all audio systems
  });
});

// === CONTROL BUTTONS ===
controlBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    playMenuSound(menuClickSound);
    controlBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    gameSettings.inputMode = btn.dataset.control;
    saveSettings();
    updateControlsUI();
    // Footer removed from UI
  });
});



// === HOVER SOUNDS ===
document.querySelectorAll('.menu-btn, .menu-btn-angled, .toggle-btn').forEach(btn => {
  btn.addEventListener('mouseenter', () => {
    if (gameSettings.sfxEnabled) {
      playMenuSound(menuHoverSound);
    }
  });
});



// === KEYBOARD NAVIGATION ===
document.addEventListener('keydown', (e) => {
  // ESC to go back
  if (e.key === 'Escape') {
    if (optionsMenu.style.display === 'flex') {
      backBtn.click();
    } else if (gameContainer.style.display === 'block' && typeof togglePause !== 'undefined') {
      togglePause();
    }
  }

  // Enter to start game from main menu
  if (e.key === 'Enter' && mainMenu.style.display === 'flex') {
    startBtn.click();
  }
});

// === MENU READY ===
window.onload = function () {
  console.log('Game Ready - Waiting for menu start...');
};



// Add return to menu function
function returnToMenu() {
  currentBGM.pause();
  gameOverBGM.pause();
  currentBGM.currentTime = 0;
  gameOverBGM.currentTime = 0;

  game.gameOver = false;
  game.frames = 0;
  game.level = 1;
  game.speed = 1;
  game.surge = 1.0;
  game.surgePhase = 0;
  game.surgeTimer = 0;
  game.surgeCooldown = 2400;

  missilesArray = [];
  playerMissilesArray = [];
  enemyShipArray = [];
  enemyBulletsArray = [];
  explosions = [];
  abilityTokens = [];
  particles = [];

  player1 = new PlayerObject(100, 300);
  player1.lives = 1;
  player1.score = 0;

  respawnCounter = 0;
  damageFlash = 0;
  currentWave = null;
  waveCooldown = 0;
  abilityCharges = 0;
  missileAmmo = 0;
  cameraY = 0;
  gameStarted = false;
  gamePaused = false;

  if (gameContainer) gameContainer.style.display = 'none';
  if (mainMenu) mainMenu.style.display = 'flex';

  // === FPS OPTIMIZATION: Resume 3D model and CSS animations ===
  if (typeof window.resumeMenu3D === 'function') {
    window.resumeMenu3D();
  }
}

console.log('Menu System Loaded');
console.log('Settings:', gameSettings);

// Apply UI state based on loaded settings
function syncUISettings() {
  // Sync Music Buttons
  musicBtns.forEach(btn => {
    if (gameSettings.musicEnabled && btn.dataset.music === 'on') btn.classList.add('active');
    else if (!gameSettings.musicEnabled && btn.dataset.music === 'off') btn.classList.add('active');
    else btn.classList.remove('active');
  });

  // Sync SFX Buttons
  sfxBtns.forEach(btn => {
    if (gameSettings.sfxEnabled && btn.dataset.sfx === 'on') btn.classList.add('active');
    else if (!gameSettings.sfxEnabled && btn.dataset.sfx === 'off') btn.classList.add('active');
    else btn.classList.remove('active');
  });

  // Sync Control Buttons
  controlBtns.forEach(btn => {
    if (gameSettings.inputMode === btn.dataset.control) btn.classList.add('active');
    else btn.classList.remove('active');
  });


}

// Call this on startup
syncUISettings();

// Leaderboard Logic Removed

// === ENDING SEQUENCE (TERRIFYING / DRAMATIC) ===
// Fixed: First shows FULL image, THEN zooms to photo
// === REUSABLE SCORE UI ===
function drawScoreBoardui() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // Screen space
  ctx.textAlign = "center";

  const pulseTime = Date.now() / 1000;

  // === SCORE PANEL ===
  const panelY = canvasHeight / 2;
  const panelWidth = 500;
  const panelHeight = 200;
  const panelX = canvasWidth / 2 - panelWidth / 2;

  // Panel border glow
  ctx.strokeStyle = "rgba(0, 234, 255, 0.6)";
  ctx.lineWidth = 3;
  ctx.shadowColor = "rgba(0, 234, 255, 0.8)";
  ctx.shadowBlur = 20;
  ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

  // Panel background
  const panelGradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
  panelGradient.addColorStop(0, "rgba(10, 10, 30, 0.9)");
  panelGradient.addColorStop(1, "rgba(20, 20, 40, 0.95)");
  ctx.fillStyle = panelGradient;
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.shadowBlur = 0;

  // "Your score:" label
  ctx.font = "700 34px Orbitron, Arial";
  ctx.fillStyle = "#00eaff";
  ctx.fillText("Your score:", canvasWidth / 2, panelY + 70);

  // Score value
  ctx.font = "900 64px Orbitron, Arial";
  ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
  ctx.shadowBlur = 15;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(player1.score.toLocaleString(), canvasWidth / 2, panelY + 145);
  ctx.shadowBlur = 0;

  // === RESTART BUTTON ===
  const btnWidth = 200;
  const btnHeight = 50;
  const btnX = canvasWidth / 2 - btnWidth / 2;
  const btnY = panelY + panelHeight + 30;

  // Save button position for click handler
  game.restartBtn = { x: btnX, y: btnY, w: btnWidth, h: btnHeight };

  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnHeight);
  btnGrad.addColorStop(0, '#00eaff');
  btnGrad.addColorStop(1, '#0099ff');

  ctx.fillStyle = btnGrad;
  ctx.shadowColor = '#00eaff';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnWidth, btnHeight, 10);
  ctx.fill();

  // Button Text
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = "white";
  ctx.font = "bold 24px Orbitron, Arial";
  ctx.textBaseline = "middle";
  ctx.fillText("RESTART", canvasWidth / 2, btnY + btnHeight / 2);

  ctx.restore();
}

// === PRE-GAMEOVER CINEMATIC SEQUENCE ===
// Phase 1: Fade to black (1s)
// Phase 2: Hold black (1s)
// Phase 3: Fade in cockpit_family.png (1s)
// Phase 4: Static Wait 1 (2.5s)
// Phase 5: Zoom to family photo (4s, Ease-In)
// Phase 6: Static Wait 2 (1s)
// Phase 7: X Mark Animation (1s)
// Phase 8: Static Wait 3 (3s)
// Phase 9: UI Fade In with Darkening (2s)

// === PRE-GAMEOVER CINEMATIC SEQUENCE (TIME-BASED) ===
// Improved with dramatic pacing, staggered reveals, and proper easing

// Phase Durations (Seconds) (Cumulative)
const S_FADE_OUT = 1.0;    // Fade to black
const S_HOLD_BLACK = 2.0;    // +1.0s Hold black
const S_FADE_IN = 3.0;    // +1.0s Fade in cockpit
const S_ZOOM = 5.5;    // +2.5s Zoom to photo (ease-out)
const S_HOLD_PHOTO = 5.8;    // +0.3s Brief hold on photo
const S_X_DRAW = 6.3;    // +0.5s X line-drawing animation
const S_HOLD_X = 7.1;    // +0.8s Hold with X visible
const S_TEXT_APPEAR = 7.9;    // +0.8s "YOU ARE DEAD" (ease-in-out)
const S_TEXT_PAUSE = 8.5;    // +0.6s Dramatic pause
const S_SCORE_APPEAR = 9.1;    // +0.6s Score + Button appear (ease-out)
// Total: ~9.1s

// 123321 - ZOOM TARGET COORDINATES (Fixed)
const ZOOM_TARGET_CENTER_X = 1160; // Shifted left to prevent out-of-bounds on the right edge (1160 + 512 = 1672)
const ZOOM_TARGET_CENTER_Y = 380; // Shifted camera DOWN so the face appears higher on screen
const ZOOM_TARGET_WIDTH = 1024;  // 16:9 exact ratio
const ZOOM_TARGET_HEIGHT = 576;

// 123321 - DAD'S FACE COORDINATES
const DAD_FACE_SOURCE_X = 1267;
const DAD_FACE_SOURCE_Y = 299;

const SOURCE_IMG_WIDTH = 1672;
const SOURCE_IMG_HEIGHT = 941;

// === EASING FUNCTIONS ===
function easeInCubic(t) {
  return t * t * t;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// === HELPER FUNCTIONS ===
function getDadFaceScreenPosition() {
  const zoomSX = ZOOM_TARGET_CENTER_X - ZOOM_TARGET_WIDTH / 2;
  const zoomSY = ZOOM_TARGET_CENTER_Y - ZOOM_TARGET_HEIGHT / 2;

  const relX = DAD_FACE_SOURCE_X - zoomSX;
  const relY = DAD_FACE_SOURCE_Y - zoomSY;

  const scaleX = canvasWidth / ZOOM_TARGET_WIDTH;
  const scaleY = canvasHeight / ZOOM_TARGET_HEIGHT;

  return {
    x: relX * scaleX,
    y: relY * scaleY
  };
}

function drawZoomedImage() {
  if (cockpitImg.complete) {
    const finalSX = ZOOM_TARGET_CENTER_X - ZOOM_TARGET_WIDTH / 2;
    const finalSY = ZOOM_TARGET_CENTER_Y - ZOOM_TARGET_HEIGHT / 2;

    ctx.drawImage(
      cockpitImg,
      finalSX, finalSY, ZOOM_TARGET_WIDTH, ZOOM_TARGET_HEIGHT,
      0, 0, canvasWidth, canvasHeight
    );
  }
}

// Line-drawing X animation (progress 0 to 1)
function drawXMarkLineDraw(progress) {
  const dadPos = getDadFaceScreenPosition();
  const xMarkSize = 100;
  const eased = easeOutCubic(progress);

  ctx.save();
  ctx.strokeStyle = "#8B0000";
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.shadowColor = "#FF0000";
  ctx.shadowBlur = 30;

  // First stroke of the X (top-left to bottom-right)
  const line1Progress = Math.min(eased * 2, 1); // First half of animation
  if (line1Progress > 0) {
    const startX1 = dadPos.x - xMarkSize / 2;
    const startY1 = dadPos.y - xMarkSize / 2;
    const endX1 = dadPos.x + xMarkSize / 2;
    const endY1 = dadPos.y + xMarkSize / 2;

    ctx.beginPath();
    ctx.moveTo(startX1, startY1);
    ctx.lineTo(
      startX1 + (endX1 - startX1) * line1Progress,
      startY1 + (endY1 - startY1) * line1Progress
    );
    ctx.stroke();
  }

  // Second stroke of the X (top-right to bottom-left)
  const line2Progress = Math.max(0, (eased - 0.5) * 2); // Second half of animation
  if (line2Progress > 0) {
    const startX2 = dadPos.x + xMarkSize / 2;
    const startY2 = dadPos.y - xMarkSize / 2;
    const endX2 = dadPos.x - xMarkSize / 2;
    const endY2 = dadPos.y + xMarkSize / 2;

    ctx.beginPath();
    ctx.moveTo(startX2, startY2);
    ctx.lineTo(
      startX2 + (endX2 - startX2) * line2Progress,
      startY2 + (endY2 - startY2) * line2Progress
    );
    ctx.stroke();
  }

  ctx.restore();
}

// Full X mark (for after animation completes)
function drawXMarkFull() {
  const dadPos = getDadFaceScreenPosition();
  const xMarkSize = 100;

  ctx.save();
  ctx.strokeStyle = "#8B0000";
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.shadowColor = "#FF0000";
  ctx.shadowBlur = 30;

  ctx.beginPath();
  ctx.moveTo(dadPos.x - xMarkSize / 2, dadPos.y - xMarkSize / 2);
  ctx.lineTo(dadPos.x + xMarkSize / 2, dadPos.y + xMarkSize / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(dadPos.x + xMarkSize / 2, dadPos.y - xMarkSize / 2);
  ctx.lineTo(dadPos.x - xMarkSize / 2, dadPos.y + xMarkSize / 2);
  ctx.stroke();

  ctx.restore();
}

let triggerOnce = false;

function drawEndingSequence() {
  if (!game.endingStartTime) {
    game.endingStartTime = Date.now();
  }

  const now = Date.now();
  const t = (now - game.endingStartTime) / 1000;

  if (!triggerOnce) {
    triggerOnce = true;
    crossfadeToGameOver();
  }

  // === PHASE 1: FADE OUT GAME (1s) ===
  if (t <= S_FADE_OUT) {
    const progress = t / S_FADE_OUT;
    ctx.fillStyle = `rgba(0, 0, 0, ${progress})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    requestAnimationFrame(gameLoop);
    return;
  }

  // === PHASE 2: HOLD BLACK (1s) ===
  if (t <= S_HOLD_BLACK) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    requestAnimationFrame(gameLoop);
    return;
  }

  // === PHASE 3: FADE IN IMAGE (1s) ===
  if (t <= S_FADE_IN) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const progress = (t - S_HOLD_BLACK) / (S_FADE_IN - S_HOLD_BLACK);
    const eased = easeOutQuad(progress);

    ctx.globalAlpha = Math.max(0, Math.min(1, eased));
    if (cockpitImg.complete) {
      ctx.drawImage(cockpitImg, 0, 0, canvasWidth, canvasHeight);
    }
    ctx.globalAlpha = 1;

    requestAnimationFrame(gameLoop);
    return;
  }

  // === PHASE 4: ZOOM (2.5s, Ease-In — AE-style accelerating zoom) ===
  if (t <= S_ZOOM) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const progress = (t - S_FADE_IN) / (S_ZOOM - S_FADE_IN);
    const eased = easeInCubic(Math.min(progress, 1));

    const startSX = 0, startSY = 0;
    const startSW = SOURCE_IMG_WIDTH, startSH = SOURCE_IMG_HEIGHT;

    const endSX = ZOOM_TARGET_CENTER_X - ZOOM_TARGET_WIDTH / 2;
    const endSY = ZOOM_TARGET_CENTER_Y - ZOOM_TARGET_HEIGHT / 2;
    const endSW = ZOOM_TARGET_WIDTH, endSH = ZOOM_TARGET_HEIGHT;

    const curSX = startSX + (endSX - startSX) * eased;
    const curSY = startSY + (endSY - startSY) * eased;
    const curSW = startSW + (endSW - startSW) * eased;
    const curSH = startSH + (endSH - startSH) * eased;

    if (cockpitImg.complete) {
      ctx.drawImage(cockpitImg, curSX, curSY, curSW, curSH, 0, 0, canvasWidth, canvasHeight);
    }

    requestAnimationFrame(gameLoop);
    return;
  }

  // === PHASE 5: BRIEF HOLD ON PHOTO (0.3s) ===
  if (t <= S_HOLD_PHOTO) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    drawZoomedImage();
    requestAnimationFrame(gameLoop);
    return;
  }

  // === PHASE 6: X LINE-DRAWING ANIMATION (0.5s) ===
  if (t <= S_X_DRAW) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    drawZoomedImage();

    const progress = (t - S_HOLD_PHOTO) / (S_X_DRAW - S_HOLD_PHOTO);
    drawXMarkLineDraw(progress);

    requestAnimationFrame(gameLoop);
    return;
  }

  // === PHASE 7: HOLD WITH X VISIBLE (0.8s) ===
  if (t <= S_HOLD_X) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    drawZoomedImage();
    drawXMarkFull();
    requestAnimationFrame(gameLoop);
    return;
  }

  // === PHASE 8: "YOU ARE DEAD" TEXT APPEARS (0.8s, ease-in-out) ===
  if (t <= S_TEXT_APPEAR) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    drawZoomedImage();
    drawXMarkFull();

    const progress = (t - S_HOLD_X) / (S_TEXT_APPEAR - S_HOLD_X);
    const eased = easeInOutCubic(Math.min(progress, 1));

    // Darken background for text
    ctx.fillStyle = `rgba(0, 0, 0, ${eased * 0.5})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw only the title with ease-in-out
    drawYouAreDeadText(eased);

    requestAnimationFrame(gameLoop);
    return;
  }

  // === PHASE 9: DRAMATIC PAUSE (0.6s) ===
  if (t <= S_TEXT_PAUSE) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    drawZoomedImage();
    drawXMarkFull();

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    drawYouAreDeadText(1.0);

    requestAnimationFrame(gameLoop);
    return;
  }

  // === PHASE 10: SCORE + BUTTON APPEAR (0.6s, ease-out) ===
  if (t <= S_SCORE_APPEAR) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    drawZoomedImage();
    drawXMarkFull();

    const progress = (t - S_TEXT_PAUSE) / (S_SCORE_APPEAR - S_TEXT_PAUSE);
    const eased = easeOutCubic(Math.min(progress, 1));

    // Increase darkness as score appears
    ctx.fillStyle = `rgba(0, 0, 0, ${0.5 + eased * 0.2})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    drawYouAreDeadText(1.0);
    drawScorePanel(eased);
    drawRestartButton(eased * 0.8); // Button slightly delayed

    requestAnimationFrame(gameLoop);
    return;
  }

  // === FINAL STATE ===
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  drawZoomedImage();
  drawXMarkFull();

  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  drawYouAreDeadText(1.0);
  drawScorePanel(1.0);
  drawRestartButton(1.0);

  if (!game.gameOver) {
    game.gameOver = true;
    document.body.style.cursor = 'default';
  }

  requestAnimationFrame(gameLoop);
}

// === STAGGERED UI COMPONENTS ===

// "YOU ARE DEAD" Text with red glow, white core
function drawYouAreDeadText(alpha = 1.0) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = "center";
  ctx.globalAlpha = alpha;

  const time = Date.now() / 300;
  const pulse = Math.sin(time) * 0.2 + 1.0;

  const titleY = 120;
  ctx.font = "900 72px Orbitron, Arial";

  // Outer glow layers (Red Bloom)
  for (let i = 30; i > 0; i -= 3) {
    ctx.shadowColor = `rgba(255, 50, 50, ${((30 - i) / 100) * alpha})`;
    ctx.shadowBlur = i;
    ctx.fillStyle = `rgba(255, 0, 0, ${((30 - i) / 100) * alpha})`;
    ctx.fillText("YOU ARE DEAD", canvasWidth / 2, titleY);
  }

  // Final Main Text (White) with Red Shadow
  ctx.shadowColor = `rgba(255, 0, 0, ${0.8 * alpha})`;
  ctx.shadowBlur = 40 * pulse * alpha;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("YOU ARE DEAD", canvasWidth / 2, titleY);
  ctx.shadowBlur = 0;

  ctx.restore();
}

// Score Panel (Cyan/Blue Theme)
function drawScorePanel(alpha = 1.0) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = "center";
  ctx.globalAlpha = alpha;

  const panelY = canvasHeight / 2 + 50;
  const panelWidth = 500;
  const panelHeight = 200;
  const panelX = canvasWidth / 2 - panelWidth / 2;

  // Panel border glow
  ctx.strokeStyle = `rgba(0, 234, 255, ${0.6 * alpha})`;
  ctx.lineWidth = 3;
  ctx.shadowColor = `rgba(0, 234, 255, ${0.8 * alpha})`;
  ctx.shadowBlur = 20 * alpha;
  ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

  // Panel background
  const panelGradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
  panelGradient.addColorStop(0, `rgba(10, 10, 30, ${0.85 * alpha})`);
  panelGradient.addColorStop(1, `rgba(20, 20, 40, ${0.9 * alpha})`);
  ctx.fillStyle = panelGradient;
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.shadowBlur = 0;

  // "Your score:" label
  ctx.font = "700 34px Orbitron, Arial";
  ctx.fillStyle = "#00eaff";
  ctx.fillText("Your score:", canvasWidth / 2, panelY + 60);

  // Score value
  ctx.font = "900 64px Orbitron, Arial";
  ctx.shadowColor = `rgba(255, 255, 255, ${0.5 * alpha})`;
  ctx.shadowBlur = 15 * alpha;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(player1.score.toLocaleString(), canvasWidth / 2, panelY + 145);
  ctx.shadowBlur = 0;

  ctx.restore();
}

// Restart Button (Cyan/Blue, Pulsing)
function drawRestartButton(alpha = 1.0) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.textAlign = "center";

  const time = Date.now() / 300;

  const panelY = canvasHeight / 2 + 50;
  const panelHeight = 200;

  const btnWidth = 200;
  const btnHeight = 50;
  const btnX = canvasWidth / 2 - btnWidth / 2;
  const btnY = panelY + panelHeight + 30;

  // Register button only when fully visible
  if (alpha >= 0.95) {
    game.restartBtn = { x: btnX, y: btnY, w: btnWidth, h: btnHeight };
  }

  // Button Pulse Alpha
  const btnPulseAlpha = (Math.sin(time * 4) * 0.2 + 0.8) * alpha;
  ctx.globalAlpha = btnPulseAlpha;

  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnHeight);
  btnGrad.addColorStop(0, '#00eaff');
  btnGrad.addColorStop(1, '#0099ff');

  ctx.fillStyle = btnGrad;
  ctx.shadowColor = '#00eaff';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnWidth, btnHeight, 10);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "white";
  ctx.font = "bold 24px Orbitron, Arial";
  ctx.textBaseline = "middle";
  ctx.fillText("RESTART", canvasWidth / 2, btnY + btnHeight / 2);

  ctx.restore();
}

// === FULLSCREEN LOGIC ===
const fullscreenBtn = document.getElementById('fullscreenBtn');

fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.error(`Error attempting to enable full-screen mode: ${err.message}`);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
});

// Update icon or state based on fullscreen changes
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) {
    fullscreenBtn.style.background = "rgba(0, 234, 255, 0.3)";
  } else {
    fullscreenBtn.style.background = "rgba(0, 234, 255, 0.1)";
  }
});