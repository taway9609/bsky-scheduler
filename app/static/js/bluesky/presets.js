// js/presets.js - プリセット時間管理

// デフォルトのプリセット時間
const DEFAULT_PRESET_TIMES = ['07:00', '10:00', '12:00', '15:00', '18:00', '21:00'];
const STORAGE_KEY = 'bluesky_preset_times';
window.MAX_PRESET_TIMES = 6;

// プリセット時間を取得
function getPresetTimes() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (e) {
        console.error('Error loading preset times:', e);
    }
    return [...DEFAULT_PRESET_TIMES];
}

// プリセット時間を保存
function savePresetTimes(times) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(times));
        return true;
    } catch (e) {
        console.error('Error saving preset times:', e);
        return false;
    }
}

// プリセット時間ボタンを動的に生成（投稿作成画面用）
function renderPresetTimeButtons() {
    const presetTimes = getPresetTimes();
    const $container = $('#preset-time-buttons');
    
    if (!$container.length) return;
    
    $container.empty();
    
    const icons = {
        '07:00': 'fa-sun',
        '10:00': '',
        '12:00': 'fa-utensils',
        '15:00': '',
        '18:00': 'fa-cloud-sun',
        '21:00': 'fa-moon'
    };
    
    const titles = {
        '07:00': '朝 7:00',
        '10:00': '午前 10:00',
        '12:00': '昼 12:00',
        '15:00': '午後 3:00',
        '18:00': '夕方 6:00',
        '21:00': '夜 9:00'
    };
    
    presetTimes.forEach(time => {
        const icon = icons[time] || '';
        const title = titles[time] || time;
        const iconHtml = icon ? `<i class="fas ${icon}"></i> ` : '';
        
        const $btn = $(`
            <button type="button" class="btn btn-sm btn-outline-secondary preset-time-btn" 
                    onclick="setScheduleTime('${time}')" 
                    title="${title}">
                ${iconHtml}${time}
            </button>
        `);
        $container.append($btn);
    });
}

// プリセット時間入力フォームを生成（設定画面用）
function renderPresetTimeInputs() {
    const presetTimes = getPresetTimes();
    const $container = $('#preset-times-inputs');
    
    if (!$container.length) return;
    
    $container.empty();
    
    presetTimes.forEach((time, index) => {
        const $inputGroup = $(`
            <div class="preset-time-input-group">
                <input type="time" class="form-control preset-time-input" value="${time}" 
                       data-index="${index}">
                <button type="button" class="btn btn-sm btn-outline-danger remove-preset-btn" 
                        onclick="removePresetTimeInput(${index})" 
                        title="削除">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `);
        $container.append($inputGroup);
    });
    
    updateAddButtonState();
}

// プリセット時間入力を追加
function addPresetTimeInput() {
    const presetTimes = getPresetTimes();
    if (presetTimes.length >= window.MAX_PRESET_TIMES) {
        showNotification(`プリセット時間は最大${window.MAX_PRESET_TIMES}つまでです`, 'warning');
        return;
    }
    
    const $container = $('#preset-times-inputs');
    const index = presetTimes.length;
    
    const $inputGroup = $(`
        <div class="preset-time-input-group">
            <input type="time" class="form-control preset-time-input" value="12:00" 
                   data-index="${index}">
            <button type="button" class="btn btn-sm btn-outline-danger remove-preset-btn" 
                    onclick="removePresetTimeInput(${index})" 
                    title="削除">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `);
    $container.append($inputGroup);
    updateAddButtonState();
}

// プリセット時間入力を削除
function removePresetTimeInput(index) {
    const $container = $('#preset-times-inputs');
    $container.find(`[data-index="${index}"]`).closest('.preset-time-input-group').remove();
    
    // インデックスを更新
    $container.find('.preset-time-input').each(function(i) {
        $(this).attr('data-index', i);
    });
    
    updateAddButtonState();
}

// 追加ボタンの状態を更新
function updateAddButtonState() {
    const presetTimes = getPresetTimes();
    const $addBtn = $('#add-preset-time-btn');
    
    if (presetTimes.length >= window.MAX_PRESET_TIMES) {
        $addBtn.prop('disabled', true).html('<i class="fas fa-plus"></i> 最大数に達しています');
    } else {
        $addBtn.prop('disabled', false).html('<i class="fas fa-plus"></i> 時間を追加');
    }
}

// デフォルトに戻す
function resetPresetTimesToDefault() {
    if (confirm('プリセット時間をデフォルトに戻しますか？')) {
        savePresetTimes([...DEFAULT_PRESET_TIMES]);
        renderPresetTimeInputs();
        renderPresetTimeButtons();
        showNotification('プリセット時間をデフォルトに戻しました', 'success');
    }
}

// プリセット時間を保存（設定フォーム）
function savePresetTimesFromForm() {
    const $inputs = $('.preset-time-input');
    const times = [];
    let hasError = false;
    
    $inputs.each(function() {
        const value = $(this).val();
        if (value && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
            times.push(value);
        } else if (value) {
            showNotification(`無効な時間形式：${value}`, 'error');
            hasError = true;
        }
    });
    
    if (hasError) return false;
    if (times.length === 0) {
        showNotification('少なくとも 1 つのプリセット時間を設定してください', 'warning');
        return false;
    }
    
    if (savePresetTimes(times)) {
        renderPresetTimeButtons();
        showNotification('プリセット時間を保存しました', 'success');
        return true;
    }
    return false;
}

// 初期化
$(document).ready(function() {
    // 投稿作成画面のボタンを生成
    renderPresetTimeButtons();
    
    // 設定画面の入力フォームを生成
    renderPresetTimeInputs();
    
    // 追加ボタン
    $(document).on('click', '#add-preset-time-btn', addPresetTimeInput);
    
    // 設定フォームの送信
    $(document).on('submit', '#preset-times-form', function(e) {
        e.preventDefault();
        savePresetTimesFromForm();
    });
});

// セクション切り替え時にボタンを再描画
$(document).on('click', '[data-section="create"]', function() {
    setTimeout(renderPresetTimeButtons, 100);
});

// グローバルに関数をエクスポート
window.resetPresetTimesToDefault = resetPresetTimesToDefault;
window.getPresetTimes = getPresetTimes;
window.renderPresetTimeButtons = renderPresetTimeButtons;
