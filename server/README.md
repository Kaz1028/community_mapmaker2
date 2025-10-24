# Community Map Maker - Proxy Server

ローカル Node.js サーバ（中継サーバ）。GitHub Pages からの POST を受けて Google Sheets に書き込みます。

## セットアップ手順（5分）

### 1. Node.js のインストール確認
PowerShell で以下を実行：
```powershell
node --version
```
- バージョンが表示されれば OK（例: v18.x.x）
- 表示されない場合は https://nodejs.org/ からインストール

### 2. 依存パッケージのインストール
```powershell
cd c:\Users\choko\community_mapmaker2\server
npm install
```

### 3. Google Cloud プロジェクトとサービスアカウントの作成

#### 3-1. Google Cloud Console を開く
https://console.cloud.google.com/

#### 3-2. 新しいプロジェクトを作成
- 左上のプロジェクト名 → 「新しいプロジェクト」
- プロジェクト名: 「mapmaker-proxy」など
- 作成

#### 3-3. Google Sheets API を有効化
- 左メニュー「API とサービス」→「ライブラリ」
- 「Google Sheets API」を検索 → 「有効にする」

#### 3-4. サービスアカウントを作成
- 左メニュー「API とサービス」→「認証情報」
- 上部「認証情報を作成」→「サービスアカウント」
- サービスアカウント名: 「mapmaker-writer」など
- 作成して続行
- ロール: 「編集者」を選択（または「なし」でも可）
- 完了

#### 3-5. サービスアカウントキーをダウンロード
- 作成したサービスアカウントをクリック
- 上部タブ「キー」→「鍵を追加」→「新しい鍵を作成」
- 「JSON」を選択 → 作成
- **ダウンロードされた JSON ファイルを `server/credentials.json` にリネームして配置**

#### 3-6. スプレッドシートに権限を付与
- あなたの Google スプレッドシート（activity シートがあるもの）を開く
- 右上「共有」をクリック
- **サービスアカウントのメールアドレス**（例: mapmaker-writer@...iam.gserviceaccount.com）を追加
- 権限: 「編集者」
- 送信

#### 3-7. スプレッドシート ID を取得
- スプレッドシートの URL から ID をコピー：
  ```
  https://docs.google.com/spreadsheets/d/【ここがID】/edit
  ```
- `server.js` の 15行目 `YOUR_SPREADSHEET_ID` をこの ID に置き換える

### 4. サーバー起動
```powershell
npm start
```

表示：
```
Server running on http://localhost:3000
Ready to receive requests from GitHub Pages
```

### 5. テスト
PowerShell で別ウィンドウを開いて：
```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/post -Method Post -Body @{lat=35.6;lng=139.7;title='テスト';body='本文'} -ContentType 'application/x-www-form-urlencoded'
```

→ スプレッドシートに行が追加されれば成功！

## クライアント側の設定

`cmapmaker.js` の `USER_POST_ENDPOINT` を以下に変更：
```javascript
const USER_POST_ENDPOINT = "http://localhost:3000/api/post";
```

注意：本番公開時は localhost では動きません。Cloud Run 等へのデプロイが必要です。

## トラブルシューティング

### エラー: `Cannot find module 'express'`
→ `npm install` を実行してください

### エラー: `ENOENT: no such file or directory, open 'credentials.json'`
→ サービスアカウントキー（JSON）を `server/credentials.json` に配置してください

### エラー: `The caller does not have permission`
→ スプレッドシートにサービスアカウントのメールアドレスを共有してください

### サーバーが起動しない
→ ポート 3000 が使用中の可能性。`server.js` の PORT を変更してください
