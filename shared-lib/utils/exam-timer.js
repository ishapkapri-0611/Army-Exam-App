class ExamTimer {
    constructor(durationMinutes, onUpdate, onComplete) {
        this.durationMs = durationMinutes * 60 * 1000;
        this.startTime = null;
        this.remainingTime = this.durationMs;
        this.isRunning = false;
        this.onUpdate = onUpdate;
        this.onComplete = onComplete;
        this.intervalId = null;
        this.isBlinking = false;
    }

    start() {
        this.startTime = Date.now();
        this.isRunning = true;
        this.intervalId = setInterval(() => this.update(), 1000);
        this.update();
    }

    pause() {
        this.isRunning = false;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    resume() {
        if (!this.isRunning && this.startTime) {
            this.isRunning = true;
            this.intervalId = setInterval(() => this.update(), 1000);
        }
    }

    update() {
        if (!this.isRunning) return;

        const elapsed = Date.now() - this.startTime;
        this.remainingTime = Math.max(0, this.durationMs - elapsed);

        const minutes = Math.floor(this.remainingTime / 60000);
        const seconds = Math.floor((this.remainingTime % 60000) / 1000);

        // Trigger blinking effect for last 5 minutes
        if (this.remainingTime <= 5 * 60 * 1000 && !this.isBlinking) {
            this.isBlinking = true;
            this.startBlinking();
        }

        // Notify update
        if (this.onUpdate) {
            this.onUpdate({
                minutes: minutes,
                seconds: seconds,
                totalSeconds: Math.floor(this.remainingTime / 1000),
                isBlinking: this.isBlinking,
                isCritical: this.remainingTime <= 2 * 60 * 1000
            });
        }

        // Check if time's up
        if (this.remainingTime <= 0) {
            this.complete();
        }
    }

    startBlinking() {
        if (this.blinkInterval) clearInterval(this.blinkInterval);
        
        this.blinkInterval = setInterval(() => {
            if (this.onUpdate) {
                const minutes = Math.floor(this.remainingTime / 60000);
                const seconds = Math.floor((this.remainingTime % 60000) / 1000);
                
                this.onUpdate({
                    minutes: minutes,
                    seconds: seconds,
                    totalSeconds: Math.floor(this.remainingTime / 1000),
                    isBlinking: true,
                    blinkState: !this.blinkState,
                    isCritical: this.remainingTime <= 2 * 60 * 1000
                });
                
                this.blinkState = !this.blinkState;
            }
        }, 500);
    }

    complete() {
        this.pause();
        if (this.blinkInterval) clearInterval(this.blinkInterval);
        
        if (this.onComplete) {
            this.onComplete();
        }
    }

    getFormattedTime() {
        const minutes = Math.floor(this.remainingTime / 60000);
        const seconds = Math.floor((this.remainingTime % 60000) / 1000);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    addTime(seconds) {
        this.durationMs += seconds * 1000;
        this.remainingTime += seconds * 1000;
    }

    getProgress() {
        return 1 - (this.remainingTime / this.durationMs);
    }

    destroy() {
        this.pause();
        if (this.blinkInterval) clearInterval(this.blinkInterval);
    }
}

module.exports = ExamTimer;