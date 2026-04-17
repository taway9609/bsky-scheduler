# jQueryイベントハンドラ変換のまとめ

## 概要
HTMLの`onclick`属性を使用していたコードをjQueryのイベントハンドラに変換しました。以下のベストプラクティスに従っています：

- `$(document).ready()`を使用してDOMの準備完了を待つ
- `.on()`メソッドを使用したイベント委譲
- 非侵入的なJavaScriptの実装
- 適切なセレクタとデータ属性の使用

## 変換されたファイル

### HTMLファイル
1. **`app/templates/bluesky/accounts.html`**
   - `onclick="showAddAccountModal()"` → `id="show-add-account-modal-btn"`
   - `onclick="editSelectedAccount('{{ username }}')"` → `class="edit-account-btn" data-username="{{ username }}"`
   - `onclick="syncAccount('{{ account_data.did }}', this)"` → `class="sync-account-btn" data-did="{{ account_data.did }}"`
   - `onclick="handleConfirmDeleteAccount('{{ account_data.did }}')"` → `class="delete-account-btn" data-did="{{ account_data.did }}"`
   - `onclick="closeAddAccountModal()"` → `id="close-add-account-modal-btn"`
   - `onclick="closeEditAccountModal()"` → `id="close-edit-account-modal-btn"`

2. **`app/templates/bluesky/_header.html`**
   - `onclick="toggleDarkMode()"` → `id="theme-toggle-btn"`
   - `onclick="logout()"` → `id="logout-btn"`（既存のIDを維持）

3. **`app/templates/bluesky/_nav.html`**
   - `onclick="switchSection('posts')"` → `data-section="posts"`
   - `onclick="switchSection('create')"` → `data-section="create"`
   - `onclick="switchSection('account')"` → `data-section="account"`
   - `onclick="switchSection('settings')"` → `data-section="settings"`

4. **`app/templates/bluesky/settings.html`**
   - `onclick="resetPresetTimesToDefault()"` → `id="reset-preset-times-btn"`

5. **`app/templates/bluesky/create.html`**
   - `onclick="switchSection('account')"` → `id="switch-to-account-btn"`
   - `onclick="setScheduleDay(-1)"` → `data-day-offset="-1"`
   - `onclick="setScheduleDay(0)"` → `data-day-offset="0"`
   - `onclick="setScheduleDay(1)"` → `data-day-offset="1"`
   - `onclick="setScheduleDay(-2)"` → `data-day-offset="-2"`
   - `onclick="setScheduleDay(2)"` → `data-day-offset="2"`
   - `onclick="setScheduleDay(7)"` → `data-day-offset="7"`
   - `onclick="resetForm()"` → `id="reset-form-btn"`
   - `onclick="closeAltTextModal()"` → `id="close-alt-text-modal-btn"`

6. **`app/templates/bluesky/posts.html`**
   - `onclick="switchSection('create')"` → `id="new-post-btn"`

### JavaScriptファイル
**`app/static/js/bluesky/event-handlers.js`** - 新規作成

## jQueryイベントハンドラの実装

### イベント委譲の使用
動的に生成される要素（アカウントカードのボタンなど）にはイベント委譲を使用：
```javascript
$(document).on('click', '.edit-account-btn', function() {
    const username = $(this).data('username');
    editSelectedAccount(username);
});
```

### データ属性の活用
動的な値をデータ属性として保存：
```html
<button class="edit-account-btn" data-username="{{ username }}">編集</button>
```

### セレクタの最適化
IDセレクタを使用してパフォーマンスを向上：
```javascript
$('#show-add-account-modal-btn').on('click', function() {
    showAddAccountModal();
});
```

## 追加された機能

### プレースホルダー関数
定義されていなかった関数のためのプレースホルダーを追加：
- `toggleDarkMode()`
- `closeAltTextModal()`

### JavaScriptファイルの読み込み
各ページにイベントハンドラファイルを追加：
```html
<script src="{{ url_for('static', filename='js/bluesky/event-handlers.js') }}"></script>
```

## 利点

1. **保守性の向上**: HTMLとJavaScriptの分離
2. **再利用性**: 同じイベントハンドラを複数のページで使用
3. **パフォーマンス**: イベント委譲による効率的なイベント処理
4. **拡張性**: 新しい機能の追加が容易

## テスト

変換後のコードが正しく動作することを確認するために、以下のテストを推奨：

1. 各ボタンのクリックイベントが正しく動作するか
2. 動的に生成される要素のイベントが機能するか
3. モーダルの開閉が正常に動作するか
4. セクション切り替えが正しく機能するか

## 実装されたプレースホルダー関数

以下の関数を実際に実装しました：

### `toggleDarkMode()`
- ダークモードとライトモードの切り替え機能
- ローカルストレージにテーマ設定を保存
- アイコンの動的切り替え

### `initializeTheme()`
- ページ読み込み時のテーマ初期化
- 保存されたテーマ設定の読み込み

### `showAltTextModal(imageIndex)`
- ALTテキストモーダルを開く機能
- 画像インデックスの保存

### `closeAltTextModal()`
- ALTテキストモーダルを閉じる機能

### `submitAltText(event)`
- ALTテキストフォームの送信処理

### `submitAddAccount(event)`
- アカウント追加フォームの送信処理（プレースホルダー）

### `submitEditAccount(event)`
- アカウント編集フォームの送信処理（プレースホルダー）

## 注意点

- `submitAddAccount` と `submitEditAccount` 関数は基本的なプレースホルダー実装のみです
- 実際のアカウント追加・編集機能が必要な場合は、これらの関数を適切に実装してください
- CSSの構文チェッカーによるエラーは無視して構いません（Jinja2テンプレートのため）