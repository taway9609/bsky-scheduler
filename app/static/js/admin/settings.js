// js/admin/settings.js - Admin settings page specific JavaScript

let originalRegistrationEnabled = null;
let hasChanges = false;

$(document).ready(function() {
    const token = getToken();
    if (!token) {
        window.location.href = '/auth/login?return_url=/admin/settings';
        return;
    }

    loadSettings();
});

function loadSettings() {
    const token = getToken();
    $.ajax({
        url: '/admin/api/settings',
        type: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token
        },
        success: function(res) {
            if (res.status === 'success') {
                originalRegistrationEnabled = res.data.registration_enabled;
                $('#registration-enabled').prop('checked', res.data.registration_enabled);
                updateStatusText(res.data.registration_enabled);
                hasChanges = false;
                $('#save-btn').prop('disabled', true);
            }
        },
        error: function(xhr) {
            if (xhr.status === 401) {
                window.location.href = '/auth/login?return_url=/admin/settings';
            } else {
                showNotification('設定の読み込みに失敗しました', 'error');
            }
        }
    });
}

function toggleRegistration() {
    hasChanges = true;
    $('#save-btn').prop('disabled', false);
    updateStatusText($('#registration-enabled').prop('checked'));
}

function updateStatusText(enabled) {
    if (enabled) {
        $('#registration-status-text').html('<span class="text-success"><i class="fas fa-check-circle me-1"></i>有効 - 新規ユーザーの登録を許可</span>');
    } else {
        $('#registration-status-text').html('<span class="text-danger"><i class="fas fa-times-circle me-1"></i>無効 - 新規ユーザーの登録を停止</span>');
    }
}

function saveSettings() {
    const token = getToken();
    const registrationEnabled = $('#registration-enabled').prop('checked') ? 'true' : 'false';

    $('#save-btn').prop('disabled', true).html('<i class="fas fa-spinner fa-spin me-1"></i>保存中...');

    $.ajax({
        url: '/admin/api/settings',
        type: 'PUT',
        headers: {
            'Authorization': 'Bearer ' + token
        },
        data: {
            registration_enabled: registrationEnabled
        },
        success: function(res) {
            if (res.status === 'success') {
                showNotification('設定を保存しました', 'success');
                originalRegistrationEnabled = registrationEnabled;
                hasChanges = false;
                $('#save-btn').prop('disabled', true);
                $('#save-btn').html('<i class="fas fa-save me-1"></i>設定を保存');
            }
        },
        error: function(xhr) {
            if (xhr.status === 401) {
                window.location.href = '/auth/login?return_url=/admin/settings';
            } else {
                showNotification('設定の保存に失敗しました', 'error');
                $('#save-btn').prop('disabled', false);
                $('#save-btn').html('<i class="fas fa-save me-1"></i>設定を保存');
            }
        }
    });
}
