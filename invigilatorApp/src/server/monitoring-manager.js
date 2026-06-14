const AnalyticsEngine = require('../../shared-lib/utils/analytics-engine');

class MonitoringManager {
    constructor(io) {
        this.io = io;
        this.analytics = new AnalyticsEngine();
        this.activeExams = new Map();
        this.broadcastMessages = [];
    }

    initializeExam(examId, examConfig) {
        this.analytics.initializeExam(examConfig);
        this.activeExams.set(examId, {
            config: examConfig,
            startTime: new Date(),
            candidates: new Map(),
            status: 'active'
        });

        console.log(`📊 Exam ${examId} monitoring initialized`);
    }

    registerCandidate(examId, candidateId, candidateData, socket) {
        if (!this.activeExams.has(examId)) return;

        const exam = this.activeExams.get(examId);
        exam.candidates.set(candidateId, {
            socketId: socket.id,
            ...candidateData,
            connectionTime: new Date(),
            isActive: true
        });

        this.analytics.addCandidate(candidateId, candidateData);

        // Notify all invigilators
        this.io.to('invigilators').emit('candidate-joined', {
            examId,
            candidateId,
            candidateData,
            totalCandidates: exam.candidates.size
        });

        console.log(`👤 Candidate ${candidateData.armyNumber} joined exam ${examId}`);
    }

    recordCandidateActivity(candidateId, activity) {
        this.analytics.recordAnswer(
            candidateId, 
            activity.questionId, 
            activity.answer, 
            new Date()
        );

        this.updateCandidateStatus(candidateId, 'active');
    }

    recordSecurityEvent(candidateId, event) {
        this.analytics.recordSecurityEvent(candidateId, {
            ...event,
            severity: this.calculateEventSeverity(event)
        });

        // Notify invigilators of high-severity events
        if (event.severity === 'high') {
            this.io.to('invigilators').emit('security-alert', {
                candidateId,
                event,
                timestamp: new Date()
            });
        }

        console.log(`🔒 Security event for candidate ${candidateId}:`, event.message);
    }

    calculateEventSeverity(event) {
        switch (event.type) {
            case 'tab_switch':
                return event.tabSwitchCount >= 3 ? 'high' : 'medium';
            case 'screenshot_attempt':
                return 'high';
            case 'devtools_detected':
                return 'high';
            default:
                return 'low';
        }
    }

    updateCandidateStatus(candidateId, status) {
        const exam = this.getExamByCandidate(candidateId);
        if (exam && exam.candidates.has(candidateId)) {
            exam.candidates.get(candidateId).isActive = status === 'active';
            exam.candidates.get(candidateId).lastActivity = new Date();
        }
    }

    getExamByCandidate(candidateId) {
        for (const [examId, exam] of this.activeExams) {
            if (exam.candidates.has(candidateId)) {
                return exam;
            }
        }
        return null;
    }

    broadcastMessage(examId, message) {
        const exam = this.activeExams.get(examId);
        if (!exam) return;

        const broadcast = {
            id: Date.now(),
            message,
            timestamp: new Date(),
            sender: 'invigilator'
        };

        this.broadcastMessages.push(broadcast);

        // Send to all candidates in the exam
        exam.candidates.forEach((candidate, candidateId) => {
            this.io.to(candidate.socketId).emit('broadcast-message', broadcast);
        });

        console.log(`📢 Broadcast message to exam ${examId}: ${message}`);
    }

    getRealTimeDashboard(examId) {
        const dashboard = this.analytics.getRealTimeDashboard();
        const exam = this.activeExams.get(examId);

        return {
            ...dashboard,
            examInfo: {
                id: examId,
                startTime: exam.startTime,
                duration: exam.config.duration,
                status: exam.status
            },
            candidateDetails: this.getCandidateDetails(examId)
        };
    }

    getCandidateDetails(examId) {
        const exam = this.activeExams.get(examId);
        if (!exam) return [];

        return Array.from(exam.candidates.entries()).map(([candidateId, candidate]) => ({
            candidateId,
            armyNumber: candidate.armyNumber,
            name: candidate.name,
            progress: this.analytics.candidateStats.get(candidateId)?.progress || 0,
            riskLevel: this.analytics.candidateStats.get(candidateId)?.riskLevel || 'low',
            isActive: candidate.isActive,
            connectionTime: candidate.connectionTime
        }));
    }

    forceSubmitCandidate(candidateId) {
        const exam = this.getExamByCandidate(candidateId);
        if (exam && exam.candidates.has(candidateId)) {
            const candidate = exam.candidates.get(candidateId);
            
            this.io.to(candidate.socketId).emit('force-submit', {
                reason: 'Invigilator forced submission',
                timestamp: new Date()
            });

            console.log(`⚡ Force-submitted candidate ${candidateId}`);
        }
    }

    extendExamTime(examId, additionalMinutes) {
        const exam = this.activeExams.get(examId);
        if (exam) {
            exam.config.duration += additionalMinutes;
            
            // Notify all candidates
            exam.candidates.forEach((candidate, candidateId) => {
                this.io.to(candidate.socketId).emit('time-extended', {
                    additionalMinutes,
                    newDuration: exam.config.duration
                });
            });

            console.log(`⏰ Exam ${examId} time extended by ${additionalMinutes} minutes`);
        }
    }

    generateFinalReport(examId) {
        const report = this.analytics.generateExamReport();
        const exam = this.activeExams.get(examId);

        return {
            ...report,
            examDetails: {
                id: examId,
                config: exam.config,
                startTime: exam.startTime,
                endTime: new Date()
            }
        };
    }

    exportResults(examId, format = 'excel') {
        const report = this.generateFinalReport(examId);
        
        switch (format) {
            case 'excel':
                return this.analytics.exportToExcel();
            case 'pdf':
                return this.generatePdfReport(report);
            case 'word':
                return this.generateWordReport(report);
            default:
                return report;
        }
    }

    generatePdfReport(report) {
        // PDF generation logic would go here
        return {
            format: 'pdf',
            data: report,
            generatedAt: new Date()
        };
    }

    generateWordReport(report) {
        // Word document generation logic would go here
        return {
            format: 'docx',
            data: report,
            generatedAt: new Date()
        };
    }
}

module.exports = MonitoringManager;