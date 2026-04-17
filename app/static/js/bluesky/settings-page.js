// js/bluesky/settings-page.js - Settings page specific JavaScript

document.addEventListener('DOMContentLoaded', function() {
  async function loadDuplicateSettings() {
    try {
      const response = await window._apiDebugFetch('GET /bluesky/settings', fetch('/bluesky/settings', {
        headers: Auth.apiHeaders()
      }));
      const data = await response.json();
      if (data.status === 'success' && data.data.duplicate_images !== undefined) {
        document.getElementById('duplicate_images').checked = data.data.duplicate_images === 'true' || data.data.duplicate_images === true;
      }
      if (data.status === 'success' && data.data.duplicate_date_auto_adjust !== undefined) {
        document.getElementById('duplicate_date_auto_adjust').checked = data.data.duplicate_date_auto_adjust === 'true' || data.data.duplicate_date_auto_adjust === true;
      }
    } catch (error) {
      console.error('Failed to load duplicate settings:', error);
    }
  }

  async function loadAutoDeleteSettings() {
    try {
      console.log('Loading auto-delete settings...');
      
      const accountsResponse = await fetch('/bluesky/get_accounts', {
        headers: Auth.apiHeaders()
      });
      const accountsData = await accountsResponse.json();
      
      const settingsResponse = await fetch('/bluesky/settings/auto-delete', {
        headers: Auth.apiHeaders()
      });
      const settingsData = await settingsResponse.json();
      
      const container = document.getElementById('auto-delete-accounts-container');
      if (!container) return;
      
      let accounts = null;
      if (accountsData.status === 'success' && accountsData.data && accountsData.data.accounts) {
        accounts = accountsData.data.accounts;
      } else if (accountsData.accounts) {
        accounts = accountsData.accounts;
      } else if (accountsData.data && typeof accountsData.data === 'object') {
        accounts = accountsData.data;
      } else if (accountsData.status === 'success' && accountsData.data) {
        accounts = accountsData.data;
      }
      
      if (!accounts || Object.keys(accounts).length === 0) {
        container.innerHTML = '<div class="alert alert-warning"><i class="fas fa-exclamation-triangle"></i> アカウントがありません。先にアカウントを追加してください。</div>';
        return;
      }
      
      const accountKeys = Object.keys(accounts);
      const firstAccountKey = accountKeys[0];
      const firstAccount = accounts[firstAccountKey];
      
      let html = '';
      html += '<div class="account-selector-wrapper mb-4">';
      html += '  <label class="form-label fw-bold d-flex align-items-center" style="font-size: 1.1rem;">';
      html += '    <i class="fas fa-user-circle me-2" style="font-size: 1.3rem; color: #3b82f6;"></i>';
      html += '    <span>アカウントを選択</span>';
      html += '  </label>';
      html += '  <div class="account-select-container">';
      html += '    <i class="fas fa-chevron-down select-icon"></i>';
      html += '    <select class="form-select form-select-lg account-select" id="auto-delete-account-select" onchange="renderAutoDeleteSettingsForAccount(this.value)">';
      
      for (const [username, account] of Object.entries(accounts)) {
        const isSelected = username === firstAccountKey ? 'selected' : '';
        html += '      <option value="' + account.did + '" ' + isSelected + '>' + (account.username || account.handle || username) + '</option>';
      }
      
      html += '    </select>';
      html += '  </div>';
      html += '</div>';
      html += '<div id="auto-delete-settings-container"></div>';
      
      container.innerHTML = html;
      
      window.renderAutoDeleteSettingsForAccount = function(did, accountsOverride, settingsDataOverride) {
        const accs = accountsOverride || accounts;
        const settingsD = settingsDataOverride || settingsData;
        
        const account = Object.values(accs).find(a => a.did === did) || Object.values(accs)[0];
        if (!account) return;
        
        const settings = settingsD.status === 'success' ? (settingsD.data[did] || { auto_delete_days: 0, auto_delete_mode: 'all' }) : { auto_delete_days: 0, auto_delete_mode: 'all' };
        
        const isDisabled = settings.auto_delete_days === 0;
        const modeDisabledAttr = isDisabled ? 'disabled' : '';
        const buttonDisabledAttr = isDisabled ? 'disabled' : '';
        const buttonDisabledClass = isDisabled ? 'disabled' : '';
        
        let h = '';
        h += '<div class="settings-card p-4">';
        h += '  <div class="settings-header d-flex justify-content-between align-items-center mb-4 pb-3">';
        h += '    <h4 class="mb-0 account-title"><i class="fas fa-user-circle me-2"></i>' + (account.username || account.handle || 'Unknown') + '</h4>';
        h += '    <span class="badge bg-secondary did-badge">' + account.did + '</span>';
        h += '  </div>';
        h += '  <div class="row">';
        h += '    <div class="col-md-6 mb-4">';
        h += '      <label class="form-label fw-bold"><i class="fas fa-calendar-alt me-1"></i> 削除対象の日数</label>';
        h += '      <div class="radio-group">';
        h += '        <label class="radio-custom"><input type="radio" name="auto-delete-days-' + did + '" value="0" ' + (settings.auto_delete_days === 0 ? 'checked' : '') + ' onchange="toggleDeleteControls(\'' + did + '\')"><span><i class="fas fa-ban"></i> 無効 (自動削除しない)</span></label>';
        h += '        <label class="radio-custom"><input type="radio" name="auto-delete-days-' + did + '" value="1" ' + (settings.auto_delete_days === 1 ? 'checked' : '') + ' onchange="toggleDeleteControls(\'' + did + '\')"><span><i class="fas fa-calendar-day"></i> 1 日前</span></label>';
        h += '        <label class="radio-custom"><input type="radio" name="auto-delete-days-' + did + '" value="7" ' + (settings.auto_delete_days === 7 ? 'checked' : '') + ' onchange="toggleDeleteControls(\'' + did + '\')"><span><i class="fas fa-calendar-week"></i> 7 日前</span></label>';
        h += '        <label class="radio-custom"><input type="radio" name="auto-delete-days-' + did + '" value="14" ' + (settings.auto_delete_days === 14 ? 'checked' : '') + ' onchange="toggleDeleteControls(\'' + did + '\')"><span><i class="fas fa-calendar-week"></i> 14 日前</span></label>';
        h += '        <label class="radio-custom"><input type="radio" name="auto-delete-days-' + did + '" value="30" ' + (settings.auto_delete_days === 30 ? 'checked' : '') + ' onchange="toggleDeleteControls(\'' + did + '\')"><span><i class="fas fa-calendar-alt"></i> 30 日前 (1 ヶ月)</span></label>';
        h += '        <label class="radio-custom"><input type="radio" name="auto-delete-days-' + did + '" value="60" ' + (settings.auto_delete_days === 60 ? 'checked' : '') + ' onchange="toggleDeleteControls(\'' + did + '\')"><span><i class="fas fa-calendar"></i> 60 日前 (2 ヶ月)</span></label>';
        h += '        <label class="radio-custom"><input type="radio" name="auto-delete-days-' + did + '" value="90" ' + (settings.auto_delete_days === 90 ? 'checked' : '') + ' onchange="toggleDeleteControls(\'' + did + '\')"><span><i class="fas fa-calendar-check"></i> 90 日前 (3 ヶ月)</span></label>';
        h += '      </div>';
        h += '    </div>';
        h += '    <div class="col-md-6 mb-4">';
        h += '      <label class="form-label fw-bold"><i class="fas fa-trash-alt me-1"></i> 削除モード</label>';
        h += '      <div class="radio-group" id="mode-group-' + did + '">';
        h += '        <label class="radio-custom ' + (isDisabled ? 'radio-disabled' : '') + '"><input type="radio" name="auto-delete-mode-' + did + '" value="all" ' + (settings.auto_delete_mode === 'all' ? 'checked' : '') + ' ' + modeDisabledAttr + '><span><i class="fas fa-trash"></i> 全て削除 (画像も削除)</span></label>';
        h += '        <label class="radio-custom ' + (isDisabled ? 'radio-disabled' : '') + '"><input type="radio" name="auto-delete-mode-' + did + '" value="posted_only" ' + (settings.auto_delete_mode === 'posted_only' ? 'checked' : '') + ' ' + modeDisabledAttr + '><span><i class="fas fa-check-circle"></i> 投稿済みのみ削除</span></label>';
        h += '      </div>';
        h += '    </div>';
        h += '  </div>';
        h += '  <div class="action-buttons mt-4 pt-3">';
        h += '    <button type="button" class="btn btn-primary btn-lg me-3" onclick="saveAutoDeleteSettings(\'' + did + '\')"><i class="fas fa-save me-2"></i>設定を保存</button>';
        h += '    <button type="button" class="btn btn-danger btn-lg ' + buttonDisabledClass + '" id="execute-delete-btn-' + did + '" onclick="executeAutoDelete(\'' + did + '\')" ' + buttonDisabledAttr + '><i class="fas fa-trash-alt me-2"></i>今すぐ削除を実行</button>';
        h += '  </div>';
        h += '</div>';
        
        const settingsContainer = document.getElementById('auto-delete-settings-container');
        if (settingsContainer) {
          settingsContainer.innerHTML = h;
        }
      };
      
      window.toggleDeleteControls = function(did) {
        const daysElement = document.querySelector('input[name="auto-delete-days-' + did + '"]:checked');
        const modeRadios = document.querySelectorAll('input[name="auto-delete-mode-' + did + '"]');
        const modeGroup = document.getElementById('mode-group-' + did);
        const executeBtn = document.getElementById('execute-delete-btn-' + did);
        
        if (!daysElement) return;
        
        const isZero = daysElement.value === '0';
        
        modeRadios.forEach(radio => {
          radio.disabled = isZero;
        });
        
        if (executeBtn) {
          executeBtn.disabled = isZero;
          if (isZero) {
            executeBtn.classList.add('disabled');
          } else {
            executeBtn.classList.remove('disabled');
          }
        }
        
        const labels = modeGroup.querySelectorAll('.radio-custom');
        labels.forEach(label => {
          if (isZero) {
            label.classList.add('radio-disabled');
          } else {
            label.classList.remove('radio-disabled');
          }
        });
      };
      
      renderAutoDeleteSettingsForAccount(firstAccount.did, accounts, settingsData);
      
    } catch (error) {
      console.error('Failed to load auto-delete settings:', error);
      console.error('Stack:', error.stack);
      const container = document.getElementById('auto-delete-accounts-container');
      if (container) {
        container.innerHTML = '<div class="alert alert-danger"><i class="fas fa-exclamation-triangle"></i> 設定の読み込みに失敗しました：' + error.message + '</div>';
      }
    }
  }
  
  window.saveAutoDeleteSettings = async function(did) {
    const daysElement = document.querySelector('input[name="auto-delete-days-' + did + '"]:checked');
    const modeElement = document.querySelector('input[name="auto-delete-mode-' + did + '"]:checked');
    
    if (!daysElement || !modeElement) {
      showNotification('設定が選択されていません', 'error');
      return;
    }
    
    const days = daysElement.value;
    const mode = modeElement.value;
    
    try {
      const response = await fetch('/bluesky/settings/auto-delete', {
        method: 'POST',
        headers: { ...Auth.apiHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_did: did, auto_delete_days: parseInt(days), auto_delete_mode: mode })
      });
      
      const data = await response.json();
      if (data.status === 'success') {
        showNotification(data.message || '設定を保存しました', 'success');
      } else {
        showNotification(data.message || '設定の保存に失敗しました', 'error');
      }
    } catch (error) {
      showNotification('エラーが発生しました', 'error');
    }
  };
  
  window.executeAutoDelete = async function(did) {
    if (!confirm('本当に削除を実行しますか？この操作は元に戻せません。')) return;
    
    try {
      const response = await fetch('/bluesky/settings/auto-delete/execute?account_did=' + did, {
        method: 'POST',
        headers: Auth.apiHeaders()
      });
      
      const data = await response.json();
      if (data.status === 'success') {
        showNotification(data.message || '削除を実行しました', 'success');
        loadAutoDeleteSettings();
      } else {
        showNotification(data.message || '削除に失敗しました', 'error');
      }
    } catch (error) {
      showNotification('エラーが発生しました', 'error');
    }
  };
  
  loadAutoDeleteSettings();

  const changePasswordForm = document.getElementById('change-password-form');
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const resultDiv = document.getElementById('password-change-result');
      const currentPassword = document.getElementById('password-change-current').value;
      const newPassword = document.getElementById('password-change-new').value;
      const confirmPassword = document.getElementById('password-change-confirm').value;

      resultDiv.innerHTML = '<div class="alert alert-info"><i class="fas fa-spinner fa-spin"></i> 処理中...</div>';

      if (newPassword !== confirmPassword) {
        resultDiv.innerHTML = '<div class="alert alert-danger"><i class="fas fa-exclamation-triangle"></i> パスワードが一致しません</div>';
        return;
      }

      try {
        const response = await fetch('/auth/change-password', {
          method: 'POST',
          headers: { ...Auth.apiHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
        });

        const data = await response.json();
        if (data.status === 'success') {
          resultDiv.innerHTML = '<div class="alert alert-success"><i class="fas fa-check"></i> ' + data.message + '</div>';
          document.getElementById('change-password-form').reset();
        } else {
          resultDiv.innerHTML = '<div class="alert alert-danger"><i class="fas fa-exclamation-triangle"></i> ' + data.message + '</div>';
        }
      } catch (error) {
        resultDiv.innerHTML = '<div class="alert alert-danger"><i class="fas fa-exclamation-triangle"></i> エラーが発生しました</div>';
      }
    });
  }

  const duplicateSettingsForm = document.getElementById('duplicate-settings-form');
  if (duplicateSettingsForm) {
    duplicateSettingsForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const duplicateImages = document.getElementById('duplicate_images').checked;
      const duplicateDateAutoAdjust = document.getElementById('duplicate_date_auto_adjust').checked;

      try {
        const response = await fetch('/bluesky/settings', {
          method: 'POST',
          headers: { ...Auth.apiHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            duplicate_images: duplicateImages,
            duplicate_date_auto_adjust: duplicateDateAutoAdjust
          })
        });

        const data = await response.json();
        if (data.status === 'success') {
          showNotification(data.message || '設定を保存しました', 'success');
        } else {
          showNotification(data.message || '設定の保存に失敗しました', 'error');
        }
      } catch (error) {
        showNotification('エラーが発生しました', 'error');
      }
    });
  }

  loadDuplicateSettings();
});
