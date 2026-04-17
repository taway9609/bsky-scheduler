// js/admin/dashboard.js - Admin dashboard specific JavaScript

$(document).ready(function() {
    var accessToken = $('#dashboard-data').data('access-token');
    if (!localStorage.getItem('access_token') && accessToken) {
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('token_expires_in', '86400');
        localStorage.setItem('token_received_at', Date.now().toString());
    }

    $.ajax({
        url: '/admin/stats',
        type: 'GET',
        success: function(res) {
            if (res.status === 'success') {
                var data = res.data;
                $('#stat-users').text(data.users.total);
                $('#stat-active-users').text(data.users.active);
                $('#stat-accounts').text(data.bluesky_accounts.total);
                $('#stat-posts').text(data.posts.total);
                $('#stat-pending').text(data.posts.pending);
                $('#stat-posted').text(data.posts.posted);
                $('#stat-failed').text(data.posts.failed);
                $('#stat-error-total').text(data.error_logs.total);
                $('#stat-error-unresolved').text(data.error_logs.unresolved);
                var resolved = data.error_logs.total - data.error_logs.unresolved;
                $('#stat-error-resolved').text(resolved);
            }
        },
        error: function(xhr) {
            if (xhr.status === 401) {
                window.location.href = '/auth/login?return_url=/admin';
            } else {
                showNotification('統計データの読み込みに失敗しました', 'error');
            }
        }
    });
});
