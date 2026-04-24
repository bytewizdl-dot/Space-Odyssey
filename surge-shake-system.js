const surgeShake = {
    active: false,
    startTime: 0,
    duration: 0,
    fadeOutStart: 0,

    amplitude: 10,
    frequency: 50,

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
        this.duration = 14500;
        this.fadeOutStart = this.duration - 1200;

        this.amplitude = 10;
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

        let intensity = 1.0;
        if (elapsed >= this.fadeOutStart) {
            let fadeProgress = (elapsed - this.fadeOutStart) / 1200;
            intensity = 1.0 - fadeProgress;
        }

        this.directionChangeTimer++;
        if (this.directionChangeTimer >= this.directionChangeInterval) {
            this.directionChangeTimer = 0;
            this.currentDirectionX = (Math.random() - 0.5) * 2;
            this.currentDirectionY = (Math.random() - 0.5) * 2;
            this.currentDirectionRot = (Math.random() - 0.5) * 2;
        }

        let timeScale = elapsed * 0.001;
        let oscillationX = Math.sin(timeScale * this.frequency * (1 + Math.random() * 0.2));
        let oscillationY = Math.cos(timeScale * this.frequency * (1 + Math.random() * 0.2));
        let oscillationRot = Math.sin(timeScale * this.frequency * 0.5) * (Math.random() * 0.4 + 0.8);

        let jitter = 0.8 + Math.random() * 0.4;
        let effectiveAmplitude = this.amplitude * intensity * jitter;

        this.offsetX = this.currentDirectionX * oscillationX * effectiveAmplitude;
        this.offsetY = this.currentDirectionY * oscillationY * effectiveAmplitude;
        this.offsetRotation = this.currentDirectionRot * oscillationRot * 0.015 * intensity; // Small rotation in radians

        this.blurIntensity = intensity * 8;
    }
};

const surgeFlash = {
    active: false,
    intensity: 0,
    pulseSpeed: 3,

    start() {
        this.active = true;
        this.intensity = 0;
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

        let time = Date.now() * 0.001;
        this.intensity = 0.15 + Math.sin(time * this.pulseSpeed) * 0.1;
    },

    apply(ctx) {
        if (!this.active || this.intensity <= 0) return;

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = `rgba(255, 255, 255, ${this.intensity * 0.5})`;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.restore();
    }
};
