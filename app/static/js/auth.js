// js/auth.js - Authentication utilities

window.Auth = {
    getTokenFromCookie: function() {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; access_token=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    },
    
    getToken: function() {
        return localStorage.getItem('access_token') || this.getTokenFromCookie();
    },
    
    isLoggedIn: function() {
        const token = this.getToken();
        if (!token) return false;
        
        const expiresIn = parseInt(localStorage.getItem('token_expires_in') || '0');
        const receivedAt = parseInt(localStorage.getItem('token_received_at') || '0');
        
        const now = Date.now();
        const expiresAt = receivedAt + (expiresIn * 1000);
        
        return now < expiresAt;
    },
    
    getUser: function() {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                return JSON.parse(userStr);
            } catch (e) {
                return null;
            }
        }
        return null;
    },
    
    logout: async function() {
        localStorage.removeItem('access_token');
        localStorage.removeItem('token_expires_in');
        localStorage.removeItem('token_received_at');
        localStorage.removeItem('user');
        try {
            await fetch('/auth/logout', { method: 'POST' });
        } catch (e) {}
        window.location.href = '/auth/login';
    },
    
    requireAuth: function() {
        if (!this.isLoggedIn()) {
            window.location.href = '/auth/login';
            return false;
        }
        return true;
    },
    
    apiHeaders: function() {
        const token = this.getToken();
        if (token) {
            return {
                'Authorization': 'Bearer ' + token
            };
        }
        return {};
    }
};

// API wrapper with auth
window.API_DEBUG = window.IS_DEV || false;

window._apiDebugFetch = async function(label, fetchPromise) {
    const response = await fetchPromise;
    if (!window.API_DEBUG) return response;
    const startTime = performance.now();
    const elapsed = (performance.now() - startTime).toFixed(1);
    console.group(`%c[API fetch] ${label} ${response.ok ? '✓' : '✗'} ${response.status} (${elapsed}ms)`, `color: ${response.ok ? '#22c55e' : '#ef4444'}; font-weight: bold`);
    console.log('  URL:', response.url);
    console.log('  Status:', response.status, response.statusText);
    console.log('  Time:', elapsed + 'ms');
    try {
        const clone = response.clone();
        const data = await clone.json();
        console.log('  Body:', JSON.stringify(data).substring(0, 500));
    } catch (e) {}
    console.groupEnd();
    return response;
};

(function() {
    if (typeof $ === 'undefined') return;
    var _ajax = $.ajax;
    var _reloginShown = false;

    function _handle401(jqXHR) {
        if (jqXHR.status === 401 && !_reloginShown) {
            _reloginShown = true;
            if (typeof window.showReloginModal === 'function') {
                window.showReloginModal();
            } else {
                var $modal = $('#relogin-modal');
                if ($modal.length) {
                    $modal.css('display', 'flex');
                    $('#relogin-username').val(Auth.getUser()?.username || '').focus();
                }
            }
        }
    }

    $.ajax = function(urlOrSettings, settings) {
        var url, method, data, headers, contentType;
        if (typeof urlOrSettings === 'string') {
            url = urlOrSettings;
            method = (settings && (settings.type || settings.method)) || 'GET';
            data = settings ? settings.data : undefined;
            headers = settings ? settings.headers : undefined;
            contentType = settings ? settings.contentType : undefined;
        } else {
            var s = urlOrSettings || {};
            url = s.url || '';
            method = s.type || s.method || 'GET';
            data = s.data;
            headers = s.headers;
            contentType = s.contentType;
        }
        method = method.toUpperCase();

        var startTime = performance.now();
        var reqId = Math.random().toString(36).substring(2, 8);
        var bodyPreview = data ? (typeof data === 'string' ? data.substring(0, 300) : JSON.stringify(data).substring(0, 300)) : null;

        if (window.API_DEBUG) {
            console.group('%c[API ' + reqId + '] ' + method + ' ' + url, 'color: #3b82f6; font-weight: bold');
            console.log('%c→ Request', 'color: #3b82f6');
            console.log('  Method:', method);
            console.log('  URL:', url);
            if (headers) console.log('  Headers:', headers);
            if (contentType) console.log('  Content-Type:', contentType);
            if (bodyPreview) console.log('  Body:', bodyPreview);
        }

        var originalSettings;
        if (typeof urlOrSettings === 'string') {
            originalSettings = $.extend({}, settings, {
                success: function(data, textStatus, jqXHR) {
                    var elapsed = (performance.now() - startTime).toFixed(1);
                    if (window.API_DEBUG) {
                        console.log('%c← Response', 'color: #22c55e');
                        console.log('  Status:', jqXHR.status, textStatus);
                        console.log('  Time:', elapsed + 'ms');
                        console.log('  Data:', typeof data === 'object' ? JSON.stringify(data).substring(0, 500) : String(data).substring(0, 500));
                        console.groupEnd();
                    }
                    if (settings && settings.success) settings.success.apply(this, arguments);
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    var elapsed = (performance.now() - startTime).toFixed(1);
                    if (window.API_DEBUG) {
                        console.log('%c← Error', 'color: #ef4444');
                        console.log('  Status:', jqXHR.status);
                        console.log('  Text:', textStatus);
                        console.log('  Error:', errorThrown);
                        try {
                            var errBody = jqXHR.responseJSON || jqXHR.responseText;
                            console.log('  Response:', typeof errBody === 'object' ? JSON.stringify(errBody).substring(0, 500) : String(errBody).substring(0, 500));
                        } catch (e) {}
                        console.groupEnd();
                    }
                    _handle401(jqXHR);
                    if (settings && settings.error) settings.error.apply(this, arguments);
                },
                complete: function(jqXHR, textStatus) {
                    if (settings && settings.complete) settings.complete.apply(this, arguments);
                }
            });
        } else {
            originalSettings = $.extend({}, urlOrSettings, {
                success: function(data, textStatus, jqXHR) {
                    var elapsed = (performance.now() - startTime).toFixed(1);
                    if (window.API_DEBUG) {
                        console.log('%c← Response', 'color: #22c55e');
                        console.log('  Status:', jqXHR.status, textStatus);
                        console.log('  Time:', elapsed + 'ms');
                        console.log('  Data:', typeof data === 'object' ? JSON.stringify(data).substring(0, 500) : String(data).substring(0, 500));
                        console.groupEnd();
                    }
                    if (urlOrSettings && urlOrSettings.success) urlOrSettings.success.apply(this, arguments);
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    var elapsed = (performance.now() - startTime).toFixed(1);
                    if (window.API_DEBUG) {
                        console.log('%c← Error', 'color: #ef4444');
                        console.log('  Status:', jqXHR.status);
                        console.log('  Text:', textStatus);
                        console.log('  Error:', errorThrown);
                        try {
                            var errBody = jqXHR.responseJSON || jqXHR.responseText;
                            console.log('  Response:', typeof errBody === 'object' ? JSON.stringify(errBody).substring(0, 500) : String(errBody).substring(0, 500));
                        } catch (e) {}
                        console.groupEnd();
                    }
                    _handle401(jqXHR);
                    if (urlOrSettings && urlOrSettings.error) urlOrSettings.error.apply(this, arguments);
                },
                complete: function(jqXHR, textStatus) {
                    if (urlOrSettings && urlOrSettings.complete) urlOrSettings.complete.apply(this, arguments);
                }
            });
        }

        return _ajax.call(this, originalSettings);
    };
})();

window.api = {
    _request: function(method, url, options = {}) {
        const startTime = performance.now();
        const reqId = Math.random().toString(36).substring(2, 8);
        const hasBody = options.data !== undefined;
        const bodyPreview = hasBody ? (typeof options.data === 'string' ? options.data.substring(0, 200) : JSON.stringify(options.data).substring(0, 200)) : null;

        if (window.API_DEBUG) {
            console.group(`%c[API ${reqId}] ${method} ${url}`, 'color: #3b82f6; font-weight: bold');
            console.log('%c→ Request', 'color: #3b82f6');
            console.log('  Method:', method);
            console.log('  URL:', url);
            console.log('  Headers:', options.headers || {});
            if (bodyPreview) console.log('  Body:', bodyPreview);
            console.groupEnd();
        }

        return $.ajax({
            url: url,
            type: method,
            ...options
        }).done(function(data, textStatus, jqXHR) {
            const elapsed = (performance.now() - startTime).toFixed(1);
            if (window.API_DEBUG) {
                console.group(`%c[API ${reqId}] ${method} ${url} ✓ ${jqXHR.status} (${elapsed}ms)`, 'color: #22c55e; font-weight: bold');
                console.log('%c← Response', 'color: #22c55e');
                console.log('  Status:', jqXHR.status, textStatus);
                console.log('  Time:', elapsed + 'ms');
                console.log('  Data:', data);
                console.groupEnd();
            }
        }).fail(function(jqXHR, textStatus, errorThrown) {
            const elapsed = (performance.now() - startTime).toFixed(1);
            if (window.API_DEBUG) {
                console.group(`%c[API ${reqId}] ${method} ${url} ✗ ${jqXHR.status} (${elapsed}ms)`, 'color: #ef4444; font-weight: bold');
                console.log('%c← Error', 'color: #ef4444');
                console.log('  Status:', jqXHR.status);
                console.log('  Text:', textStatus);
                console.log('  Error:', errorThrown);
                try {
                    const errBody = jqXHR.responseJSON || jqXHR.responseText;
                    console.log('  Response:', errBody);
                } catch (e) {}
                console.groupEnd();
            }
        });
    },

    get: function(url, options = {}) {
        return this._request('GET', url, { headers: window.Auth.apiHeaders(), ...options });
    },

    post: function(url, data, options = {}) {
        return this._request('POST', url, { headers: window.Auth.apiHeaders(), data, ...options });
    },

    postJSON: function(url, data, options = {}) {
        return this._request('POST', url, {
            headers: { 'Content-Type': 'application/json', ...window.Auth.apiHeaders() },
            data: JSON.stringify(data),
            ...options
        });
    },

    put: function(url, data, options = {}) {
        return this._request('PUT', url, { headers: window.Auth.apiHeaders(), data, ...options });
    },

    delete: function(url, options = {}) {
        return this._request('DELETE', url, { headers: window.Auth.apiHeaders(), ...options });
    }
};

// Re-login Modal
window.showReloginModal = function() {
    var $modal = $('#relogin-modal');
    if (!$modal.length) return;
    $modal.css('display', 'flex');
    var user = Auth.getUser();
    $('#relogin-username').val(user?.username || '').focus();
    $('#relogin-password').val('');
    $('#relogin-error').hide();
};

window.hideReloginModal = function() {
    $('#relogin-modal').css('display', 'none');
};

$(document).ready(function() {
    var $modal = $('#relogin-modal');
    if (!$modal.length) return;

    $('#relogin-submit').on('click', async function() {
        var $btn = $(this);
        var username = $('#relogin-username').val().trim();
        var password = $('#relogin-password').val();
        var $error = $('#relogin-error');

        if (!username || !password) {
            $error.text('ユーザー名とパスワードを入力してください').show();
            return;
        }

        $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> 処理中...');
        $error.hide();

        try {
            var formData = new URLSearchParams();
            formData.append('identifier', username);
            formData.append('password', password);
            formData.append('remember_me', 'false');

            var response = await window._apiDebugFetch('POST /auth/login/redirect', fetch('/auth/login/redirect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData,
                redirect: 'follow'
            }));

            if (response.ok) {
                window.hideReloginModal();
                window._reloginShown = false;
                window.location.reload();
            } else {
                var data = await response.json().catch(() => ({}));
                $error.text(data.detail || data.message || 'ログインに失敗しました').show();
            }
        } catch (e) {
            $error.text('ログインリクエストに失敗しました').show();
        } finally {
            $btn.prop('disabled', false).html('<i class="fas fa-sign-in-alt"></i> ログイン');
        }
    });

    // Enter key submits form
    $('#relogin-password').on('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            $('#relogin-submit').click();
        }
    });
});

// Login page initialization
function initLoginPage() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const identifier = document.getElementById('identifier').value;
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('remember_me').checked;
            const errorDiv = document.getElementById('error-message');

            errorDiv.classList.remove('show');
            errorDiv.textContent = '';

            const urlParams = new URLSearchParams(window.location.search);
            const returnUrl = urlParams.get('return_url') || '';

            const formData = new URLSearchParams();
            formData.append('identifier', identifier);
            formData.append('password', password);
            formData.append('remember_me', rememberMe.toString());
            if (returnUrl) formData.append('return_url', returnUrl);

            const response = await window._apiDebugFetch('POST /auth/login/redirect', fetch('/auth/login/redirect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData
            }));

            const data = await response.json();

            if (response.ok && data.status === 'success') {
                const targetUrl = returnUrl || '/bluesky/scheduler';
                window.location.href = targetUrl;
            } else {
                errorDiv.textContent = data.message || 'ログインに失敗しました';
                errorDiv.classList.add('show');
            }
        });
    }

    // Handle URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const returnUrl = urlParams.get('return_url');
    const errorParam = urlParams.get('error');

    if (errorParam === 'login_failed') {
        const errorDiv = document.getElementById('error-message');
        if (errorDiv) {
            errorDiv.textContent = 'ユーザー名またはパスワードが正しくありません';
            errorDiv.classList.add('show');
        }
    }

    // Auto-redirect handled server-side; no client-side redirect needed
}

// Run immediately if DOM ready, otherwise wait
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoginPage);
} else {
    initLoginPage();
}
