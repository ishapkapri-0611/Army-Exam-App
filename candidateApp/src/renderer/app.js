class CandidateApp {
    constructor() {
        console.log('CandidateApp constructor called');
        this.serverInfo = null;
        this.isConnected = false;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.discoverServers();
    }

    async discoverServers() {
        try {
            console.log('discoverServers called');
            this.updateServerStatus('searching', 'Searching for exam servers...');
            
            const result = await window.electronAPI.discoverServers();
            console.log('discoverServers result:', result);
            if (result.success && result.server) {
                this.serverInfo = result.server;
                this.isConnected = true;
                localStorage.setItem('serverInfo', JSON.stringify(result.server)); // Save to localStorage
                this.updateServerStatus('online', `Connected to: ${result.server.ip}:${result.server.port}`);
                this.enableLogin();
            } else {
                this.updateServerStatus('offline', 'No exam server found. Please try again.');
                this.disableLogin();
            }
        } catch (error) {
            this.updateServerStatus('error', `Error: ${error.message}`);
            this.disableLogin();
        }
    }

    async attemptLogin() {
        const armyNumber = document.getElementById('armyNumber').value.trim();
        
        if (!armyNumber) {
            this.showMessage('Please enter your Army Number', 'error');
            return;
        }

        if (!this.isConnected) {
            this.showMessage('Not connected to exam server', 'error');
            return;
        }

        try {
            this.showMessage('Authenticating...', 'info');
            this.disableLogin();

            console.log('Attempting to call candidateLogin IPC');
            const result = await window.electronAPI.candidateLogin({
                armyNumber: armyNumber,
                serverInfo: this.serverInfo
            });

            if (result.success) {
                this.showMessage(`Welcome ${result.candidate.name}!`, 'success');
                console.log('Exam data received:', result.examData);
                
                // Store data BEFORE navigating
                try {
                    localStorage.setItem('serverInfo', JSON.stringify(this.serverInfo));
                    localStorage.setItem('examData', JSON.stringify(result.examData));
                    localStorage.setItem('candidateInfo', JSON.stringify(result.candidate));
                    console.log('Data stored in localStorage');
                    
                    // Navigate only after data is stored
                    setTimeout(() => {
                        window.location.replace('exam-page.html');
                    }, 100);
                } catch (e) {
                    console.error('Storage error:', e);
                    this.showMessage('Error preparing exam data', 'error');
                    this.enableLogin();
                    return;
                }
            } else {
                this.showMessage(`Login failed: ${result.error}`, 'error');
                this.enableLogin();
            }
        } catch (error) {
            this.showMessage(`Login error: ${error.message}`, 'error');
            this.enableLogin();
        }
    }

    updateServerStatus(status, message) {
        const statusElement = document.getElementById('serverStatus');
        const networkElement = document.getElementById('networkStatus');
        
        const statusConfig = {
            searching: { class: 'searching', text: 'Searching...' },
            online: { class: 'online', text: 'Connected' },
            offline: { class: 'offline', text: 'Offline' },
            error: { class: 'offline', text: 'Error' }
        };

        const config = statusConfig[status] || statusConfig.offline;
        
        statusElement.innerHTML = 
            `<span class="status-indicator ${config.class}"></span> ${config.text}`;
        
        if (message) {
            networkElement.textContent = message;
        }
    }

    enableLogin() {
        console.log('enableLogin called');
        document.getElementById('loginBtn').disabled = false;
        document.getElementById('armyNumber').disabled = false;
    }

    disableLogin() {
        console.log('disableLogin called');
        document.getElementById('loginBtn').disabled = true;
        document.getElementById('armyNumber').disabled = true;
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

    setupEventListeners() {
        const armyNumberInput = document.getElementById('armyNumber');
        const loginBtn = document.getElementById('loginBtn');

        // Disable input initially
        armyNumberInput.disabled = true;

        // Enable login button when Army Number is entered
        armyNumberInput.addEventListener('input', (e) => {
            const hasValue = e.target.value.trim().length > 0;
            loginBtn.disabled = !hasValue || !this.isConnected;
        });

        // Enter key to login
        armyNumberInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.attemptLogin();
            }
        });
    }

    updateUI() {
        // Additional UI updates can be added here
    }
}

// Global functions
let candidateApp;

function attemptLogin() {
    candidateApp.attemptLogin();
}

function refreshServerSearch() {
    candidateApp.discoverServers();
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded event fired');
    candidateApp = new CandidateApp();
});