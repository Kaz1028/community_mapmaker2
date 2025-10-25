// Google Sheets をデータベースとして使用（OAuth経由）

window.sheetsDB = {
  SPREADSHEET_ID: '1DZ4rKgQ_MfIkzyQERdTDWjI0BMNT5UaqQJPWijnylRw',
  SHEET_NAME: 'Posts', // 投稿データ用シート名
  
  // ヘッダー行の列順（A列=id, B列=lat, C列=lng, ...）
  COLUMNS: ['id', 'lat', 'lng', 'type', 'title', 'body', 'updatetime', 'photo_url'],
  
  isInitialized: false,
  
  // 初期化（gapi.client.sheets が使えるか確認）
  async init() {
    if (this.isInitialized) return;
    
    // gapi が読み込まれるまで待機
    if (!window.gapi) {
      console.log('sheetsDB: waiting for gapi...');
      await new Promise((resolve) => {
        const check = setInterval(() => {
          if (window.gapi) {
            clearInterval(check);
            resolve();
          }
        }, 100);
      });
    }
    
    // gapi.client が初期化されるまで待機
    if (!gapi.client) {
      console.log('sheetsDB: waiting for gapi.client...');
      await new Promise((resolve) => {
        const check = setInterval(() => {
          if (gapi.client && gapi.client.sheets) {
            clearInterval(check);
            resolve();
          }
        }, 100);
      });
    }
    
    this.isInitialized = true;
    console.log('sheetsDB: initialized');
  },
  
  // 投稿を追加（行追加）
  async addPost(postData) {
    try {
      // drive-upload.js の init を呼んで gapi.client を確実に初期化
      if (window.driveUploader && !window.driveUploader.isInitialized) {
        console.log('sheetsDB: initializing driveUploader...');
        await window.driveUploader.init();
      }
      
      await this.init();
      
      // トークンが有効か確認（drive-upload.js の ensureToken を流用）
      if (window.driveUploader && window.driveUploader.ensureToken) {
        await window.driveUploader.ensureToken();
      }
      
      const now = new Date().toISOString();
      const id = Date.now().toString();
      
      // 行データを列順に整形
      const row = [
        id,
        postData.lat || '',
        postData.lng || '',
        postData.type || 'memo',
        postData.title || '',
        postData.body || '',
        now,
        postData.photo_url || ''
      ];
      
      console.log('sheetsDB: adding post', row);
      
      // Sheets API で行追加（append）
      const response = await gapi.client.sheets.spreadsheets.values.append({
        spreadsheetId: this.SPREADSHEET_ID,
        range: `${this.SHEET_NAME}!A:H`, // A〜H列
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [row]
        }
      });
      
      console.log('sheetsDB: post added', response);
      return { ok: true, id };
      
    } catch (error) {
      console.error('sheetsDB: addPost error', error);
      const errorMsg = error.result?.error?.message || error.message || JSON.stringify(error);
      return { ok: false, error: errorMsg };
    }
  },
  
  // 全投稿を取得
  async getPosts() {
    try {
      // drive-upload.js の init を呼んで gapi.client を確実に初期化
      if (window.driveUploader && !window.driveUploader.isInitialized) {
        console.log('sheetsDB: initializing driveUploader...');
        await window.driveUploader.init();
      }
      
      await this.init();
      
      // トークンがある場合のみ確認（ない場合は認証ダイアログを出さない）
      if (window.driveUploader && window.driveUploader.accessToken) {
        await window.driveUploader.ensureToken();
      }
      
      console.log('sheetsDB: fetching posts...');
      
      let response;
      try {
        // Sheets API でデータ取得（OAuth認証済みの場合）
        response = await gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: this.SPREADSHEET_ID,
          range: `${this.SHEET_NAME}!A:H` // A〜H列
        });
      } catch (apiError) {
        // API呼び出し失敗時は公開CSV形式で取得（認証不要）
        console.log('sheetsDB: API failed, trying public CSV...', apiError);
        const csvUrl = `https://docs.google.com/spreadsheets/d/${this.SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(this.SHEET_NAME)}`;
        const csvResponse = await fetch(csvUrl);
        if (!csvResponse.ok) throw new Error('公開シートの取得に失敗しました');
        const csvText = await csvResponse.text();
        const rows = this._parseCSV(csvText);
        response = { result: { values: rows } };
      }
      
      const rows = response.result.values || [];
      if (rows.length === 0) {
        console.log('sheetsDB: no data');
        return { ok: true, items: [] };
      }
      
      // 1行目はヘッダー行として読み飛ばす
      const dataRows = rows.slice(1);
      
      const items = dataRows.map(row => {
        const [id, lat, lng, type, title, body, updatetime, photo_url] = row;
        return {
          id: id || '',
          lat: parseFloat(lat) || 0,
          lng: parseFloat(lng) || 0,
          type: type || 'memo',
          title: title || '',
          body: body || '',
          updatetime: updatetime || '',
          created_at: updatetime || '', // 互換性
          photo_url: photo_url || ''
        };
      }).filter(it => it.lat && it.lng); // 緯度経度が有効なもののみ
      
      // 新しい順にソート（updatetime降順）
      items.sort((a, b) => {
        const ta = new Date(a.updatetime).getTime() || 0;
        const tb = new Date(b.updatetime).getTime() || 0;
        return tb - ta;
      });
      
      console.log(`sheetsDB: fetched ${items.length} posts`, items);
      return { ok: true, items };
      
    } catch (error) {
      console.error('sheetsDB: getPosts error', error);
      const errorMsg = error.result?.error?.message || error.message || JSON.stringify(error);
      return { ok: false, error: errorMsg, items: [] };
    }
  },
  
  // CSV パーサー（簡易版）
  _parseCSV(csvText) {
    const lines = csvText.split('\n');
    const result = [];
    for (let line of lines) {
      if (!line.trim()) continue;
      // 簡易CSVパース（ダブルクォート対応）
      const row = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          row.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      row.push(current);
      result.push(row);
    }
    return result;
  }
};
