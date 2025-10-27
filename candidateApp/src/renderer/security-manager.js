class SecurityManager {
    constructor() {
        this.proctoringInterval = null;
        this.securityReport = {
            warnings: [],
            startTime: null,
            endTime: null,
            focusLossCount: 0,
            suspiciousActivities: []
        };
        this.isMonitoring = false;
        
        console.log('SecurityManager initialized successfully');
    }

    startExamMonitoring() {
        try {
            if (this.isMonitoring) {
                console.log('Security monitoring already active');
                return;
            }
            
            this.securityReport.startTime = new Date().toISOString();
            this.isMonitoring = true;
            
            // Set up monitoring interval
            this.proctoringInterval = setInterval(() => {
                this.checkForSuspiciousActivity();
            }, 5000); // Check every 5 seconds
            
            // Set up event listeners for security monitoring
            this.setupSecurityEventListeners();
            
            console.log('Security monitoring started successfully');
        } catch (error) {
            console.error('Error starting security monitoring:', error);
        }
    }

    stopExamMonitoring() {
        try {
            if (!this.isMonitoring) {
                console.log('Security monitoring not active');
                return;
            }
            
            this.securityReport.endTime = new Date().toISOString();
            this.isMonitoring = false;
            
            if (this.proctoringInterval) {
                clearInterval(this.proctoringInterval);
                this.proctoringInterval = null;
            }
            
            // Remove event listeners
            this.removeSecurityEventListeners();
            
            console.log('Security monitoring stopped successfully');
        } catch (error) {
            console.error('Error stopping security monitoring:', error);
        }
    }

    setupSecurityEventListeners() {
        try {
            // Monitor window focus changes
            window.addEventListener('blur', this.handleWindowBlur.bind(this));
            window.addEventListener('focus', this.handleWindowFocus.bind(this));
            
            // Monitor visibility changes
            document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
            
            // Monitor key combinations
            document.addEventListener('keydown', this.handleKeyDown.bind(this));
            
            // Monitor right-click attempts
            document.addEventListener('contextmenu', this.handleContextMenu.bind(this));
            
        } catch (error) {
            console.error('Error setting up security event listeners:', error);
        }
    }

    removeSecurityEventListeners() {
        try {
            window.removeEventListener('blur', this.handleWindowBlur.bind(this));
            window.removeEventListener('focus', this.handleWindowFocus.bind(this));
            document.removeEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
            document.removeEventListener('keydown', this.handleKeyDown.bind(this));
            document.removeEventListener('contextmenu', this.handleContextMenu.bind(this));
        } catch (error) {
            console.error('Error removing security event listeners:', error);
        }
    }

    handleWindowBlur() {
        this.logSecurityEvent('WINDOW_FOCUS_LOST', 'Candidate switched away from exam window');
        this.securityReport.focusLossCount++;
    }

    handleWindowFocus() {
        this.logSecurityEvent('WINDOW_FOCUS_GAINED', 'Candidate returned to exam window');
    }

    handleVisibilityChange() {
        if (document.hidden) {
            this.logSecurityEvent('TAB_HIDDEN', 'Exam tab became hidden');
        } else {
            this.logSecurityEvent('TAB_VISIBLE', 'Exam tab became visible');
        }
    }

    handleKeyDown(event) {
        // Monitor for suspicious key combinations
        const suspiciousKeys = [
            'F12', 'F11', 'F5', // Dev tools, fullscreen, refresh
            'Alt+Tab', 'Ctrl+Shift+I', 'Ctrl+U' // Alt-tab, dev tools, view source
        ];
        
        const keyCombo = this.getKeyCombo(event);
        if (suspiciousKeys.some(key => keyCombo.includes(key))) {
            this.logSecurityEvent('SUSPICIOUS_KEYPRESS', `Attempted: ${keyCombo}`);
            event.preventDefault();
        }
    }

    handleContextMenu(event) {
        this.logSecurityEvent('RIGHT_CLICK_ATTEMPT', 'Candidate attempted right-click');
        event.preventDefault();
    }

    getKeyCombo(event) {
        let combo = [];
        if (event.ctrlKey) combo.push('Ctrl');
        if (event.altKey) combo.push('Alt');
        if (event.shiftKey) combo.push('Shift');
        combo.push(event.key);
        return combo.join('+');
    }

    checkForSuspiciousActivity() {
        try {
            // Check if window is in focus
            if (!document.hasFocus()) {
                this.logSecurityEvent('FOCUS_CHECK', 'Window not in focus during monitoring');
            }
            
            // Check if page is visible
            if (document.hidden) {
                this.logSecurityEvent('VISIBILITY_CHECK', 'Page hidden during monitoring');
            }
            
        } catch (error) {
            console.error('Error during suspicious activity check:', error);
        }
    }

    logSecurityEvent(type, details) {
        try {
            const event = {
                type: type,
                details: details,
                timestamp: new Date().toISOString(),
                url: window.location.href
            };
            
            this.securityReport.warnings.push(event);
            this.securityReport.suspiciousActivities.push(event);
            
            console.log('Security event logged:', event);
            
            // Send to main process if available
            if (window.electronAPI && window.electronAPI.logSecurityEvent) {
                window.electronAPI.logSecurityEvent({
                    type: type,
                    details: details,
                    severity: 'MEDIUM'
                });
            }
        } catch (error) {
            console.error('Error logging security event:', error);
        }
    }

    getSecurityReport() {
        try {
            return {
                ...this.securityReport,
                totalWarnings: this.securityReport.warnings.length,
                monitoringDuration: this.calculateMonitoringDuration(),
                isMonitoring: this.isMonitoring
            };
        } catch (error) {
            console.error('Error getting security report:', error);
            return {
                warnings: [],
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
                totalWarnings: 0,
                monitoringDuration: 0,
                isMonitoring: false
            };
        }
    }

    calculateMonitoringDuration() {
        try {
            if (!this.securityReport.startTime) return 0;
            
            const start = new Date(this.securityReport.startTime);
            const end = this.securityReport.endTime ? new Date(this.securityReport.endTime) : new Date();
            
            return Math.floor((end - start) / 1000); // Duration in seconds
        } catch (error) {
            console.error('Error calculating monitoring duration:', error);
            return 0;
        }
    }
}

// Ensure SecurityManager is available globally
if (typeof window !== 'undefined') {
    window.SecurityManager = SecurityManager;
}

console.log('SecurityManager class loaded successfully');