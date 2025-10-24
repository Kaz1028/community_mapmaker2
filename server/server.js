const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// CORS設定（GitHub Pagesからのアクセスを許可）
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Google Sheets設定（あとで設定ファイルを配置します）
const SPREADSHEET_ID = '1DZ4rKgQ_MfIkzyQERdTDWjI0BMNT5UaqQJPWijnylRw'; // スプレッドシートのIDをここに入れる
const DRIVE_FOLDER_ID = '1k2LRCdpkCpbFk5_DsfznV7XKiUjZN3BF'; // Google Drive フォルダID
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');

// Google API認証（Sheets + Drive）
async function getAuthClient() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ],
  });
  return await auth.getClient();
}

// Google Drive に写真をアップロードして公開リンクを取得
async function uploadToDrive(auth, filePath, fileName) {
  const drive = google.drive({ version: 'v3', auth });
  
  const fileMetadata = {
    name: fileName,
    parents: [DRIVE_FOLDER_ID] // 指定されたフォルダに保存
  };
  
  const media = {
    mimeType: 'image/jpeg',
    body: fs.createReadStream(filePath)
  };
  
  // ファイルをアップロード
  const file = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id'
  });
  
  const fileId = file.data.id;
  
  // 公開設定（誰でも閲覧可能）
  await drive.permissions.create({
    fileId: fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone'
    }
  });
  
  // 公開リンクを返す
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

// POST エンドポイント（Firebase + Drive 対応）
app.post('/api/upload-photo', upload.single('photo'), async (req, res) => {
  try {
    console.log('Received photo upload:', req.body);
    
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No photo file uploaded' });
    }

    // Google Drive に写真をアップロード
    const auth = await getAuthClient();
    const fileName = `mapmaker-${Date.now()}-${req.file.originalname}`;
    const photoUrl = await uploadToDrive(auth, req.file.path, fileName);
    
    // アップロード後、一時ファイルを削除
    fs.unlinkSync(req.file.path);
    
    console.log('Photo uploaded to Drive:', photoUrl);
    res.json({ ok: true, photo_url: photoUrl });
    
  } catch (error) {
    console.error('Error uploading photo:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// GET エンドポイント（一覧取得）
app.get('/api/post', async (req, res) => {
  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'activity!A:H',
    });
    
    const rows = response.data.values || [];
    if (rows.length === 0) {
      return res.json({ ok: true, items: [] });
    }
    
    const headers = rows[0];
    const items = rows.slice(1).map(row => {
      const item = {};
      headers.forEach((header, i) => {
        item[header] = row[i] || '';
      });
      return item;
    });
    
    res.json({ ok: true, items });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ヘルスチェック
app.get('/', (req, res) => {
  res.json({ ok: true, message: 'Map Maker Proxy Server running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Ready to receive requests from GitHub Pages');
});
