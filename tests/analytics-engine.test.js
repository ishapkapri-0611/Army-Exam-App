const AnalyticsEngine = require('../shared-lib/utils/analytics-engine');

describe('AnalyticsEngine', () => {
    let engine;

    beforeEach(() => {
        engine = new AnalyticsEngine();
    });

    describe('constructor', () => {
        it('should initialize with empty data structures', () => {
            expect(engine.examData).toBeInstanceOf(Map);
            expect(engine.candidateStats).toBeInstanceOf(Map);
            expect(engine.questionStats).toBeInstanceOf(Map);
            expect(engine.realTimeEvents).toEqual([]);
        });
    });

    describe('initializeExam', () => {
        it('should store exam config', () => {
            const config = { totalQuestions: 50, duration: 60 };
            engine.initializeExam(config);

            expect(engine.examData.get('config')).toEqual(config);
            expect(engine.examData.get('startTime')).toBeInstanceOf(Date);
            expect(engine.examData.get('candidates')).toBeInstanceOf(Map);
        });
    });

    describe('addCandidate', () => {
        beforeEach(() => {
            engine.initializeExam({ totalQuestions: 10, duration: 30 });
        });

        it('should add a candidate with default tracking fields', () => {
            engine.addCandidate('C001', { armyNumber: 'JC543031A', name: 'John' });

            const candidate = engine.examData.get('candidates').get('C001');
            expect(candidate).toBeDefined();
            expect(candidate.armyNumber).toBe('JC543031A');
            expect(candidate.name).toBe('John');
            expect(candidate.questionsAnswered).toBe(0);
            expect(candidate.tabSwitches).toBe(0);
            expect(candidate.securityEvents).toEqual([]);
            expect(candidate.answers).toBeInstanceOf(Map);
            expect(candidate.progress).toBe(0);
        });
    });

    describe('recordAnswer', () => {
        beforeEach(() => {
            engine.initializeExam({ totalQuestions: 10, duration: 30 });
            engine.addCandidate('C001', { armyNumber: 'JC543031A', name: 'John' });
        });

        it('should record an answer for a candidate', () => {
            const timestamp = new Date();
            engine.recordAnswer('C001', 'Q1', 'A', timestamp);

            const candidate = engine.examData.get('candidates').get('C001');
            expect(candidate.answers.has('Q1')).toBe(true);
            expect(candidate.answers.get('Q1').answer).toBe('A');
        });

        it('should update questionsAnswered count', () => {
            engine.recordAnswer('C001', 'Q1', 'A', new Date());
            engine.recordAnswer('C001', 'Q2', 'B', new Date());

            const candidate = engine.examData.get('candidates').get('C001');
            expect(candidate.questionsAnswered).toBe(2);
        });

        it('should update progress percentage', () => {
            engine.recordAnswer('C001', 'Q1', 'A', new Date());

            const candidate = engine.examData.get('candidates').get('C001');
            expect(candidate.progress).toBe(10); // 1/10 * 100
        });

        it('should not throw for non-existent candidate', () => {
            expect(() => {
                engine.recordAnswer('INVALID', 'Q1', 'A', new Date());
            }).not.toThrow();
        });
    });

    describe('recordSecurityEvent', () => {
        beforeEach(() => {
            engine.initializeExam({ totalQuestions: 10, duration: 30 });
            engine.addCandidate('C001', { armyNumber: 'JC543031A', name: 'John' });
        });

        it('should record security events for a candidate', () => {
            engine.recordSecurityEvent('C001', { type: 'screenshot_attempt', message: 'Screenshot blocked' });

            const candidate = engine.examData.get('candidates').get('C001');
            expect(candidate.securityEvents.length).toBe(1);
        });

        it('should increment tabSwitches for tab_switch events', () => {
            engine.recordSecurityEvent('C001', { type: 'tab_switch', message: 'Tab switch detected' });

            const candidate = engine.examData.get('candidates').get('C001');
            expect(candidate.tabSwitches).toBe(1);
        });

        it('should add event to realTimeEvents', () => {
            engine.recordSecurityEvent('C001', { type: 'tab_switch', message: 'Test' });
            expect(engine.realTimeEvents.length).toBe(1);
            expect(engine.realTimeEvents[0].candidateId).toBe('C001');
        });

        it('should cap realTimeEvents at 1000', () => {
            for (let i = 0; i < 1010; i++) {
                engine.recordSecurityEvent('C001', { type: 'test', message: `Event ${i}` });
            }
            expect(engine.realTimeEvents.length).toBe(1000);
        });
    });

    describe('updateQuestionStats', () => {
        it('should initialize stats for a new question', () => {
            engine.updateQuestionStats('Q1', 'A');

            const stats = engine.questionStats.get('Q1');
            expect(stats.totalAttempts).toBe(1);
            expect(stats.answerDistribution.A).toBe(1);
        });

        it('should increment answer distribution', () => {
            engine.updateQuestionStats('Q1', 'A');
            engine.updateQuestionStats('Q1', 'B');
            engine.updateQuestionStats('Q1', 'A');

            const stats = engine.questionStats.get('Q1');
            expect(stats.answerDistribution.A).toBe(2);
            expect(stats.answerDistribution.B).toBe(1);
        });

        it('should calculate difficulty after 5 attempts', () => {
            for (let i = 0; i < 5; i++) {
                engine.updateQuestionStats('Q1', 'A');
            }

            const stats = engine.questionStats.get('Q1');
            expect(stats.difficulty).not.toBe('unknown');
        });

        it('should mark as hard when accuracy is low', () => {
            // 0 correct out of 5 = 0% accuracy
            for (let i = 0; i < 5; i++) {
                engine.updateQuestionStats('Q1', 'A');
            }

            const stats = engine.questionStats.get('Q1');
            expect(stats.difficulty).toBe('hard');
        });
    });

    describe('calculateTimeSpent', () => {
        it('should return time difference in seconds', () => {
            const start = new Date('2024-01-01T10:00:00');
            const end = new Date('2024-01-01T10:01:30');

            expect(engine.calculateTimeSpent(start, end)).toBe(90);
        });
    });

    describe('calculateRiskLevel', () => {
        it('should return low for no violations', () => {
            const candidate = {
                tabSwitches: 0,
                securityEvents: [],
                lastActivity: new Date()
            };
            expect(engine.calculateRiskLevel(candidate)).toBe('low');
        });

        it('should return medium for moderate violations', () => {
            const candidate = {
                tabSwitches: 3,
                securityEvents: [],
                lastActivity: new Date()
            };
            expect(engine.calculateRiskLevel(candidate)).toBe('medium');
        });

        it('should return high for severe violations', () => {
            const candidate = {
                tabSwitches: 6,
                securityEvents: new Array(6),
                lastActivity: new Date(Date.now() - 300000) // 5 min ago
            };
            expect(engine.calculateRiskLevel(candidate)).toBe('high');
        });
    });

    describe('calculateAverageProgress', () => {
        it('should return 0 when no candidates exist', () => {
            engine.initializeExam({ totalQuestions: 10, duration: 30 });
            expect(engine.calculateAverageProgress()).toBe(0);
        });

        it('should calculate average progress correctly', () => {
            engine.initializeExam({ totalQuestions: 10, duration: 30 });
            engine.addCandidate('C001', { armyNumber: 'JC543031A', name: 'A' });
            engine.addCandidate('C002', { armyNumber: 'JC543032B', name: 'B' });

            engine.recordAnswer('C001', 'Q1', 'A', new Date());
            engine.recordAnswer('C001', 'Q2', 'B', new Date());
            // C001 = 20%, C002 = 0%, average = 10%
            expect(engine.calculateAverageProgress()).toBe(10);
        });
    });

    describe('estimateScore', () => {
        it('should return progress minus violation deductions', () => {
            const candidate = {
                progress: 80,
                tabSwitches: 2
            };
            expect(engine.estimateScore(candidate)).toBe(70); // 80 - (2*5)
        });

        it('should cap deductions at 30', () => {
            const candidate = {
                progress: 80,
                tabSwitches: 10
            };
            expect(engine.estimateScore(candidate)).toBe(50); // 80 - 30 (capped)
        });

        it('should not go below 0', () => {
            const candidate = {
                progress: 10,
                tabSwitches: 6
            };
            expect(engine.estimateScore(candidate)).toBe(0);
        });
    });

    describe('getMostCommonAnswer', () => {
        it('should return the answer with highest count', () => {
            const distribution = { A: 5, B: 3, C: 1, D: 2 };
            expect(engine.getMostCommonAnswer(distribution)).toBe('A');
        });

        it('should return first highest when tied', () => {
            const distribution = { A: 3, B: 3, C: 1, D: 0 };
            const result = engine.getMostCommonAnswer(distribution);
            expect(['A', 'B']).toContain(result);
        });
    });

    describe('getQuestionAnalytics', () => {
        it('should return formatted question analytics', () => {
            engine.updateQuestionStats('Q1', 'A');
            engine.updateQuestionStats('Q2', 'B');

            const analytics = engine.getQuestionAnalytics();
            expect(analytics.length).toBe(2);
            expect(analytics[0]).toHaveProperty('questionId');
            expect(analytics[0]).toHaveProperty('totalAttempts');
            expect(analytics[0]).toHaveProperty('accuracy');
        });
    });

    describe('getCandidateAnalytics', () => {
        it('should return null for non-existent candidate', () => {
            engine.initializeExam({ totalQuestions: 10, duration: 30 });
            expect(engine.getCandidateAnalytics('INVALID')).toBeNull();
        });

        it('should return formatted analytics for an existing candidate', () => {
            engine.initializeExam({ totalQuestions: 10, duration: 30 });
            engine.addCandidate('C001', { armyNumber: 'JC543031A', name: 'John', rank: 'Captain', unit: 'Unit 1' });

            const analytics = engine.getCandidateAnalytics('C001');
            expect(analytics).not.toBeNull();
            expect(analytics.candidateId).toBe('C001');
            expect(analytics.performance).toHaveProperty('progress');
            expect(analytics.behavior).toHaveProperty('tabSwitches');
        });
    });

    describe('getRealTimeDashboard', () => {
        it('should return dashboard data with zero candidates', () => {
            engine.initializeExam({ totalQuestions: 10, duration: 30 });
            const dashboard = engine.getRealTimeDashboard();

            expect(dashboard.totalCandidates).toBe(0);
            expect(dashboard.activeCandidates).toBe(0);
            expect(dashboard.averageProgress).toBe(0);
        });

        it('should count active candidates', () => {
            engine.initializeExam({ totalQuestions: 10, duration: 30 });
            engine.addCandidate('C001', { armyNumber: 'JC543031A', name: 'A' });
            engine.addCandidate('C002', { armyNumber: 'JC543032B', name: 'B' });

            const dashboard = engine.getRealTimeDashboard();
            expect(dashboard.totalCandidates).toBe(2);
            expect(dashboard.activeCandidates).toBe(2);
        });
    });

    describe('generateExamReport', () => {
        it('should generate a complete report', () => {
            engine.initializeExam({ totalQuestions: 10, duration: 30 });
            engine.addCandidate('C001', { armyNumber: 'JC543031A', name: 'John', rank: 'Captain', unit: 'Unit 1' });
            engine.recordAnswer('C001', 'Q1', 'A', new Date());

            const report = engine.generateExamReport();
            expect(report.summary).toHaveProperty('totalCandidates');
            expect(report.summary).toHaveProperty('averageProgress');
            expect(report.summary).toHaveProperty('totalDuration');
            expect(report.candidates.length).toBe(1);
            expect(report.generatedAt).toBeDefined();
        });
    });

    describe('formatExcelData', () => {
        it('should return structured data with summary, candidates, and questions', () => {
            engine.initializeExam({ totalQuestions: 10, duration: 30 });
            engine.addCandidate('C001', { armyNumber: 'JC543031A', name: 'John', rank: 'Captain', unit: 'Unit 1' });

            const report = engine.generateExamReport();
            const excelData = engine.formatExcelData(report);

            expect(excelData).toHaveProperty('summary');
            expect(excelData).toHaveProperty('candidates');
            expect(excelData).toHaveProperty('questions');
            expect(excelData.summary[0]).toEqual(['Metric', 'Value']);
        });
    });
});
