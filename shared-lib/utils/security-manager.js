class SecurityManager {
    constructor() {
        this.tabSwitchCount = 0;
        this.maxTabSwitches = 3;
        this.screenshotAttempts = 0;
        this.isExamActive = false;
        this.init();
    }

    init() {
        this.disableContextMenu();
        this.disableCopyPaste();
        this.detectTabSwitching();
        this.blockScreenshots();
        this.blockDevTools();
    }

    disableContextMenu() {
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.logSecurityEvent('Right-click attempted');
        });
    }

    disableCopyPaste() {
        // Disable copy
        document.addEventListener('copy', (e) => {
            e.preventDefault();
            this.logSecurityEvent('Copy attempted');
        });

        // Disable paste
        document.addEventListener('paste', (e) => {
            e.preventDefault();
            this.logSecurityEvent('Paste attempted');
        });

        // Disable cut
        document.addEventListener('cut', (e) => {
            e.preventDefault();
            this.logSecurityEvent('Cut attempted');
        });
    }

    detectTabSwitching() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.isExamActive) {
                this.tabSwitchCount++;
                this.logSecurityEvent(`Tab switch detected (${this.tabSwitchCount}/${this.maxTabSwitches})`);

                if (this.tabSwitchCount >= this.maxTabSwitches) {
                    this.forceExamSubmit();
                } else {
                    this.showWarning(`Warning: Tab switch detected! ${this.maxTabSwitches - this.tabSwitchCount} attempts remaining.`);
                }
            }
        });
    }

    blockScreenshots() {
        // Block PrintScreen key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'PrintScreen') {
                e.preventDefault();
                this.screenshotAttempts++;
                this.logSecurityEvent('Screenshot attempt blocked');
                this.showWarning('Screenshot functionality is disabled during exam.');
            }

            // Block Windows + Shift + S (Windows snipping tool)
            if (e.key === 's' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                this.logSecurityEvent('Snipping tool shortcut blocked');
            }
        });
    }

    blockDevTools() {
        // Block F12, Ctrl+Shift+I, etc.
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F12' || 
                (e.ctrlKey && e.shiftKey && e.key === 'I') ||
                (e.ctrlKey && e.shiftKey && e.key === 'C') ||
                (e.ctrlKey && e.key === 'u')) {
                e.preventDefault();
                this.logSecurityEvent('DevTools access attempted');
            }
        });

        // Detect DevTools opening
        let devToolsOpen = false;
        setInterval(() => {
            const widthThreshold = window.outerWidth - window.innerWidth > 160;
            const heightThreshold = window.outerHeight - window.innerHeight > 160;
            
            if ((widthThreshold || heightThreshold) && !devToolsOpen) {
                devToolsOpen = true;
                this.logSecurityEvent('DevTools detected open');
                this.showWarning('Developer Tools are not allowed during exam.');
            }
        }, 1000);
    }

    startExamMonitoring() {
        this.isExamActive = true;
        this.tabSwitchCount = 0;
        this.logSecurityEvent('Exam monitoring started');
    }

    stopExamMonitoring() {
        this.isExamActive = false;
        this.logSecurityEvent('Exam monitoring stopped');
    }

    forceExamSubmit() {
        this.logSecurityEvent('FORCE SUBMIT: Maximum tab switches exceeded');
        this.showWarning('Exam will be submitted automatically due to multiple violations.');
        
        // Trigger exam submission
        if (window.submitExam) {
            setTimeout(() => {
                window.submitExam();
            }, 3000);
        }
    }

    logSecurityEvent(message) {
        const event = {
            type: 'security',
            message: message,
            timestamp: new Date().toISOString(),
            tabSwitches: this.tabSwitchCount,
            screenshotAttempts: this.screenshotAttempts
        };

        // Send to main process for logging
        if (window.electronAPI && window.electronAPI.logSecurityEvent) {
            window.electronAPI.logSecurityEvent(event);
        }

        console.log('🔒 Security Event:', event);
    }

    showWarning(message) {
        // Create warning overlay
        const warning = document.createElement('div');
        warning.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(231, 76, 60, 0.95);
            color: white;
            padding: 30px;
            border-radius: 15px;
            z-index: 10000;
            text-align: center;
            font-size: 1.2em;
            font-weight: bold;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            border: 3px solid white;
        `;
        warning.textContent = message;

        document.body.appendChild(warning);

        // Remove after 5 seconds
        setTimeout(() => {
            if (warning.parentNode) {
                warning.parentNode.removeChild(warning);
            }
        }, 5000);
    }

    getSecurityReport() {
        return {
            tabSwitchCount: this.tabSwitchCount,
            screenshotAttempts: this.screenshotAttempts,
            isExamActive: this.isExamActive,
            lastEvent: new Date().toISOString()
        };
    }
}

module.exports = SecurityManager;