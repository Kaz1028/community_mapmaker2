(() => {
  const CFG = window.COMMUNITY_MAP_CONFIG;

  // 地図の作成
  const map = L.map('map').setView([CFG.CENTER.lat, CFG.CENTER.lng], CFG.ZOOM);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  let currentLatLng = null;

  // ショートハンド
  const $ = (s) => document.querySelector(s);

  // フォーム要素
  const modal     = $('#modal');
  const typeEl    = $('#type');
  const latEl     = $('#lat');
  const lngEl     = $('#lng');
  const titleEl   = $('#title');
  const bodyEl    = $('#body');
  const photoRow  = $('#row-photo');
  const photoEl   = $('#photo');
  const formTitle = $('#form-title');
  const msgEl     = $('#msg');

  function openModal(kind) {
    typeEl.value = kind; // 'memo' | 'photo'
    formTitle.textContent = (kind === 'photo' ? '写真投稿' : 'メモ投稿');
    photoRow.style.display = (kind === 'photo') ? '' : 'none';

    // 初期化
    titleEl.value = '';
    bodyEl.value  = '';
    photoEl.value = '';
    msgEl.textContent = '';

    // 位置を反映
    if (currentLatLng) {
      latEl.value = currentLatLng.lat.toFixed(6);
      lngEl.value = currentLatLng.lng.toFixed(6);
    }
    modal.classList.add('active');
  }

  function closeModal() {
    modal.classList.remove('active');
  }

  // 地図クリックで位置セット ＋ メモ投稿フォーム自動表示
  map.on('click', (e) => {
    currentLatLng = e.latlng;
    latEl.value = e.latlng.lat.toFixed(6);
    lngEl.value = e.latlng.lng.toFixed(6);
    openModal('memo'); // ← 自動でメモ投稿フォームを開く（写真にしたければ 'photo'）
  });

  // ボタンクリック
  $('#btn-memo').onclick  = () => openModal('memo');
  $('#btn-photo').onclick = () => openModal('photo');
  $('#cancel').onclick    = () => closeModal();

  // 送信
  document.getElementById('postForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    msgEl.textContent = '送信中...';

    try {
      const fd = new FormData(ev.target);
      if (!fd.get('lat') || !fd.get('lng')) {
        msgEl.textContent = '地図をクリックして位置を選んでください。';
        return;
      }

      const res = await fetch(CFG.GAS_ENDPOINT, { method: 'POST', body: fd });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || '投稿に失敗しました');

      msgEl.textContent = '投稿しました。マップを更新します…';
      closeModal();
      await loadPoints(true);
    } catch (err) {
      msgEl.textContent = 'エラー: ' + err.message;
    }
  });

  // 既存ポイント読み込み
  const markers = L.layerGroup().addTo(map);

  async function loadPoints(resetView) {
    const url = CFG.GAS_ENDPOINT + '?mode=list&_=' + Date.now();
    const res = await fetch(url);
    const data = await res.json();

    if (!data.ok) throw new Error('取得失敗');

    markers.clearLayers();

    data.items.forEach((it) => {
      const icon = (it.type === 'photo')
        ? L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41]
          })
        : L.divIcon({
            className: 'memo-icon',
            html: '📝',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

      const html = (it.type === 'photo' && it.photo_url)
        ? `<b>${esc(it.title || '（無題）')}</b><br>
           <img src="${it.photo_url}" style="max-width:220px;border-radius:6px"><br>
           ${nl2br(esc(it.body || ''))}<br>
           <small>${it.created_at || ''}</small>`
        : `<b>${esc(it.title || '（無題）')}</b><br>
           ${nl2br(esc(it.body || ''))}<br>
           <small>${it.created_at || ''}</small>`;

      L.marker([it.lat, it.lng], { icon }).addTo(markers).bindPopup(html);
    });

    if (resetView && data.items.length) {
      const latlngs = data.items.map((i) => [i.lat, i.lng]);
      map.fitBounds(latlngs, { padding: [20, 20] });
    }
  }

  // ユーティリティ
  function esc(s)  { return (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function nl2br(s){ return (s || '').replace(/\n/g, '<br>'); }

  // 初回ロード
  loadPoints(true);
})();
