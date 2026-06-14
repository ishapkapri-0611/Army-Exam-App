class ResultController {
    constructor() {
        this.candidateInfo = null;
        this.examResult = null;
        this.init();
    }
    
    init() {
        console.log('🎯 ResultController initialized');
        this.loadCandidateInfo();
    }
    
    loadCandidateInfo() {
        try {
            // Load candidate info from localStorage
            const storedCandidateInfo = localStorage.getItem('candidateInfo');
            if (storedCandidateInfo) {
                this.candidateInfo = JSON.parse(storedCandidateInfo);
                console.log('✅ Candidate info loaded:', this.candidateInfo);
            } else {
                console.error('❌ No candidate info found in localStorage');
                this.showError('Candidate information not found. Please contact the invigilator.');
                return;
            }
        } catch (error) {
            console.error('❌ Error loading candidate info:', error);
            this.showError('Error loading candidate information.');
            return;
        }
    }
    
    async loadResult() {
        try {
            console.log('📊 Loading exam result...');
            
            if (!this.candidateInfo || !this.candidateInfo.armyNumber) {
                this.showError('Candidate information is missing. Cannot load result.');
                return;
            }
            
            // Show loading state
            this.showLoading();
            
            // Always fetch fresh result from server instead of using cached result
            // This ensures we get the latest calculation with all fixes applied
            console.log('🔄 Fetching fresh result from server...');
            
            // Get server info and fetch from API
            const serverInfo = JSON.parse(localStorage.getItem('serverInfo') || '{}');
            if (!serverInfo.ip || !serverInfo.port) {
                this.showError('Server information not found. Cannot retrieve result.');
                return;
            }
            
            // Fetch individual result from server (always get fresh calculation)
            const response = await fetch(`http://${serverInfo.ip}:${serverInfo.port}/api/candidate-result/${this.candidateInfo.armyNumber}`);
            
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Failed to retrieve result');
            }
            
            this.examResult = data.result;
            console.log('✅ Result loaded from server:', this.examResult);
            
            // Display the result
            this.displayResult();
            
        } catch (error) {
            console.error('❌ Error loading result:', error);
            this.showError(`Unable to load your result: ${error.message}`);
        }
    }
    
    showLoading() {
        document.getElementById('loadingSection').style.display = 'flex';
        document.getElementById('errorSection').style.display = 'none';
        document.getElementById('resultSection').style.display = 'none';
    }
    
    showError(message) {
        document.getElementById('loadingSection').style.display = 'none';
        document.getElementById('errorSection').style.display = 'block';
        document.getElementById('resultSection').style.display = 'none';
        document.getElementById('errorMessage').textContent = message;
    }
    
    displayResult() {
        try {
            console.log('🎨 Displaying result...');
            
            // Hide loading and error sections
            document.getElementById('loadingSection').style.display = 'none';
            document.getElementById('errorSection').style.display = 'none';
            document.getElementById('resultSection').style.display = 'block';
            
            // Display candidate information
            document.getElementById('displayArmyNumber').textContent = this.candidateInfo.armyNumber || 'N/A';
            document.getElementById('displayName').textContent = this.candidateInfo.name || 'N/A';
            document.getElementById('displayRank').textContent = this.candidateInfo.rank || 'N/A';
            document.getElementById('displayUnit').textContent = this.candidateInfo.unit || 'N/A';
            
            // Display result details
            const score = this.examResult.score || 0;
            const totalMarks = this.examResult.totalMarks || this.examResult.totalQuestions || 0;
            const totalQuestions = this.examResult.totalQuestions || 0;
            const percentage = this.examResult.percentage || 0;
            const timeTaken = this.examResult.timeTaken || 'N/A';
            
            document.getElementById('scoreValue').textContent = `${score} / ${totalMarks} marks`;
            document.getElementById('percentageValue').textContent = `${percentage.toFixed(2)}%`;
            document.getElementById('totalQuestions').textContent = totalQuestions;
            document.getElementById('timeTaken').textContent = this.formatTime(timeTaken);
            
            // Update score circle
            this.updateScoreCircle(percentage);
            
            // Display pass/fail status
            this.displayStatus(percentage);
            
            // Display performance message
            this.displayPerformanceMessage(percentage, score, totalQuestions);
            
            console.log('✅ Result displayed successfully');
            
        } catch (error) {
            console.error('❌ Error displaying result:', error);
            this.showError('Error displaying result data.');
        }
    }
    
    updateScoreCircle(percentage) {
        const scoreCircle = document.getElementById('scoreCircle');
        const scoreText = document.getElementById('scoreText');
        
        // Calculate angle for the circular progress (360 degrees = 100%)
        const angle = (percentage / 100) * 360;
        
        // Update the conic gradient
        scoreCircle.style.setProperty('--score-angle', `${angle}deg`);
        
        // Update score text
        scoreText.textContent = `${percentage.toFixed(1)}%`;
        
        // Change color based on performance
        let color = '#e74c3c'; // Red for low scores
        if (percentage >= 75) {
            color = '#27ae60'; // Green for high scores
        } else if (percentage >= 50) {
            color = '#f39c12'; // Orange for medium scores
        }
        
        scoreCircle.style.background = `conic-gradient(${color} 0deg, ${color} ${angle}deg, rgba(255,255,255,0.2) ${angle}deg)`;
    }
    
    displayStatus(percentage) {
        const statusBadge = document.getElementById('statusBadge');
        
        // Calculate grade based on percentage
        let grade = 'F';
        let gradeClass = 'status-fail';
        
        if (percentage >= 80) {
            grade = 'D';  // 80+ = D (Excellent)
            gradeClass = 'status-excellent';
        } else if (percentage >= 70) {
            grade = 'A';  // 70-79 = A (Very Good)
            gradeClass = 'status-verygood';
        } else if (percentage >= 60) {
            grade = 'B';  // 60-69 = B (Good)
            gradeClass = 'status-good';
        } else if (percentage >= 50) {
            grade = 'C';  // 50-59 = C (Average)
            gradeClass = 'status-average';
        } else if (percentage >= 40) {
            grade = 'E';  // 40-49 = E (Pass)
            gradeClass = 'status-pass';
        } else {
            grade = 'F';  // <40 = F (Fail)
            gradeClass = 'status-fail';
        }
        
        statusBadge.textContent = `Grade: ${grade}`;
        statusBadge.className = `status-badge ${gradeClass}`;
    }
    
    displayPerformanceMessage(percentage, score, totalQuestions) {
        const messageElement = document.getElementById('performanceMessage');
        let message = '';
        
        if (percentage >= 80) {
            message = '🏆 Grade D - Excellent! Outstanding performance with exceptional knowledge and understanding.';
        } else if (percentage >= 70) {
            message = '🌟 Grade A - Very Good! Your performance shows strong grasp of the subject matter.';
        } else if (percentage >= 60) {
            message = '👍 Grade B - Good! You have shown solid understanding with room for improvement.';
        } else if (percentage >= 50) {
            message = '✅ Grade C - Average. You have passed. Consider reviewing areas where you can strengthen your knowledge.';
        } else if (percentage >= 40) {
            message = '📝 Grade E - Pass. You have met the minimum requirements. We encourage further study to improve your understanding.';
        } else {
            message = '📚 Grade F - Fail. You did not meet the passing criteria. We encourage you to study further and retake the examination.';
        }
        
        messageElement.textContent = message;
    }
    
    formatTime(timeInSeconds) {
        if (!timeInSeconds || timeInSeconds === 'N/A') {
            return 'N/A';
        }
        
        const hours = Math.floor(timeInSeconds / 3600);
        const minutes = Math.floor((timeInSeconds % 3600) / 60);
        const seconds = timeInSeconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    // Method to handle result data from submission response
    setResultFromSubmission(submissionResult) {
        if (submissionResult && submissionResult.result) {
            this.examResult = submissionResult.result;
            this.displayResult();
        }
    }
}

// Make ResultController available globally
window.ResultController = ResultController;