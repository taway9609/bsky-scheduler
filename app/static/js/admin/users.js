// js/admin/users.js - Admin users management page specific JavaScript

let currentPage = 1;
let currentUserId = null;
let selectedUsers = [];

$(document).ready(function() {
    const token = getToken();
    if (!token) {
        window.location.href = '/auth/login?return_url=/admin/users';
        return;
    }
    loadUsers();
});

function adminApiRequest(url, method = 'GET', data = null) {
    const token = getToken();
    return new Promise(function(resolve, reject) {
        $.ajax({
            url: url,
            type: method,
            headers: {
                'Authorization': 'Bearer ' + token
            },
            contentType: method !== 'GET' ? 'application/json' : undefined,
            data: data ? (method === 'GET' ? data : JSON.stringify(data)) : undefined,
            success: function(res) { resolve(res); },
            error: function(xhr) {
                if (xhr.status === 401) {
                    window.location.href = '/auth/login?return_url=/admin/users';
                } else if (xhr.status === 403) {
                    showNotification('管理者権限が必要です', 'error');
                    reject(xhr);
                } else {
                    reject(xhr);
                }
            }
        });
    });
}

function loadUsers(page = 1) {
    currentPage = page;
    adminApiRequest(`/admin/users/list?page=${page}&per_page=20`).then(function(res) {
        if (res.status === 'success') {
            renderUsers(res.data.users);
            renderPagination(res.data);
            $('#total-users').text(res.data.total);
        }
    }).catch(function(xhr) {
        if (xhr.status !== 403) {
            showNotification('ユーザー一覧の読み込みに失敗しました', 'error');
        }
    });
}

function renderUsers(users) {
    const tbody = $('#users-tbody');
    selectedUsers = [];
    updateBulkDeleteButton();

    if (users.length === 0) {
        tbody.html('<tr><td colspan="9" class="text-center py-4">ユーザーが見つかりません</td></tr>');
        return;
    }

    tbody.html(users.map(function(user) {
        const initial = user.username.charAt(0).toUpperCase();
        const statusBadge = user.is_active
            ? '<span class="badge badge-active">有効</span>'
            : '<span class="badge badge-inactive">無効</span>';
        const adminBadge = user.is_admin
            ? '<span class="badge badge-admin">管理者</span>'
            : '';

        return `
            <tr data-user-id="${user.id}">
                <td>
                    <input type="checkbox" class="user-checkbox" value="${user.id}" onchange="toggleUserSelection(${user.id})">
                </td>
                <td>
                    <div class="user-avatar">${initial}</div>
                </td>
                <td>
                    <strong>${escapeHtml(user.username)}</strong>
                </td>
                <td>${statusBadge}</td>
                <td>${adminBadge}</td>
                <td>${user.bluesky_accounts_count}</td>
                <td>${user.posts_count}</td>
                <td>${formatDate(user.created_at)}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="showUserDetail(${user.id})" title="詳細">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-outline-warning" onclick="showPasswordReset(${user.id})" title="パスワードリセット">
                            <i class="fas fa-key"></i>
                        </button>
                        <button class="btn btn-outline-${user.is_active ? 'secondary' : 'success'}"
                                onclick="toggleUserActive(${user.id}, ${user.is_active})"
                                title="${user.is_active ? '無効化' : '有効化'}">
                            <i class="fas fa-${user.is_active ? 'ban' : 'check'}"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteUser(${user.id}, '${escapeHtml(user.username)}')" title="削除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join(''));
}

function toggleSelectAll() {
    const selectAll = document.getElementById('select-all');
    const checkboxes = document.querySelectorAll('.user-checkbox');

    checkboxes.forEach(function(checkbox) {
        checkbox.checked = selectAll.checked;
    });

    if (selectAll.checked) {
        selectedUsers = Array.from(checkboxes).map(function(cb) { return parseInt(cb.value); });
    } else {
        selectedUsers = [];
    }
    updateBulkDeleteButton();
}

function toggleUserSelection(userId) {
    const index = selectedUsers.indexOf(userId);
    if (index > -1) {
        selectedUsers.splice(index, 1);
    } else {
        selectedUsers.push(userId);
    }

    const checkboxes = document.querySelectorAll('.user-checkbox');
    const allChecked = checkboxes.length > 0 && Array.from(checkboxes).every(function(cb) { return cb.checked; });
    document.getElementById('select-all').checked = allChecked;
    updateMobileSelectButton();
    updateBulkDeleteButton();
}

function toggleMobileSelectAll() {
    const selectAll = document.getElementById('select-all');
    const isAllSelected = selectAll.checked;

    selectAll.checked = !isAllSelected;
    toggleSelectAll();

    updateMobileSelectButton();
}

function updateMobileSelectButton() {
    const selectAll = document.getElementById('select-all');
    const mobileBtn = document.getElementById('mobile-select-all-btn');
    const mobileText = document.getElementById('mobile-select-text');
    const checkboxes = document.querySelectorAll('.user-checkbox');
    const anyChecked = checkboxes.length > 0 && Array.from(checkboxes).some(function(cb) { return cb.checked; });

    if (anyChecked) {
        mobileText.textContent = 'すべて解除';
        mobileBtn.classList.remove('btn-primary');
        mobileBtn.classList.add('btn-outline-secondary');
    } else {
        mobileText.textContent = 'すべて選択';
        mobileBtn.classList.remove('btn-outline-secondary');
        mobileBtn.classList.add('btn-primary');
    }
}

function updateBulkDeleteButton() {
    const btn = document.getElementById('bulk-delete-btn');
    const count = document.getElementById('selected-count');
    if (selectedUsers.length > 0) {
        btn.style.display = 'inline-block';
        count.textContent = selectedUsers.length;
    } else {
        btn.style.display = 'none';
    }
}

function bulkDeleteUsers() {
    if (selectedUsers.length === 0) return;

    showConfirm('一括削除', `${selectedUsers.length}人のユーザーを削除しますか？この操作は取り消せません。`, function() {
        Promise.all(selectedUsers.map(function(userId) {
            return adminApiRequest(`/admin/users/${userId}`, 'DELETE');
        })).then(function(results) {
            showNotification(`${selectedUsers.length}人のユーザーを削除しました`, 'success');
            selectedUsers = [];
            loadUsers(currentPage);
        }).catch(function(xhr) {
            showNotification('削除に失敗しました', 'error');
        });
    });
}

function renderPagination(data) {
    const pagination = $('#pagination');
    if (data.total_pages <= 1) {
        pagination.html('');
        return;
    }

    let html = '';

    if (currentPage > 1) {
        html += `<li class="page-item"><a class="page-link" href="#" onclick="loadUsers(${currentPage - 1}); return false;">前へ</a></li>`;
    }

    for (let i = 1; i <= data.total_pages; i++) {
        if (i === 1 || i === data.total_pages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<li class="page-item ${i === currentPage ? 'active' : ''}"><a class="page-link" href="#" onclick="loadUsers(${i}); return false;">${i}</a></li>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
    }

    if (currentPage < data.total_pages) {
        html += `<li class="page-item"><a class="page-link" href="#" onclick="loadUsers(${currentPage + 1}); return false;">次へ</a></li>`;
    }

    pagination.html(html);
}

function showUserDetail(userId) {
    currentUserId = userId;
    const modal = new bootstrap.Modal(document.getElementById('userDetailModal'));
    document.getElementById('userDetailContent').innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">読み込み中...</span>
            </div>
        </div>
    `;
    modal.show();

    adminApiRequest(`/admin/users/${userId}`).then(function(res) {
        if (res.status === 'success') {
            const user = res.data;
            const statusText = user.is_active ? '有効' : '無効';
            const statusClass = user.is_active ? 'text-success' : 'text-danger';

            let accountsHtml = '<p class="text-muted">アカウントなし</p>';
            if (user.bluesky_accounts.length > 0) {
                accountsHtml = '<ul class="list-unstyled">' + user.bluesky_accounts.map(acc =>
                    `<li><i class="fab fa-blogger-b me-2"></i>${escapeHtml(acc.username)}</li>`
                ).join('') + '</ul>';
            }

            let postsHtml = '<p class="text-muted">投稿なし</p>';
            if (user.recent_posts.length > 0) {
                postsHtml = '<ul class="list-unstyled small">' + user.recent_posts.map(post =>
                    `<li class="mb-2">
                        <span class="badge bg-${getStatusBadgeClass(post.status)} me-1">${getStatusText(post.status)}</span>
                        ${escapeHtml(post.content)}
                    </li>`
                ).join('') + '</ul>';
            }

            document.getElementById('userDetailContent').innerHTML = `
                <div class="row">
                    <div class="col-md-6">
                        <h6>ユーザー情報</h6>
                        <table class="table table-sm">
                            <tr><td><strong>ID</strong></td><td>${user.id}</td></tr>
                            <tr><td><strong>ユーザー名</strong></td><td>${escapeHtml(user.username)}</td></tr>
                            <tr><td><strong>ステータス</strong></td><td class="${statusClass}">${statusText}</td></tr>
                            <tr><td><strong>権限</strong></td><td>${user.is_admin ? '<span class="badge badge-admin">管理者</span>' : '一般ユーザー'}</td></tr>
                            <tr><td><strong>登録日</strong></td><td>${formatDate(user.created_at)}</td></tr>
                        </table>
                    </div>
                    <div class="col-md-6">
                        <h6>Bluesky アカウント</h6>
                        ${accountsHtml}
                        <h6 class="mt-3">最近の投稿</h6>
                        ${postsHtml}
                    </div>
                </div>
            `;
        }
    }).catch(function() {
        document.getElementById('userDetailContent').innerHTML = `
            <div class="alert alert-danger">詳細の読み込みに失敗しました</div>
        `;
    });
}

function showPasswordReset(userId) {
    currentUserId = userId;
    document.getElementById('tempPasswordDisplay').style.display = 'none';
    document.getElementById('confirmResetPassword').disabled = false;
    document.getElementById('tempPassword').value = '';
    const modal = new bootstrap.Modal(document.getElementById('passwordResetModal'));
    modal.show();
}

function confirmPasswordReset() {
    if (!currentUserId) return;

    document.getElementById('confirmResetPassword').disabled = true;
    document.getElementById('confirmResetPassword').innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>処理中...';

    adminApiRequest(`/admin/users/${currentUserId}/reset-password`, 'POST').then(function(res) {
        if (res.status === 'success') {
            document.getElementById('tempPassword').value = res.temporary_password;
            document.getElementById('tempPasswordDisplay').style.display = 'block';
            document.getElementById('confirmResetPassword').style.display = 'none';
            showNotification('パスワードをリセットしました', 'success');
        }
    }).catch(function(xhr) {
        const msg = xhr.responseJSON?.detail || 'パスワードリセットに失敗しました';
        showNotification(msg, 'error');
        document.getElementById('confirmResetPassword').disabled = false;
        document.getElementById('confirmResetPassword').innerHTML = '<i class="fas fa-key me-2"></i>リセットする';
    });
}

function copyPassword() {
    const input = document.getElementById('tempPassword');
    input.select();
    document.execCommand('copy');
    showNotification('パスワードをコピーしました', 'success');
}

function toggleUserActive(userId, isActive) {
    const action = isActive ? '無効化' : '有効化';
    showConfirm('ユーザー状態変更', `このユーザーを${action}しますか？`, function() {
        adminApiRequest(`/admin/users/${userId}/toggle-active`, 'PATCH').then(function(res) {
            showNotification(res.message, 'success');
            loadUsers(currentPage);
        }).catch(function(xhr) {
            const msg = xhr.responseJSON?.detail || '操作に失敗しました';
            showNotification(msg, 'error');
        });
    });
}

function deleteUser(userId, username) {
    showConfirm('ユーザー削除', `ユーザー「${username}」を削除しますか？この操作は取り消せません。すべての関連データ（Blueskyアカウント、投稿）が削除されます。`, function() {
        adminApiRequest(`/admin/users/${userId}`, 'DELETE').then(function(res) {
            showNotification(res.message, 'success');
            loadUsers(currentPage);
        }).catch(function(xhr) {
            const msg = xhr.responseJSON?.detail || '削除に失敗しました';
            showNotification(msg, 'error');
        });
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getStatusBadgeClass(status) {
    const map = {
        'pending': 'warning',
        'posted': 'success',
        'failed': 'danger',
        'editing': 'info'
    };
    return map[status] || 'secondary';
}

function getStatusText(status) {
    const map = {
        'pending': '予約済み',
        'posted': '投稿済み',
        'failed': '失敗',
        'editing': '編集中'
    };
    return map[status] || status;
}
