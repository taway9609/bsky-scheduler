// js/app.js

// Fallback for generateUniqueId if not defined in utils.js
if (typeof window.generateUniqueId !== 'function') {
    window.generateUniqueId = function() {
        return 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
    };
}

$(document).ready(function() {
  window.debugLog('DEBUG: Document ready, initializing Bluesky Scheduler application');
  initializeApp();
  initializeAppImageUpload();
  initializeAccountSelection();
    initializeFilters();
    setupReplyGateLogic();
    setupSettingsForm();
    setupQuoteUrlFeature();
    restoreLastSection();
    updateSubmitButtonState();
    loadInitialData();
    loadHashtagHistory();
    
    // グローバルイベントリスナー
    $(document).on('click', '.modal', function(e) { if (e.target === this) $(this).removeClass('active'); });
    $(document).on('keydown', function(e) {
        if (e.key === 'Escape') { $('.alert, .modal.active').removeClass('active'); $('body').css('overflow', ''); }
    });

    // セクション遷移
    $(document).on('click', '[data-section]', function() { switchSection($(this).data('section')); });

    // 更新ボタン
    $('#refresh-posts-btn').on('click', function() {
        const now = Date.now();
        if (now - AppConfig.lastManualRefreshTime < AppConfig.REFRESH_COOLDOWN_SECONDS * 1000) {
            const remaining = Math.ceil((AppConfig.REFRESH_COOLDOWN_SECONDS * 1000 - (now - AppConfig.lastManualRefreshTime)) / 1000);
            return showNotification(`更新は${AppConfig.REFRESH_COOLDOWN_SECONDS}秒に 1 回までです。あと ${remaining} 秒お待ちください。`, 'warning');
        }
        loadPostsList();
        AppConfig.lastManualRefreshTime = now;
    });

    // ページ離脱時に自動更新を停止
    $(window).on('beforeunload', function() {
        stopAutoUpdate();
    });

    // 画像アクション委任 (images.js ロジックに接続)
    $(document).on('click', '.image-btn.delete', function() { window.handleImageAction('delete', $(this).closest('.image-item').data('imageId')); });
    $(document).on('click', '.image-btn.move-left', function() { window.handleImageAction('left', $(this).closest('.image-item').data('imageId')); });
    $(document).on('click', '.image-btn.move-right', function() { window.handleImageAction('right', $(this).closest('.image-item').data('imageId')); });
    
    // ハッシュタグ履歴クリアボタン
    $(document).on('click', '#clear-hashtag-history-btn', clearHashtagHistory);
});

function initializeApp() {
window.debugLog('DEBUG: Initializing application');
$('#post-content').on('input', updateCharCount);
const $scheduleInput = $('#create-section #schedule_time');
if ($scheduleInput.length && !$scheduleInput.val()) $scheduleInput.val(formatDateTime(new Date()));

// 日時入力の変更を監視
$scheduleInput.on('change input', function() {
window.debugLog('DEBUG: Schedule time changed');
updateSelectedDatetimeDisplay();
});

$('#post-form').on('submit', validateForm);
setupAutoCloseAlerts();
updateBulkActionsUI();
checkAccountAndToggleForm();
updateSelectedDatetimeDisplay();
initializeSwipeToDismiss();
window.debugLog('DEBUG: Application initialization complete');
}

function loadInitialData() {
    window.api.get('/bluesky/get_accounts').then(function(res) {
        if (res.status === 'success') {
            updateAccountList(res.accounts);
        }
    }).fail(function() {
        console.error('Failed to load accounts');
    });
}

function checkAccountAndToggleForm() {
    const hasAccounts = window.accountsData && Object.keys(window.accountsData).length > 0;
    const $warning = $('#no-account-warning');
    const $container = $('#create-form-container');
    const $form = $('#post-form');
    
    if (hasAccounts) {
        $warning.hide();
        $container.css('opacity', '1');
        $form.find('input, textarea, select, button').prop('disabled', false);
    } else {
        $warning.show();
        $container.css('opacity', '0.5');
        $form.find('input, textarea, select, button').prop('disabled', true);
    }
}

let isSwitchingSection = false;

async function switchSection(sectionName, skipConfirm = false) {
    // 編集中または複製中に別セクションへ移動しようとした場合
    if (!skipConfirm && !isSwitchingSection) {
        const isEditing = $('#post-form').attr('data-edit-mode') === 'true';
        const isDuplicating = typeof isDuplicatedPost !== 'undefined' && isDuplicatedPost;
        
        if ((isEditing || isDuplicating) && sectionName !== 'create') {
            const message = isDuplicating ? '複製中の投稿をキャンセルして移動しますか？' : '編集内容を保存せずに移動しますか？';
            const confirmed = await showCustomConfirm(message, '移動確認');
            if (!confirmed) return;

            isSwitchingSection = true;

            try {
                // キャンセルする場合は複製/編集状態をリセット
                if (isDuplicating) {
                    isDuplicatedPost = false;
                    sourcePostId = null;
                    AppConfig.uploadedImages = [];
                    $('#cancel-edit-btn').removeClass('btn-danger').addClass('btn-warning')
                        .html('<i class="fas fa-times-circle"></i> 編集をキャンセル');
                    resetForm();
                } else {
                    const postId = $('#post-form').attr('data-post-id');
                    if (postId) {
                        $.post(`/bluesky/resume_job/${postId}`).catch(() => {});
                    }
                    resetForm();
                }
            } finally {
                isSwitchingSection = false;
            }
        }
    }
    
    $(`#${AppConfig.currentSection}-section`).removeClass('active');
    $(`[data-section="${AppConfig.currentSection}"]`).removeClass('active');
    $(`#${sectionName}-section`).addClass('active');
    $(`[data-section="${sectionName}"]`).addClass('active');
    AppConfig.currentSection = sectionName;
    localStorage.setItem('lastSection', sectionName);

    if (sectionName === 'posts') {
        loadPostsList(false);
        startAutoUpdate(); // 自動更新開始
        // Scroll to top when switching to posts section
        $('.posts-container').animate({ scrollTop: 0 }, 300);
    } else {
        stopAutoUpdate(); // 他のセクションでは自動更新停止
    }
    if (sectionName === 'create' && !$('#post-form').attr('data-edit-mode') && !isDuplicatedPost) resetForm();

    // アカウントチェック（投稿作成画面）
    if (sectionName === 'create') {
        checkAccountAndToggleForm();
    }
}

function resetForm(isReplyMode = false) {
    const $form = $('#post-form');
    const currentAccount = $('#account-select').val();
    $form[0].reset();
    $form.removeAttr('data-edit-mode data-post-id data-reply-mode');
    $('#image-grid').empty();
    $('#reply-info-area').hide();
    $('#quote-mode-selector').hide(); // 引用モードセレクターも非表示
    $('#cancel-edit-btn').hide().removeClass('btn-danger').addClass('btn-warning').html('<i class="fas fa-times-circle"></i> 編集をキャンセル');
    $('button[type="submit"]', $form).html('<i class="fas fa-calendar-plus"></i> 投稿を予約');
    $('#create-section h2').text('新規投稿作成');
    $('#schedule_time').val(formatDateTime(new Date()));
    $('#is_quote').val('0'); // reset is_quote to default (reply)
    AppConfig.uploadedImages = [];
    updateImageControls();
    updateImageOrderInputs();
    if (currentAccount) $('#account-select').val(currentAccount).trigger('change');
    updateSubmitButtonState();
    // 複製フラグをリセット
    if (typeof isDuplicatedPost !== 'undefined') {
        isDuplicatedPost = false;
        sourcePostId = null;
    }
}

function cancelEdit() {
    resetForm();
    switchSection('posts');
}

function updateCharCount() {
    const $textarea = $('#post-content'), $counter = $('.char-count');
    const count = $textarea.val().length;
    $counter.text(`${count} / 300`);
    $textarea.add($counter).css({ 
        borderColor: count > 300 ? 'var(--danger-color)' : count > 250 ? 'var(--warning-color)' : 'var(--border-color)',
        color: count > 300 ? 'var(--danger-color)' : count > 250 ? 'var(--warning-color)' : 'var(--text-secondary)'
    });
    updateSubmitButtonState();
}

function updateSubmitButtonState() {
    const content = $('#post-content').val().trim();
    const hasUploading = AppConfig.uploadedImages.some(img => img.isUploading);
    const canSubmit = (AppConfig.uploadedImages.length > 0 || content.length > 0) && !hasUploading;
    const $btn = $('#post-form button[type="submit"]');
    $btn.prop('disabled', !canSubmit);
    const isEdit = $('#post-form').attr('data-edit-mode') === 'true';
    if (hasUploading) {
        $btn.html('<i class="fas fa-spinner fa-spin"></i> 画像処理中...');
    } else {
        $btn.html(canSubmit ? (isEdit ? '<i class="fas fa-save"></i> 更新' : '<i class="fas fa-calendar-plus"></i> 投稿を予約') : '<i class="fas fa-exclamation-circle"></i> 内容または画像を入力');
    }
}

function validateForm(e) {
  window.debugLog('DEBUG: Form submission started');
  e.preventDefault();
  const $form = $(e.target), $btn = $('button[type="submit"]', $form);
  if ($btn.prop('disabled')) {
    window.debugLog('DEBUG: Submit button is disabled');
    const hasUploading = AppConfig.uploadedImages.some(img => img.isUploading);
    if (hasUploading) {
        return showNotification('画像の処理中です。しばらくお待ちください。', 'warning');
    }
    return showNotification('投稿内容を入力するか、画像を 1 枚以上選択してください。', 'warning');
  }

  const $accountSelect = $('#account-select');
  const account = $accountSelect.val();
  let content = $('#post-content').val().trim();
  let scheduleTime = $('#schedule_time').val();

  window.debugLog('DEBUG: Form validation - account:', account, 'content length:', content.length, 'images:', AppConfig.uploadedImages.length);

  if (!account) {
    window.debugLog('DEBUG: No account selected');
    return showNotification('投稿アカウントを選択してください', 'error');
  }
  if (scheduleTime && new Date(scheduleTime) < new Date()) {
    window.debugLog('DEBUG: Schedule time is in the past');
    return showNotification('予約日時は過去の日付に設定できません。', 'error');
  }
  if (!content && AppConfig.uploadedImages.length === 0) {
    window.debugLog('DEBUG: No content and no images');
    return showNotification('投稿内容を入力するか、画像を 1 枚以上選択してください。', 'error');
  }
  if (content.length > 300) {
    window.debugLog('DEBUG: Content exceeds 300 characters');
    return showNotification('投稿内容は 300 文字以内で入力してください', 'error');
  }

  const originalBtnHtml = $btn.html();
  $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> 送信中...');
  window.debugLog('DEBUG: Form validation passed, preparing submission');

  // Get account_did from the selected option
  const did = $accountSelect.find('option:selected').data('did');
  if (!did) {
    $btn.prop('disabled', false).html(originalBtnHtml);
    return showNotification('アカウントの DID が見つかりません。', 'error');
  }

  window.debugLog('DEBUG: Images are pre-uploaded, count:', AppConfig.uploadedImages.length);
  AppConfig.uploadedImages.forEach((img, index) => {
    window.debugLog('DEBUG: Image', index, '- filename:', img.serverFilename || img.filename, 'isUploading:', img.isUploading, 'size:', img.size);
  });

  // Note: Images are already optimized during individual uploads
  // No need to show optimization overlay during form submission

  // Create empty FormData and add fields explicitly in the correct order
  const formData = new FormData();

  // Get account_did from the selected option
  const accountDid = did;
  formData.append('account_did', accountDid);
    
    // Add content
    formData.append('content', content || '');
    
    // Add schedule_time
    formData.append('schedule_time', scheduleTime || '');
    
    // Add language
    formData.append('language', 'ja');
    
    // Add image_data (JSON metadata)
    if (AppConfig.uploadedImages && AppConfig.uploadedImages.length > 0) {
        window.debugLog('DEBUG: Adding image_data to form submission');
        const imageDataArray = AppConfig.uploadedImages.map((img, index) => {
          window.debugLog('DEBUG: Image metadata', index, '- id:', img.id, 'serverFilename:', img.serverFilename, 'alt:', img.alt);
          return {
            id: img.id,
            name: img.name,
            size: img.size,
            alt: img.alt || '',
            order: index,
            serverFilename: img.serverFilename || img.filename || '',
            original_size: img.originalSize || img.size  // Include original size for optimization tracking
          };
        });
        formData.append('image_data', JSON.stringify(imageDataArray));
        window.debugLog('DEBUG: Image data JSON:', JSON.stringify(imageDataArray));
    }
    
    // Add labels if any (sexual, nudity, porn)
    const selectedLabels = [];
    $form.find('input[name="labels"]:checked').each(function() {
        selectedLabels.push($(this).val());
    });
    if (selectedLabels.length > 0) {
        formData.append('labels', JSON.stringify(selectedLabels));
    }
    
    // Add reply_to fields if any
    const replyToPostId = $('#reply-to-post-id').val();
    if (replyToPostId) {
        formData.append('parent_post_id', replyToPostId);
    }
    const externalReplyUri = $('#external-reply-uri').val();
    if (externalReplyUri) {
        formData.append('external_reply_uri', externalReplyUri);
    }
    const externalReplyCid = $('#external-reply-cid').val();
    if (externalReplyCid) {
        formData.append('external_reply_cid', externalReplyCid);
    }
    
    // Handle reply_gate checkboxes
    const selectedReplyGates = [];
    $form.find('input[name="reply_gate"]:checked').each(function() {
        selectedReplyGates.push($(this).val());
    });
    if (selectedReplyGates.length > 0) {
        formData.append('reply_gate', JSON.stringify(selectedReplyGates));
    }
    
    // Add disable_quotes
    const disableQuotes = $form.find('#disable_quotes').prop('checked') ? '1' : '0';
    formData.append('disable_quotes', disableQuotes);
    
    // Add is_quote
    formData.append('is_quote', $form.find('#is_quote').val() || '0');
    
    // Add image metadata (images are already uploaded separately)
    if (AppConfig.uploadedImages && AppConfig.uploadedImages.length > 0) {
        const imageDataArray = AppConfig.uploadedImages.filter(img => img.serverFilename).map((img, index) => ({
            id: img.id,
            name: img.name,
            size: img.size,
            alt: img.alt || '',
            order: index,
            serverFilename: img.serverFilename,
            original_size: img.originalSize || img.size
        }));
        formData.append('image_data', JSON.stringify(imageDataArray));
    }
    
    // Add source_post_id if duplicating
    if (typeof isDuplicatedPost !== 'undefined' && isDuplicatedPost && sourcePostId) {
        formData.append('source_post_id', sourcePostId);
    }

    const url = $form.attr('data-edit-mode') === 'true' ? `/bluesky/edit_scheduled_post/${$form.attr('data-post-id')}` : '/bluesky/schedule_post';
    window.debugLog('DEBUG: Submitting form to URL:', url);
    
    $.ajax({
  url: url, type: 'POST', data: formData, processData: false, contentType: false,
  success: (res) => {
    window.debugLog('DEBUG: Form submission successful:', res);
    showNotification(res.message, 'success');
    if (content) extractHashtags(content).forEach(tag => addHashtagToHistory(tag));
    resetForm();
    switchSection('posts');
    loadHashtagHistory(); // Reload from server to sync
  },
  error: (xhr) => {
    console.error('DEBUG: Form submission error:', xhr.responseJSON || xhr.statusText);
    const errorMsg = xhr.responseJSON?.message || '予約に失敗しました';
    showNotification(simplifySubmitError(errorMsg), 'error');
  },
  complete: () => {
    window.debugLog('DEBUG: Form submission complete');
    const $btn = $('#post-form button[type="submit"]');
    $btn.prop('disabled', false).html(originalBtnHtml);
  }
});
}

function simplifySubmitError(errorMsg) {
    if (!errorMsg) return '予約に失敗しました';
    
    const lowerMsg = errorMsg.toLowerCase();
    
    if (lowerMsg.includes('rate limit') || lowerMsg.includes('ratelimit') || 
        lowerMsg.includes('429') || lowerMsg.includes('status_code=429')) {
        return 'レート制限です。時間をおいて再試行してください';
    }
    
    if (lowerMsg.includes('network') || (lowerMsg.includes('connection') && lowerMsg.includes('error'))) {
        return '接続エラーが発生しました';
    }
    
    if (lowerMsg.includes('timeout')) {
        return 'タイムアウトしました';
    }
    
    if (lowerMsg.includes('account') && lowerMsg.includes('not found')) {
        return 'アカウントが見つかりません';
    }
    
    if (lowerMsg.includes('login') || lowerMsg.includes('password') || lowerMsg.includes('authentication')) {
        return 'ログインに失敗しました';
    }
    
    if (lowerMsg.includes('400')) return 'リクエストエラー';
    if (lowerMsg.includes('401') || lowerMsg.includes('403')) return '認証エラー';
    if (lowerMsg.includes('404')) return 'リソースが見つかりません';
    if (lowerMsg.includes('500') || lowerMsg.includes('502') || lowerMsg.includes('503')) return 'サーバーエラー';
    
    return errorMsg.length > 50 ? errorMsg.substring(0, 50) + '...' : errorMsg;
}

function setupReplyGateLogic() {
    const $nobody = $('#create-section input[name="reply_gate"][value="nobody"]');
    const $others = $('#create-section input[name="reply_gate"]:not([value="nobody"])');
    $nobody.on('change', function() {
        const checked = this.checked;
        $others.prop('disabled', checked).prop('checked', checked ? false : $others.prop('checked'));
    });
    $others.on('change', function() { if (this.checked) $nobody.prop('checked', false); });
}

function setupSettingsForm() {
    $('#settings-form').on('submit', async function(e) {
        e.preventDefault();
        const $btn = $('button[type="submit"]', this).prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> 保存中...');
        try {
            const res = await $.post('/bluesky/settings', $(this).serialize());
            showNotification(res.message, res.status);
        } catch (err) { showNotification('設定の保存中にエラーが発生しました。', 'error'); }
        $btn.prop('disabled', false).html('保存');
    });
}

function setupAutoCloseAlerts() {
    setTimeout(() => { $('.alert:not(#no-account-warning)').css({ opacity: '0', transform: 'translateY(-10px)' }).fadeOut(300, function() { $(this).remove(); }); }, 5000);
}

function restoreLastSection() {
    switchSection(localStorage.getItem('lastSection') || 'posts');
}

async function addHashtagToHistory(tag) {
  if (!tag) return;
  
  // Sync to server only (no localStorage)
  try {
    const token = window.Auth?.getToken();
    if (token) {
      await fetch('/bluesky/hashtags/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tag: tag })
      });
      
      // Reload history from server
      await loadHashtagHistory();
    }
  } catch (error) {
    console.error('Failed to sync hashtag to server:', error);
  }
}

function renderHashtagHistory() {
    const $container = $('#hashtag-history-container');
    const $itemsContainer = $container.find('.hashtag-history-items');
    
    $itemsContainer.empty();
    
    if (!AppConfig.hashtagHistory.length) {
        $container.hide();
        return;
    }
    
    $container.show();
    AppConfig.hashtagHistory.forEach(tag => {
        $itemsContainer.append(`<button type="button" class="hashtag-history-item" onclick="insertHashtagIntoContent('${tag}')">#${tag}</button>`);
    });
}

function clearHashtagHistory() {
  showCustomConfirm('ハッシュタグ履歴をクリアしますか？').then((confirmed) => {
    if (!confirmed) return;
    
    $.ajax({
      url: '/bluesky/hashtags/clear',
      method: 'POST',
      success: function() {
        AppConfig.hashtagHistory = [];
        renderHashtagHistory();
        showNotification('ハッシュタグ履歴をクリアしました', 'success');
      },
      error: function() {
        showNotification('ハッシュタグ履歴のクリアに失敗しました', 'error');
      }
    });
  });
}

function insertHashtagIntoContent(tag) {
    const $textarea = $('#post-content');
    const start = $textarea[0].selectionStart, val = $textarea.val();
    $textarea.val(val.substring(0, start) + `#${tag} ` + val.substring($textarea[0].selectionEnd));
    $textarea[0].selectionStart = $textarea[0].selectionEnd = start + tag.length + 2;
    $textarea.focus();
    updateCharCount();
}

async function loadHashtagHistory() {
  // Load from server only (no localStorage)
  try {
    const response = await fetch('/bluesky/hashtags', {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success' && Array.isArray(data.data)) {
        AppConfig.hashtagHistory = data.data;
      }
    }
  } catch (error) {
    console.error('Failed to load hashtag history from server:', error);
    AppConfig.hashtagHistory = [];
  }
  
  renderHashtagHistory();
}

// 引用URL機能
function setupQuoteUrlFeature() {
    $('#add-quote-url-btn').on('click', handleAddQuoteUrl);
    // URL入力でEnterキーを許可
    $('#quote-url-input').on('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddQuoteUrl();
        }
    });
}

async function handleAddQuoteUrl() {
    const $btn = $('#add-quote-url-btn');
    const $input = $('#quote-url-input');
    const originalBtnHtml = $btn.html();
    $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> 解決中...');

    try {
        const url = $input.val().trim();

        if (!url) {
            return showNotification('URL を入力してください', 'warning');
        }

        let parent = null;
        let internalPostId = null;
        let externalUri = null;
        let externalCid = null;

        // ステップ1：内部の予約/投稿済み投稿として解決を試みる
        const extractedId = extractPostIdFromUrl(url);
        if (extractedId) {
            if (extractedId.includes('-')) {
                // UUID形式 - 直接参照
                try {
                    const res = await $.get(`/bluesky/get_post/${extractedId}`);
                    if (res.status === 'success') {
                        parent = res.data;
                        internalPostId = extractedId;
                    }
                } catch (e) {
                    // 内部に見つからなかった、以下で外部を試す
                }
            } else {
                // CID形式 - 内部の投稿済み投稿に解決を試みる
                try {
                    const resolveRes = await $.post('/bluesky/resolve_cid_to_post', { cid: extractedId });
                    if (resolveRes.status === 'success') {
                        internalPostId = resolveRes.data.post_id;
                        const getRes = await $.get(`/bluesky/get_post/${internalPostId}`);
                        if (getRes.status === 'success') parent = getRes.data;
                    }
                } catch (e) {
                    // 内部に見つからなかった、以下で外部を試す
                }
            }
        }

        // ステップ2：内部に見つからなかった場合、外部Bluesky URLとして扱う
        if (!parent) {
            try {
                const extRes = await $.ajax({
                    url: '/bluesky/resolve_external_url',
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify({ url: url })
                });
                if (extRes.status !== 'success') {
                    const errorMsg = extRes.message || '外部投稿の解決に失敗しました';
                    showNotification(errorMsg, 'error');
                    $input.val('');
                    return;
                }
                parent = extRes.data;
                externalUri = parent.post_uri;
                externalCid = parent.post_cid;
            } catch (xhr) {
                const errorMsg = xhr.responseJSON?.message || '引用元の投稿を解決できませんでした';
                showNotification(errorMsg, 'error');
                $input.val('');
                return;
            }
        }

        if (!parent) {
            return showNotification('引用元の投稿データを取得できませんでした', 'error');
        }

    // 返信ターゲットを切り替えているかどうかを判定
    const currentReplyId = $('#reply-to-post-id').val();
    const currentExternalUri = $('#external-reply-uri').val();

    // すでに別のターゲットで返信モードの場合、確認を求める
    if (currentReplyId && currentReplyId !== internalPostId) {
        if (!await showCustomConfirm('現在の引用を置き換えますか？', '引用交換')) {
            return;
        }
    } else if (currentExternalUri && currentExternalUri !== externalUri) {
        if (!await showCustomConfirm('現在の引用を置き換えますか？', '引用交換')) {
            return;
        }
    }

    // 新規の場合、返信モードを設定
    const isFreshReply = !currentReplyId && !currentExternalUri;
    if (isFreshReply) {
        $('#reply-info-area').show();
        $('#create-section h2').text('返信を作成');
    }

    // 以前の値をクリア
    $('#reply-to-post-id').val(internalPostId || '');
    $('#external-reply-uri').val(externalUri || '');
    $('#external-reply-cid').val(externalCid || '');
    $('#post-form').attr('data-reply-mode', 'true');

    // 引用モードセレクターを表示し、デフォルトを返信に設定（is_quote=0）
    $('#quote-mode-selector').show();
    $('input[name="quote_mode"][value="reply"]').prop('checked', true);
    $('#is_quote').val('0');

    // ユーザーがモードを変更したとき、隠しフィールドを更新
    $('input[name="quote_mode"]').off('change').on('change', function() {
        $('#is_quote').val($(this).val() === 'quote' ? '1' : '0');
    });

    // プレビューコンテンツを設定
    const displayName = parent.display_name || parent.account || '(外部)';
    const handle = parent.account || '(不明)';
    $('#reply-to-parent-account').text(displayName !== handle ? `${displayName} @${handle}` : `@${handle}`);
    $('#reply-to-content-preview').text(parent.content ? (parent.content.length > 100 ? parent.content.substring(0, 100) + '...' : parent.content) : '(本文なし)');

    // 利用可能な場合は画像を表示
    if (parent.image_data && parent.image_data.length > 0) {
        const $previewContainer = $('#reply-to-parent-image-preview').empty();
        parent.image_data.forEach(img => {
            const src = img.filename ? `/static/images/${img.filename}` : img.url;
            const alt = img.alt_text || img.alt || '引用画像';
            const $img = $(`<img src="${src}" alt="${alt}" class="reply-parent-image-thumb">`);
            $previewContainer.append($img);
        });
    } else {
        $('#reply-to-parent-image-preview').empty();
    }

    // 利用可能な場合はスケジュール時間とアカウントをコピー
    if (parent.schedule_time) {
        $('#schedule_time').val(formatUtcToLocal(parent.schedule_time));
        updateSelectedDatetimeDisplay();
    }
    if (parent.account) $('#account-select').val(parent.account).trigger('change');

    $input.val('');
    showNotification('引用元の投稿を読み込みました', 'success');
    updateSubmitButtonState();
    } finally {
        $btn.prop('disabled', false).html(originalBtnHtml);
    }
}

function extractPostIdFromUrl(url) {
    // existing implementation

    // Bluesky URLパターン：
    // https://bsky.app/profile/{handle}/post/{postId}
    // https://{did}.bsky.social/post/{postId}
    // https://bsky.app/profile/{did}/post/{postId}
    // postIdはbase32（a-zの文字、数字2-7）またはハイフン付きUUIDのいずれか
    const patterns = [
        /bsky\.app\/profile\/[^\/]+\/post\/([a-zA-Z0-9\-]+)/i,
        /\/post\/([a-zA-Z0-9\-]+)/i
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }
    return null;
}

// Image upload initialization - use the new upload logic from utils.js
function initializeAppImageUpload() {
  window.debugLog('DEBUG: Initializing image upload using utils.js logic');
  
  // Check if the utils.js function is available
  if (typeof window.initializeImageUpload === 'function') {
    window.debugLog('DEBUG: Calling window.initializeImageUpload from utils.js');
    window.initializeImageUpload();
  } else {
    console.error('DEBUG: window.initializeImageUpload function not found in utils.js');
    window.debugLog('DEBUG: Falling back to basic image upload initialization');
    
    // Basic fallback initialization
    const $fileUploadArea = $('#file-upload-area');
    const $fileInput = $('#images');
    
    $fileUploadArea.on('click', function() {
      $fileInput.click();
    });
    
    $('#add-more-images').on('click', function() {
      $fileInput.click();
    });
    
    $('#clear-all-images').on('click', function() {
      AppConfig.uploadedImages = [];
      rerenderImages();
      updateImageControls();
      $(this).hide();
    });
  }
}

// ========================================
// スワイプジェスチャー機能 (モバイル通知用)
// ========================================
function initializeSwipeToDismiss() {
const SWIPE_THRESHOLD = 100; // 最小スワイプ距離
let touchStartX = 0;
let touchStartY = 0;
let touchElement = null;

function handleTouchStart(e) {
touchStartX = e.touches[0].clientX;
touchStartY = e.touches[0].clientY;
touchElement = e.currentTarget;
}

function handleTouchMove(e) {
if (!touchElement) return;
const touchEndX = e.touches[0].clientX;
const touchEndY = e.touches[0].clientY;
const diffX = touchEndX - touchStartX;
const diffY = touchEndY - touchStartY;

// 横方向の swipe の場合のみ（縦スクロールと区別）
if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) < SWIPE_THRESHOLD * 2) {
e.preventDefault();
touchElement.style.transform = `translateX(${diffX}px)`;
touchElement.style.opacity = 1 - (Math.abs(diffX) / SWIPE_THRESHOLD) * 0.5;
}
}

function handleTouchEnd(e) {
if (!touchElement) return;
const touchEndX = e.changedTouches[0].clientX;
const diffX = touchEndX - touchStartX;

// 左スワイプの場合のみ閉じる
if (diffX < -SWIPE_THRESHOLD) {
touchElement.classList.add('swiping-left');
touchElement.style.transform = 'translateX(-100%)';
touchElement.style.opacity = '0';
setTimeout(() => touchElement.remove(), 200);
} else {
// 元に戻す
touchElement.style.transform = '';
touchElement.style.opacity = '';
}

touchElement = null;
}

// data-swipe-dismiss 属性を持つ要素にイベントをバインド
$(document).on('touchstart', '[data-swipe-dismiss]', function(e) {
touchStartX = e.touches[0].clientX;
touchStartY = e.touches[0].clientY;
touchElement = $(this);
});

$(document).on('touchmove', '[data-swipe-dismiss]', function(e) {
if (!touchElement) return;
const touchEndX = e.touches[0].clientX;
const diffX = touchEndX - touchStartX;
const diffY = e.touches[0].clientY - touchStartY;

// 横方向の swipe の場合のみ（縦スクロールと区別）
if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) < SWIPE_THRESHOLD * 2) {
touchElement.css('transform', `translateX(${diffX}px)`);
touchElement.css('opacity', 1 - (Math.abs(diffX) / SWIPE_THRESHOLD) * 0.5);
}
});

$(document).on('touchend', '[data-swipe-dismiss]', function(e) {
if (!touchElement) return;
const touchEndX = e.changedTouches[0].clientX;
const diffX = touchEndX - touchStartX;

// 左スワイプの場合のみ閉じる
if (diffX < -SWIPE_THRESHOLD) {
touchElement.addClass('swiping-left');
touchElement.css({ 'transform': 'translateX(-100%)', 'opacity': '0' });
setTimeout(() => touchElement.remove(), 200);
} else {
// 元に戻す
touchElement.css({ 'transform': '', 'opacity': '' });
}

touchElement = null;
});
}

// initializeSwipeToDismiss を app.js の initializeApp 内で呼び出す
