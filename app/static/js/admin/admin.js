// js/admin/admin.js - Admin panel specific JavaScript

// Clear authentication data
function clearAuth() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token_expires_in');
    localStorage.removeItem('token_received_at');
    localStorage.removeItem('user');
    document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'user_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'is_admin=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
}

// Show notification message
function showNotification(message, type = 'info') {
    // Use the toast system if available
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        // Fallback: create a simple toast manually
        const container = document.getElementById('toast-container');
        if (!container) return;

        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('data-category', type);
        toast.setAttribute('data-message', message);

        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        ${type === 'success' ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>' :
                        type === 'error' || type === 'danger' ? '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>' :
                        type === 'warning' ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>' :
                        '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'}
                    </svg>
                </div>
                <div class="toast-text">${message}</div>
            </div>
            <button class="toast-close" aria-label="閉じる">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            <div class="toast-progress"></div>
        `;

        container.appendChild(toast);

        // Initialize toast
        const category = type;
        let color = 'var(--primary-color)';
        switch(category) {
            case 'success': color = 'var(--success-color)'; break;
            case 'error': case 'danger': color = 'var(--danger-color)'; break;
            case 'warning': color = 'var(--warning-color)'; break;
            case 'info': color = 'var(--primary-color)'; break;
        }
        toast.style.borderLeftColor = color;

        setTimeout(() => toast.classList.add('toast-enter'), 10);

        const autoDismiss = setTimeout(() => dismissToast(toast), 5000);

        toast.addEventListener('mouseenter', () => {
            clearTimeout(autoDismiss);
            toast.style.transform = 'scale(1.02)';
        });

        toast.addEventListener('mouseleave', () => {
            const remainingTime = 5000 - (Date.now() - toast.dataset.timestamp);
            if (remainingTime > 0) {
                setTimeout(() => dismissToast(toast), remainingTime);
            }
            toast.style.transform = 'scale(1)';
        });

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => dismissToast(toast));

        toast.dataset.timestamp = Date.now();

        const progress = toast.querySelector('.toast-progress');
        progress.style.transition = 'width 5s linear';
        progress.style.width = '100%';

        setTimeout(() => { progress.style.width = '0%'; }, 10);
    }
}

// Dismiss toast
function dismissToast(toast) {
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');
    setTimeout(() => { toast.remove(); }, 300);
}

// Global showToast function for external scripts
window.showToast = function(message, category = 'info') {
    showNotification(message, category);
};

// Show confirmation dialog
function showConfirm(title, message, onConfirm) {
    document.getElementById('confirmModalTitle').textContent = title;
    document.getElementById('confirmModalBody').textContent = message;
    const modal = new bootstrap.Modal(document.getElementById('confirmModal'));
    document.getElementById('confirmModalOk').onclick = function() {
        modal.hide();
        onConfirm();
    };
    modal.show();
}

// Logout function
async function logout() {
    try {
        await fetch('/auth/logout', { method: 'POST' });
    } catch (e) {}
    clearAuth();
    window.location.href = '/auth/login';
}

// Get cookie value
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

// Get token from cookie
function getTokenFromCookie() {
    return getCookie('access_token');
}

// Get token
function getToken() {
    return localStorage.getItem('access_token') || getCookie('access_token');
}

// Toggle admin dark mode
function toggleAdminDarkMode() {
    const body = document.body;
    const isDark = body.classList.toggle('dark-mode');
    localStorage.setItem('admin_dark_mode', isDark);
    updateThemeIcon();
}

// Update theme icon
function updateThemeIcon() {
    const isDark = document.body.classList.contains('dark-mode');
    const icon = document.querySelector('.theme-toggle-sidebar i');
    const text = document.querySelector('.theme-toggle-sidebar .theme-text');
    if (icon) {
        icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }
    if (text) {
        text.textContent = isDark ? 'ライトモード' : 'ダークモード';
    }
}

// Mobile navigation functions
function openAdminNav() {
    const adminSidebar = document.getElementById('adminSidebar');
    const adminNavOverlay = document.getElementById('adminNavOverlay');
    adminSidebar.classList.add('active');
    adminNavOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAdminNav() {
    const adminSidebar = document.getElementById('adminSidebar');
    const adminNavOverlay = document.getElementById('adminNavOverlay');
    adminSidebar.classList.remove('active');
    adminNavOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Initialize admin panel
$(document).ready(function() {
    // Seed token from server-rendered hidden input (httponly cookies can't be read by JS)
    const tokenInput = document.getElementById('admin-token');
    if (tokenInput) {
        const token = tokenInput.dataset.accessToken;
        if (token && !localStorage.getItem('access_token')) {
            localStorage.setItem('access_token', token);
            localStorage.setItem('token_expires_in', '86400');
            localStorage.setItem('token_received_at', Date.now().toString());
        }
    }

    const cookieUsername = getCookie('username');
    const localUser = JSON.parse(localStorage.getItem('user') || '{}');

    if (cookieUsername) {
        $('#admin-username').text(cookieUsername);
    } else if (localUser.username) {
        $('#admin-username').text(localUser.username);
    }

    const stored = localStorage.getItem('admin_dark_mode');
    if (stored === null || stored === 'true') {
        document.body.classList.add('dark-mode');
        updateThemeIcon();
    }

    // Mobile navigation setup
    const adminNavToggle = document.getElementById('adminNavToggle');
    const adminNavOverlay = document.getElementById('adminNavOverlay');
    const adminSidebar = document.getElementById('adminSidebar');

    if (adminNavToggle) {
        adminNavToggle.addEventListener('click', function() {
            if (adminSidebar.classList.contains('active')) {
                closeAdminNav();
            } else {
                openAdminNav();
            }
        });
    }

    if (adminNavOverlay) {
        adminNavOverlay.addEventListener('click', closeAdminNav);
    }

    // Close nav on link click
    document.querySelectorAll('.admin-sidebar .nav-link').forEach(function(link) {
        link.addEventListener('click', closeAdminNav);
    });
});
