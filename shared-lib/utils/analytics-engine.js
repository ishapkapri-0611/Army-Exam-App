class AnalyticsEngine {
    constructor() {
        this.examData = new Map();
        this.candidateStats = new Map();
        this.questionStats = new Map();
        this.realTimeEvents = [];
    }

    initializeExam(examConfig) {
        this.examData.set('config', examConfig);
        this.examData.set('startTime', new Date());
        this.examData.set('candidates', new Map());
    }

    addCandidate(candidateId, candidateData) {
        this.examData.get('candidates').set(candidateId, {
            ...candidateData,
            loginTime: new Date(),
            lastActivity: new Date(),
            questionsAnswered: 0,
            tabSwitches: 0,
            securityEvents: [],
            answers: new Map(),
            progress: 0
        });
    }

    recordAnswer(candidateId, questionId, answer, timestamp) {
        const candidate = this.examData.get('candidates').get(candidateId);
        if (candidate) {
            candidate.answers.set(questionId, {
                answer,
                timestamp,
                timeSpent: this.calculateTimeSpent(candidate.lastActivity, timestamp)
            });
            
            candidate.lastActivity = timestamp;
            candidate.questionsAnswered = candidate.answers.size;
            candidate.progress = (candidate.answers.size / this.examData.get('config').totalQuestions) * 100;

            this.updateQuestionStats(questionId, answer);
            this.updateCandidateStats(candidateId);
        }
    }

    recordSecurityEvent(candidateId, event) {
        const candidate = this.examData.get('candidates').get(candidateId);
        if (candidate) {
            candidate.securityEvents.push(event);
            
            if (event.type === 'tab_switch') {
                candidate.tabSwitches++;
            }
        }

        this.realTimeEvents.push({
            candidateId,
            ...event,
            timestamp: new Date()
        });

        // Keep only last 1000 events
        if (this.realTimeEvents.length > 1000) {
            this.realTimeEvents = this.realTimeEvents.slice(-1000);
        }
    }

    updateQuestionStats(questionId, answer) {
        if (!this.questionStats.has(questionId)) {
            this.questionStats.set(questionId, {
                totalAttempts: 0,
                correctAttempts: 0,
                answerDistribution: { A: 0, B: 0, C: 0, D: 0 },
                difficulty: 'unknown'
            });
        }

        const stats = this.questionStats.get(questionId);
        stats.totalAttempts++;
        stats.answerDistribution[answer]++;

        // Calculate difficulty based on correct answers (would need correct answer data)
        if (stats.totalAttempts >= 5) {
            const accuracy = stats.correctAttempts / stats.totalAttempts;
            if (accuracy < 0.3) stats.difficulty = 'hard';
            else if (accuracy < 0.7) stats.difficulty = 'medium';
            else stats.difficulty = 'easy';
        }
    }

    updateCandidateStats(candidateId) {
        const candidate = this.examData.get('candidates').get(candidateId);
        if (candidate) {
            this.candidateStats.set(candidateId, {
                progress: candidate.progress,
                questionsAnswered: candidate.questionsAnswered,
                averageTimePerQuestion: this.calculateAverageTime(candidate),
                riskLevel: this.calculateRiskLevel(candidate),
                lastActivity: candidate.lastActivity
            });
        }
    }

    calculateTimeSpent(startTime, endTime) {
        return Math.round((endTime - startTime) / 1000); // seconds
    }

    calculateAverageTime(candidate) {
        const times = Array.from(candidate.answers.values()).map(a => a.timeSpent);
        return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    }

    calculateRiskLevel(candidate) {
        let riskScore = 0;
        
        if (candidate.tabSwitches > 2) riskScore += 30;
        if (candidate.tabSwitches > 5) riskScore += 50;
        
        if (candidate.securityEvents.length > 5) riskScore += 20;
        
        const inactivityTime = (new Date() - candidate.lastActivity) / 60000; // minutes
        if (inactivityTime > 3) riskScore += 10;
        
        if (riskScore >= 50) return 'high';
        if (riskScore >= 20) return 'medium';
        return 'low';
    }

    getRealTimeDashboard() {
        const candidates = this.examData.get('candidates');
        const totalCandidates = candidates ? candidates.size : 0;
        const activeCandidates = candidates ? 
            Array.from(candidates.values()).filter(c => 
                (new Date() - c.lastActivity) < 300000 // 5 minutes
            ).length : 0;

        return {
            totalCandidates,
            activeCandidates,
            averageProgress: this.calculateAverageProgress(),
            securityAlerts: this.realTimeEvents.filter(e => 
                e.timestamp > new Date(Date.now() - 300000) // last 5 minutes
            ).length,
            highRiskCandidates: this.getHighRiskCandidates(),
            recentEvents: this.realTimeEvents.slice(-10)
        };
    }

    calculateAverageProgress() {
        const candidates = this.examData.get('candidates');
        if (!candidates || candidates.size === 0) return 0;
        
        const progresses = Array.from(candidates.values()).map(c => c.progress);
        return progresses.reduce((a, b) => a + b, 0) / progresses.length;
    }

    getHighRiskCandidates() {
        return Array.from(this.candidateStats.entries())
            .filter(([_, stats]) => stats.riskLevel === 'high')
            .map(([candidateId, stats]) => ({
                candidateId,
                ...stats
            }));
    }

    getQuestionAnalytics() {
        return Array.from(this.questionStats.entries()).map(([questionId, stats]) => ({
            questionId,
            ...stats,
            accuracy: stats.totalAttempts > 0 ? (stats.correctAttempts / stats.totalAttempts) * 100 : 0
        }));
    }

    getCandidateAnalytics(candidateId) {
        const candidate = this.examData.get('candidates').get(candidateId);
        if (!candidate) return null;

        return {
            candidateId,
            personalInfo: {
                armyNumber: candidate.armyNumber,
                name: candidate.name,
                rank: candidate.rank,
                unit: candidate.unit
            },
            performance: {
                progress: candidate.progress,
                questionsAnswered: candidate.questionsAnswered,
                averageTime: this.calculateAverageTime(candidate),
                estimatedScore: this.estimateScore(candidate)
            },
            behavior: {
                tabSwitches: candidate.tabSwitches,
                securityEvents: candidate.securityEvents.length,
                riskLevel: this.calculateRiskLevel(candidate),
                loginDuration: Math.round((new Date() - candidate.loginTime) / 60000) // minutes
            },
            answers: Array.from(candidate.answers.entries())
        };
    }

    estimateScore(candidate) {
        // Simple estimation based on progress and behavior
        let baseScore = candidate.progress;
        
        // Deduct points for security violations
        const violationDeduction = Math.min(candidate.tabSwitches * 5, 30);
        
        return Math.max(0, baseScore - violationDeduction);
    }

    generateExamReport() {
        const dashboard = this.getRealTimeDashboard();
        const questionAnalytics = this.getQuestionAnalytics();
        const candidateAnalytics = Array.from(this.examData.get('candidates').keys())
            .map(id => this.getCandidateAnalytics(id))
            .filter(analytics => analytics !== null);

        return {
            summary: {
                totalCandidates: dashboard.totalCandidates,
                averageProgress: dashboard.averageProgress,
                totalDuration: Math.round((new Date() - this.examData.get('startTime')) / 60000),
                securityIncidents: this.realTimeEvents.length
            },
            questions: questionAnalytics,
            candidates: candidateAnalytics,
            generatedAt: new Date().toISOString()
        };
    }

    exportToExcel() {
        // This would integrate with Excel export library
        const report = this.generateExamReport();
        return this.formatExcelData(report);
    }

    formatExcelData(report) {
        // Format data for Excel export
        return {
            summary: [
                ['Metric', 'Value'],
                ['Total Candidates', report.summary.totalCandidates],
                ['Average Progress', report.summary.averageProgress.toFixed(1) + '%'],
                ['Exam Duration', report.summary.totalDuration + ' minutes'],
                ['Security Incidents', report.summary.securityIncidents]
            ],
            candidates: this.formatCandidateData(report.candidates),
            questions: this.formatQuestionData(report.questions)
        };
    }

    formatCandidateData(candidates) {
        const headers = ['Army Number', 'Name', 'Progress', 'Questions Answered', 'Risk Level', 'Tab Switches'];
        const data = candidates.map(c => [
            c.personalInfo.armyNumber,
            c.personalInfo.name,
            c.performance.progress.toFixed(1) + '%',
            c.performance.questionsAnswered,
            c.behavior.riskLevel,
            c.behavior.tabSwitches
        ]);
        
        return [headers, ...data];
    }

    formatQuestionData(questions) {
        const headers = ['Question ID', 'Total Attempts', 'Accuracy', 'Difficulty', 'Most Common Answer'];
        const data = questions.map(q => [
            q.questionId,
            q.totalAttempts,
            q.accuracy.toFixed(1) + '%',
            q.difficulty,
            this.getMostCommonAnswer(q.answerDistribution)
        ]);
        
        return [headers, ...data];
    }

    getMostCommonAnswer(distribution) {
        return Object.entries(distribution).reduce((a, b) => 
            a[1] > b[1] ? a : b
        )[0];
    }
}

module.exports = AnalyticsEngine;