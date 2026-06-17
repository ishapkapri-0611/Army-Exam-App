const ExamTimer = require('../shared-lib/utils/exam-timer');

describe('ExamTimer', () => {
    let timer;

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        if (timer) timer.destroy();
        jest.useRealTimers();
    });

    describe('constructor', () => {
        it('should initialize with correct duration in milliseconds', () => {
            timer = new ExamTimer(30, jest.fn(), jest.fn());
            expect(timer.durationMs).toBe(30 * 60 * 1000);
            expect(timer.remainingTime).toBe(30 * 60 * 1000);
        });

        it('should start in a non-running state', () => {
            timer = new ExamTimer(10, jest.fn(), jest.fn());
            expect(timer.isRunning).toBe(false);
            expect(timer.startTime).toBeNull();
            expect(timer.intervalId).toBeNull();
        });

        it('should store callbacks', () => {
            const onUpdate = jest.fn();
            const onComplete = jest.fn();
            timer = new ExamTimer(5, onUpdate, onComplete);
            expect(timer.onUpdate).toBe(onUpdate);
            expect(timer.onComplete).toBe(onComplete);
        });
    });

    describe('start', () => {
        it('should set isRunning to true', () => {
            timer = new ExamTimer(10, jest.fn(), jest.fn());
            timer.start();
            expect(timer.isRunning).toBe(true);
        });

        it('should set startTime', () => {
            timer = new ExamTimer(10, jest.fn(), jest.fn());
            timer.start();
            expect(timer.startTime).not.toBeNull();
        });

        it('should call onUpdate immediately', () => {
            const onUpdate = jest.fn();
            timer = new ExamTimer(10, onUpdate, jest.fn());
            timer.start();
            expect(onUpdate).toHaveBeenCalledTimes(1);
        });

        it('should call onUpdate with correct time data', () => {
            const onUpdate = jest.fn();
            timer = new ExamTimer(10, onUpdate, jest.fn());
            timer.start();
            expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
                minutes: 10,
                seconds: 0,
                totalSeconds: 600,
                isBlinking: false,
                isCritical: false
            }));
        });
    });

    describe('pause and resume', () => {
        it('should stop the timer when paused', () => {
            timer = new ExamTimer(10, jest.fn(), jest.fn());
            timer.start();
            timer.pause();
            expect(timer.isRunning).toBe(false);
            expect(timer.intervalId).toBeNull();
        });

        it('should resume after pause', () => {
            timer = new ExamTimer(10, jest.fn(), jest.fn());
            timer.start();
            timer.pause();
            timer.resume();
            expect(timer.isRunning).toBe(true);
        });

        it('should not resume if timer was never started', () => {
            timer = new ExamTimer(10, jest.fn(), jest.fn());
            timer.resume();
            expect(timer.isRunning).toBe(false);
        });
    });

    describe('update', () => {
        it('should decrease remaining time as real time elapses', () => {
            const onUpdate = jest.fn();
            timer = new ExamTimer(10, onUpdate, jest.fn());
            timer.start();

            jest.advanceTimersByTime(5000);

            const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
            expect(lastCall.totalSeconds).toBeLessThan(600);
        });

        it('should not update when timer is not running', () => {
            const onUpdate = jest.fn();
            timer = new ExamTimer(10, onUpdate, jest.fn());
            timer.update();
            expect(onUpdate).not.toHaveBeenCalled();
        });

        it('should trigger blinking in last 5 minutes', () => {
            const onUpdate = jest.fn();
            timer = new ExamTimer(6, onUpdate, jest.fn());
            timer.start();

            // Advance past the 5-minute threshold (6 min - 5 min = 1 min elapsed)
            jest.advanceTimersByTime(61000);

            const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
            expect(lastCall.isBlinking).toBe(true);
        });

        it('should mark as critical in last 2 minutes', () => {
            const onUpdate = jest.fn();
            timer = new ExamTimer(3, onUpdate, jest.fn());
            timer.start();

            // Advance past the 2-minute threshold (3 min - 2 min = 1 min + 1s elapsed)
            jest.advanceTimersByTime(61000);

            const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
            expect(lastCall.isCritical).toBe(true);
        });
    });

    describe('complete', () => {
        it('should call onComplete when time runs out', () => {
            const onComplete = jest.fn();
            timer = new ExamTimer(1, jest.fn(), onComplete);
            timer.start();

            jest.advanceTimersByTime(61000);

            expect(onComplete).toHaveBeenCalledTimes(1);
        });

        it('should stop the timer on completion', () => {
            const onComplete = jest.fn();
            timer = new ExamTimer(1, jest.fn(), onComplete);
            timer.start();

            jest.advanceTimersByTime(61000);

            expect(timer.isRunning).toBe(false);
        });
    });

    describe('getFormattedTime', () => {
        it('should format time with leading zeros', () => {
            timer = new ExamTimer(5, jest.fn(), jest.fn());
            expect(timer.getFormattedTime()).toBe('05:00');
        });

        it('should format time correctly for larger values', () => {
            timer = new ExamTimer(90, jest.fn(), jest.fn());
            expect(timer.getFormattedTime()).toBe('90:00');
        });

        it('should show 00:00 when time is zero', () => {
            timer = new ExamTimer(0, jest.fn(), jest.fn());
            expect(timer.getFormattedTime()).toBe('00:00');
        });
    });

    describe('addTime', () => {
        it('should increase duration and remaining time', () => {
            timer = new ExamTimer(10, jest.fn(), jest.fn());
            const originalDuration = timer.durationMs;
            const originalRemaining = timer.remainingTime;

            timer.addTime(120); // 2 minutes

            expect(timer.durationMs).toBe(originalDuration + 120000);
            expect(timer.remainingTime).toBe(originalRemaining + 120000);
        });
    });

    describe('getProgress', () => {
        it('should return 0 at the start', () => {
            timer = new ExamTimer(10, jest.fn(), jest.fn());
            expect(timer.getProgress()).toBe(0);
        });

        it('should return a value between 0 and 1 during the exam', () => {
            timer = new ExamTimer(10, jest.fn(), jest.fn());
            timer.start();
            jest.advanceTimersByTime(300000); // 5 minutes
            timer.update();

            const progress = timer.getProgress();
            expect(progress).toBeGreaterThan(0);
            expect(progress).toBeLessThanOrEqual(1);
        });
    });

    describe('destroy', () => {
        it('should stop the timer and clear all intervals', () => {
            timer = new ExamTimer(10, jest.fn(), jest.fn());
            timer.start();
            timer.destroy();
            expect(timer.isRunning).toBe(false);
            expect(timer.intervalId).toBeNull();
        });
    });
});
