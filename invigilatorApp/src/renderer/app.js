class ProductionInvigilatorUI {
    constructor() {
        this.isServerRunning = false;
        this.uploadedUsers = [];
        this.uploadedQuestions = [];
        this.examResults = [];
        this.init();
    }
    
    async init() {
        console.log('🚀 Initializing ProductionInvigilatorUI...');
        
        // Test electronAPI availability
        if (!window.electronAPI) {
            console.error('❌ electronAPI is not available!');
            this.showNotification('Error: Application not properly initialized', 'error');
            return;
        }
        
        console.log('✅ electronAPI is available');
        
        this.updateCurrentTime();
        this.setupEventListeners();
        await this.checkServerStatus();
        await this.loadUploadedData();
        
        setInterval(() => this.updateCurrentTime(), 1000);
        
        this.log('✅ UI initialized successfully');
        this.createExportButton();
        this.createResultsTable();
        await this.fetchAndDisplaySubmissions();
    }

    createResultsTable() {
        const tableContainer = document.createElement('div');
        tableContainer.innerHTML = `
            <h2>Exam Results</h2>
            <table>
                <thead>
                    <tr>
                        <th>Army Number</th>
                        <th>Name</th>
                        <th>Rank</th>
                        <th>Marks Obtained</th>
                        <th>Total Marks</th>
                        <th>Percentage</th>
                    </tr>
                </thead>
                <tbody id="resultsTableBody"></tbody>
            </table>
        `;
        document.body.appendChild(tableContainer);
    }

    // Export buttons are now in the HTML, no need to create them here

    async exportResultsWord() {
        try {
            this.log('📊 Exporting results to Word...', 'info');
            const result = await window.electronAPI.exportResultsWord(this.examResults);
            if (result.success) {
                this.log('✅ Results exported to Word successfully', 'success');
                this.showNotification('Results exported to Word successfully', 'success');
            } else {
                this.log(`❌ Failed to export results to Word: ${result.error}`, 'error');
                this.showNotification(`Export to Word failed: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('💥 Export to Word error:', error);
            this.log(`💥 Error exporting results to Word: ${error.message}`, 'error');
            this.showNotification(`Export to Word error: ${error.message}`, 'error');
        }
    }

    async startExam() {
        try {
            this.log('🚀 Starting exam...', 'info');
            const result = await window.electronAPI.startExam();
            if (result.success) {
                this.log('✅ Exam started successfully', 'success');
                this.showNotification('Exam started successfully', 'success');
            } else {
                this.log(`❌ Failed to start exam: ${result.error}`, 'error');
                this.showNotification(`Failed to start exam: ${result.error}`, 'error');
            }
        } catch (error) {
            console.error('💥 Start exam error:', error);
            this.log(`💥 Error starting exam: ${error.message}`, 'error');
            this.showNotification(`Start exam error: ${error.message}`, 'error');
        }
    }

    async exportResults() {
        try {
            this.log('📊 Exporting results as Word document...', 'info');
            
            // Check if we have results to export
            if (!this.examResults || this.examResults.length === 0) {
                // Try to calculate results first
                await this.calculateExamResults();
                
                if (!this.examResults || this.examResults.length === 0) {
                    throw new Error('No exam results available to export. Please calculate results first.');
                }
            }
            
            // Export the results as a Word document
            await this.exportResultsWord();

        } catch (error) {
            console.error('💥 Export error:', error);
            this.log(`💥 Error exporting results: ${error.message}`, 'error');
            this.showNotification(`Export error: ${error.message}`, 'error');
        }
    }

    async calculateExamResults() {
        try {
            this.log('🔄 Calculating exam results...', 'info');
            const results = await window.electronAPI.calculateResults();
            if (results.success) {
                this.examResults = results.results;
                this.log(`✅ Exam results calculated for ${this.examResults.length} candidates`, 'success');
                this.showNotification('Exam results calculated successfully', 'success');
                this.displayResultsInTable();
            } else {
                this.log(`❌ Failed to calculate results: ${results.error}`, 'error');
                this.showNotification(`Calculation failed: ${results.error}`, 'error');
            }
        } catch (error) {
            console.error('💥 Calculation error:', error);
            this.log(`💥 Error calculating results: ${error.message}`, 'error');
            this.showNotification(`Calculation error: ${error.message}`, 'error');
        }
    }

    displayResultsInTable() {
        const tableBody = document.getElementById('resultsTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = '';
        this.examResults.forEach(result => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${result.armyNumber}</td>
                <td>${result.name}</td>
                <td>${result.rank}</td>
                <td>${result.totalScore}</td>
                <td>${result.percentage.toFixed(2)}%</td>
            `;
            tableBody.appendChild(row);
        });
    }

    async loadUploadedData() {
        try {
            console.log('🔄 Loading previously uploaded data...');
            const data = await window.electronAPI.getUploadedData();
            this.uploadedUsers = data.users || [];
            this.uploadedQuestions = data.questions || [];
            
            console.log('📊 Loaded data:', {
                users: this.uploadedUsers.length,
                questions: this.uploadedQuestions.length
            });
            
            if (this.uploadedUsers.length > 0) {
                this.updateUploadStatus('users', `✅ ${this.uploadedUsers.length} users loaded`);
            }
            if (this.uploadedQuestions.length > 0) {
                const totalMarks = this.uploadedQuestions.reduce((sum, q) => sum + q.marks, 0);
                this.updateUploadStatus('questions', `✅ ${this.uploadedQuestions.length} questions (${totalMarks} marks)`);
            }
        } catch (error) {
            console.error('Error loading uploaded data:', error);
            this.log(`❌ Error loading previous data: ${error.message}`, 'error');
        }
    }

    // Fixed Upload Methods with better error handling
    async uploadUsersFile() {
        try {
            this.log('📁 Starting users file upload...', 'info');
            
            const usersBtn = document.getElementById('usersBtn');
            if (!usersBtn) {
                throw new Error('Upload button not found in DOM');
            }

            const originalText = usersBtn.innerHTML;
            usersBtn.innerHTML = '⏳ Opening file dialog...';
            usersBtn.disabled = true;

            console.log('🔄 Calling electronAPI.uploadUsersFile...');
            const result = await window.electronAPI.uploadUsersFile();
            console.log('📄 Upload result:', result);
            
            if (result.success) {
                this.uploadedUsers = result.users;
                this.updateUploadStatus('users', `✅ ${result.fileName} (${result.usersCount} users)`);
                this.log(`✅ Users file uploaded successfully: ${result.usersCount} users loaded`, 'success');
                this.showNotification(`Users file loaded: ${result.usersCount} candidates`, 'success');
                
                // Update exam summary
                this.updateExamSummary();
            } else {
                if (result.cancelled) {
                    this.log('📁 File selection cancelled by user', 'info');
                    this.showNotification('File selection cancelled', 'info');
                } else {
                    this.log(`❌ Failed to upload users file: ${result.error}`, 'error');
                    this.showNotification(`Upload failed: ${result.error}`, 'error');
                    this.updateUploadStatus('users', `❌ Upload failed: ${result.error}`);
                }
            }

            usersBtn.innerHTML = originalText;
            usersBtn.disabled = false;
            
        } catch (error) {
            console.error('💥 Upload error:', error);
            this.log(`💥 Error uploading users file: ${error.message}`, 'error');
            this.showNotification(`Upload error: ${error.message}`, 'error');
            
            // Reset button state
            const usersBtn = document.getElementById('usersBtn');
            if (usersBtn) {
                usersBtn.innerHTML = '📋 Upload Users Document';
                usersBtn.disabled = false;
            }
        }
    }

    async uploadQuestionsFile() {
        try {
            this.log('📝 Starting questions file upload...', 'info');
            
            const questionsBtn = document.getElementById('questionsBtn');
            if (!questionsBtn) {
                throw new Error('Upload button not found in DOM');
            }

            try {
                const originalText = questionsBtn.innerHTML;
                questionsBtn.innerHTML = '⏳ Opening file dialog...';
                questionsBtn.disabled = true;

                console.log('🔄 Calling electronAPI.uploadQuestionsFile...');
                const result = await window.electronAPI.uploadQuestionsFile();
                console.log('📄 Upload result:', result);
                
                if (result.success) {
                    this.uploadedQuestions = result.questions;
                    this.updateUploadStatus('questions', `✅ ${result.fileName} (${result.questionsCount} questions, ${result.totalMarks} marks)`);
                    this.log(`✅ Questions file uploaded: ${result.questionsCount} questions, ${result.totalMarks} total marks`, 'success');
                    this.showNotification(`Questions loaded: ${result.questionsCount} questions`, 'success');
                    
                    // Show validation warnings if any
                    if (result.validation && result.validation.warnings.length > 0) {
                        this.log(`⚠️ Validation warnings: ${result.validation.warnings.join(', ')}`, 'warn');
                        this.showNotification(`Upload completed with warnings: ${result.validation.warnings.length} issues found`, 'warning');
                    }
                    
                    // Update exam summary
                    this.updateExamSummary();
                } else {
                    if (result.cancelled) {
                        this.log('📁 File selection cancelled by user', 'info');
                        this.showNotification('File selection cancelled', 'info');
                    } else {
                        this.log(`❌ Failed to upload questions file: ${result.error}`, 'error');
                        this.showNotification(`Upload failed: ${result.error}`, 'error');
                        this.updateUploadStatus('questions', `❌ Upload failed: ${result.error}`);
                    }
                }
            } catch (error) {
                console.error('💥 Error in uploadQuestionsFile:', error);
                this.log(`💥 Error uploading questions file: ${error.message}`, 'error');
                this.showNotification(`Upload error: ${error.message}`, 'error');
                this.updateUploadStatus('questions', `❌ Upload error: ${error.message}`);
            } finally {
                // Reset button state safely
                const questionsBtn = document.getElementById('questionsBtn');
                if (questionsBtn) {
                    questionsBtn.innerHTML = '❓ Upload Questions Document';
                    questionsBtn.disabled = false;
                }
            }
            
        } catch (error) {
            console.error('💥 Upload error:', error);
            this.log(`💥 Error uploading questions file: ${error.message}`, 'error');
            this.showNotification(`Upload error: ${error.message}`, 'error');
            
            // Reset button state
            const questionsBtn = document.getElementById('questionsBtn');
            if (questionsBtn) {
                questionsBtn.innerHTML = '❓ Upload Questions Document';
                questionsBtn.disabled = false;
            }
        }
    }

    updateUploadStatus(type, message) {
        const statusElement = document.getElementById(`${type}Status`);
        if (statusElement) {
            if (message.includes('✅')) {
                statusElement.className = 'upload-status status-success';
            } else if (message.includes('❌')) {
                statusElement.className = 'upload-status status-error';
            } else if (message.includes('⚠️')) {
                statusElement.className = 'upload-status status-warning';
            } else {
                statusElement.className = 'upload-status status-pending';
            }
            statusElement.innerHTML = message;
        }
    }

    updateExamSummary() {
        const hasUsers = this.uploadedUsers.length > 0;
        const hasQuestions = this.uploadedQuestions.length > 0;
        
        if (hasUsers && hasQuestions) {
            const totalMarks = this.uploadedQuestions.reduce((sum, q) => sum + q.marks, 0);
            this.log(`📊 Exam ready: ${this.uploadedUsers.length} candidates, ${this.uploadedQuestions.length} questions, ${totalMarks} total marks`, 'success');
            this.showNotification('Exam configuration complete! Ready to start server.', 'success');
        }
    }

    showNotification(message, type = 'info') {
        window.ToastNotification.showToast(message, type, { duration: 5000, useGradient: true });
    }

    log(message, level = 'info') {
        const logContainer = document.getElementById('logContainer');
        if (!logContainer) {
            console.log(message);
            return;
        }

        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        
        const timestamp = new Date().toLocaleTimeString();
        const levelIcon = level === 'error' ? '❌' : 
                         level === 'warn' ? '⚠️' : 
                         level === 'success' ? '✅' : 'ℹ️';
        
        logEntry.innerHTML = `
            <span class="log-time">${timestamp}</span>
            <span>${levelIcon} ${message}</span>
        `;
        
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
        
        // Keep only last 100 log entries
        if (logContainer.children.length > 100) {
            logContainer.removeChild(logContainer.firstChild);
        }
        
        // Also log to console for debugging
        console.log(`[${timestamp}] ${message}`);
    }

    async fetchAndDisplaySubmissions() {
        try {
            const response = await fetch('http://localhost:3000/api/submissions');
            const data = await response.json();
            console.log('Fetched submissions:', data); // Debug log
            if (data.success && Array.isArray(data.submissions)) {
                if (data.submissions.length === 0) {
                    this.showNotification('No submissions found.', 'info');
                }
                this.displaySubmissionsInTable(data.submissions);
            } else {
                this.showNotification('Failed to fetch submissions', 'error');
                console.error('API response:', data);
            }
        } catch (error) {
            this.showNotification('Error fetching submissions: ' + error.message, 'error');
            console.error('Fetch error:', error);
        }
    }

    displaySubmissionsInTable(submissions) {
        const tableBody = document.getElementById('resultsTableBody');
        if (!tableBody) {
            console.error('resultsTableBody not found in DOM');
            return;
        }
        tableBody.innerHTML = '';
        if (!submissions || submissions.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="6">No submissions available</td>';
            tableBody.appendChild(row);
            return;
        }
        submissions.forEach(sub => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${sub.candidateId || sub.armyNumber || ''}</td>
                <td>${sub.name || '-'}</td>
                <td>${sub.rank || '-'}</td>
                <td>${sub.score || 0}</td>
                <td>${sub.totalMarks || sub.totalQuestions || 0}</td>
                <td>${sub.percentage !== undefined ? sub.percentage + '%' : '-'}</td>
            `;
            tableBody.appendChild(row);
        });
    }
}

// Global functions for HTML buttons - FIXED
function uploadUsersFile() {
    console.log('📁 uploadUsersFile called from HTML');
    if (window.ui && window.ui.uploadUsersFile) {
        window.ui.uploadUsersFile();
    } else {
        console.error('❌ UI not properly initialized');
        alert('Application not ready. Please wait for initialization.');
    }
}

function uploadQuestionsFile() {
    console.log('📝 uploadQuestionsFile called from HTML');
    if (window.ui && window.ui.uploadQuestionsFile) {
        window.ui.uploadQuestionsFile();
    } else {
        console.error('❌ UI not properly initialized');
        alert('Application not ready. Please wait for initialization.');
    }
}

function calculateResults() {
    if (window.ui) {
        window.ui.calculateExamResults();
    } else {
        console.error('UI not initialized');
    }
}

// Initialize with error handling
let ui;
document.addEventListener('DOMContentLoaded', () => {
    console.log('🏁 DOM loaded, initializing UI...');
    try {
        ui = new ProductionInvigilatorUI();
        window.ui = ui;
        console.log('✅ UI initialization complete');
    } catch (error) {
        console.error('💥 Failed to initialize UI:', error);
        alert('Failed to initialize application: ' + error.message);
    }
});