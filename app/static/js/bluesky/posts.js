// js/posts.js

// 自動更新タイマー用変数 (utils.js で定義済み)
const AUTO_UPDATE_INTERVAL = 60000; // 60 秒（1 分）
let isDuplicatedPost = false;
let sourcePostId = null;

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function atUriToHttpsUrl(atUri) {
  if (!atUri) return atUri;
  if (!atUri.startsWith('at://')) return atUri;
  
  try {
    const uriWithoutPrefix = atUri.substring(5);
    const parts = uriWithoutPrefix.split('/');
    
    if (parts.length < 3) return atUri;
    
    const handle = parts[0];
    const collection = parts[1];
    
    let rkey = null;
    if (parts.length > 2) {
      if (collection.includes('.')) {
        rkey = parts[2];
      } else {
        rkey = collection;
      }
    }
    
    if (!rkey) return atUri;
    
    return `https://bsky.app/profile/${handle}/post/${rkey}`;
  } catch (e) {
    return atUri;
  }
}

// Update bulk actions UI - defined at top level so it's available before $(document).ready()
function updateBulkActionsUI() {
  const count = AppConfig.selectedPostIdsForBulkAction.size;
  const totalPosts = $('.posts-grid .post-card').length;
  const allSelected = count === totalPosts && totalPosts > 0;

  $('#selected-posts-count').text(count);
  $('#delete-selected-btn').prop('disabled', count === 0);
  $('#select-all-posts-btn').toggle(!allSelected).prop('disabled', totalPosts === 0);
  $('#deselect-all-posts-btn').toggle(allSelected);
}

// Make updateBulkActionsUI globally available
window.updateBulkActionsUI = updateBulkActionsUI;

function loadPostsList(notify = true, force = false) {
    const now = new Date().getTime();
    if (!force && now - AppConfig.lastManualRefreshTime < AppConfig.REFRESH_COOLDOWN_SECONDS * 1000) return;
    AppConfig.lastManualRefreshTime = now;

    const sortValue = $('#sort-select').val() || 'created_at-desc';
    const [sortBy, sortOrder] = sortValue.split('-');

    window.api.get(`/bluesky/get_posts?sort_by=${sortBy}&sort_order=${sortOrder}`).then(function(res) {
        if (res.status === 'success') {
            renderPostsList(res.data);
            if (notify) showNotification('投稿一覧を更新しました', 'success');
        }
    }).fail(function(xhr) {
        if (xhr && xhr.status === 401) {
            stopAutoUpdate();
            return;
        }
        showNotification('投稿一覧の読み込みに失敗しました', 'error');
    });
}

// 自動更新開始
function startAutoUpdate() {
    stopAutoUpdate(); // 既存のタイマーを停止
    window.autoUpdateTimer = setInterval(function() {
        // posts セクションが表示されている場合のみ更新
        if ($('#posts-section').hasClass('active')) {
            loadPostsList(false, true); // notify=false, force=true
        }
    }, AUTO_UPDATE_INTERVAL);
}

// 自動更新停止
function stopAutoUpdate() {
    if (window.autoUpdateTimer) {
        clearInterval(window.autoUpdateTimer);
        window.autoUpdateTimer = null;
    }
}

function renderPostsList(posts) {
  const $container = $('.posts-container').empty();
  if (!posts || posts.length === 0) {
    $container.html(`
    <div class="empty-state">
      <i class="fas fa-calendar-plus"></i><h3>予約投稿がありません</h3>
      <p>新しい投稿を作成して予約しましょう</p>
      <button class="btn btn-primary" onclick="switchSection('create')"><i class="fas fa-plus"></i> 投稿を作成</button>
    </div>`);
    return updateBulkActionsUI();
  }

  const $grid = $('<div class="posts-grid"></div>');
  posts.forEach(post => $grid.append(createPostCard(post)));
  $container.append($grid);
  applyFilters();
  updateBulkActionsUI();
  requestAnimationFrame(() => {
    requestAnimationFrame(initAccountMarquee);
  });
  
  // Smooth scroll to top of posts container when new posts are rendered
  $container[0].scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function createPostCard(post) {
    const statusText = getStatusText(post.status);
  const truncatedContent = post.content ? post.content : '';
  const isContentTruncated = post.content && post.content.length > 200; // Assuming 200 chars as truncation threshold
  const isSelected = AppConfig.selectedPostIdsForBulkAction.has(post.id);

// アカウントの表示名を取得
const accountData = AppConfig.accountsData[post.account];
const accountDisplay = accountData?.display_name ? escapeHtml(accountData.display_name) + ' (@' + escapeHtml(post.account) + ')' : '@' + escapeHtml(post.account);
const accountFullName = accountData?.display_name ? escapeHtml(accountData.display_name) + ' (@' + escapeHtml(post.account) + ')' : '@' + escapeHtml(post.account);

    // 時間とステータスのチェック
    const now = new Date();
    const scheduleTime = post.schedule_time ? new Date(post.schedule_time) : null;
    const isTimeArrived = scheduleTime ? now >= scheduleTime : false;
    const isStatusPosting = post.status === 'posting';
    const isStatusPosted = post.status === 'posted';
    const isStatusFailed = post.status === 'failed';

    // 編集と返信は、時間が到来した、またはステータスがposting/posted/failedの場合にロック
    const editReplyLocked = isTimeArrived || isStatusPosting || isStatusPosted || isStatusFailed;

    // 複製と削除は、ステータスがpostingの場合のみロック
    const duplicateDeleteLocked = isStatusPosting;

    // 削除がロックされている場合はチェックボックスを無効化（一括削除が唯一の一括アクションであるため）
    const checkboxDisabled = duplicateDeleteLocked;

    // ロック理由に基づいてタイトルを決定
    let editTitle = '編集';
    if (editReplyLocked) {
        if (isStatusPosting) editTitle = '投稿中は編集できません';
        else if (isStatusPosted) editTitle = '投稿済みのため編集できません';
        else if (isStatusFailed) editTitle = '失敗した投稿のため編集できません';
        else if (isTimeArrived) editTitle = 'スケジュール時間に達したため編集できません';
    }

    let replyTitle = '返信';
    if (editReplyLocked) {
        if (isStatusPosting) replyTitle = '投稿中は返信できません';
        else if (isStatusPosted) replyTitle = '投稿済みのため返信できません';
        else if (isStatusFailed) replyTitle = '失敗した投稿のため返信できません';
        else if (isTimeArrived) replyTitle = 'スケジュール時間に達したため返信できません';
    }

    let duplicateTitle = '複製';
    if (duplicateDeleteLocked) {
        duplicateTitle = '投稿中は複製できません';
    }

    let deleteTitle = '削除';
    if (duplicateDeleteLocked) {
        deleteTitle = '投稿中は削除できません';
    }

    let parentHtml = '';
    if (post.parent_post_id) {
        parentHtml = `<div class="reply-to-preview">
            <div class="reply-to-header"><i class="fas fa-reply"></i><span>返信先 (ID: <a href="#" class="highlight-parent-trigger" data-parent-id="${post.parent_post_id}">${post.parent_post_id.substring(0, 8)}</a>...)</span></div>
            <p>${escapeHtml(post.parent_post_preview || '(本文なし)')}</p>
        </div>`;
    }

    let imagesHtml = '';
    if (post.image_data && post.image_data.length > 0) {
        imagesHtml = `<div class="post-images">${post.image_data.map(img =>
            `<img src="/static/images/${img.filename}" alt="${img.alt_text || '投稿画像'}" class="post-image-thumb" data-filename="${img.filename}">`
        ).join('')}</div>`;
    }

    // ラベル
    let labelsHtml = '';
    if (post.labels && post.labels.length > 0) {
        const labelIcons = { sexual: 'fa-fire', nudity: 'fa-user', porn: 'fa-heart' };
        labelsHtml = `<div class="post-meta-labels">${post.labels.map(label =>
            `<span class="post-meta-badge" title="ラベル：${label}"><i class="fas ${labelIcons[label] || 'fa-tag'}"></i> ${label}</span>`
        ).join('')}</div>`;
    }

    // 返信ゲート
    let replyGateHtml = '';
    if (post.reply_gate && post.reply_gate.length > 0) {
        const replyGateIcons = { nobody: 'fa-ban', following: 'fa-user-check', mentioned: 'fa-at' };
        replyGateHtml = `<div class="post-meta-reply-gate">${post.reply_gate.map(gate =>
            `<span class="post-meta-badge" title="返信制限：${gate}"><i class="fas ${replyGateIcons[gate] || 'fa-lock'}"></i> ${gate}</span>`
        ).join('')}</div>`;
    }

    // 言語
    let langHtml = '';
    if (post.langs && post.langs.length > 0) {
        const langNames = { ja: '日本語', en: 'English' };
        langHtml = `<div class="post-meta-lang"><span class="post-meta-badge" title="言語"><i class="fas fa-language"></i> ${post.langs.map(l => langNames[l] || l).join(', ')}</span></div>`;
    }

    // エラー表示
    let errorHtml = '';
    if (post.status === 'failed' && post.error_message) {
        const shortError = simplifyErrorMessage(post.error_message);
        errorHtml = `<div class="post-error-message"><i class="fas fa-exclamation-circle"></i> ${escapeHtml(shortError)}</div>`;
    }

  // アカウント名は常に post-account クラスを使用 (text-overflow: ellipsis で表示)
const accountClass = 'post-account';

    let blueskyLinkHtml = '';
    if (isStatusPosted && post.post_uri) {
        const httpsUrl = atUriToHttpsUrl(post.post_uri);
        blueskyLinkHtml = `<a href="${escapeHtml(httpsUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-info bluesky-link-btn" title="Blueskyの投稿ページを開く"><i class="fas fa-external-link-alt"></i><span>Blueskyで開く</span></a>`;
        console.log('Blueskyリンクボタンを生成:', post.post_uri, '->', httpsUrl);
    } else {
        console.log('Blueskyリンクボタン条件不成立:', { isStatusPosted, hasPostUri: !!post.post_uri, status: post.status });
    }

    return $(`<div class="post-card ${isSelected ? 'selected-for-bulk' : ''}" data-status="${post.status}" data-post-id="${post.id}" data-account-username="${post.account}">
        <div class="post-card-main-content">
            <div class="post-header">
                <span class="${accountClass}" data-full-name="${accountFullName}"></span>
                <span class="post-status status-${post.status}">${getStatusIcon(post)}${escapeHtml(statusText)}</span>
                <div class="post-card-selection"><input type="checkbox" class="post-select-checkbox" data-post-id="${post.id}" ${isSelected ? 'checked' : ''} ${checkboxDisabled ? 'disabled' : ''}></div>
            </div>
            ${parentHtml}
            ${errorHtml}
            <div class="post-content${isContentTruncated ? ' ellipsis-animation' : ''}">${truncatedContent}</div>
            ${imagesHtml}
            ${blueskyLinkHtml}
        </div>
        <div class="post-card-meta">
            ${labelsHtml}
            ${replyGateHtml}
            ${langHtml}
        </div>
        <div class="post-card-footer">
            <div class="post-time-row">
                <i class="fas fa-clock"></i> <span>${formatScheduleTime(post.schedule_time)}</span>
            </div>
            <div class="post-actions-row">
                <button class="btn btn-sm btn-primary edit-btn" data-post-id="${post.id}" ${editReplyLocked ? 'disabled' : ''} title="${editTitle}"><i class="fas fa-edit"></i><span>編集</span></button>
                <button class="btn btn-sm btn-outline duplicate-btn" data-post-id="${post.id}" ${duplicateDeleteLocked ? 'disabled' : ''} title="${duplicateTitle}"><i class="fas fa-copy"></i><span>複製</span></button>
                <button class="btn btn-sm btn-danger delete-btn" data-post-id="${post.id}" ${duplicateDeleteLocked ? 'disabled' : ''} title="${deleteTitle}"><i class="fas fa-trash-alt"></i><span>削除</span></button>
                <button class="btn btn-sm btn-outline-info reply-btn" data-post-id="${post.id}" ${editReplyLocked ? 'disabled' : ''} title="${replyTitle}"><i class="fas fa-reply"></i><span>返信</span></button>
            </div>
        </div>
    </div>`)[0];
}

function getStatusIcon(post) {
    if (post.parent_post_id) return `<i class="fas fa-reply" title="返信先 ID: ${post.parent_post_id}"></i> `;
    return '';
}

function getStatusText(status) {
    const map = { 'pending': '予約済み', 'posted': '投稿済み', 'failed': '失敗', 'editing': '編集中', 'unknown': '不明' };
    return map[status] || status;
}

function simplifyErrorMessage(errorMsg) {
    if (!errorMsg) return '';
    
    const lowerMsg = errorMsg.toLowerCase();
    
    if (lowerMsg.includes('rate limit') || lowerMsg.includes('ratelimit') || 
        lowerMsg.includes('429') || lowerMsg.includes('status_code=429')) {
        return 'レート制限 (Rate Limit)';
    }
    
    if (lowerMsg.includes('connection') && lowerMsg.includes('error')) {
        return '接続エラー';
    }
    
    if (lowerMsg.includes('network')) {
        return 'ネットワークエラー';
    }
    
    if (lowerMsg.includes('timeout')) {
        return 'タイムアウト';
    }
    
    if (lowerMsg.includes('authentication') || lowerMsg.includes('auth')) {
        return '認証エラー';
    }
    
    if (lowerMsg.includes('account') && lowerMsg.includes('login') && lowerMsg.includes('failed')) {
        if (lowerMsg.includes('not found')) {
            return 'アカウントが見つかりません';
        }
        if (lowerMsg.includes('password') || lowerMsg.includes('invalid')) {
            return 'ログイン失敗（認証エラー）';
        }
        return 'ログイン失敗';
    }
    
    if (lowerMsg.includes('image') && lowerMsg.includes('not found')) {
        return '画像ファイルが見つかりません';
    }
    
    if (lowerMsg.includes('image') && lowerMsg.includes('upload')) {
        return '画像のアップロードに失敗';
    }
    
    if (lowerMsg.includes('reply') || lowerMsg.includes('返信')) {
        if (lowerMsg.includes('not found')) {
            return '返信先が見つかりません';
        }
        if (lowerMsg.includes('time') || lowerMsg.includes('指定時間')) {
            return '返信先が時間内に投稿されませんでした';
        }
    }
    
    if (errorMsg.includes('Response(')) {
        const statusMatch = errorMsg.match(/status_code=(\d+)/);
        if (statusMatch) {
            const status = statusMatch[1];
            const statusMessages = {
                '400': 'リクエストエラー',
                '401': '認証エラー',
                '403': 'アクセス権限エラー',
                '404': 'リソースが見つかりません',
                '429': 'レート制限',
                '500': 'サーバーエラー',
                '502': 'サーバーエラー',
                '503': 'サービス停止中'
            };
            if (statusMessages[status]) {
                return statusMessages[status];
            }
            return `HTTPエラー ${status}`;
        }
    }
    
    return errorMsg.length > 40 ? errorMsg.substring(0, 40) + '...' : errorMsg;
}

// 委任イベントハンドラ
$(document).on('click', '.edit-btn', function() { loadPostForEdit($(this).data('postId')); });
$(document).on('click', '.duplicate-btn', function() { duplicatePost($(this).data('postId')); });
$(document).on('click', '.delete-btn', function() { handleDeletePost($(this).data('postId')); });
$(document).on('click', '.reply-btn', function() { prepareReplyForm($(this).data('postId')); });
$(document).on('click', '#cancel-reply-btn', cancelReplyForm);
$(document).on('click', '#cancel-edit-btn', async function() {
    const postId = $('#post-form').attr('data-post-id');
    
    if (isDuplicatedPost && sourcePostId) {
        if (await showCustomConfirm('複製をキャンセルしますか？', '複製キャンセル')) {
            deleteDuplicatedPost();
        }
    } else {
        if (await showCustomConfirm('編集をキャンセルしますか？', '編集キャンセル')) {
            if (postId) {
                $.post(`/bluesky/resume_job/${postId}`).catch(() => {});
            }
            cancelEdit();
        }
    }
});
$(document).on('change', '.post-select-checkbox', function() {
    const $cb = $(this), id = $cb.data('postId');
    $cb.closest('.post-card').toggleClass('selected-for-bulk', $cb.is(':checked'));
    AppConfig.selectedPostIdsForBulkAction[$cb.is(':checked') ? 'add' : 'delete'](id);
    updateBulkActionsUI();
});
$(document).on('click', '.highlight-parent-trigger', function(e) {
    e.preventDefault();
    const $card = $(`.post-card[data-post-id="${$(this).data('parentId')}"]`);
    if ($card.length) {
        $card[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        $card.addClass('highlighted-parent');
        setTimeout(() => $card.removeClass('highlighted-parent'), 3000);
    }
});
$(document).on('click', '.post-image-thumb', function() {
    openFullscreenPreview($(this).attr('src'), $(this).data('original-filename') || $(this).data('filename'));
});

async function loadPostForEdit(postId) {
    await window.api.post(`/bluesky/pause_job/${postId}`).catch(() => showNotification('ジョブの一時停止に失敗', 'warning'));
    window.api.get(`/bluesky/get_post/${postId}`).then(function(res) {
        if (res.status !== 'success') return showNotification('投稿データの取得に失敗しました', 'error');
        const post = res.data;
        
        $('#post-form').attr({ 'data-edit-mode': 'true', 'data-post-id': postId });
        switchSection('create');
        $('#post-form')[0].reset();
        $('#post-content').val(post.content || '');
        $('#schedule_time').val(formatUtcToLocal(post.schedule_time) || formatDateTime(new Date()));
        updateSelectedDatetimeDisplay();
        $('#account-select').val(post.account).trigger('change');
        $('#language').val(post.langs?.[0] || 'ja');
        $('input[name="labels"]').prop('checked', false);
        if (post.labels) post.labels.forEach(l => $(`input[name="labels"][value="${l}"]`).prop('checked', true));
        
        // 返信ゲート
        $('input[name="reply_gate"]').prop('checked', false);
        if (post.reply_gate) post.reply_gate.forEach(g => $(`input[name="reply_gate"][value="${g}"]`).prop('checked', true));
        $('#create-section input[name="reply_gate"][value="nobody"]').trigger('change');
        
        $('#disable_quotes').prop('checked', post.disable_quotes || false);

        // 編集モード用の返信ターゲット（内部または外部）を処理
        if (post.parent_post_id || post.external_reply_uri) {
            $('#reply-to-post-id').val(post.parent_post_id || '');
            $('#external-reply-uri').val(post.external_reply_uri || '');
            $('#external-reply-cid').val(post.external_reply_cid || '');
            $('#post-form').attr('data-reply-mode', 'true');
            $('#create-section h2').text(post.is_quote ? '引用を編集' : '返信を編集');
            // 返信/引用であることを示すために返信情報エリアを表示
            $('#reply-info-area').show();
            // 引用モードセレクターを表示し、is_quoteに基づいて設定
            $('#quote-mode-selector').show();
            if (post.is_quote) {
                $('input[name="quote_mode"][value="quote"]').prop('checked', true);
                $('#is_quote').val('1');
            } else {
                $('input[name="quote_mode"][value="reply"]').prop('checked', true);
                $('#is_quote').val('0');
            }
        } else {
            // 以前の返信ターゲットをクリア
            $('#reply-to-post-id').val('');
            $('#external-reply-uri').val('');
            $('#external-reply-cid').val('');
            $('#is_quote').val('0');
            $('#post-form').removeAttr('data-reply-mode');
            $('#reply-info-area').hide();
            $('#quote-mode-selector').hide();
        }

        // 画像
        AppConfig.uploadedImages = [];
        if (post.image_data) {
            post.image_data.forEach(img => AppConfig.uploadedImages.push({
                id: window.generateUniqueId(), file: null, url: `/static/images/${img.filename}`,
                name: img.original_filename || img.filename, size: img.size || 0, serverFilename: img.filename,
                alt: img.alt_text || '',
                originalSize: img.original_size || img.size  // Add original size for optimization UI
            }));
        }
        rerenderImages(); updateFileInputFromArray(); updateImageControls();
        
        const $form = $('#post-form');
        $('button[type="submit"]', $form).html('<i class="fas fa-save"></i> 更新');
        $('#cancel-edit-btn').show();
        updateEditButton();
        if (isDuplicatedPost) {
            showNotification('複製した投稿を編集しています', 'info');
        } else {
            showNotification('編集モードに切り替えました', 'info');
        }
        updateSubmitButtonState();
    }).fail(() => showNotification('投稿の読み込みに失敗しました', 'error'));
}

async function handleDeletePost(postId) {
    if (await showCustomConfirm(`投稿 ID: ${postId} を削除しますか？`, '投稿削除')) {
        window.api.post(`/bluesky/delete_scheduled_post/${postId}`).then(function(res) {
            if (res.status === 'success') {
                showNotification('投稿を削除しました', 'success');
                loadPostsList(false, true);
            } else {
                showNotification(res.message || '投稿の削除に失敗しました', 'error');
            }
        }).fail(() => showNotification('投稿の削除に失敗しました', 'error'));
    }
}

function updateEditButton() {
    const $btn = $('#cancel-edit-btn');
    if (isDuplicatedPost && sourcePostId) {
        $btn.removeClass('btn-warning').addClass('btn-danger');
        $btn.html('<i class="fas fa-trash-alt"></i> 複製を削除');
    } else {
        $btn.removeClass('btn-danger').addClass('btn-warning');
        $btn.html('<i class="fas fa-times-circle"></i> 編集をキャンセル');
    }
}

// updateEditButton をグローバルに公開
window.updateEditButton = updateEditButton;

function deleteDuplicatedPost(skipNotification = false) {
    // 複製モードではDBに投稿が存在しないため、フロントエンドのみでリセット
    isDuplicatedPost = false;
    sourcePostId = null;
    AppConfig.uploadedImages = [];
    $('#cancel-edit-btn').removeClass('btn-danger').addClass('btn-warning')
        .html('<i class="fas fa-times-circle"></i> 編集をキャンセル');
    resetForm();
    switchSection('posts', true); // skipConfirm=true で二重ダイアログ防止
    if (!skipNotification) {
        showNotification('複製をキャンセルしました', 'info');
    }
}

async function duplicatePost(postId) {
    window.api.post(`/bluesky/duplicate_post/${postId}`).then(function(res) {
        if (res.status !== 'success') {
            return showNotification('複製に失敗しました: ' + (res.message || '不明なエラー'), 'error');
        }
        
        const sourcePost = res.data;
        
        isDuplicatedPost = true;
        sourcePostId = postId;
        
        if (sourcePost.account) {
            $('#account-select').val(sourcePost.account).trigger('change');
        }
        $('#post-content').val(sourcePost.content || '');
        $('#language').val(sourcePost.langs?.[0] || 'ja');
        
        if (sourcePost.schedule_time) {
            $('#schedule_time').val(formatUtcToLocal(sourcePost.schedule_time) || formatDateTime(new Date()));
            updateSelectedDatetimeDisplay();
        }
        
        AppConfig.uploadedImages = [];
        if (sourcePost.image_data && sourcePost.image_data.length > 0) {
            fetch('/bluesky/settings', {headers: window.Auth.apiHeaders()})
                .then(res => res.json())
                .then(settingsData => {
                    const shouldDuplicateImages = settingsData.data.duplicate_images !== false;
                    if (shouldDuplicateImages) {
                        sourcePost.image_data.forEach(img => {
                            AppConfig.uploadedImages.push({
                                id: window.generateUniqueId(),
                                file: null,
                                url: `/static/images/${img.filename}`,
                                name: img.name || img.filename,
                                size: img.size || 0,
                                serverFilename: img.filename,
                                alt: img.alt_text || '',
                                sourceFilename: img.filename,
                                originalSize: img.original_size || img.size
                            });
                        });
                    } else {
                        showNotification('画像の複製が無効に設定されています', 'info');
                    }
                    rerenderImages();
                    updateImageControls();
                });
        } else {
            rerenderImages();
            updateImageControls();
        }
        
        // ラベル
        if (sourcePost.labels && Array.isArray(sourcePost.labels)) {
            $('input[name="labels"]').prop('checked', false);
            sourcePost.labels.forEach(label => {
                $(`input[name="labels"][value="${label}"]`).prop('checked', true);
            });
        }
        
        // 返信ゲート
        $('input[name="reply_gate"]').prop('checked', false);
        if (sourcePost.reply_gate && Array.isArray(sourcePost.reply_gate)) {
            sourcePost.reply_gate.forEach(g => {
                $(`input[name="reply_gate"][value="${g}"]`).prop('checked', true);
            });
        }
        
        // 引用を無効化
        $('#disable_quotes').prop('checked', sourcePost.disable_quotes || false);
        
        // 引用/Replied投稿情報
        if (sourcePost.parent_post_id || sourcePost.external_reply_uri) {
            $('#reply-to-post-id').val(sourcePost.parent_post_id || '');
            $('#external-reply-uri').val(sourcePost.external_reply_uri || '');
            $('#external-reply-cid').val(sourcePost.external_reply_cid || '');
            $('#is_quote').val(sourcePost.is_quote ? '1' : '0');
            $('#reply-info-area').show();
            $('#quote-mode-selector').show();
            if (sourcePost.is_quote) {
                $('input[name="quote_mode"][value="quote"]').prop('checked', true);
            } else {
                $('input[name="quote_mode"][value="reply"]').prop('checked', true);
            }
        } else {
            $('#reply-to-post-id').val('');
            $('#external-reply-uri').val('');
            $('#external-reply-cid').val('');
            $('#is_quote').val('0');
            $('#reply-info-area').hide();
            $('#quote-mode-selector').hide();
        }
        
        // UI更新
        rerenderImages();
        updateFileInputFromArray();
        updateImageControls();
        
        $('#post-form').removeAttr('data-edit-mode');
        $('#post-form').removeAttr('data-post-id');
        $('button[type="submit"]', $('#post-form')).html('<i class="fas fa-calendar-plus"></i> 投稿を予約');
        $('#cancel-edit-btn').removeClass('btn-danger').addClass('btn-warning')
            .html('<i class="fas fa-trash-alt"></i> 複製を削除').show();
        
        switchSection('create');
        updateSelectedDatetimeDisplay();
        showNotification('投稿を複製しました。内容を確認して予約してください。', 'success');
    }).fail(() => showNotification('複製に失敗しました', 'error'));
}

function prepareReplyForm(parentPostId) {
    window.api.get(`/bluesky/get_post/${parentPostId}`).then(function(res) {
        if (res.status !== 'success') return showNotification('返信先の取得に失敗', 'error');
        const parent = res.data;
        switchSection('create');
        $('#reply-to-post-id').val(parentPostId);
        $('#post-form').attr('data-reply-mode', 'true');
        $('#reply-to-parent-account').text(parent.account || '(不明)');
        $('#reply-to-content-preview').text(parent.content ? (parent.content.length > 100 ? parent.content.substring(0, 100) + '...' : parent.content) : '(本文なし)');
        $('#reply-info-area').show();
        $('#create-section h2').text('返信を作成');
        if (parent.schedule_time) $('#schedule_time').val(formatUtcToLocal(parent.schedule_time));
        updateSelectedDatetimeDisplay();
        if (parent.account) $('#account-select').val(parent.account).trigger('change');
    });
}

function cancelReplyForm() {
    $('#reply-to-post-id').val('');
    $('#external-reply-uri').val('');
    $('#external-reply-cid').val('');
    $('#is_quote').val('0');
    $('#reply-info-area').hide();
    $('#reply-to-parent-account').text('');
    $('#reply-to-content-preview').text('');
    $('#reply-to-parent-image-preview').empty();
$('#post-form').removeAttr('data-reply-mode');
    $('#quote-mode-selector').hide();
    $('#create-section h2').text('新規投稿作成');
    resetForm(false);
}

// 一括アクションイベントハンドラ
$(document).on('click', '#select-all-posts-btn', function() {
    $('.post-select-checkbox:not(:disabled)').not(':checked').prop('checked', true).trigger('change');
});
$(document).on('click', '#deselect-all-posts-btn', function() {
    $('.post-select-checkbox:not(:disabled)').filter(':checked').prop('checked', false).trigger('change');
});
$(document).on('click', '#delete-selected-btn', async function() {
    const ids = Array.from(AppConfig.selectedPostIdsForBulkAction);
    if (!ids.length) return showNotification('削除する投稿が選択されていません。', 'warning');
    if (await showCustomConfirm(`${ids.length}件の投稿を削除しますか？`, '一括削除確認')) {
        window.api.postJSON('/bluesky/delete_selected_posts', { post_ids: ids })
            .then((data) => {
                showNotification(data.message, 'success');
                AppConfig.selectedPostIdsForBulkAction.clear();
                loadPostsList(false, true);
            })
            .fail(() => showNotification('一括削除に失敗しました', 'error'));
    }
});

function applyFilters() {
    $('.post-card').each(function() {
        const $card = $(this);
        const status = $card.data('status');
        const account = $card.data('account-username'); // Use data attribute instead of displayed text
        const content = $card.find('.post-content p').text().toLowerCase();

        const matchStatus = AppConfig.currentStatusFilter === 'all' || status === AppConfig.currentStatusFilter;
        const matchAccount = AppConfig.currentAccountFilter === 'all' || account === AppConfig.currentAccountFilter;
        const matchSearch = !AppConfig.currentSearchTerm || content.includes(AppConfig.currentSearchTerm);

        $card.toggle(matchStatus && matchAccount && matchSearch);
    });
}

function initializeFilters() {
    $('#account-filter-select').html('<option value="all">すべてのアカウント</option>' + 
        Object.keys(AppConfig.accountsData).map(u => {
            const acc = AppConfig.accountsData[u];
            const display = acc.display_name ? escapeHtml(acc.display_name) + ' (@' + escapeHtml(u) + ')' : '@' + escapeHtml(u);
            return `<option value="${escapeHtml(u)}">${display}</option>`;
        }).join(''))
        .on('change', function() { AppConfig.currentAccountFilter = this.value; applyFilters(); });
    
    $('#search-input').on('input', function() { AppConfig.currentSearchTerm = this.value.toLowerCase(); applyFilters(); });
    
    $('#sort-select').on('change', function() {
        const [sortBy, sortOrder] = this.value.split('-');
        AppConfig.currentSortBy = sortBy;
        AppConfig.currentSortOrder = sortOrder;
        loadPostsList(false, true);
    });
    
    $('.btn-filter').on('click', function() {
        $('.btn-filter').removeClass('active');
        $(this).addClass('active');
        AppConfig.currentStatusFilter = $(this).data('status-filter');
        applyFilters();
    });
}

function initAccountMarquee() {
    const zeroWidthElements = [];
    document.querySelectorAll('.post-account').forEach(el => {
        const fullName = el.getAttribute('data-full-name') || '';
        const containerWidth = el.offsetWidth;
        if (containerWidth === 0) {
            zeroWidthElements.push(el);
            return;
        }
        const tempSpan = document.createElement('span');
        tempSpan.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-weight:600;font-size:inherit;font-family:inherit;';
        tempSpan.textContent = fullName;
        document.body.appendChild(tempSpan);
        const textWidth = tempSpan.offsetWidth;
        document.body.removeChild(tempSpan);
        if (textWidth > containerWidth) {
            el.classList.add('marquee-active');
        } else {
            el.classList.remove('marquee-active');
        }
    });
    if (zeroWidthElements.length > 0) {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                zeroWidthElements.forEach(el => {
                    const fullName = el.getAttribute('data-full-name') || '';
                    const containerWidth = el.offsetWidth;
                    if (containerWidth === 0) return;
                    const tempSpan = document.createElement('span');
                    tempSpan.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-weight:600;font-size:inherit;font-family:inherit;';
                    tempSpan.textContent = fullName;
                    document.body.appendChild(tempSpan);
                    const textWidth = tempSpan.offsetWidth;
                    document.body.removeChild(tempSpan);
                    if (textWidth > containerWidth) {
                        el.classList.add('marquee-active');
                    } else {
                        el.classList.remove('marquee-active');
                    }
                });
            });
        });
    }
}

let resizeMarqueeTimer = null;
function onWindowResize() {
    if (resizeMarqueeTimer) clearTimeout(resizeMarqueeTimer);
    resizeMarqueeTimer = setTimeout(() => {
        requestAnimationFrame(() => {
            if (document.querySelector('.post-account')) {
                initAccountMarquee();
            }
        });
    }, 200);
}

if (!window._marqueeResizeBound) {
    window.addEventListener('resize', onWindowResize);
    window._marqueeResizeBound = true;
}