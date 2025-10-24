// Google Drive OAuth アップロード (Google Identity Services 対応)

window.driveUploader = {
  // Google API クライアントの初期化状態
  isInitialized: false,
  accessToken: null,
  
  // Google API の設定
  CLIENT_ID: '333118872457-dlfh4bj0n3vh54ph41o6lmnvp1vlfr37.apps.googleusercontent.com',
  FOLDER_ID: '1k2LRCdpkCpbFk5_DsfznV7XKiUjZN3BF',
  SCOPES: 'https://www.googleapis.com/auth/drive.file',
  
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
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
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
      // 既にトークンがある場合
      if (this.accessToken) {
        resolve(this.accessToken);
        return;
      }
      
      // Google Identity Services でトークンをリクエスト
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
          console.log('Access token obtained');
          resolve(this.accessToken);
        }
      });
      
      client.requestAccessToken();
    });
  },
  
  // 写真をアップロード
  async uploadPhoto(file) {
    try {
      console.log('Starting photo upload:', file.name, file.size, 'bytes');
      
      // 初期化チェック
      if (!this.isInitialized) {
        console.log('Initializing Google Drive API...');
        await this.init();
      }
      
      // アクセストークン取得
      if (!this.accessToken) {
        console.log('Requesting access token...');
        await this.getAccessToken();
      }
      
      // ファイルのメタデータ
      const metadata = {
        name: `mapmaker-${Date.now()}-${file.name}`,
        parents: [this.FOLDER_ID],
        mimeType: file.type
      };
      
      console.log('Upload metadata:', metadata);
      
      // multipart リクエストの作成
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);
      
      // アップロード
      console.log('Uploading to Google Drive...');
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
      const fileId = result.id;
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
