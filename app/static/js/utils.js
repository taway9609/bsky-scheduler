// js/utils.js - Common utility functions for the application

// Debug logger — only outputs when IS_DEV is true (app-dev only)
window.debugLog = function(...args) {
    if (window.IS_DEV) {
        console.log(...args);
    }
};

// Format date time to string (YYYY-MM-DDTHH:MM for datetime-local input)
window.formatDateTime = function(date) {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Format date time for display (YYYY/MM/DD HH:MM)
window.formatDateTimeDisplay = function(date) {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}`;
};

// Format timezone-aware ISO string for input field (preserves wall-clock time)
window.formatScheduleTimeForInput = function(isoString) {
    if (!isoString) return '';
    // Extract date-time part before timezone
    const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (match) {
        const [, year, month, day, hours, minutes] = match;
        // Create date in local timezone
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
        const localYear = date.getFullYear();
        const localMonth = String(date.getMonth() + 1).padStart(2, '0');
        const localDay = String(date.getDate()).padStart(2, '0');
        const localHours = String(date.getHours()).padStart(2, '0');
        const localMinutes = String(date.getMinutes()).padStart(2, '0');
        return `${localYear}-${localMonth}-${localDay}T${localHours}:${localMinutes}`;
    }
    // Fallback: try native parsing
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${min}`;
};

// Format UTC time to local time (deprecated - use formatScheduleTimeForInput)
window.formatUtcToLocal = function(utcString) {
    if (!utcString) return '';
    return formatScheduleTimeForInput(utcString);
};

// Format schedule time for display
window.formatScheduleTime = function(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localDateStr = date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    });
    return localDateStr;
};

// Format file size to human readable format
window.formatFileSize = function(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Escape HTML special characters
window.escapeHtml = function(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe
        .replace(/&/g, '&')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/"/g, '"')
        .replace(/'/g, '&#039;');
};

// Extract hashtags from text
window.extractHashtags = function(text) {
    if (!text) return [];
    const regex = /[#＆]([a-zA-Z0-9_\-\u3041-\u3096\u30A1-\u30FA\u30FC\u4E00-\u9FFF]+)/g;
    const hashtags = new Set();
    let matches;
    while ((matches = regex.exec(text)) !== null) {
        hashtags.add(matches[1]);
    }
    return Array.from(hashtags);
};

// Generate a unique ID
window.generateUniqueId = function() {
    return 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Update selected datetime display
window.updateSelectedDatetimeDisplay = function() {
    console.log('updateSelectedDatetimeDisplay called, value:', $('#schedule_time').val());
    const $input = $('#schedule_time');
    const value = $input.val();
    if (value) {
        // Parse as local time (not UTC) to preserve wall-clock time
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
        if (match) {
            const [, year, month, day, hours, minutes] = match;
            console.log('Parsed values:', {year, month, day, hours, minutes});
            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
            console.log('Created date:', date);
            const display = formatDateTimeDisplay(date);
            console.log('Display text:', display);
            $('#selected-datetime-text').text(display);
        } else {
            // Fallback to original behavior
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                const display = formatDateTimeDisplay(date);
                $('#selected-datetime-text').text(display);
            }
        }
    }
};

// Highlight preset button
window.highlightPresetButton = function(type, value) {
    if (type === 'time') {
        $('.preset-time-btn').removeClass('active');
        $(`.preset-time-btn[onclick*="setScheduleTime('${value}')"]`).addClass('active');
        setTimeout(() => {
            $('.preset-time-btn').removeClass('active');
        }, 1000);
    } else if (type === 'day') {
        $('.preset-day-btn').removeClass('active');
        $(`.preset-day-btn[onclick="setScheduleDay(${value})"]`).addClass('active');
        setTimeout(() => {
            $('.preset-day-btn').removeClass('active');
        }, 1000);
    }
};

// Set schedule time
window.setScheduleTime = function(time) {
  const $scheduleInput = $('#schedule_time');
  const currentValue = $scheduleInput.val();
  const now = new Date();
  let baseDate;
  
  if (currentValue) {
    // Parse the current value as local time
    const [datePart] = currentValue.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    // Month is 0-indexed in JavaScript
    baseDate = new Date(year, month - 1, day, hours, minutes);
  } else {
    const [hours, minutes] = time.split(':').map(Number);
    baseDate = new Date();
    baseDate.setHours(hours, minutes, 0);
  }
  
  // If the resulting time is in the past, add 1 day
  if (baseDate.getTime() < now.getTime()) {
    baseDate.setDate(baseDate.getDate() + 1);
  }
  
  $scheduleInput.val(formatDateTime(baseDate));
  updateSelectedDatetimeDisplay();
  highlightPresetButton('time', time);
};

// Set schedule day
window.setScheduleDay = function(dayOffset) {
  const $scheduleInput = $('#schedule_time');
  const currentValue = $scheduleInput.val();
  console.log('DEBUG: setScheduleDay called with dayOffset:', dayOffset, 'currentValue:', currentValue);
  
  if (dayOffset === 0) {
    const now = new Date();
    console.log('DEBUG: dayOffset is 0, setting to now:', now);
    $scheduleInput.val(formatDateTime(now));
    updateSelectedDatetimeDisplay();
    highlightPresetButton('day', 0);
    return;
  }
  
  let baseDate;
  if (currentValue) {
    // Parse the current value as local time
    const parts = currentValue.split('T');
    const datePart = parts[0];
    const timePart = parts[1] || '00:00';
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    console.log('DEBUG: Parsed date - year:', year, 'month:', month, 'day:', day, 'hours:', hours, 'minutes:', minutes);
    // Month is 0-indexed in JavaScript
    baseDate = new Date(year, month - 1, day, hours || 0, minutes || 0, 0);
    console.log('DEBUG: Created baseDate:', baseDate);
  } else {
    baseDate = new Date();
    console.log('DEBUG: No current value, using now:', baseDate);
  }
  
  // Add the day offset
  console.log('DEBUG: Before adding offset - getDate():', baseDate.getDate());
  baseDate.setDate(baseDate.getDate() + dayOffset);
  console.log('DEBUG: After adding offset - getDate():', baseDate.getDate());
  
  $scheduleInput.val(formatDateTime(baseDate));
  updateSelectedDatetimeDisplay();
  highlightPresetButton('day', dayOffset);
};

// Auto-update timer
window.autoUpdateTimer = null;

// Start auto-update timer
window.startAutoUpdate = function() {
    window.stopAutoUpdate();
    window.autoUpdateTimer = setInterval(function() {
        if ($('#posts-section').hasClass('active')) {
            loadPostsList(false, true);
        }
    }, 60000);
};

// Stop auto-update timer
window.stopAutoUpdate = function() {
    if (window.autoUpdateTimer) {
        clearInterval(window.autoUpdateTimer);
        window.autoUpdateTimer = null;
    }
};

// ============================================================
// Bluesky-specific utilities (merged from js/bluesky/utils.js)
// ============================================================

// Constants
const SWIPE_THRESHOLD = 50;

// Touch handling variables
let touchElement = null;
let touchStartX = 0;
let touchStartY = 0;

// Show notification message (Gradio-style toast)
window.showNotification = function(message, type = 'info') {
    const $toast = $(`
        <div class="toast-notification toast-${type}">
            <div class="toast-icon">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'circle-xmark' : type === 'warning' ? 'triangle-exclamation' : 'circle-info'}"></i>
            </div>
            <div class="toast-content">${message}</div>
            <button class="toast-close" aria-label="閉じる">
                <i class="fas fa-xmark"></i>
            </button>
        </div>
    `);

    // Ensure container exists
    if ($('#toast-container').length === 0) {
        $('body').append('<div id="toast-container"></div>');
    }

    $('#toast-container').append($toast);

    // Trigger animation
    requestAnimationFrame(() => {
        $toast.addClass('toast-show');
    });

    // Auto remove after 5 seconds
    const autoRemove = setTimeout(() => {
        $toast.removeClass('toast-show').addClass('toast-hide');
        setTimeout(() => $toast.remove(), 300);
    }, 5000);

    // Close button handler
    $toast.find('.toast-close').on('click', () => {
        clearTimeout(autoRemove);
        $toast.removeClass('toast-show').addClass('toast-hide');
        setTimeout(() => $toast.remove(), 300);
    });
};

// Show custom confirmation dialog
window.showCustomConfirm = async function(message, title = '確認') {
    const $modal = $('#custom-confirm-modal');
    const $title = $('#custom-confirm-title');
    const $message = $('#custom-confirm-message');
    const $cancelBtn = $('#custom-confirm-cancel-btn');
    const $okBtn = $('#custom-confirm-ok-btn');
    const $closeBtn = $('#custom-confirm-close-btn');

    // Set title and message
    if ($title.length) $title.text(title);
    if ($message.length) $message.text(message);

    // Remove old handlers
    $modal.off('click.custom-confirm');
    $cancelBtn.off('click.custom-confirm');
    $okBtn.off('click.custom-confirm');
    $closeBtn.off('click.custom-confirm');
    $(document).off('keydown.custom-confirm');

    return new Promise((resolve) => {
        function close(result) {
            $modal.removeClass('active');
            $(document).off('keydown.custom-confirm');
            resolve(result);
        }

        $cancelBtn.on('click.custom-confirm', () => close(false));
        $okBtn.on('click.custom-confirm', () => close(true));
        $closeBtn.on('click.custom-confirm', () => close(false));
        $modal.on('click.custom-confirm', function(e) {
            if (e.target === this) close(false);
        });
        $(document).on('keydown.custom-confirm', function(e) {
            if (e.key === 'Escape') close(false);
        });

        $modal.addClass('active');
    });
};

// Initialize image upload
window.initializeImageUpload = function() {
    const $fileUploadArea = $('#file-upload-area');
    const $fileInput = $('#images');

    $fileUploadArea.on('click', function() {
        $fileInput.click();
    });

    $fileInput.on('change', function(e) {
        window.debugLog('DEBUG: File input change detected', e.target.files);
        const files = e.target.files;
        if (!files || files.length === 0) {
            window.debugLog('DEBUG: No files selected');
            return;
        }

        if (AppConfig.uploadedImages.length + files.length > 4) {
            window.debugLog('DEBUG: Image limit exceeded (current:', AppConfig.uploadedImages.length, ', new:', files.length, ')');
            showNotification('画像は最大 4 枚までアップロードできます', 'warning');
            return;
        }

        window.debugLog('DEBUG: Processing', files.length, 'file(s)');

        Array.from(files).forEach(async (file) => {
            window.debugLog('DEBUG: Processing file:', file.name, 'size:', file.size);

            if (AppConfig.uploadedImages.some(img => img.file === file)) {
                window.debugLog('DEBUG: File already exists, skipping:', file.name);
                return;
            }

            try {
                const img = {
                    id: window.generateUniqueId(),
                    file: file,
                    url: URL.createObjectURL(file),
                    name: file.name,
                    size: file.size,
                    serverFilename: '',
                    alt: '',
                    originalSize: file.size,
                    isUploading: true
                };

                AppConfig.uploadedImages.push(img);
                rerenderImages();

                const formData = new FormData();
                formData.append('image', file);

                const uploadStart = performance.now();
                const response = await fetch('/bluesky/upload_image', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
                const uploadTime = (performance.now() - uploadStart).toFixed(1);

                if (window.API_DEBUG) {
                    console.group(`%c[API upload] POST /bluesky/upload_image ${response.ok ? '✓' : '✗'} ${response.status} (${uploadTime}ms)`, `color: ${response.ok ? '#22c55e' : '#ef4444'}; font-weight: bold`);
                    console.log('  File:', file.name, (file.size / 1024).toFixed(1) + 'KB');
                    console.log('  Status:', response.status, response.statusText);
                    console.log('  Time:', uploadTime + 'ms');
                    console.groupEnd();
                }

                if (!response.ok) {
                    throw new Error(`Upload failed: ${response.status}`);
                }

                const result = await response.json();

                if (result.status === 'success') {
                    const imgIndex = AppConfig.uploadedImages.findIndex(i => i.id === img.id);
                    if (imgIndex !== -1) {
                        AppConfig.uploadedImages[imgIndex] = {
                            ...AppConfig.uploadedImages[imgIndex],
                            url: result.url,
                            filename: result.filename,
                            serverFilename: result.filename,
                            size: result.size,
                            originalSize: result.original_size,
                            isUploading: false
                        };
                    }
                } else {
                    throw new Error(result.message || 'Upload failed');
                }

            } catch (error) {
                console.error('Image upload failed:', error);
                showNotification(`画像のアップロードに失敗しました：${error.message}`, 'error');
                AppConfig.uploadedImages = AppConfig.uploadedImages.filter(img => img.file !== file);
            } finally {
                rerenderImages();
                updateImageControls();

                $fileInput.val('');
            }
        });

        $fileInput.val('');
    });

    const $imagePreviewContainer = $('#image-preview-container');

    // Prevent default drag behavior on the whole page
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        document.body.addEventListener(eventName, function(e) {
            e.preventDefault();
            e.stopPropagation();
        }, false);
    });

    $fileUploadArea[0]?.addEventListener('dragenter', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $fileUploadArea.addClass('drag-over');
    });

    $fileUploadArea[0]?.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $fileUploadArea.addClass('drag-over');
    });

    $fileUploadArea[0]?.addEventListener('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $fileUploadArea.removeClass('drag-over');
    });

    $fileUploadArea[0]?.addEventListener('drop', function(e) {
        window.debugLog('DEBUG: Drag and drop event triggered');
        e.preventDefault();
        e.stopPropagation();
        $fileUploadArea.removeClass('drag-over');

        const files = e.dataTransfer.files;
        if (!files || files.length === 0) {
            window.debugLog('DEBUG: No files in drag and drop');
            return;
        }

        window.debugLog('DEBUG: Drag and drop files:', files.length);

        if (AppConfig.uploadedImages.length + files.length > 4) {
            window.debugLog('DEBUG: Image limit exceeded in drag and drop');
            showNotification('画像は最大 4 枚までアップロードできます', 'warning');
            return;
        }

        Array.from(files).forEach(async (file) => {
            window.debugLog('DEBUG: Processing drag and drop file:', file.name, 'size:', file.size);

            if (AppConfig.uploadedImages.some(img => img.file === file)) {
                window.debugLog('DEBUG: Drag and drop file already exists, skipping:', file.name);
                return;
            }

            try {
                window.debugLog('DEBUG: Creating image object for file:', file.name);
                const img = {
                    id: window.generateUniqueId(),
                    file: file,
                    url: URL.createObjectURL(file),
                    name: file.name,
                    size: file.size,
                    serverFilename: '',
                    alt: '',
                    originalSize: file.size,
                    isUploading: true
                };

                window.debugLog('DEBUG: Image object created with ID:', img.id);
                AppConfig.uploadedImages.push(img);
                window.debugLog('DEBUG: Added image to uploadedImages array, total:', AppConfig.uploadedImages.length);
                rerenderImages();

                window.debugLog('DEBUG: Preparing FormData for upload to /bluesky/upload_image');
                const formData = new FormData();
                formData.append('image', file);

                window.debugLog('DEBUG: Sending POST request to /bluesky/upload_image');
                const uploadStart = performance.now();
                const response = await fetch('/bluesky/upload_image', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
                const uploadTime = (performance.now() - uploadStart).toFixed(1);

                if (window.API_DEBUG) {
                    console.group(`%c[API upload] POST /bluesky/upload_image ${response.ok ? '✓' : '✗'} ${response.status} (${uploadTime}ms)`, `color: ${response.ok ? '#22c55e' : '#ef4444'}; font-weight: bold`);
                    console.log('  File:', file.name, (file.size / 1024).toFixed(1) + 'KB');
                    console.log('  Status:', response.status, response.statusText);
                    console.log('  Time:', uploadTime + 'ms');
                    console.groupEnd();
                }

                window.debugLog('DEBUG: Response received, status:', response.status);
                if (!response.ok) {
                    throw new Error(`Upload failed: ${response.status}`);
                }

                const result = await response.json();
                window.debugLog('DEBUG: Response JSON:', result);

                if (result.status === 'success') {
                    window.debugLog('DEBUG: Upload successful, updating image object');
                    const imgIndex = AppConfig.uploadedImages.findIndex(i => i.id === img.id);
                    if (imgIndex !== -1) {
                        AppConfig.uploadedImages[imgIndex] = {
                            ...AppConfig.uploadedImages[imgIndex],
                            url: result.url,
                            filename: result.filename,
                            serverFilename: result.filename,
                            size: result.size,
                            originalSize: result.original_size,
                            isUploading: false
                        };
                        window.debugLog('DEBUG: Image object updated with server data');
                    }
                } else {
                    console.error('DEBUG: Upload failed with message:', result.message);
                    throw new Error(result.message || 'Upload failed');
                }

            } catch (error) {
                console.error('DEBUG: Image upload failed:', error);
                showNotification(`画像のアップロードに失敗しました：${error.message}`, 'error');
                AppConfig.uploadedImages = AppConfig.uploadedImages.filter(img => img.file !== file);
                window.debugLog('DEBUG: Failed image removed from uploadedImages');
            } finally {
                window.debugLog('DEBUG: Updating UI after upload attempt');
                rerenderImages();
                updateImageControls();
            }
        });
    });

    $('#add-more-images').on('click', function() {
        $fileInput.click();
    });

    $('#clear-all-images').on('click', function() {
        AppConfig.uploadedImages = [];
        rerenderImages();
        updateFileInputFromArray();
        updateImageControls();
        $(this).hide();
    });
};

// Handle touch events for swipe-to-dismiss
window.handleTouchStart = function(e) {
    const touch = e.touches[0];
    touchElement = e.target.closest('[data-swipe-dismiss]');
    if (!touchElement) return;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
};

window.handleTouchMove = function(e) {
    if (!touchElement) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - touchStartX;
    const diffY = touch.clientY - touchStartY;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) < SWIPE_THRESHOLD * 2) {
        e.preventDefault();
        touchElement.style.transform = `translateX(${diffX}px)`;
        touchElement.style.opacity = 1 - (Math.abs(diffX) / SWIPE_THRESHOLD) * 0.5;
    }
};

window.handleTouchEnd = function(e) {
    if (!touchElement) return;
    const touch = e.changedTouches[0];
    const diffX = touch.clientX - touchStartX;

    if (Math.abs(diffX) > SWIPE_THRESHOLD) {
        touchElement.classList.add('swiping-left');
        touchElement.style.transform = 'translateX(-100%)';
        setTimeout(() => touchElement.remove(), 200);
    } else {
        touchElement.style.transform = '';
        touchElement.style.opacity = '';
    }
    touchElement = null;
};

// Account management functions
window.showAddAccountModal = function() {
    $('#add-account-modal').addClass('active');
    $('body').css('overflow', 'hidden');
};

window.closeAddAccountModal = function() {
    $('#add-account-modal').removeClass('active');
    $('body').css('overflow', '');
    $('#add-account-form')[0].reset();
};

window.handleConfirmDeleteAccount = async function(did) {
    if (await showCustomConfirm(`アカウント「${did}」を削除しますか？`, 'アカウント削除')) {
        window.api.post(`/bluesky/remove_account/${did}`)
            .then(function(res) {
                showNotification(res.message, 'success');
                updateAccountList(res.accounts);
            })
            .catch(function() {
                updateAccountList();
            })
            .fail(() => showNotification('アカウント削除に失敗しました', 'error'));
    }
};

window.showEditAccountModal = function() {
    $('#edit-account-modal').addClass('active');
    $('body').css('overflow', 'hidden');
};

window.closeEditAccountModal = function() {
    $('#edit-account-modal').removeClass('active');
    $('body').css('overflow', '');
    $('#edit-account-form')[0].reset();
};

window.editSelectedAccount = function(usernameToEdit) {
    if (!usernameToEdit) {
        return showNotification('編集するアカウントが指定されていません', 'error');
    }
    const accountData = window.accountsData[usernameToEdit];
    if (!accountData) return;
    $('#edit-account-username-display').val(usernameToEdit);
    $('#edit-account-did').val(accountData.did);
    showEditAccountModal();
};

window.submitEditAccount = function(event) {
    event.preventDefault();
    const $form = $('#edit-account-form');
    const identifier = $form.find('[name="identifier"]').val().trim();
    const password = $form.find('[name="password"]').val();

    if (!identifier || !password) {
        return showNotification('すべてのフィールドを入力してください', 'error');
    }

    const $btn = $form.find('button[type="submit"]').prop('disabled', true);
    const original = $btn.html();
    $btn.html('<i class="fas fa-spinner fa-spin"></i> 更新中...');

    window.api.postJSON('/bluesky/edit_account', { identifier, password })
        .then(function(data) {
            showNotification(data.message || (data.status === 'success' ? 'アカウントが更新されました' : 'アカウントの更新に失敗しました'), data.status);
            closeEditAccountModal();
            updateAccountList(data.accounts);
        })
        .fail(function(xhr) {
            showNotification(xhr.responseJSON?.message || 'アカウント更新中にエラーが発生しました', 'error');
        })
        .always(function() {
            $btn.prop('disabled', false).html(original);
        });
};

window.syncAccount = function(did, btnElement) {
    const $btn = $(btnElement);
    const original = $btn.html();
    $btn.prop('disabled', true).html('<i class="fas fa-spinner fa-spin"></i> 更新中...');

    window.api.post(`/bluesky/sync_account/${did}`)
        .then(function(data) {
            showNotification(data.message, 'success');
            updateAccountList(data.accounts);
        })
        .catch(function(data) {
            showNotification(data.message || '更新に失敗しました', 'error');
        })
        .fail(function(xhr) {
            showNotification(xhr.responseJSON?.message || '更新リクエストに失敗しました', 'error');
        })
        .always(function() {
            $btn.prop('disabled', false).html(original);
        });
};

// Preset times functions - delegated to presets.js
// Do not redefine these here; presets.js handles them properly
