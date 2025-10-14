(() => {
  const CFG = window.COMMUNITY_MAP_CONFIG;
  const map = L.map('map').setView([CFG.CENTER.lat, CFG.CENTER.lng], CFG.ZOOM);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap contributors'}).addTo(map);

  let currentLatLng=null;
  const $=s=>document.querySelector(s);
  const modal=$('#modal'), typeEl=$('#type'), latEl=$('#lat'), lngEl=$('#lng');
  const titleEl=$('#title'), bodyEl=$('#body'), photoRow=$('#row-photo'), photoEl=$('#photo');
  const formTitle=$('#form-title'), msgEl=$('#msg');

  function openModal(kind){ typeEl.value=kind; formTitle.textContent=(kind==='photo'?'写真投稿':'メモ投稿');
    photoRow.style.display=(kind==='photo')?'':'none'; titleEl.value=''; bodyEl.value=''; photoEl.value=''; msgEl.textContent='';
    if(currentLatLng){latEl.value=currentLatLng.lat.toFixed(6); lngEl.value=currentLatLng.lng.toFixed(6);} modal.classList.add('active'); }
  function closeModal(){ modal.classList.remove('active'); }
  map.on('click', (e) => {
  currentLatLng = e.latlng;
  latEl.value = e.latlng.lat.toFixed(6);
  lngEl.value = e.latlng.lng.toFixed(6);
  openModal('memo'); // ← コールはココ（リスナーの中）
});
  $('#btn-memo').onclick=()=>openModal('memo'); $('#btn-photo').onclick=()=>openModal('photo'); $('#cancel').onclick=()=>closeModal();

  document.getElementById('postForm').addEventListener('submit', async ev=>{
    ev.preventDefault(); msgEl.textContent='送信中...';
    try{
      const fd=new FormData(ev.target);
      if(!fd.get('lat')||!fd.get('lng')){ msgEl.textContent='地図をクリックして位置を選んでください。'; return; }
      const r=await fetch(CFG.GAS_ENDPOINT,{method:'POST',body:fd}); const j=await r.json();
      if(!j.ok) throw new Error(j.error||'投稿に失敗しました');
      msgEl.textContent='投稿しました。マップを更新します…'; closeModal(); await loadPoints(true);
    }catch(err){ msgEl.textContent='エラー: '+err.message; }
  });

  const markers=L.layerGroup().addTo(map);
  async function loadPoints(reset){
    const r=await fetch(CFG.GAS_ENDPOINT+'?mode=list&_='+Date.now()); const {ok,items}=await r.json();
    if(!ok) throw new Error('取得失敗'); markers.clearLayers();
    items.forEach(it=>{
      const icon=(it.type==='photo')? L.icon({iconUrl:'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',iconSize:[25,41],iconAnchor:[12,41]})
                                      : L.divIcon({className:'memo-icon',html:'📝',iconSize:[24,24],iconAnchor:[12,12]});
      const html=(it.type==='photo'&&it.photo_url)
        ? `<b>${esc(it.title||'（無題）')}</b><br><img src="${it.photo_url}" style="max-width:220px;border-radius:6px"><br>${nl2br(esc(it.body||''))}<br><small>${it.created_at||''}</small>`
        : `<b>${esc(it.title||'（無題）')}</b><br>${nl2br(esc(it.body||''))}<br><small>${it.created_at||''}</small>`;
      L.marker([it.lat,it.lng],{icon}).addTo(markers).bindPopup(html);
    });
    if(reset&&items.length){ map.fitBounds(items.map(i=>[i.lat,i.lng]),{padding:[20,20]}); }
  }
  const esc=s=>(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const nl2br=s=>(s||'').replace(/\n/g,'<br>');
  loadPoints(true);
})();
