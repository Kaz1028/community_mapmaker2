// Google Drive OAuth アップロード (Google Identity Services 対応)

window.driveUploader = {
  // Google API クライアントの初期化状態
  isInitialized: false,
  accessToken: null,
  tokenExpiry: 0,

  // Google API の設定
  CLIENT_ID: '333118872457-dlfh4bj0n3vh54ph41o6lmnvp1vlfr37.apps.googleusercontent.com',
  FOLDER_ID: '1k2LRCdpkCpbFk5_DsfznV7XKiUjZN3BF',
  SCOPES: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets',

  // アップロード方式・パラメータ
  LARGE_FILE_THRESHOLD: 50 * 1024 * 1024, // 50MB以上はレジューム方式
  CHUNK_SIZE: 8 * 1024 * 1024, // 8MB（回線や端末に応じて調整可）
  MAX_RETRIES: 5,

  // Google API を初期化
  async init() {
    return new Promise((resolve, reject) => {
      if (typeof gapi === 'undefined') {
        reject(new Error('Google API が読み込まれていません'));
        return;
      }

      gapi.load('client', async () => {
        try {
          await gapi.client.init({
            discoveryDocs: [
              'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
              'https://www.googleapis.com/discovery/v1/apis/sheets/v4/rest'
            ]
          });

          this.isInitialized = true;
          console.log('Google Drive API client initialized');
          resolve();
        } catch (error) {
          console.error('Failed to initialize Google Drive client:', error);
          reject(error);
        }
      });
    });
  },

  // OAuth トークンを取得 (Google Identity Services 使用)
  async getAccessToken() {
    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: this.CLIENT_ID,
        scope: this.SCOPES,
        callback: (response) => {
          if (response.error) {
            console.error('Token request failed:', response);
            reject(new Error('認証に失敗しました: ' + response.error));
            return;
          }

          this.accessToken = response.access_token;
          const expiresInSec = (typeof response.expires_in === 'number') ? response.expires_in : 3600; // 既定1h
          this.tokenExpiry = Date.now() + expiresInSec * 1000;
          // gapi クライアントにもトークンを供給
          if (this.isInitialized && gapi?.client?.setToken) {
            gapi.client.setToken({ access_token: this.accessToken });
          }
          console.log('Access token obtained');
          resolve(this.accessToken);
        }
      });

      client.requestAccessToken();
    });
  },

  async ensureToken() {
    if (!this.accessToken || Date.now() >= this.tokenExpiry - 60_000) {
      await this.getAccessToken();
    }
  },

  // レジューム可能な分割アップロード（大容量対応）
  async uploadResumable(file, { onProgress } = {}) {
    // 初期化とトークン
    if (!this.isInitialized) {
      await this.init();
    }
    await this.ensureToken();

    const metadata = {
      name: `mapmaker-${Date.now()}-${file.name}`,
      parents: [this.FOLDER_ID],
      mimeType: file.type || 'application/octet-stream'
    };

    // 1) セッション開始（Location 取得）
    const startRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': metadata.mimeType,
        'X-Upload-Content-Length': String(file.size)
      },
      body: JSON.stringify(metadata)
    });

    if (!startRes.ok) {
      const t = await startRes.text();
      console.error('Failed to start resumable session:', startRes.status, t);
      throw new Error('レジュームアップロードの開始に失敗しました');
    }

    const uploadUrl = startRes.headers.get('Location');
    if (!uploadUrl) {
      throw new Error('アップロードURLの取得に失敗しました');
    }

    let offset = 0; // 次に送る開始位置
    const total = file.size;
    const chunkSize = this.CHUNK_SIZE;
    let attempt = 0;

    const updateProgress = () => {
      if (typeof onProgress === 'function') {
        const percent = total ? Math.floor((offset / total) * 100) : 0;
        try { onProgress({ loaded: offset, total, percent }); } catch (_) {}
      }
    };

    // 再開のためのステータス問い合わせ
    const queryStatus = async () => {
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Range': `bytes */${total}`
        }
      });
      if (res.status === 308) {
        const range = res.headers.get('Range'); // 例: bytes=0-1048575
        if (range) {
          const m = range.match(/bytes=(\d+)-(\d+)/);
          if (m) {
            const received = parseInt(m[2], 10) + 1; // 次の開始位置
            return received;
          }
        }
        return 0; // Range 無ければ0
      }
      // 200/201 などは完了
      return total;
    };

    // 2) チャンク送信ループ
    while (offset < total) {
      await this.ensureToken();
      const end = Math.min(offset + chunkSize, total);
      const chunk = file.slice(offset, end);

      try {
        const res = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': metadata.mimeType,
            'Content-Range': `bytes ${offset}-${end - 1}/${total}`
          },
          body: chunk
        });

        if (res.status === 308) {
          // 継続（次チャンクへ）
          offset = end;
          updateProgress();
          attempt = 0; // 成功したのでリセット
          continue;
        }

        if (res.ok) {
          // 完了。ファイル情報が返る
          const body = await res.json();
          const fileId = body.id;
          if (!fileId) throw new Error('ファイルIDの取得に失敗しました');
          return fileId;
        }

        // エラー（4xx/5xx）。再試行対象か判定
        const retriable = res.status >= 500 || res.status === 429 || res.status === 408;
        if (!retriable) {
          const t = await res.text();
          console.error('Upload error (non-retriable):', res.status, t);
          throw new Error(`アップロードに失敗しました (status ${res.status})`);
        }

        // 再試行
        attempt++;
        if (attempt > this.MAX_RETRIES) {
          throw new Error('アップロードに繰り返し失敗しました');
        }
        const backoff = Math.min(1000 * 2 ** (attempt - 1), 15_000);
        await new Promise(r => setTimeout(r, backoff));
        // 進捗確認してoffset更新
        const received = await queryStatus();
        offset = Math.min(received, total);
        updateProgress();
      } catch (err) {
        // ネットワーク例外など
        attempt++;
        if (attempt > this.MAX_RETRIES) {
          console.error('Upload failed with exception:', err);
          throw err;
        }
        const backoff = Math.min(1000 * 2 ** (attempt - 1), 15_000);
        await new Promise(r => setTimeout(r, backoff));
        const received = await queryStatus();
        offset = Math.min(received, total);
        updateProgress();
      }
    }

    throw new Error('予期せぬ状態: アップロードが完了しませんでした');
  },

  // 写真をアップロード（サイズに応じて方式を自動選択）
  async uploadPhoto(file, opts = {}) {
    try {
      console.log('Starting photo upload:', file.name, file.size, 'bytes');

      // 初期化チェック
      if (!this.isInitialized) {
        console.log('Initializing Google Drive API...');
        await this.init();
      }

      // アクセストークン取得
      console.log('Ensuring access token...');
      await this.ensureToken();
      // gapi クライアントにもトークンを供給
      if (gapi?.client?.setToken) {
        gapi.client.setToken({ access_token: this.accessToken });
      }

      let fileId = null;
      if (file.size >= this.LARGE_FILE_THRESHOLD) {
        console.log('Using resumable upload for large file...');
        fileId = await this.uploadResumable(file, { onProgress: opts.onProgress });
      } else {
        // 小容量は従来のmultipartで高速処理
        const metadata = {
          name: `mapmaker-${Date.now()}-${file.name}`,
          parents: [this.FOLDER_ID],
          mimeType: file.type || 'application/octet-stream'
        };
        console.log('Upload metadata:', metadata);
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);
        console.log('Uploading to Google Drive (multipart)...');
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          },
          body: form
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Upload failed:', response.status, errorText);
          throw new Error(`アップロードに失敗しました: ${response.statusText}`);
        }
        const result = await response.json();
        fileId = result.id;
      }
      console.log('File uploaded, ID:', fileId);

      // 公開設定
      console.log('Setting public permission...');
      await gapi.client.drive.permissions.create({
        fileId: fileId,
        resource: {
          role: 'reader',
          type: 'anyone'
        }
      });

      // 公開 URL を返す
      const url = `https://drive.google.com/uc?export=view&id=${fileId}`;
      console.log('Upload complete, URL:', url);
      return url;

    } catch (error) {
      console.error('uploadPhoto error:', error);
      throw error;
    }
  }
};
