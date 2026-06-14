// Global state
let serverInfo = null;
let isSearchingForServer = false;

// DOM elements
let serverStatusElement;
let networkStatusElement;
let loginBtn;
let armyNumberInput;
let errorElement;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Candidate app renderer initialized');
    
    // Get DOM elements
    serverStatusElement = document.getElementById('serverStatus');
    networkStatusElement = document.getElementById('networkStatus');
    loginBtn = document.getElementById('loginBtn');
    armyNumberInput = document.getElementById('army-number');
    errorElement = document.getElementById('error-message');
    
    // Initialize UI
    updateNetworkStatus('Connected');
    
    // Start server discovery automatically
    refreshServerSearch();
    
    // Retry server discovery every 30 seconds if no server found
    setInterval(() => {
        if (!serverInfo && !isSearchingForServer) {
            console.log('Retrying server discovery...');
            refreshServerSearch();
        }
    }, 30000);
    
    // Set up input validation
    setupInputValidation();
    
    // Set up event listeners
    setupEventListeners();
});

function setupInputValidation() {
    if (armyNumberInput) {
        armyNumberInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            
            // Enable/disable login button based on input
            // Support both old format (JC543031A) and new format (145699Z)
            const oldPattern = /^[A-Z]{2}\d{6}[A-Z]?$/;
            const newPattern = /^\d+[A-Z]$/;
            const isValid = oldPattern.test(e.target.value) || newPattern.test(e.target.value);
            
            if (loginBtn) {
                loginBtn.disabled = !isValid || !serverInfo;
            }
        });
        
        // Focus on army number input
        armyNumberInput.focus();
    }
}

function setupEventListeners() {
    // Listen for exam events from main process
    if (window.electronAPI) {
        window.electronAPI.onExamStart((examData) => {
            console.log('Exam started:', examData);
            // Navigate to exam page
            window.location.href = 'exam-page.html';
        });
        
        window.electronAPI.onExamData((examData) => {
            console.log('Exam data received:', examData);
        });
        
        window.electronAPI.onServerDisconnected((data) => {
            console.log('Server disconnected:', data);
            updateServerStatus('offline', 'Server Disconnected');
            serverInfo = null;
            if (loginBtn) loginBtn.disabled = true;
        });
    }
}

async function refreshServerSearch() {
    if (isSearchingForServer) {
        console.log('Server search already in progress');
        return;
    }
    
    isSearchingForServer = true;
    updateServerStatus('searching', 'Searching...');
    
    try {
        console.log('Starting server discovery...');
        
        // Try multiple discovery attempts with different timeouts
        let result = null;
        const attempts = [5000, 10000, 15000]; // 5s, 10s, 15s timeouts
        
        for (let i = 0; i < attempts.length && !result?.success; i++) {
            console.log(`Discovery attempt ${i + 1} with ${attempts[i]}ms timeout`);
            updateServerStatus('searching', `Searching... (${i + 1}/${attempts.length})`);
            
            try {
                result = await window.electronAPI.discoverServers();
                if (result.success && result.server) {
                    break;
                }
            } catch (attemptError) {
                console.log(`Attempt ${i + 1} failed:`, attemptError.message);
            }
            
            // Wait a bit between attempts
            if (i < attempts.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        if (result?.success && result.server) {
            serverInfo = result.server;
            console.log('Server found:', serverInfo);
            updateServerStatus('online', `Found: ${serverInfo.ip}:${serverInfo.port}`);
            
            // Test server connection
            try {
                const healthResponse = await fetch(`http://${serverInfo.ip}:${serverInfo.port}/api/health`);
                if (healthResponse.ok) {
                    const healthData = await healthResponse.json();
                    console.log('Server health check passed:', healthData);
                    updateServerStatus('online', `Connected: ${serverInfo.ip}:${serverInfo.port}`);
                } else {
                    console.warn('Server health check failed');
                    updateServerStatus('online', `Found: ${serverInfo.ip}:${serverInfo.port} (No Response)`);
                }
            } catch (healthError) {
                console.warn('Health check failed:', healthError.message);
                updateServerStatus('online', `Found: ${serverInfo.ip}:${serverInfo.port} (Limited)`);
            }
            
            // Enable login button if army number is valid
            if (armyNumberInput) {
                const oldPattern = /^[A-Z]{2}\d{6}[A-Z]?$/;
                const newPattern = /^\d+[A-Z]$/;
                const isValid = oldPattern.test(armyNumberInput.value) || newPattern.test(armyNumberInput.value);
                if (isValid && loginBtn) {
                    loginBtn.disabled = false;
                }
            }
        } else {
            console.log('No server found after all attempts');
            updateServerStatus('offline', 'No Server Found');
            serverInfo = null;
            if (loginBtn) loginBtn.disabled = true;
        }
    } catch (error) {
        console.error('Server discovery error:', error);
        updateServerStatus('offline', 'Discovery Failed');
        serverInfo = null;
        if (loginBtn) loginBtn.disabled = true;
    } finally {
        isSearchingForServer = false;
    }
}

async function handleLogin() {
    if (!armyNumberInput || !errorElement) {
        console.error('Required DOM elements not found');
        return;
    }
    
    const armyNumber = armyNumberInput.value.trim();
    
    // Clear previous errors
    errorElement.textContent = '';
    
    // Validate army number format (support both old and new formats)
    const oldPattern = /^[A-Z]{2}\d{6}[A-Z]?$/;
    const newPattern = /^\d+[A-Z]$/;
    const isValid = oldPattern.test(armyNumber) || newPattern.test(armyNumber);
    
    if (!isValid) {
        errorElement.textContent = 'Invalid Army Number format (Example: JC123456A or 145699Z)';
        return;
    }
    
    // Check if server is available
    if (!serverInfo) {
        errorElement.textContent = 'No exam server found. Please click "Find Server" first.';
        return;
    }
    
    // Disable login button during login attempt
    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';
    }
    
    try {
        console.log('Attempting login with:', armyNumber);
        
        const loginData = {
            armyNumber: armyNumber,
            serverInfo: serverInfo
        };
        
        const result = await window.electronAPI.candidateLogin(loginData);
        
        if (result.success && result.role === 'candidate') {
            console.log('Login successful:', result.candidate.name);
            
            // Store candidate info in localStorage for persistence
            localStorage.setItem('candidateInfo', JSON.stringify(result.candidate));
            localStorage.setItem('serverInfo', JSON.stringify(serverInfo));
            
            // Store exam data if available
            if (result.examData) {
                localStorage.setItem('examQuestions', JSON.stringify(result.examData.questions));
                localStorage.setItem('examDuration', result.examData.duration);
                if (result.examData.startTime) {
                    localStorage.setItem('examStartTime', result.examData.startTime);
                }
            }
            
            // Store globally as well
            window.candidateInfo = result.candidate;
            window.examData = result.examData;
            window.serverInfo = serverInfo;
            
            // Navigate to exam page
            window.location.href = 'exam-page.html';
        } else {
            console.log('Login failed:', result.error);
            errorElement.textContent = result.error || 'Login failed. Please check your Army Number.';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorElement.textContent = 'Login failed due to network error. Please try again.';
    } finally {
        // Re-enable login button
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
        }
    }
}

function updateServerStatus(status, message) {
    if (!serverStatusElement) return;
    
    const indicator = serverStatusElement.querySelector('.status-indicator');
    const text = serverStatusElement.querySelector('span:last-child') || serverStatusElement;
    
    if (indicator) {
        indicator.className = `status-indicator ${status}`;
    }
    
    // Update text content
    const textNode = Array.from(serverStatusElement.childNodes)
        .find(node => node.nodeType === Node.TEXT_NODE);
    
    if (textNode) {
        textNode.textContent = message;
    } else {
        // Fallback: update the entire element
        serverStatusElement.innerHTML = `<span class="status-indicator ${status}"></span>${message}`;
    }
}

function updateNetworkStatus(status) {
    if (networkStatusElement) {
        networkStatusElement.textContent = status;
    }
}

// Make functions available globally for onclick handlers
window.handleLogin = handleLogin;
window.refreshServerSearch = refreshServerSearch;