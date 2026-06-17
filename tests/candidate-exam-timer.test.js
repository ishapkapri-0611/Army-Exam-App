const fs = require('fs');
const path = require('path');

// Load the ExamTimer class from candidateApp (browser-style, no module.exports)
const examTimerCode = fs.readFileSync(
    path.join(__dirname, '../candidateApp/src/renderer/exam-timer.js'),
    'utf-8'
);

// Use Function constructor to evaluate in current context (has access to globals)
const ExamTimer = new Function(examTimerCode + '\nreturn ExamTimer;')();

describe('CandidateApp ExamTimer', () => {
    let timer;

    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        if (timer) timer.destroy();
        jest.useRealTimers();
    });

    describe('constructor', () => {
        it('should convert minutes to seconds by default', () => {
            timer = new ExamTimer(30, jest.fn(), jest.fn());
            expect(timer.totalSeconds).toBe(1800); // 30 * 60
        });

        it('should keep seconds when isSeconds flag is true', () => {
            timer = new ExamTimer(120, jest.fn(), jest.fn(), true);
            expect(timer.totalSeconds).toBe(120);
        });

        it('should store onTick and onComplete callbacks', () => {
            const onTick = jest.fn();
            const onComplete = jest.fn();
            timer = new ExamTimer(10, onTick, onComplete);
            expect(timer.onTick).toBe(onTick);
            expect(timer.onComplete).toBe(onComplete);
        });
    });

    describe('start', () => {
        it('should call onTick every second', () => {
            const onTick = jest.fn();
            timer = new ExamTimer(1, onTick, jest.fn());
            timer.start();

            jest.advanceTimersByTime(3000);

            expect(onTick).toHaveBeenCalledTimes(3);
        });

        it('should decrease totalSeconds over time', () => {
            const onTick = jest.fn();
            timer = new ExamTimer(2, onTick, jest.fn());
            timer.start();

            jest.advanceTimersByTime(5000);

            expect(timer.totalSeconds).toBe(115); // 120 - 5
        });

        it('should provide correct minutes and seconds in tick', () => {
            const onTick = jest.fn();
            timer = new ExamTimer(2, onTick, jest.fn()); // 120 seconds
            timer.start();

            jest.advanceTimersByTime(1000); // first tick: 119 seconds left

            expect(onTick).toHaveBeenCalledWith(expect.objectContaining({
                minutes: 1,
                seconds: 59,
                totalSeconds: 119
            }));
        });

        it('should set isBlinking when 60 seconds or less remain', () => {
            const onTick = jest.fn();
            timer = new ExamTimer(70, onTick, jest.fn(), true); // 70 seconds
            timer.start();

            jest.advanceTimersByTime(10000); // 60 seconds remaining

            const lastCall = onTick.mock.calls[onTick.mock.calls.length - 1][0];
            expect(lastCall.isBlinking).toBe(true);
        });

        it('should set isCritical when 30 seconds or less remain', () => {
            const onTick = jest.fn();
            timer = new ExamTimer(40, onTick, jest.fn(), true); // 40 seconds
            timer.start();

            jest.advanceTimersByTime(10000); // 30 seconds remaining

            const lastCall = onTick.mock.calls[onTick.mock.calls.length - 1][0];
            expect(lastCall.isCritical).toBe(true);
        });

        it('should not set isCritical when more than 30 seconds remain', () => {
            const onTick = jest.fn();
            timer = new ExamTimer(60, onTick, jest.fn(), true); // 60 seconds
            timer.start();

            jest.advanceTimersByTime(1000); // 59 seconds remaining

            const lastCall = onTick.mock.calls[onTick.mock.calls.length - 1][0];
            expect(lastCall.isCritical).toBe(false);
        });
    });

    describe('completion', () => {
        it('should call onComplete when timer reaches zero', () => {
            const onComplete = jest.fn();
            timer = new ExamTimer(3, jest.fn(), onComplete, true); // 3 seconds
            timer.start();

            jest.advanceTimersByTime(3000);

            expect(onComplete).toHaveBeenCalledTimes(1);
        });

        it('should destroy interval after completion', () => {
            const onComplete = jest.fn();
            const onTick = jest.fn();
            timer = new ExamTimer(2, onTick, onComplete, true); // 2 seconds
            timer.start();

            jest.advanceTimersByTime(5000); // well past completion

            // onComplete should only be called once
            expect(onComplete).toHaveBeenCalledTimes(1);
            // onTick should stop after timer reaches 0
            expect(onTick).toHaveBeenCalledTimes(2);
        });
    });

    describe('destroy', () => {
        it('should clear the interval', () => {
            const onTick = jest.fn();
            timer = new ExamTimer(10, onTick, jest.fn());
            timer.start();
            timer.destroy();

            const callCount = onTick.mock.calls.length;
            jest.advanceTimersByTime(5000);

            // No more ticks after destroy
            expect(onTick.mock.calls.length).toBe(callCount);
        });
    });
});
