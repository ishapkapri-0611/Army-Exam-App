/**
 * Shared toast notification utility for renderer processes.
 * Provides a consistent notification UI across both candidateApp and invigilatorApp.
 */

const TOAST_COLORS = {
    info: '#3498db',
    success: '#27ae60',
    error: '#e74c3c',
    warning: '#f39c12'
};

const TOAST_GRADIENTS = {
    info: 'linear-gradient(135deg, #3498db, #2980b9)',
    success: 'linear-gradient(135deg, #27ae60, #2ecc71)',
    error: 'linear-gradient(135deg, #e74c3c, #c0392b)',
    warning: 'linear-gradient(135deg, #f39c12, #e67e22)'
};

/**
 * Show a toast notification message that auto-dismisses.
 * @param {string} message - The message to display
 * @param {string} [type='info'] - One of 'info', 'success', 'error', 'warning'
 * @param {object} [options]
 * @param {number} [options.duration=4000] - Time in ms before auto-dismiss
 * @param {boolean} [options.useGradient=false] - Use gradient background
 * @returns {HTMLElement} The toast element (can be removed early if needed)
 */
function showToast(message, type = 'info', options = {}) {
    const { duration = 4000, useGradient = false } = options;

    const toast = document.createElement('div');
    const bg = useGradient
        ? (TOAST_GRADIENTS[type] || TOAST_GRADIENTS.info)
        : (TOAST_COLORS[type] || TOAST_COLORS.info);

    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bg};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 400px;
        animation: slideIn 0.3s ease;
    `;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, duration);

    return toast;
}

// Export for both CommonJS (Node/Electron) and browser (window) environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { showToast, TOAST_COLORS, TOAST_GRADIENTS };
}
if (typeof window !== 'undefined') {
    window.ToastNotification = { showToast, TOAST_COLORS, TOAST_GRADIENTS };
}
