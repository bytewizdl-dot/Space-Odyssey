
// === GAME SETTINGS (Global State) ===
const gameSettings = {
  musicVolume: 100,
  sfxVolume: 100,
  inputMode: 'keyboard'
};

Object.defineProperty(gameSettings, 'musicEnabled', {
  get: function() { return this.musicVolume > 0; }
});
Object.defineProperty(gameSettings, 'sfxEnabled', {
  get: function() { return this.sfxVolume > 0; }
});

// Load Settings from LocalStorage immediately
try {
  const saved = localStorage.getItem('blockShooterSettings');
  if (saved) {
    const parsed = JSON.parse(saved);
    if(parsed.musicVolume !== undefined) gameSettings.musicVolume = parsed.musicVolume;
    else if (parsed.musicEnabled !== undefined) gameSettings.musicVolume = parsed.musicEnabled ? 100 : 0;
    
    if(parsed.sfxVolume !== undefined) gameSettings.sfxVolume = parsed.sfxVolume;
    else if (parsed.sfxEnabled !== undefined) gameSettings.sfxVolume = parsed.sfxEnabled ? 100 : 0;
    
    gameSettings.inputMode = parsed.inputMode || 'keyboard';
  }
} catch (e) {
  console.log("Could not load settings:", e);
}

// ============================================================================
// === AUDIO MANAGER — All Audio Systems for Block Shooter ===
// ============================================================================
// Extracted from Script.js for maintainability.
// Contains: BGM management, SFX elements, AudioMixer (Touhou-style),
// Sound Pools, crossfade logic, menu audio, and autoplay unlock.
// ============================================================================

// === BGM CONFIGURATION ===
const BGM_VOLUME = 0.4;

const bgmList = [
  { normal: "music/Scary.mp3", gameover: "music/ScaryGO.mp3" },
  { normal: "music/Fear.mp3", gameover: "music/FearGO.mp3" },
  { normal: "music/Chill.mp3", gameover: "music/ChillGO.mp3" },
];

let currentBGM = new Audio();
let gameOverBGM = new Audio();
currentBGM.loop = true;
gameOverBGM.loop = true;

function pickRandomBGM() {
  const bgm = bgmList[Math.floor(Math.random() * bgmList.length)];
  currentBGM.src = bgm.normal;
  gameOverBGM.src = bgm.gameover;
}

var musicMuted = false;

// === SFX AUDIO ELEMENTS ===
var laser = document.createElement("audio");
laser.src = "music/sfx/laser2.mp3";


var bombGetSound = document.createElement("audio");
bombGetSound.src = "music/sfx/bomb-get.mp3";
bombGetSound.volume = 0.07; // Baseline volume

var missileGetSound = document.createElement("audio");
missileGetSound.src = "music/sfx/missile-get.mp3";
missileGetSound.volume = 0.25; // Baseline

var weaponGetSound = document.createElement("audio");
weaponGetSound.src = "music/sfx/weapon-get.mp3";
weaponGetSound.volume = 0.25; // Baseline

var playerDeadSound = document.createElement("audio");
playerDeadSound.src = "music/sfx/DEFEATED.wav";
playerDeadSound.volume = 0.5; // Increased by 50% (was 0.25)

var miniBossDeadSound = document.createElement("audio");
miniBossDeadSound.src = "music/sfx/playerdeadlol.mp3";

var lifeUpSound = document.createElement("audio");
lifeUpSound.src = "music/sfx/lifeup.wav";
lifeUpSound.volume = 0.375; // Increased by 50% (was 0.25)

var missileAwaySound = document.createElement("audio");
missileAwaySound.src = "music/sfx/missileaway.mp3";

var warningSound = document.createElement("audio");
warningSound.src = "music/sfx/Warning.wav";
warningSound.volume = 1.0; // CRITICAL EVENT: Keep at max

var bombHitSound = document.createElement("audio");
bombHitSound.src = "music/sfx/BombHIT.wav";
bombHitSound.volume = 0.65; // Mid-tier (was 0.5)

// CRITICAL EVENT: Maximum impact!
var bombSoundMerged = document.createElement("audio");
bombSoundMerged.src = "music/sfx/BombMerged.wav";
bombSoundMerged.volume = 1.0;

// === HORDE SCREAM (SURGE WARNING) ===
var hordeScreamSound = document.createElement("audio");
hordeScreamSound.src = "music/audacity/Hordescream.wav";
hordeScreamSound.volume = 0.4;

// === SURGE MUSIC TRACKS ===
var surgeTracks = [
  "music/audacity/RainH1.wav",
  "music/audacity/RainH2.wav",
  "music/audacity/LD1edit.wav",
  "music/audacity/LD2.wav"
];
var currentSurgeMusic = null;
var surgeMusicTimer = 0; // For the 1.5s delay
var savedBgmTime = 0; // To pause/resume BGM

// ============================================================================
// === PROFESSIONAL AUDIO MIXER SYSTEM ===
// ============================================================================
// Solves audio performance issues during chaos events (surge, bombs, etc.)
// Key Features:
// 1. Voice Budgets - Hard limits on concurrent sounds per category
// 2. Priority System - Important sounds (bomb, player hit) always play
// 3. Event Coalescing - 90 explosions become 3-5 "summary" sounds
// 4. Sound Pooling - Pre-allocated Audio objects for all frequent SFX
// 5. Frame-based Processing - Audio decisions happen once per frame
// ============================================================================

const AudioMixer = {
  // === CONFIGURATION ===
  config: {
    // Global voice limit (browser can handle ~32-64 concurrent voices)
    maxGlobalVoices: 32,

    // Per-category voice limits
    voiceLimits: {
      explosion: 20,      // Max 6 explosion sounds at once
      laser: 4,          // Max 4 laser sounds at once
      missile: 4,        // Max 2 missile sounds at once
      pickup: 4,         // Power-up pickups
      impact: 20,        // ALLOW MASSIVE BURST OF HITS
      boss: 2,           // Boss attacks
      graze: 6,          // Rapid-fire graze sounds (Touhou-style)
      critical: 20,       // Player hit, bomb, warnings - ALWAYS plays
    },

    // Event coalescing intervals (ms) - how often each category can trigger
    coalesceIntervals: {
      explosion: 33,     // ~30 sounds per second
      laser: 50,
      missile: 100,
      pickup: 0,
      impact: 4,         // ULTRA-DENSE FEEDBACK (Allows machine-gun sound)
      boss: 200,
      graze: 50,
      critical: 0,
    },

    // Surge mode multipliers (during chaos)
    surgeMultipliers: {
      explosion: 1.0,    // Remove 2.5x throttle to allow 30/sec in surge
      laser: 1.0,
      missile: 1.0,
      pickup: 1.0,
      impact: 1.0,
      boss: 1.0,
      critical: 1.0,
    }
  },

  // === STATE ===
  activeVoices: {
    explosion: 0,
    laser: 0,
    missile: 0,
    pickup: 0,
    impact: 0,
    boss: 0,
    critical: 0,
  },
  lastPlayTime: {},

  // --- ! CLEANUP: eventQueue was NEVER processed (processFrame never called)
  // === EVENT QUEUE (Per-Frame Collection) ===
  eventQueue: [],

  // === SOUND POOLS ===
  pools: {},

  // === CRITICAL SOUND POOL (Flaw #1 Fix: prevents ghost Audio leak) ===
  _criticalPool: [],
  _getCriticalAudio(src) {
    // Reuse an idle Audio object with matching source
    let audio = this._criticalPool.find(a => a.paused && a.src.endsWith(src));
    if (!audio) {
      audio = new Audio(src);
      this._criticalPool.push(audio);
      // Hard cap to prevent unbounded growth
      if (this._criticalPool.length > 16) {
        const old = this._criticalPool.shift();
        old.src = ''; // Release media resource
      }
    }
    audio.currentTime = 0;
    return audio;
  },

  // === BOMB MODE FLAG ===
  // When true, individual explosion sounds are suppressed (bomb handles audio)
  bombAudioActive: false,

  // === INITIALIZATION ===
  init() {
    // Create pools for all frequent SFX
    this.pools = {
      explosion: this._createPool("music/sfx/explosion-small.mp3", 15), // Increased pool size
      laser: this._createPool("music/sfx/laser2.mp3", 8),
      missile: this._createPool("music/sfx/missileaway.mp3", 4),
      impact: this._createPool("music/sfx/BombHIT.wav", 24), // Increased pool for double-triggering hits
      graze: this._createPool("music/sfx/grazedezpz.wav", 8), // Pool for grazes
    };

    console.log("[AudioMixer] Touhou-Mode: 30 SFX/sec enabled");
  },

  _createPool(src, size) {
    const pool = [];
    for (let i = 0; i < size; i++) {
      const audio = new Audio(src);
      audio.load();
      pool.push({
        audio: audio,
        inUse: false,
        startTime: 0,
      });
    }
    return {
      src: src,
      channels: pool,
      idx: 0,
    };
  },

  // === PUBLIC API: Queue a sound event ===
  // Instead of playing immediately, queue for end-of-frame processing
  queueSound(category, volume = 1.0, priority = 0) {
    this.eventQueue.push({ category, volume, priority });
  },

  // === PUBLIC API: Play a sound immediately (for critical/UI sounds) ===
  playImmediate(category, src, volume = 1.0) {
    if (!gameSettings.sfxEnabled) return;

    // Critical sounds bypass all limits but reuse pooled Audio objects
    if (category === 'critical') {
      const sfx = this._getCriticalAudio(src);
      sfx.volume = Math.max(0, Math.min(1, volume)) * (gameSettings.sfxVolume / 100);
      sfx.play().catch(() => { });
      return true;
    }

    // Check voice limit
    if (this.activeVoices[category] >= this.config.voiceLimits[category]) {
      return false; // Voice budget exceeded
    }

    // Check coalesce interval
    const now = Date.now();
    const lastTime = this.lastPlayTime[category] || 0;
    let interval = this.config.coalesceIntervals[category];

    // AUDIO OPTIMIZATION: Suppress generic explosions during bomb to keep audio clean
    // but impacts (like BombHIT) are allowed to play for feedback.
    if (category === 'explosion' && this.bombAudioActive) return false;

    // Apply surge multiplier
    if (typeof game !== 'undefined' && game.surgePhase >= 1) {
      interval *= this.config.surgeMultipliers[category];
    }

    if (now - lastTime < interval) {
      return false; // Throttled
    }

    // Play from pool if available
    if (this.pools[category]) {
      this._playFromPool(category, volume);
    } else {
      // Fallback for non-pooled sounds
      const sfx = new Audio(src);
      sfx.volume = Math.max(0, Math.min(1, volume)) * (gameSettings.sfxVolume / 100);
      sfx.play().catch(() => { });
    }

    this.lastPlayTime[category] = now;
    return true;
  },

  _playFromPool(category, volume) {
    const pool = this.pools[category];
    if (!pool) return;

    // PHYSICAL VOLUME BOOST: 
    // If it's an 'impact' or we're at max volume, play TWO channels with a tiny offset.
    // This effectively boosts the sound beyond the browser's normal 1.0 limit.
    const runCount = (category === 'impact' && volume >= 0.9) ? 2 : 1;

    for (let i = 0; i < runCount; i++) {
      const channel = pool.channels[pool.idx];
      channel.audio.currentTime = 0;
      channel.audio.volume = Math.max(0, Math.min(1, volume)) * (gameSettings.sfxVolume / 100);

      // Flaw #3 Fix: Track active voices via onended callback
      this.activeVoices[category]++;
      const cat = category; // Capture for closure
      channel.audio.onended = () => {
        this.activeVoices[cat] = Math.max(0, this.activeVoices[cat] - 1);
      };

      // Tiny delay for the second channel to create a thicker "thick" sound
      if (i > 0) {
        setTimeout(() => channel.audio.play().catch(() => {
          this.activeVoices[cat] = Math.max(0, this.activeVoices[cat] - 1);
        }), 1);
      } else {
        channel.audio.play().catch(() => {
          this.activeVoices[cat] = Math.max(0, this.activeVoices[cat] - 1);
        });
      }

      pool.idx = (pool.idx + 1) % pool.channels.length;
    }
  },

  // === FRAME PROCESSING ===
  // Call this at the END of each game update frame
  processFrame() {
    if (this.eventQueue.length === 0) return;

    // Group events by category
    const grouped = {};
    for (const event of this.eventQueue) {
      if (!grouped[event.category]) {
        grouped[event.category] = [];
      }
      grouped[event.category].push(event);
    }

    // Process each category with coalescing
    for (const category in grouped) {
      const events = grouped[category];

      // Apply voice budget
      const limit = this.config.voiceLimits[category] || 1;
      const toPlay = Math.min(events.length, limit);

      // Calculate summary volume (louder for more events, but not linear)
      // This creates the "mass destruction" feeling with fewer sounds
      const baseVolume = events[0].volume;
      let intensityBoost = Math.min(0.3, events.length * 0.02);

      // FIX: Disable density boost during surge to prevent ear-bleeding loudness
      // This respects the manually lowered volume (0.1) for chaos events
      if (typeof game !== 'undefined' && game.surgePhase >= 1) {
        intensityBoost = 0;
      }

      const finalVolume = Math.min(1.0, baseVolume + intensityBoost);

      // Play the limited number of sounds
      for (let i = 0; i < toPlay; i++) {
        // Slight pitch variation for variety (if supported)
        this.playImmediate(category, null, finalVolume);
      }
    }

    // Clear queue
    this.eventQueue = [];
  },

  // === BOMB MODE ===
  startBombMode() {
    this.bombAudioActive = true;
    // Bomb mode automatically expires after 2 seconds
    setTimeout(() => {
      this.bombAudioActive = false;
    }, 2000);
  },

  // === Helper: Check if explosion sound should play ===
  shouldPlayExplosion() {
    if (this.bombAudioActive) return false;
    return true;
  },
};

// Initialize the mixer
AudioMixer.init();

// ============================================================================
// === LEGACY COMPATIBILITY LAYER ===
// ============================================================================
// These functions maintain backward compatibility with existing code
// while using the new professional audio system under the hood

function playSfxWithVolume(srcPath, volume) {
  if (!gameSettings.sfxEnabled) return;

  // Route to appropriate category based on path
  if (srcPath.includes("explosion")) {
    if (!AudioMixer.shouldPlayExplosion()) return;
    AudioMixer.playImmediate('explosion', srcPath, volume);
  } else if (srcPath.includes("laser")) {
    AudioMixer.playImmediate('laser', srcPath, volume);
  } else if (srcPath.includes("missile")) {
    AudioMixer.playImmediate('missile', srcPath, volume);
  } else if (srcPath.includes("Bomb") || srcPath.includes("Warning") || srcPath.includes("DEFEATED") || srcPath.includes("ClockAura") || srcPath.includes("SpiralPlayer")) {
    // Critical sounds always play
    AudioMixer.playImmediate('critical', srcPath, volume);
  } else if (srcPath.includes("grazedezpz")) {
    AudioMixer.playImmediate('graze', srcPath, volume);
  } else {
    // Generic sounds - create new Audio (for infrequent sounds this is fine)
    const sfx = new Audio(srcPath);
    sfx.volume = Math.max(0, Math.min(1, volume)) * (gameSettings.sfxVolume / 100);
    sfx.play().catch(() => { });
  }
}

const audioThrottleMap = {};
function playThrottledSfx(src, minIntervalMs, volume = 1.0) {
  // Now handled by AudioMixer's built-in coalescing
  playSfxWithVolume(src, volume);
}

// === SOUND POOL CLASS (Legacy - still used by some code) ===
class SoundPool {
  constructor(src, size = 10) {
    this.pool = [];
    this.idx = 0;
    this.src = src;
    for (let i = 0; i < size; i++) {
      let a = new Audio(src);
      a.load();
      this.pool.push(a);
    }
  }

  play(volume = 1.0) {
    if (!gameSettings.sfxEnabled) return;

    // Check if bomb mode is blocking explosions
    if (this.src.includes("explosion") && !AudioMixer.shouldPlayExplosion()) {
      return;
    }

    // Check AudioMixer throttling
    const category = this.src.includes("explosion") ? 'explosion' :
      this.src.includes("laser") ? 'laser' : 'impact';

    const now = Date.now();
    const lastTime = AudioMixer.lastPlayTime[category] || 0;
    let interval = AudioMixer.config.coalesceIntervals[category];

    if (typeof game !== 'undefined' && game.surgePhase >= 1) {
      interval *= AudioMixer.config.surgeMultipliers[category];
    }

    if (now - lastTime < interval) {
      return; // Throttled
    }

    // Play from pool
    let sfx = this.pool[this.idx];
    sfx.currentTime = 0;
    sfx.volume = Math.max(0, Math.min(1, volume)) * (gameSettings.sfxVolume / 100);
    sfx.play().catch(() => { });

    this.idx = (this.idx + 1) % this.pool.length;
    AudioMixer.lastPlayTime[category] = now;
  }
}

// Initialize pools with REDUCED sizes (AudioMixer handles limiting)
const explosionPool = new SoundPool("music/sfx/explosion-small.mp3", 8);
const laserPool = new SoundPool("music/sfx/laser2.mp3", 6);

// === MAIN MENU BGM ===
var mainMenuBGM = new Audio();
mainMenuBGM.src = "music/MainMenu.mp3";
mainMenuBGM.loop = true;
mainMenuBGM.volume = 0.25;
mainMenuBGM.muted = true; // Start muted to bypass browser block and begin buffering
mainMenuBGM.preload = "auto";
mainMenuBGM.load();

// The play() call is removed here so the music stays at 0:00 until unlocked

let audioStarted = false;

// === AUTOPLAY UNLOCK LISTENERS ===
function unlockAudio() {
  if (audioStarted) return;

  // Delayed Start (1 second delay as requested)
  // This syncs perfectly with the 1s CSS transition of the overlay
  setTimeout(() => {
    // Safety: Only play if the player hasn't already clicked "Start Game"
    if (typeof gameStarted === 'undefined' || !gameStarted) {
      mainMenuBGM.currentTime = 0; // Restart from beginning
      mainMenuBGM.muted = false;
      mainMenuBGM.play().catch(() => { });
    }
  }, 1000);

  // Hide Overlay
  const overlay = document.getElementById('autoplayOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    // Remove from DOM after transition
    setTimeout(() => overlay.remove(), 1000);
  }

  audioStarted = true;
}

window.addEventListener("keydown", unlockAudio);
window.addEventListener("click", unlockAudio);

// === MENU SOUNDS ===
const menuHoverSound = new Audio();
menuHoverSound.src = 'music/sfx/weapon-get.mp3';
const menuClickSound = new Audio();
menuClickSound.src = 'music/sfx/bomb-get.mp3';

// === PLAY SOUND HELPER (GAMEPLAY) ===
function playSound(audio, volume = 0.5) {
  if (gameSettings.sfxEnabled) {
    audio.volume = volume * (gameSettings.sfxVolume / 100);
    audio.currentTime = 0;
    audio.play().catch(() => { });
  }
}

// === PLAY MENU SOUND (LOUDER & OVERLAPPING) ===
function playMenuSound(audio) {
  if (gameSettings.sfxEnabled) {
    // Clone node allows overlapping sounds
    let sfx = audio.cloneNode();
    sfx.volume = 0.4 * (gameSettings.sfxVolume / 100);
    sfx.play().catch(() => { });
  }
}

// === BGM CROSSFADE (Game Over Transition) ===
function crossfadeToGameOver() {
  let fadeSpeed = 0.02;

  gameOverBGM.volume = 0;
  gameOverBGM.play();

  // === SURGE MUSIC FADE OUT (0.8s) ===
  // Independent logic to ensure clean exit of surge event audio
  // Capture LOCAL reference to prevent global variable race conditions
  const musicToFade = currentSurgeMusic;

  if (musicToFade && musicToFade instanceof Audio && !musicToFade.paused) {
    console.log("Starting Surge Music Fade...");
    const startVol = musicToFade.volume;
    const fadeDuration = 800; // ms
    const fadeIntervalMs = 50;
    const steps = fadeDuration / fadeIntervalMs;
    const volStep = startVol / steps;

    const surgeFadeInterval = setInterval(() => {
      // Safety check: if object is invalidated or already silent
      if (!musicToFade || musicToFade.paused) {
        clearInterval(surgeFadeInterval);
        return;
      }

      const newVol = musicToFade.volume - volStep;
      if (newVol > 0.001) {
        musicToFade.volume = newVol;
      } else {
        musicToFade.volume = 0;
        musicToFade.pause();
        clearInterval(surgeFadeInterval);
      }
    }, fadeIntervalMs);
  }

  // === MAIN BGM CROSSFADE ===
  let fadeInterval = setInterval(() => {
    let newCurrentVol = currentBGM.volume - fadeSpeed;
    if (newCurrentVol < 0) newCurrentVol = 0;
    currentBGM.volume = newCurrentVol;

    let newGameOverVol = gameOverBGM.volume + fadeSpeed;
    if (newGameOverVol > BGM_VOLUME * (gameSettings.musicVolume / 100)) newGameOverVol = BGM_VOLUME * (gameSettings.musicVolume / 100);
    gameOverBGM.volume = newGameOverVol;

    // Flaw #5 Fix: Epsilon comparison prevents floating-point infinite loop
    if (currentBGM.volume <= 0.001) {
      currentBGM.volume = 0;
      currentBGM.pause();
      clearInterval(fadeInterval);
    }
  }, 1000 / 30);
}

function isNormalBgmAllowed() {
  if (typeof game === 'undefined') return true;
  if (game.surgePhase >= 1) return false;
  if (game.surgeSchedulerState === 'BGM_FADE_OUT' || 
      game.surgeSchedulerState === 'WARNING_PHASE' || 
      game.surgeSchedulerState === 'EVENT_RUNNING' || 
      game.surgeSchedulerState === 'POST_SURGE_WAIT') {
    return false;
  }
  return true;
}

// === APPLY SETTINGS TO GAME ===
function applySettings() {
  // Apply Main Menu BGM
  if (typeof mainMenuBGM !== 'undefined') {
    if (gameSettings.musicEnabled) {
      mainMenuBGM.volume = 0.25 * (gameSettings.musicVolume / 100);
      if (!gameStarted) {
        mainMenuBGM.play().catch(() => { });
      }
    } else {
      mainMenuBGM.pause();
    }
  }

  // Apply Gameplay BGM
  if (typeof currentBGM !== 'undefined') {
    if (gameSettings.musicEnabled) {
      currentBGM.volume = BGM_VOLUME * (gameSettings.musicVolume / 100);
      if (gameStarted && !game.gameOver) {
        // Only play if not paused and allowed by surge state
        if (typeof gamePaused === 'undefined' || !gamePaused) {
          if (isNormalBgmAllowed()) {
            currentBGM.play().catch(() => { });
          } else {
            currentBGM.pause();
          }
        } else {
          currentBGM.pause();
        }
      }
    } else {
      currentBGM.volume = 0;
      currentBGM.pause();
    }
  }

  // Apply Game Over BGM
  if (typeof gameOverBGM !== 'undefined') {
    if (gameSettings.musicEnabled) {
      gameOverBGM.volume = BGM_VOLUME * (gameSettings.musicVolume / 100);
      if (gameStarted && game.gameOver) {
        gameOverBGM.play().catch(() => { });
      }
    } else {
      gameOverBGM.volume = 0;
      gameOverBGM.pause();
    }
  }
}
