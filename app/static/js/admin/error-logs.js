// js/admin/error-logs.js - Admin error logs page specific JavaScript

let currentPage = 1;
let currentFilter = 'all';

function setFilter(filter) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(function(btn) {
        btn.classList.remove('active');
    });
    document.querySelector(`.filter-btn[data-filter="${filter}"]`).classList.add('active');
    loadErrorLogs(1);
}

$(document).ready(function() {
    loadErrorLogs();
});

function loadErrorLogs(page = 1) {
    currentPage = page;

    let url = `/admin/error-logs/list?page=${page}&per_page=20`;
    if (currentFilter === 'unresolved') {
        url += '&resolved=false';
    } else if (currentFilter === 'resolved') {
        url += '&resolved=true';
    }

    const token = getToken();
    if (!token) {
        window.location.href = '/auth/login?return_url=/admin/error-logs';
        return;
    }

    $.ajax({
        url: url,
        type: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token
        },
        success: function(res) {
            if (res.status === 'success') {
                renderErrorLogs(res.data.logs);
                renderPagination(res.data);
                $('#total-logs').text(res.data.total);
            }
        },
        error: function(xhr) {
            if (xhr.status === 401) {
                window.location.href = '/auth/login?return_url=/admin/error-logs';
            } else {
                showNotification('エラーログの読み込みに失敗しました', 'error');
            }
        }
    });
}

function renderErrorLogs(logs) {
    const tbody = $('#error-logs-tbody');

    if (logs.length === 0) {
        tbody.html('<tr><td colspan="7" class="text-center py-4">エラーログが見つかりません</td></tr>');
        return;
    }

    tbody.html(logs.map(function(log) {
        const statusBadge = log.resolved
            ? '<span class="badge bg-success">解決済み</span>'
            : '<span class="badge bg-danger">未解決</span>';

        const errorTypeBadge = '<span class="badge bg-warning text-dark">' + escapeHtml(log.error_type || 'error') + '</span>';

        const userId = log.user_id || '-';
        const postId = log.post_id ? '<small class="text-muted">' + log.post_id.substring(0, 8) + '...</small>' : '-';

        return `
            <tr>
                <td>${log.id}</td>
                <td>${errorTypeBadge}</td>
                <td>
                    <div class="text-truncate" style="max-width: 300px;" title="${escapeHtml(log.message)}">
                        ${escapeHtml(log.message)}
                    </div>
                </td>
                <td>${userId}</td>
                <td>${formatDate(log.created_at)}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="showLogDetail(${log.id})" title="詳細">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${log.resolved
                            ? `<button class="btn btn-outline-secondary" onclick="unresolveLog(${log.id})" title="未解決に戻す">
                                <i class="fas fa-undo"></i>
                               </button>`
                            : `<button class="btn btn-outline-success" onclick="resolveLog(${log.id})" title="解決済み">
                                <i class="fas fa-check"></i>
                               </button>`
                        }
                        <button class="btn btn-outline-danger" onclick="deleteLog(${log.id})" title="削除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join(''));
}

function renderPagination(data) {
    const pagination = $('#pagination');
    if (data.total_pages <= 1) {
        pagination.html('');
        return;
    }

    let html = '';

    if (currentPage > 1) {
        html += `<li class="page-item"><a class="page-link" href="#" onclick="loadErrorLogs(${currentPage - 1}); return false;">前へ</a></li>`;
    }

    for (let i = 1; i <= data.total_pages; i++) {
        if (i === 1 || i === data.total_pages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            html += `<li class="page-item ${i === currentPage ? 'active' : ''}"><a class="page-link" href="#" onclick="loadErrorLogs(${i}); return false;">${i}</a></li>`;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            html += '<li class="page-item disabled"><span class="page-link">...</span></li>';
        }
    }

    if (currentPage < data.total_pages) {
        html += `<li class="page-item"><a class="page-link" href="#" onclick="loadErrorLogs(${currentPage + 1}); return false;">次へ</a></li>`;
    }

    pagination.html(html);
}

function showLogDetail(logId) {
    const token = getToken();
    const logs = [];

    $.ajax({
        url: `/admin/error-logs/list?page=1&per_page=100`,
        type: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token
        },
        success: function(res) {
            const log = res.data.logs.find(l => l.id === logId);
            if (log) {
                const modal = new bootstrap.Modal(document.getElementById('logDetailModal'));
                document.getElementById('logDetailContent').innerHTML = `
                    <table class="table table-sm">
                        <tr><td><strong>ID</strong></td><td>${log.id}</td></tr>
                        <tr><td><strong>種類</strong></td><td>${escapeHtml(log.error_type || '-')}</td></tr>
                        <tr><td><strong>メッセージ</strong></td><td style="white-space: pre-wrap;">${escapeHtml(log.message)}</td></tr>
                        <tr><td><strong>詳細</strong></td><td style="white-space: pre-wrap;">${escapeHtml(log.details || '-')}</td></tr>
                        <tr><td><strong>ユーザーID</strong></td><td>${log.user_id || '-'}</td></tr>
                        <tr><td><strong>投稿ID</strong></td><td>${log.post_id || '-'}</td></tr>
                        <tr><td><strong>アカウントDID</strong></td><td>${log.account_did || '-'}</td></tr>
                        <tr><td><strong>日時</strong></td><td>${formatDate(log.created_at)}</td></tr>
                        <tr><td><strong>状態</strong></td><td>${log.resolved ? '解決済み' : '未解決'}</td></tr>
                    </table>
                `;
                modal.show();
            }
        }
    });
}

function resolveLog(logId) {
    const token = getToken();
    $.ajax({
        url: `/admin/error-logs/${logId}/resolve`,
        type: 'PATCH',
        headers: {
            'Authorization': 'Bearer ' + token
        },
        success: function() {
            showNotification('エラーを解決済みにしました', 'success');
            loadErrorLogs(currentPage);
        },
        error: function() {
            showNotification('操作に失敗しました', 'error');
        }
    });
}

function unresolveLog(logId) {
    const token = getToken();
    $.ajax({
        url: `/admin/error-logs/${logId}/unresolve`,
        type: 'PATCH',
        headers: {
            'Authorization': 'Bearer ' + token
        },
        success: function() {
            showNotification('エラーを未解決に戻しました', 'success');
            loadErrorLogs(currentPage);
        },
        error: function() {
            showNotification('操作に失敗しました', 'error');
        }
    });
}

function deleteLog(logId) {
    showConfirm('削除確認', 'このエラーログを削除しますか？', function() {
        const token = getToken();
        $.ajax({
            url: `/admin/error-logs/${logId}`,
            type: 'DELETE',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            success: function() {
                showNotification('エラーログを削除しました', 'success');
                loadErrorLogs(currentPage);
            },
            error: function() {
                showNotification('削除に失敗しました', 'error');
            }
        });
    });
}

function deleteResolvedLogs() {
    showConfirm('削除確認', 'すべての解決済みエラーログを削除しますか？', function() {
        const token = getToken();
        $.ajax({
            url: `/admin/error-logs/delete-resolved`,
            type: 'POST',
            headers: {
                'Authorization': 'Bearer ' + token
            },
            success: function(res) {
                showNotification(res.message, 'success');
                loadErrorLogs(currentPage);
            },
            error: function() {
                showNotification('削除に失敗しました', 'error');
            }
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
    if (isNaN(date.getTime())) return '-';

    const pad = (n) => String(n).padStart(2, '0');
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tzAbbr = getTimeZoneAbbr(timeZone);

    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds} ${tzAbbr}`;
}

function getTimeZoneAbbr(timeZone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timeZone,
        timeZoneName: 'short'
    });
    const parts = formatter.formatToParts(new Date());
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    return tzPart ? tzPart.value : timeZone;
}
