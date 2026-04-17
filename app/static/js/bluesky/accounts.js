// js/accounts.js

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// アカウント一覧をアップデートする関数
function updateAccountList(newAccountData) {
    window.accountsData = newAccountData || window.accountsData;
    
    // AppConfig.accountsData も同期する
    if (window.AppConfig) {
        window.AppConfig.accountsData = window.accountsData;
    }

    // アカウント選択ボックスを更新
    const $select = $('#account-select');
    const currentValue = $select.val();
    const hasAccounts = Object.keys(window.accountsData).length > 0;

    if (hasAccounts) {
        let options = '<option value="">アカウントを選択してください</option>';
        Object.keys(window.accountsData).forEach(username => {
            const acc = window.accountsData[username];
            const displayText = acc.display_name ? escapeHtml(acc.display_name) + ' (@' + escapeHtml(username) + ')' : '@' + escapeHtml(username);
            options += `<option value="${escapeHtml(username)}" data-did="${escapeHtml(acc.did)}" data-username="${escapeHtml(acc.username)}" data-handle="${escapeHtml(acc.handle || '')}" data-display-name="${escapeHtml(acc.display_name || '')}">${displayText}</option>`;
        });
        $select.html(options).val(currentValue);
    } else {
        $select.html('<option disabled>アカウントがありません</option>');
    }

    // アカウント管理テーブルを更新
    updateAccountTable();

    // フォーム状態を更新
    if (typeof checkAccountAndToggleForm === 'function') {
        checkAccountAndToggleForm();
    }
}

// アカウント管理テーブルを更新する関数
function updateAccountTable() {
    const $section = $('.accounts-table-section');
    const hasAccounts = Object.keys(window.accountsData).length > 0;
    
    if (hasAccounts) {
        let cards = '';
        Object.keys(window.accountsData).forEach(username => {
            const acc = window.accountsData[username];
            const displayName = acc.display_name ? escapeHtml(acc.display_name) : '';
            const didShort = escapeHtml(acc.did).substring(0, 30) + '...';
            cards += `
            <div class="account-card">
                <div class="account-card-header">
                    <div class="account-card-icon">
                        <i class="fas fa-user-circle"></i>
                    </div>
                    <div class="account-card-info">
                        <div class="account-card-name">${displayName}</div>
                        <div class="account-card-username">@${escapeHtml(username)}</div>
                    </div>
                </div>
                <div class="account-card-body">
                    <div class="account-card-did">
                        <small class="text-muted">DID</small>
                        <code>${didShort}</code>
                    </div>
                    <div class="account-card-stats">
                        <div class="account-card-stat">
                            <span class="stat-value">0</span>
                            <span class="stat-label">投稿</span>
                        </div>
                    </div>
                </div>
                <div class="account-card-footer">
                    <button class="btn btn-sm btn-outline" onclick="editSelectedAccount('${escapeHtml(username)}')">
                        <i class="fas fa-edit"></i> <span>編集</span>
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="syncAccount('${escapeHtml(acc.did)}', this)" title="Blueskyから表示名を更新">
                        <i class="fas fa-sync"></i> <span>更新</span>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="handleConfirmDeleteAccount('${escapeHtml(acc.did)}')">
                        <i class="fas fa-trash"></i> <span>削除</span>
                    </button>
                </div>
            </div>`;
        });
        
        $section.html(`
            <h4>登録アカウント一覧</h4>
            <div class="accounts-grid">${cards}</div>
        `);
    } else {
        $section.html(`
            <h4>登録アカウント一覧</h4>
            <div class="no-accounts">
                <i class="fas fa-user-slash"></i>
                <h3>登録されたアカウントがありません</h3>
                <p>新しいアカウントを追加してください</p>
                <button class="btn btn-primary" onclick="showAddAccountModal()">
                    <i class="fas fa-plus"></i>アカウントを追加
                </button>
            </div>
        `);
    }
}

function initializeAccountSelection() {
    const last = localStorage.getItem('lastSelectedAccount');
    if (last && $('#account-select option').filter(function() { return this.value === last; }).length) {
        $('#account-select').val(last).trigger('change');
    }
}

$(document).on('change', '#account-select', function() {
    localStorage.setItem('lastSelectedAccount', this.value);
});

function showAddAccountModal() { $('#add-account-modal').addClass('active'); $('body').css('overflow', 'hidden'); }
function closeAddAccountModal() { $('#add-account-modal').removeClass('active'); $('body').css('overflow', ''); $('#add-account-form')[0].reset(); }

async function handleConfirmDeleteAccount(did) {
    if (await showCustomConfirm(`アカウント "${did}" を削除しますか？`, 'アカウント削除')) {
        window.api.post(`/bluesky/remove_account/${did}`)
            .then(function(res) {
                if (res.status === 'success') {
                    showNotification(res.message, 'success');
                    if (res.accounts) {
                        updateAccountList(res.accounts);
                    } else {
                        window.api.get('/bluesky/get_accounts').then(function(data) {
                            if (data.status === 'success') {
                                updateAccountList(data.accounts);
                            } else {
                                updateAccountList();
                            }
                        }).fail(function() {
                            updateAccountList();
                        });
                    }
                } else {
                    showNotification(res.message, 'error');
                }
            })
            .fail(() => showNotification('アカウント削除に失敗しました', 'error'));
    }
}

function submitAddAccount(event) {
    event.preventDefault();

    const $form = $(event.target);
    if ($form.data('submitting')) return;
    $form.data('submitting', true);

    const identifier = $form.find('[name="identifier"]').val().trim();
    const password = $form.find('[name="password"]').val();

    if (!identifier || !password) {
        $form.data('submitting', false);
        return showNotification('すべてのフィールドを入力してください', 'error');
    }
    if (accountsData[identifier]) {
        $form.data('submitting', false);
        return showNotification('このアカウントは既に登録されています', 'error');
    }

    const $btn = $form.find('button[type="submit"]').prop('disabled', true);
    const originalBtnHtml = $btn.html();
    $btn.html('<i class="fas fa-spinner fa-spin"></i> 追加中...');

    window.api.postJSON('/bluesky/add_account', { identifier, password })
        .then(function(data) {
            showNotification(data.message || (data.status === 'success' ? 'アカウントが追加されました' : 'アカウントの追加に失敗しました'), data.status);
            if (data.status === 'success') {
                closeAddAccountModal();
                if (data.accounts) {
                    updateAccountList(data.accounts);
                } else {
                    window.api.get('/bluesky/get_accounts').then(function(res) {
                        if (res.status === 'success') {
                            updateAccountList(res.accounts);
                        } else {
                            updateAccountList();
                        }
                    }).fail(function() {
                        updateAccountList();
                    });
                }
            }
        })
        .fail(function(xhr) {
            showNotification(xhr.responseJSON?.message || 'アカウント追加中にエラーが発生しました', 'error');
        })
        .always(function() {
            $btn.prop('disabled', false).html(originalBtnHtml);
            $form.data('submitting', false);
        });
}

// アカウント追加後にフォーム状態を更新（モーダルを閉じた時）
$(document).on('click', '#add-account-modal .modal-close', function() {
    setTimeout(function() {
        if (typeof checkAccountAndToggleForm === 'function') {
            checkAccountAndToggleForm();
        }
    }, 300);
});

function showEditAccountModal() { $('#edit-account-modal').addClass('active'); $('body').css('overflow', 'hidden'); }
function closeEditAccountModal() { $('#edit-account-modal').removeClass('active'); $('body').css('overflow', ''); $('#edit-account-form')[0].reset(); }

function editSelectedAccount(usernameToEdit) {
    if (!usernameToEdit) {
        return showNotification('編集するアカウントが指定されていません', 'error');
    }
    
    const accountData = accountsData[usernameToEdit];
    
    // 編集フォームに現在の値を設定
    $('#edit-account-username-display').val(usernameToEdit);   // 表示用フィールド
    $('#edit-account-did').val(accountData.did);               // DID
    
    // モーダル表示
    $('#edit-account-modal').addClass('active');
    $('body').css('overflow', 'hidden');
}

function submitEditAccount(event) {
    event.preventDefault();

    const $form = $(event.target);
    const identifier = $form.find('[name="identifier"]').val().trim();
    const password = $form.find('[name="password"]').val();

    if (!identifier || !password) return showNotification('すべてのフィールドを入力してください', 'error');

    const $btn = $form.find('button[type="submit"]').prop('disabled', true);
    const original = $btn.html();
    $btn.html('<i class="fas fa-spinner fa-spin"></i> 更新中...');

    window.api.postJSON('/bluesky/edit_account', { identifier, password })
        .then(function(data) {
            showNotification(data.message || (data.status === 'success' ? 'アカウントが更新されました' : 'アカウントの更新に失敗しました'), data.status);
            if (data.status === 'success') {
                closeEditAccountModal();
                if (data.accounts) {
                    updateAccountList(data.accounts);
                } else {
                    window.api.get('/bluesky/get_accounts').then(function(res) {
                        if (res.status === 'success') {
                            updateAccountList(res.accounts);
                        } else {
                            updateAccountList();
                        }
                    }).fail(function() {
                        updateAccountList();
                    });
                }
            }
        })
        .fail(function(xhr) {
            showNotification(xhr.responseJSON?.message || 'アカウント更新中にエラーが発生しました', 'error');
        })
        .always(function() {
            $btn.prop('disabled', false).html(original);
        });
}

function syncAccount(did, btnElement) {
    const $btn = $(btnElement);
    const original = $btn.html();
    $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> 更新中...');

    window.api.post(`/bluesky/sync_account/${did}`)
        .then(function(data) {
            if (data.status === 'success') {
                showNotification(data.message, 'success');
                if (data.accounts) {
                    updateAccountList(data.accounts);
                } else {
                    window.api.get('/bluesky/get_accounts').then(function(res) {
                        if (res.status === 'success') {
                            updateAccountList(res.accounts);
                        }
                    });
                }
            } else {
                showNotification(data.message || '更新に失敗しました', 'error');
            }
        })
        .fail(function(xhr) {
            const msg = xhr.responseJSON?.detail || xhr.responseJSON?.message || '更新リクエストに失敗しました';
            showNotification(msg, 'error');
        })
        .always(function() {
            $btn.prop('disabled', false).html(original);
        });
}