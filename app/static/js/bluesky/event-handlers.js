/**
 * jQueryイベントハンドラ
 * onclick属性をjQueryのイベントハンドラに変換
 */

// ダークモード切り替え関数
function toggleDarkMode() {
    const body = document.body;
    const isDarkMode = body.classList.contains('dark-mode');
    
    if (isDarkMode) {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        localStorage.setItem('theme', 'light');
    } else {
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
    }
    
    // アイコンの切り替え
    const themeIcon = document.querySelector('.theme-toggle i');
    if (themeIcon) {
        if (isDarkMode) {
            themeIcon.className = 'fas fa-sun';
            themeIcon.closest('.theme-toggle').setAttribute('title', 'ライトモード切り替え');
        } else {
            themeIcon.className = 'fas fa-moon';
            themeIcon.closest('.theme-toggle').setAttribute('title', 'ダークモード切り替え');
        }
    }
}

// ALTテキストフォームの送信
function submitAltText(event) {
    event.preventDefault();
    
    const imageId = document.getElementById('alt-text-image-id').value;
    const altText = document.getElementById('alt-text-input').value;
    
    if (imageId && altText) {
        // ここにALTテキストの保存処理を実装
        console.log(`画像 ${imageId} のALTテキストを保存: ${altText}`);
        
        // モーダルを閉じる
        closeAltTextModal();
    }
    
    // アカウント追加フォームの送信
    function submitAddAccount(event) {
        event.preventDefault();
        console.log('アカウント追加フォームが送信されました');
        // ここにアカウント追加の実装を追加
    }
    
    // アカウント編集フォームの送信
    function submitEditAccount(event) {
        event.preventDefault();
        console.log('アカウント編集フォームが送信されました');
        // ここにアカウント編集の実装を追加
    }
}

// ALTテキストモーダルを開く関数
function showAltTextModal(imageIndex) {
    const modal = document.getElementById('alt-text-modal');
    if (modal) {
        modal.style.display = 'block';
        // 画像インデックスを保存
        modal.setAttribute('data-image-index', imageIndex);
    }
}

// ALTテキストモーダルを閉じる関数
function closeAltTextModal() {
    const modal = document.getElementById('alt-text-modal');
    if (modal) {
        modal.style.display = 'none';
        // 画像インデックスをクリア
        modal.removeAttribute('data-image-index');
    }
}

// テーマの初期化
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const body = document.body;
    
    if (savedTheme === 'light') {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        
        // アイコンの更新
        const themeIcon = document.querySelector('.theme-toggle i');
        if (themeIcon) {
            themeIcon.className = 'fas fa-sun';
            themeIcon.closest('.theme-toggle').setAttribute('title', 'ライトモード切り替え');
        }
    } else {
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
        
        // アイコンの更新
        const themeIcon = document.querySelector('.theme-toggle i');
        if (themeIcon) {
            themeIcon.className = 'fas fa-moon';
            themeIcon.closest('.theme-toggle').setAttribute('title', 'ダークモード切り替え');
        }
    }
}

// jQueryが読み込まれるのを待つ
if (typeof jQuery === 'undefined') {
    // jQueryがまだ読み込まれていない場合、DOMContentLoadedイベントで実行
    document.addEventListener('DOMContentLoaded', function() {
        // jQueryが読み込まれるのを待つ
        const waitForJQuery = function() {
            if (typeof jQuery !== 'undefined') {
                initializeEventHandlers();
            } else {
                setTimeout(waitForJQuery, 100);
            }
        };
        waitForJQuery();
    });
} else {
    // jQueryが既に読み込まれている場合
    $(document).ready(function() {
        initializeEventHandlers();
    });
}

function initializeEventHandlers() {
    // テーマの初期化
    initializeTheme();
    
    // ヘッダーセクションのイベントハンドラ
    
    // テーマ切り替えボタン
    $('#theme-toggle-btn').on('click', function() {
        toggleDarkMode();
    });
    
    // ログアウトボタン
    $('#logout-btn').on('click', function() {
        logout();
    });
    
    // ナビゲーションセクションのイベントハンドラ
    
    // ナビゲーションボタン
    $('.nav-btn').on('click', function() {
        const sectionName = $(this).data('section');
        switchSection(sectionName);
    });
    
    // 投稿一覧セクションのイベントハンドラ
    
    // 新規投稿ボタン
    $('#new-post-btn').on('click', function() {
        switchSection('create');
    });
    
    // アカウント追加ボタン（投稿作成ページ）
    $('#switch-to-account-btn').on('click', function() {
        switchSection('account');
    });
    
    // 設定セクションのイベントハンドラ
    
    // プリセット時間をデフォルトに戻す
    $('#reset-preset-times-btn').on('click', function() {
        resetPresetTimesToDefault();
    });
    
    // 投稿作成セクションのイベントハンドラ
    
// 日付調整ボタン
$('.preset-day-btn').off('click').on('click', function() {
  const dayOffset = parseInt($(this).data('day-offset'));
  setScheduleDay(dayOffset);
});
    
    // フォームリセットボタン
    $('#reset-form-btn').on('click', function() {
        resetForm();
    });
    
    // ALTテキストモーダル閉じるボタン
    $('#close-alt-text-modal-btn').on('click', function() {
        closeAltTextModal();
    });
    
    // ALTテキストモーダルキャンセルボタン
    $('#cancel-alt-text-btn').on('click', function() {
        closeAltTextModal();
    });
    
    // ALTテキストフォームの送信
    $('#alt-text-form').on('submit', function(event) {
        submitAltText(event);
    });
    
    // アカウント追加フォームの送信
    $('#add-account-form').off('submit').on('submit', function(event) {
        submitAddAccount(event);
    });
    
    // アカウント編集フォームの送信
    $('#edit-account-form').off('submit').on('submit', function(event) {
        submitEditAccount(event);
    });
    
    // アカウント管理セクションのイベントハンドラ
    
    // アカウント追加モーダル表示
    $('#show-add-account-modal-btn').on('click', function() {
        showAddAccountModal();
    });
    
    // アカウント追加ボタン（アカウントなしの場合）
    $('#show-add-account-modal-btn-empty').on('click', function() {
        showAddAccountModal();
    });
    
    // アカウントカードの編集ボタン
    $(document).on('click', '.edit-account-btn', function() {
        const username = $(this).data('username');
        editSelectedAccount(username);
    });
    
    // アカウントカードの更新ボタン
    $(document).on('click', '.sync-account-btn', function() {
        const did = $(this).data('did');
        syncAccount(did, this);
    });
    
    // アカウントカードの削除ボタン
    $(document).on('click', '.delete-account-btn', function() {
        const did = $(this).data('did');
        handleConfirmDeleteAccount(did);
    });
    
    // モーダル閉じるボタン
    $('#close-add-account-modal-btn').on('click', function() {
        closeAddAccountModal();
    });
    
    $('#close-edit-account-modal-btn').on('click', function() {
        closeEditAccountModal();
    });
    
    // モーダルキャンセルボタン
    $('#cancel-add-account-btn').on('click', function() {
        closeAddAccountModal();
    });
    
    $('#cancel-edit-account-btn').on('click', function() {
        closeEditAccountModal();
    });
}