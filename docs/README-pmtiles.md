# オフライン地図（PMTiles）生成手順（福知山市）

この手順で `tiles/fukuchiyama.pmtiles` を作成し、完全オフラインのベースマップを有効化します。

## 前提
- Windows + PowerShell
- Java 17+ (Temurin など)
- pmtiles CLI（https://github.com/protomaps/PMTiles/releases からDLし PATH に追加）

## 1. 自動スクリプトを実行
リポジトリのルートで、次を実行します。

```powershell
pwsh -ExecutionPolicy Bypass -File .\scripts\generate_pmtiles.ps1
```

スクリプトは以下を行います。
- tools/planetiler-openmaptiles.jar を取得（未取得の場合）
- Planetiler を使って福知山市周辺の `fukuchiyama.mbtiles` を生成
- pmtiles CLI で `tiles/fukuchiyama.pmtiles` に変換

## 2. 確認
- `tiles/fukuchiyama.pmtiles` が作成されていること
- すでに `service-worker.js` は v4 で `.pmtiles` をキャッシュ対象に含め、オフライン時に返すよう対応済
- `data/config-user.jsonc` で `"offlineTileName": "OSM_Offline"` が設定済み
- `tiles/osm-offline.json` は `pmtiles://./tiles/fukuchiyama.pmtiles` を参照

## 3. 反映
```powershell
git add tiles/fukuchiyama.pmtiles
git commit -m "Add Fukuchiyama PMTiles for offline basemap"
git push origin dev
```

Git LFS による追跡設定は `.gitattributes` で `*.pmtiles` に済ませてあります。

## 注意
- PMTiles はサイズが大きくなることがあります。初回は狭めの範囲で試し、問題なければ範囲を広げてください。
- Pixel 等の端末では、オンラインで1回ページを開いて Service Worker を更新後、オフラインの再読み込みで地図が表示されます。
