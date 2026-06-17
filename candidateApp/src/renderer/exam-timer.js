/**
 * Lightweight renderer-side exam timer for the candidate app.
 * See also: shared-lib/utils/exam-timer.js for the full-featured Node.js version
 * used by the invigilator's monitoring system.
 */
class ExamTimer {
    constructor(duration, onTick, onComplete, isSeconds = false) {
        this.duration = isSeconds ? duration : duration * 60; // convert minutes to seconds if needed
        this.onTick = onTick;
        this.onComplete = onComplete;
        this.interval = null;
        this.totalSeconds = this.duration;
    }

    start() {
        this.interval = setInterval(() => {
            this.totalSeconds--;

            const minutes = Math.floor(this.totalSeconds / 60);
            const seconds = this.totalSeconds % 60;

            const isBlinking = this.totalSeconds <= 60;
            const isCritical = this.totalSeconds <= 30;

            this.onTick({
                minutes,
                seconds,
                isBlinking,
                isCritical,
                totalSeconds: this.totalSeconds
            });

            if (this.totalSeconds <= 0) {
                this.destroy();
                this.onComplete();
            }
        }, 1000);
    }

    destroy() {
        clearInterval(this.interval);
    }
}