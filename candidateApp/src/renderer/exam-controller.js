class ExamController {
    constructor() {
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.answers = new Map();
        this.markedQuestions = new Set();
        this.examTimer = null;
        
        // Initialize SecurityManager with error handling
        try {
            if (typeof SecurityManager !== 'undefined') {
                this.securityManager = new SecurityManager();
            } else {
                console.error('SecurityManager class not found, creating fallback');
                this.securityManager = this.createFallbackSecurityManager();
            }
        } catch (error) {
            console.error('Error initializing SecurityManager:', error);
            this.securityManager = this.createFallbackSecurityManager();
        }
        
        this.autoSaveInterval = null;
        this.init();
    }

    createFallbackSecurityManager() {
        return {
            startExamMonitoring: () => console.log('Security monitoring started (fallback)'),
            stopExamMonitoring: () => console.log('Security monitoring stopped (fallback)'),
            getSecurityReport: () => ({
                warnings: [],
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString()
            })
        };
    }

    async init() {
        this.setupExamStartListener();
        await this.loadExamData();
        this.startExam();
        this.startAutoSave();
    }

    setupExamStartListener() {
        window.electronAPI.onExamStart((examData) => {
            console.log('Exam start event received:', examData);
            localStorage.setItem('examQuestions', JSON.stringify(examData.questions));
            localStorage.setItem('examDuration', examData.duration);
            localStorage.setItem('examStartTime', examData.startTime);
            // Reload the page to apply the new exam data
            window.location.reload();
        });
    }

    async loadExamData() {
        try {
            console.log('Loading exam data...');
            const storedQuestions = localStorage.getItem('examQuestions');
            const storedDuration = localStorage.getItem('examDuration');
            const storedStartTime = localStorage.getItem('examStartTime');

            if (storedQuestions) {
                this.questions = JSON.parse(storedQuestions);
            }

            if (storedDuration) {
                this.examDuration = parseInt(storedDuration, 10);
            }

            if (storedStartTime) {
                this.examStartTime = new Date(storedStartTime);
            }

            if (!this.questions || this.questions.length === 0) {
                this.showMessage('Waiting for invigilator to start the exam...', 'info');
                // Disable UI elements until exam starts
                return;
            }
            
            const candidateInfo = JSON.parse(localStorage.getItem('candidateInfo'));
            if (candidateInfo) {
                document.getElementById('candidateName').textContent = candidateInfo.name;
                document.getElementById('armyNumber').textContent = candidateInfo.armyNumber;
                document.getElementById('candidateRank').textContent = candidateInfo.rank;
            }

            this.renderQuestionNavigation();
            this.showQuestion(0);
        } catch (error) {
            console.error('Exam data loading error:', error);
            this.showMessage('Error loading exam data. Please contact the invigilator.', 'error');
        }
    }

    showMessage(message, type = 'info') {
        // Simple message display - will be enhanced in Phase 3
        const colors = {
            info: '#3498db',
            success: '#27ae60',
            error: '#e74c3c',
            warning: '#f39c12'
        };

        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type]};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        messageDiv.textContent = message;

        document.body.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.remove();
        }, 4000);
    }

    startExam() {
        const examDuration = this.examDuration || 60; // minutes
        
        // Calculate remaining time based on server start time
        let remainingTime = examDuration * 60; // default in seconds
        
        if (this.examStartTime) {
            const now = new Date();
            const elapsedSeconds = Math.floor((now - this.examStartTime) / 1000);
            remainingTime = Math.max(0, (examDuration * 60) - elapsedSeconds);
            
            console.log(`Exam started at: ${this.examStartTime}`);
            console.log(`Current time: ${now}`);
            console.log(`Elapsed: ${elapsedSeconds}s, Remaining: ${remainingTime}s`);
        }
        
        this.examTimer = new ExamTimer(
            remainingTime, // pass remaining seconds directly
            (time) => this.updateTimerDisplay(time),
            () => this.autoSubmitExam(),
            true // indicate this is in seconds, not minutes
        );
        
        this.examTimer.start();
        
        try {
            if (this.securityManager && typeof this.securityManager.startExamMonitoring === 'function') {
                this.securityManager.startExamMonitoring();
            }
        } catch (error) {
            console.error('Error starting security monitoring:', error);
        }
    }

    updateTimerDisplay(time) {
        const timerElement = document.getElementById('examTimer');
        timerElement.textContent = `${time.minutes.toString().padStart(2, '0')}:${time.seconds.toString().padStart(2, '0')}`;
        
        // Apply blinking effect
        timerElement.classList.toggle('blinking', time.isBlinking);
        timerElement.classList.toggle('critical', time.isCritical);
        
        // Update timer status
        const statusElement = document.getElementById('timerStatus');
        if (time.totalSeconds <= 300) { // 5 minutes
            statusElement.textContent = 'HURRY UP! Time is running out';
            statusElement.style.color = '#e74c3c';
        } else if (time.totalSeconds <= 600) { // 10 minutes
            statusElement.textContent = 'Time is getting short';
            statusElement.style.color = '#f39c12';
        }
    }

    showQuestion(index) {
        if (!this.questions || index < 0 || index >= this.questions.length) return;
        
        this.currentQuestionIndex = index;
        const question = this.questions[index];
        
        // Update question text
        document.getElementById('questionText').textContent = `${index + 1}. ${question.text}`;
        
        // Update options
        const optionsContainer = document.getElementById('optionsContainer');
        optionsContainer.innerHTML = '';
        
        question.options.forEach(option => {
            const optionElement = document.createElement('div');
            optionElement.className = 'option';
            if (this.answers.get(index) === option.letter) {
                optionElement.classList.add('selected');
            }
            
            optionElement.innerHTML = `
                <span class="option-letter">${option.letter}.</span>
                <span class="option-text">${option.text}</span>
            `;
            
            optionElement.addEventListener('click', (event) => this.selectAnswer(option.letter, event));
            optionsContainer.appendChild(optionElement);
        });
        
        // Update navigation highlights
        this.updateNavigation();
    }

    selectAnswer(answer, event) {
        try {
            if (!this.answers) {
                console.error('Answers Map is not initialized');
                this.answers = new Map();
            }
            
            this.answers.set(this.currentQuestionIndex, answer);
            console.log(`Answer selected: Q${this.currentQuestionIndex + 1} = ${answer}`);
            console.log('Total answers so far:', this.answers.size);
            
            this.updateNavigation();
            this.updateProgress();
            
            // Show selection feedback
            const options = document.querySelectorAll('.option');
            options.forEach(opt => opt.classList.remove('selected'));
            event.currentTarget.classList.add('selected');
        } catch (error) {
            console.error('Error in selectAnswer:', error);
        }
    }

    markForReview() {
        if (this.markedQuestions.has(this.currentQuestionIndex)) {
            this.markedQuestions.delete(this.currentQuestionIndex);
        } else {
            this.markedQuestions.add(this.currentQuestionIndex);
        }
        this.updateNavigation();
    }

    nextQuestion() {
        if (this.questions && this.currentQuestionIndex < this.questions.length - 1) {
            this.showQuestion(this.currentQuestionIndex + 1);
        }
    }

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.showQuestion(this.currentQuestionIndex - 1);
        }
    }

    renderQuestionNavigation() {
        const grid = document.getElementById('questionsGrid');
        grid.innerHTML = '';
        
        this.questions.forEach((_, index) => {
            const numberElement = document.createElement('div');
            numberElement.className = 'question-number';
            numberElement.textContent = index + 1;
            numberElement.addEventListener('click', () => this.showQuestion(index));
            
            grid.appendChild(numberElement);
        });
    }

    updateNavigation() {
        const numbers = document.querySelectorAll('.question-number');
        numbers.forEach((number, index) => {
            number.classList.remove('active', 'answered', 'marked');
            
            if (index === this.currentQuestionIndex) {
                number.classList.add('active');
            }
            if (this.answers.has(index)) {
                number.classList.add('answered');
            }
            if (this.markedQuestions.has(index)) {
                number.classList.add('marked');
            }
        });
    }

    updateProgress() {
        try {
            const answered = this.answers ? this.answers.size : 0;
            const total = this.questions ? this.questions.length : 0;
            const percentage = total > 0 ? (answered / total) * 100 : 0;
            
            const progressFill = document.getElementById('progressFill');
            const progressText = document.getElementById('progressText');
            
            if (progressFill) {
                progressFill.style.width = `${percentage}%`;
            }
            
            if (progressText) {
                progressText.textContent = `${answered}/${total} answered`;
            }
        } catch (error) {
            console.error('Error updating progress:', error);
        }
    }

    startAutoSave() {
        this.autoSaveInterval = setInterval(() => {
            this.autoSaveAnswers();
        }, 60000); // Auto-save every minute
        
        // Update security status every 10 seconds
        this.securityStatusInterval = setInterval(() => {
            this.updateSecurityStatus();
        }, 10000);
        
        // Initial security status update
        setTimeout(() => this.updateSecurityStatus(), 1000);
    }

    async autoSaveAnswers() {
        try {
            await window.electronAPI.autoSaveAnswers({
                answers: Array.from(this.answers.entries()),
                timestamp: new Date().toISOString()
            });
            
            this.showAutoSaveIndicator();
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }

    showAutoSaveIndicator() {
        const indicator = document.getElementById('autoSaveIndicator');
        indicator.classList.add('show');
        setTimeout(() => indicator.classList.remove('show'), 2000);
    }

    updateSecurityStatus() {
        try {
            const statusElement = document.getElementById('securityStatus');
            if (statusElement && this.securityManager) {
                const report = this.securityManager.getSecurityReport();
                statusElement.textContent = `Warnings: ${report.totalWarnings || 0} | Monitoring: ${report.isMonitoring ? 'Active' : 'Inactive'}`;
            }
        } catch (error) {
            console.error('Error updating security status:', error);
        }
    }

    async submitExam() {
        if (confirm('Are you sure you want to submit your exam? This action cannot be undone.')) {
            await this.finalSubmit();
        }
    }

    async autoSubmitExam() {
        alert('Time is up! Your exam will be submitted automatically.');
        await this.finalSubmit();
    }

    async finalSubmit() {
        console.log('=== STARTING FINAL SUBMIT ===');
        
        try {
            console.log('Getting stored data...');
            const serverInfo = JSON.parse(localStorage.getItem('serverInfo'));
            const candidateInfo = JSON.parse(localStorage.getItem('candidateInfo'));
            
            console.log('Server info:', serverInfo);
            console.log('Candidate info:', candidateInfo);
            
            if (!serverInfo) {
                console.error('Server info not found');
                alert('Submission failed: Server information not found.');
                return;
            }

            if (!candidateInfo) {
                console.error('Candidate info not found');
                alert('Submission failed: Candidate information not found.');
                return;
            }
            
            console.log('Current answers Map:', this.answers);
            console.log('Answers Map size:', this.answers ? this.answers.size : 'undefined');
            console.log('Answers Map type:', typeof this.answers);

            // Format answers as expected by server: [[questionId, answer], ...]
            console.log('=== FORMATTING ANSWERS ===');
            let formattedAnswers = [];
            
            try {
                console.log('Checking answers format...');
                console.log('this.answers:', this.answers);
                console.log('typeof this.answers:', typeof this.answers);
                console.log('this.answers.entries:', typeof this.answers?.entries);
                
                if (this.answers && typeof this.answers.entries === 'function') {
                    console.log('Using Map.entries() method');
                    formattedAnswers = Array.from(this.answers.entries());
                    console.log('Map entries result:', formattedAnswers);
                } else if (this.answers && typeof this.answers === 'object') {
                    console.log('Using Object.entries() fallback');
                    formattedAnswers = Object.entries(this.answers);
                    console.log('Object entries result:', formattedAnswers);
                } else {
                    console.warn('No answers found or answers is not in expected format');
                    console.warn('this.answers value:', this.answers);
                    formattedAnswers = [];
                }
            } catch (error) {
                console.error('Error formatting answers:', error);
                console.error('Error stack:', error.stack);
                formattedAnswers = [];
            }
            
            console.log('Final formatted answers:', formattedAnswers);
            console.log('Formatted answers length:', formattedAnswers.length);
            
            // Get security report with error handling
            let securityReport = {
                warnings: [],
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString()
            };
            
            try {
                if (this.securityManager && typeof this.securityManager.getSecurityReport === 'function') {
                    securityReport = this.securityManager.getSecurityReport();
                }
            } catch (error) {
                console.error('Error getting security report:', error);
            }
            
            const submissionData = {
                armyNumber: candidateInfo.armyNumber,
                candidateId: candidateInfo.armyNumber,
                candidate: candidateInfo,
                answers: formattedAnswers,
                submittedAt: new Date().toISOString(),
                securityReport: securityReport
            };

            console.log('Submitting exam data:', submissionData);
            
            // Validate submission data before sending
            if (!submissionData.armyNumber) {
                alert('Submission failed: Missing army number.');
                return;
            }
            
            if (!Array.isArray(submissionData.answers)) {
                alert('Submission failed: Invalid answers format.');
                return;
            }
            
            if (submissionData.answers.length === 0) {
                const confirmEmpty = confirm('No answers found. Do you want to submit an empty exam?');
                if (!confirmEmpty) {
                    return;
                }
            }

            const result = await window.electronAPI.submitExam({
                examData: submissionData,
                serverInfo: serverInfo
            });
            
            if (result.success) {
                console.log('✅ Exam submitted successfully!');
                
                // Clear stored data
                localStorage.removeItem('examQuestions');
                localStorage.removeItem('examDuration');
                localStorage.removeItem('examStartTime');
                localStorage.removeItem('candidateInfo');
                localStorage.removeItem('serverInfo');
                
                // Show success message and close app
                alert('Exam submitted successfully! The application will close now.');
                
                console.log('Closing application...');
                
                try {
                    window.electronAPI.closeApp();
                } catch (error) {
                    console.error('Error closing app:', error);
                    // Fallback: try emergency exit
                    try {
                        window.electronAPI.emergencyExit();
                    } catch (emergencyError) {
                        console.error('Emergency exit also failed:', emergencyError);
                        alert('Please close the application manually.');
                    }
                }
            } else {
                console.error('❌ Submission failed:', result.error);
                alert('Submission failed: ' + result.error);
            }
        } catch (error) {
            console.error('Submission error:', error);
            alert('Error submitting exam: ' + error.message);
        }
    }

    getSampleQuestions() {
        return [
            {
                id: 1,
                text: "What is the primary role of the Indian Army?",
                options: [
                    { letter: "A", text: "Maritime security" },
                    { letter: "B", text: "Air defense" },
                    { letter: "C", text: "Land-based warfare" },
                    { letter: "D", text: "Cyber security" }
                ],
                correctAnswer: "C",
                language: "english"
            },
            // Add more sample questions...
        ];
    }

    shuffleQuestions() {
        if (!this.questions || !Array.isArray(this.questions)) {
            console.warn('Cannot shuffle questions: questions array is not available');
            return;
        }
        
        // Fisher-Yates shuffle algorithm
        for (let i = this.questions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.questions[i], this.questions[j]] = [this.questions[j], this.questions[i]];
        }
    }

    destroy() {
        try {
            if (this.examTimer) {
                this.examTimer.destroy();
            }
        } catch (error) {
            console.error('Error destroying exam timer:', error);
        }
        
        try {
            if (this.autoSaveInterval) {
                clearInterval(this.autoSaveInterval);
            }
        } catch (error) {
            console.error('Error clearing auto-save interval:', error);
        }
        
        try {
            if (this.securityStatusInterval) {
                clearInterval(this.securityStatusInterval);
            }
        } catch (error) {
            console.error('Error clearing security status interval:', error);
        }
        
        try {
            if (this.securityManager && typeof this.securityManager.stopExamMonitoring === 'function') {
                this.securityManager.stopExamMonitoring();
            }
        } catch (error) {
            console.error('Error stopping security monitoring:', error);
        }
    }
}

// Global functions
let examController;

function markForReview() {
    examController.markForReview();
}

function previousQuestion() {
    examController.previousQuestion();
}

function nextQuestion() {
    examController.nextQuestion();
}

function submitExam() {
    examController.submitExam();
}

// Initialize exam when page loads
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('Initializing ExamController...');
        examController = new ExamController();
        console.log('ExamController initialized successfully');
        
        // Debug: Log initial state
        console.log('Initial answers:', examController.answers);
        console.log('Initial questions:', examController.questions);
        
    } catch (error) {
        console.error('Error initializing ExamController:', error);
        console.error('Stack trace:', error.stack);
        
        // Show user-friendly error
        alert('Error initializing exam. Please refresh the page and try again.');
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (examController) {
        examController.destroy();
    }
});