// js/auth/register.js - Registration page specific JavaScript

document.addEventListener('DOMContentLoaded', function() {
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm_password').value;
            const errorDiv = document.getElementById('error-message');
            const successDiv = document.getElementById('success-message');

            errorDiv.classList.remove('show');
            errorDiv.textContent = '';
            successDiv.classList.remove('show');

            if (password !== confirmPassword) {
                errorDiv.textContent = 'パスワードが一致しません';
                errorDiv.classList.add('show');
                return;
            }

            if (password.length < 6) {
                errorDiv.textContent = 'パスワードは6文字以上必要です';
                errorDiv.classList.add('show');
                return;
            }

            try {
                const formData = new URLSearchParams();
                formData.append('username', username);
                formData.append('password', password);

                const response = await window._apiDebugFetch('POST /auth/register', fetch('/auth/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: formData
                }));

                const data = await response.json();

                if (data.status === 'success') {
                    successDiv.classList.add('show');
                    setTimeout(function() {
                        window.location.href = '/bluesky/posts';
                    }, 1500);
                } else {
                    errorDiv.textContent = data.message || '登録に失敗しました';
                    errorDiv.classList.add('show');
                }
            } catch (error) {
                errorDiv.textContent = 'エラーが発生しました。もう一度お試しください。';
                errorDiv.classList.add('show');
            }
        });
    }

    // Auto-redirect handled server-side
});
