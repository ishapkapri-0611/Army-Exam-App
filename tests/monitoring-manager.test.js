// Mock AnalyticsEngine at the path that moduleNameMapper resolves to
jest.mock('../shared-lib/utils/analytics-engine', () => {
    return jest.fn().mockImplementation(() => ({
        initializeExam: jest.fn(),
        addCandidate: jest.fn(),
        recordAnswer: jest.fn(),
        recordSecurityEvent: jest.fn(),
        candidateStats: new Map(),
        getRealTimeDashboard: jest.fn().mockReturnValue({
            totalCandidates: 0,
            activeCandidates: 0,
            averageProgress: 0,
            securityAlerts: 0,
            highRiskCandidates: [],
            recentEvents: []
        })
    }));
});

const MonitoringManager = require('../invigilatorApp/src/server/monitoring-manager');

describe('MonitoringManager', () => {
    let manager;
    let mockIo;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        mockIo = {
            to: jest.fn().mockReturnThis(),
            emit: jest.fn()
        };
        manager = new MonitoringManager(mockIo);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with io instance', () => {
            expect(manager.io).toBe(mockIo);
        });

        it('should initialize with empty active exams', () => {
            expect(manager.activeExams).toBeInstanceOf(Map);
            expect(manager.activeExams.size).toBe(0);
        });

        it('should initialize with empty broadcast messages', () => {
            expect(manager.broadcastMessages).toEqual([]);
        });
    });

    describe('initializeExam', () => {
        it('should register a new exam', () => {
            const config = { duration: 60, totalQuestions: 50 };
            manager.initializeExam('EXAM001', config);

            expect(manager.activeExams.has('EXAM001')).toBe(true);
            expect(manager.activeExams.get('EXAM001').config).toEqual(config);
            expect(manager.activeExams.get('EXAM001').status).toBe('active');
        });

        it('should call analytics initializeExam', () => {
            const config = { duration: 60, totalQuestions: 50 };
            manager.initializeExam('EXAM001', config);

            expect(manager.analytics.initializeExam).toHaveBeenCalledWith(config);
        });
    });

    describe('registerCandidate', () => {
        beforeEach(() => {
            manager.initializeExam('EXAM001', { duration: 60, totalQuestions: 50 });
        });

        it('should register a candidate for an active exam', () => {
            const candidateData = { armyNumber: 'JC543031A', name: 'John' };
            const socket = { id: 'socket123' };

            manager.registerCandidate('EXAM001', 'C001', candidateData, socket);

            const exam = manager.activeExams.get('EXAM001');
            expect(exam.candidates.has('C001')).toBe(true);
            expect(exam.candidates.get('C001').socketId).toBe('socket123');
        });

        it('should not register candidate for non-existent exam', () => {
            const candidateData = { armyNumber: 'JC543031A', name: 'John' };
            const socket = { id: 'socket123' };

            manager.registerCandidate('INVALID', 'C001', candidateData, socket);

            expect(manager.analytics.addCandidate).not.toHaveBeenCalled();
        });

        it('should notify invigilators when a candidate joins', () => {
            const candidateData = { armyNumber: 'JC543031A', name: 'John' };
            const socket = { id: 'socket123' };

            manager.registerCandidate('EXAM001', 'C001', candidateData, socket);

            expect(mockIo.to).toHaveBeenCalledWith('invigilators');
            expect(mockIo.emit).toHaveBeenCalledWith('candidate-joined', expect.objectContaining({
                examId: 'EXAM001',
                candidateId: 'C001',
                totalCandidates: 1
            }));
        });
    });

    describe('calculateEventSeverity', () => {
        it('should return high for tab_switch with count >= 3', () => {
            expect(manager.calculateEventSeverity({ type: 'tab_switch', tabSwitchCount: 3 })).toBe('high');
            expect(manager.calculateEventSeverity({ type: 'tab_switch', tabSwitchCount: 5 })).toBe('high');
        });

        it('should return medium for tab_switch with low count', () => {
            expect(manager.calculateEventSeverity({ type: 'tab_switch', tabSwitchCount: 1 })).toBe('medium');
        });

        it('should return high for screenshot_attempt', () => {
            expect(manager.calculateEventSeverity({ type: 'screenshot_attempt' })).toBe('high');
        });

        it('should return high for devtools_detected', () => {
            expect(manager.calculateEventSeverity({ type: 'devtools_detected' })).toBe('high');
        });

        it('should return low for unknown event types', () => {
            expect(manager.calculateEventSeverity({ type: 'other' })).toBe('low');
        });
    });

    describe('getExamByCandidate', () => {
        it('should find the exam containing the candidate', () => {
            manager.initializeExam('EXAM001', { duration: 60, totalQuestions: 50 });
            const candidateData = { armyNumber: 'JC543031A', name: 'John' };
            const socket = { id: 'socket123' };
            manager.registerCandidate('EXAM001', 'C001', candidateData, socket);

            const exam = manager.getExamByCandidate('C001');
            expect(exam).not.toBeNull();
            expect(exam.candidates.has('C001')).toBe(true);
        });

        it('should return null for non-existent candidate', () => {
            expect(manager.getExamByCandidate('INVALID')).toBeNull();
        });
    });

    describe('broadcastMessage', () => {
        it('should send message to all candidates in exam', () => {
            manager.initializeExam('EXAM001', { duration: 60, totalQuestions: 50 });
            const socket = { id: 'socket123' };
            manager.registerCandidate('EXAM001', 'C001', { armyNumber: 'JC543031A', name: 'John' }, socket);

            manager.broadcastMessage('EXAM001', 'Time extended by 5 minutes');

            expect(mockIo.to).toHaveBeenCalledWith('socket123');
            expect(mockIo.emit).toHaveBeenCalledWith('broadcast-message', expect.objectContaining({
                message: 'Time extended by 5 minutes',
                sender: 'invigilator'
            }));
        });

        it('should store broadcast in messages array', () => {
            manager.initializeExam('EXAM001', { duration: 60, totalQuestions: 50 });
            manager.broadcastMessage('EXAM001', 'Test message');

            expect(manager.broadcastMessages.length).toBe(1);
            expect(manager.broadcastMessages[0].message).toBe('Test message');
        });

        it('should not broadcast for non-existent exam', () => {
            manager.broadcastMessage('INVALID', 'Test');
            expect(manager.broadcastMessages.length).toBe(0);
        });
    });

    describe('updateCandidateStatus', () => {
        it('should update candidate active status', () => {
            manager.initializeExam('EXAM001', { duration: 60, totalQuestions: 50 });
            const socket = { id: 'socket123' };
            manager.registerCandidate('EXAM001', 'C001', { armyNumber: 'JC543031A', name: 'John' }, socket);

            manager.updateCandidateStatus('C001', 'inactive');

            const exam = manager.activeExams.get('EXAM001');
            expect(exam.candidates.get('C001').isActive).toBe(false);
        });

        it('should set isActive true for active status', () => {
            manager.initializeExam('EXAM001', { duration: 60, totalQuestions: 50 });
            const socket = { id: 'socket123' };
            manager.registerCandidate('EXAM001', 'C001', { armyNumber: 'JC543031A', name: 'John' }, socket);

            manager.updateCandidateStatus('C001', 'active');

            const exam = manager.activeExams.get('EXAM001');
            expect(exam.candidates.get('C001').isActive).toBe(true);
        });
    });

    describe('getCandidateDetails', () => {
        it('should return candidate details for an exam', () => {
            manager.initializeExam('EXAM001', { duration: 60, totalQuestions: 50 });
            const socket = { id: 'socket123' };
            manager.registerCandidate('EXAM001', 'C001', { armyNumber: 'JC543031A', name: 'John' }, socket);

            const details = manager.getCandidateDetails('EXAM001');
            expect(details.length).toBe(1);
            expect(details[0].candidateId).toBe('C001');
            expect(details[0].armyNumber).toBe('JC543031A');
        });

        it('should return empty array for non-existent exam', () => {
            const details = manager.getCandidateDetails('INVALID');
            expect(details).toEqual([]);
        });
    });

    describe('recordCandidateActivity', () => {
        it('should call analytics recordAnswer', () => {
            manager.initializeExam('EXAM001', { duration: 60, totalQuestions: 50 });
            const socket = { id: 'socket123' };
            manager.registerCandidate('EXAM001', 'C001', { armyNumber: 'JC543031A', name: 'John' }, socket);

            manager.recordCandidateActivity('C001', { questionId: 'Q1', answer: 'A' });

            expect(manager.analytics.recordAnswer).toHaveBeenCalledWith(
                'C001', 'Q1', 'A', expect.any(Date)
            );
        });
    });

    describe('recordSecurityEvent', () => {
        it('should call analytics recordSecurityEvent with severity', () => {
            manager.initializeExam('EXAM001', { duration: 60, totalQuestions: 50 });
            const socket = { id: 'socket123' };
            manager.registerCandidate('EXAM001', 'C001', { armyNumber: 'JC543031A', name: 'John' }, socket);

            const event = { type: 'tab_switch', tabSwitchCount: 1, message: 'Tab switch' };
            manager.recordSecurityEvent('C001', event);

            expect(manager.analytics.recordSecurityEvent).toHaveBeenCalledWith('C001', expect.objectContaining({
                type: 'tab_switch',
                severity: 'medium'
            }));
        });

        it('should notify invigilators of high-severity events', () => {
            const event = { type: 'screenshot_attempt', severity: 'high', message: 'Screenshot blocked' };
            manager.recordSecurityEvent('C001', event);

            expect(mockIo.to).toHaveBeenCalledWith('invigilators');
            expect(mockIo.emit).toHaveBeenCalledWith('security-alert', expect.objectContaining({
                candidateId: 'C001'
            }));
        });
    });
});
