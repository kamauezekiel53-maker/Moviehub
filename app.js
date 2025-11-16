/* Movie Hub — app.js (with streaming support)
   - Streams `stream_url` from your DOWNLOAD_API using an HTML5 player
   - Fallback to "Open in new tab" if playback is blocked
   - Adds subtitle tracks when available
   - Keeps existing features: TMDb, carousels, modal, watchlist, themes
*/

/* ================= CONFIG ================= */
const API_KEY = '7cc9abef50e4c94689f48516718607be';
const API_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';
const DOWNLOAD_API = 'https://movieapi.giftedtech.co.ke/api/sources/6127914234610600632';

/* ================= DOM ================= */
const moviesGrid = document.getElementById('moviesGrid');
const loader = document.getElementById('loader');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const suggestionsBox = document.getElementById('suggestions');
const sectionButtons = document.querySelectorAll('.sec-btn');
const pageInfo = document.getElementById('pageInfo');
const prevBtn = document.getElementById('prevPage');
const nextBtn = document.getElementById('nextPage');

const modal = document.getElementById('modal');
const modalClose = document.getElementById('modalClose');
const modalPoster = document.getElementById('modalPoster');
const modalTitle = document.getElementById('modalTitle');
const modalOverview = document.getElementById('modalOverview');
const modalSub = document.getElementById('modalSub');
const modalCast = document.getElementById('modalCast');
const modalVideos = document.getElementById('modalVideos');
const modalDownload = document.getElementById('modalDownload');
const favBtn = document.getElementById('favBtn');
const openTmdb = document.getElementById('openTmdb');

const actorModal = document.getElementById('actorModal');
const actorBody = document.getElementById('actorBody');

const trendingRow = document.getElementById('trendingRow');
const topRatedRow = document.getElementById('topRatedRow');
const nowPlayingRow = document.getElementById('nowPlayingRow');

const watchlistBtn = document.getElementById('watchlistBtn');
const watchlistPanel = document.getElementById('watchlistPanel');
const watchlistItems = document.getElementById('watchlistItems');
const closeWatchlist = document.getElementById('closeWatchlist');
const clearWatchlist = document.getElementById('clearWatchlist');

const themeToggle = document.getElementById('themeToggle');
const colorTheme = document.getElementById('colorTheme');

const playerModal = document.getElementById('playerModal');
const playerContainer = document.getElementById('playerContainer');
const toastEl = document.getElementById('toast');

/* ================= STATE ================= */
let state = {
  section: 'popular',
  page: 1,
  total_pages: 1,
  query: '',
  debounceTimer: null,
  lastFetchId: 0
};

/* ============== UTIL ============== */
function escapeHtml(s=''){ return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

function proxy(url){
  // If you previously used corsproxy.io for TMDb, enable proxying here.
  // For the download API we fetch directly (it supports CORS in your tests),
  // if you need to proxy it, wrap with proxy(...) as done with TMDb earlier.
  return url;
}

/* TMDb fetch wrapper with API key */
async function tmdbFetch(url){
  const u = new URL(url);
  u.searchParams.set('api_key', API_KEY);
  const res = await fetch(proxy(u.toString()));
  if(!res.ok) throw new Error('TMDb fetch failed');
  return res.json();
}

/* fetch with timeout helper */
function fetchWithTimeout(input, timeout=15000){
  return Promise.race([
    fetch(input),
    new Promise((_, reject) => setTimeout(()=>reject(new Error('Request timed out')), timeout))
  ]);
}

function showToast(msg, time=2200){
  if(!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(()=> toastEl.classList.add('hidden'), time);
}

/* loader & skeleton helpers */
function showLoader(){ loader?.classList.remove('hidden'); }
function hideLoader(){ loader?.classList.add('hidden'); }
function clearGrid(){ moviesGrid.innerHTML=''; }

function showSkeletons(count=8){
  clearGrid();
  moviesGrid.classList.add('skeleton-grid');
  for(let i=0;i<count;i++){
    const sk = document.createElement('div');
    sk.className = 'skeleton-card';
    sk.innerHTML = `<div class="sk-poster"></div><div class="sk-body"><div class="skeleton-line sk-w-85"></div><div class="skeleton-line sk-w-70"></div><div class="skeleton-line sk-w-50"></div></div>`;
    moviesGrid.appendChild(sk);
  }
}
function clearSkeletons(){ moviesGrid.classList.remove('skeleton-grid'); clearGrid(); }

/* ============== ENDPOINTS ============== */
function endpointForSection(section, page=1){
  if(section==='trending') return `${API_BASE}/trending/movie/week?page=${page}`;
  if(section==='now_playing') return `${API_BASE}/movie/now_playing?page=${page}`;
  if(section==='top_rated') return `${API_BASE}/movie/top_rated?page=${page}`;
  if(section==='tv_popular') return `${API_BASE}/tv/popular?page=${page}`;
  if(section==='anime') return `${API_BASE}/discover/movie?with_genres=16&page=${page}`; // animation
  return `${API_BASE}/movie/popular?page=${page}`;
}

/* ============== RENDER ============== */
function renderMovies(list, mediaType='movie'){
  clearGrid();
  if(!list || list.length===0){
    moviesGrid.innerHTML = `<p class="muted">No results found.</p>`;
    return;
  }
  list.forEach(m=>{
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = m.id;
    card.dataset.type = mediaType;
    const title = escapeHtml(m.title || m.name || '');
    const poster = (m.poster_path || m.backdrop_path) ? IMG_BASE + (m.poster_path || m.backdrop_path) : '';
    card.innerHTML = `
      <div class="poster">${poster ? `<img src="${poster}" alt="${title}">` : `<div style="padding:20px;color:var(--muted)">No Image</div>`}</div>
      <div class="card-body">
        <div class="title-row"><h3>${title}</h3><span class="badge">⭐ ${m.vote_average ? Number(m.vote_average).toFixed(1) : '—'}</span></div>
        <div style="font-size:13px;color:var(--muted)">${(m.release_date||m.first_air_date)?(m.release_date||m.first_air_date).slice(0,4):'—'}</div>
      </div>
    `;
    card.addEventListener('click', ()=> openModal(m.id, mediaType));
    moviesGrid.appendChild(card);
  });
}

/* ============== LOAD SECTION ============== */
async function loadSection(section=state.section, page=state.page){
  try{
    showSkeletons(8); showLoader();
    state.section = section; state.page = page;
    const url = endpointForSection(section, page);
    const data = await tmdbFetch(url);
    clearSkeletons();
    renderMovies(data.results, section === 'tv_popular' ? 'tv' : 'movie');
    state.total_pages = data.total_pages || 1;
    pageInfo.textContent = `Page ${state.page} of ${state.total_pages}`;
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page >= state.total_pages;
  }catch(e){
    clearSkeletons();
    moviesGrid.innerHTML = `<p class="muted">Failed to load movies.</p>`;
    console.error(e);
  }finally{
    hideLoader();
  }
}

/* ============== MODAL ============== */
async function openModal(id, mediaType='movie'){
  try{
    modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
    modalPoster.src=''; modalTitle.textContent='Loading...'; modalOverview.textContent=''; modalCast.innerHTML=''; modalVideos.innerHTML=''; modalDownload.innerHTML=''; favBtn.textContent='☆ Add to Watchlist';

    const path = mediaType === 'tv' ? `${API_BASE}/tv/${id}` : `${API_BASE}/movie/${id}`;
    const data = await tmdbFetch(`${path}?append_to_response=videos,credits`);
    const title = data.title || data.name || 'Untitled';
    modalPoster.src = data.poster_path ? IMG_BASE + data.poster_path : '';
    modalTitle.textContent = title;
    modalSub.textContent = `${data.release_date ?? data.first_air_date ?? ''} • ${data.runtime ? data.runtime+' min' : (data.episode_run_time ? (data.episode_run_time[0]+' min ep') : '')}`;
    modalOverview.textContent = data.overview || 'No description available.';
    openTmdb.href = `https://www.themoviedb.org/${mediaType}/${id}`;

    // cast
    modalCast.innerHTML = data.credits?.cast?.slice(0,8).map(c=>`
      <div class="cast-item">
        <img src="${c.profile_path ? IMG_BASE + c.profile_path : ''}" alt="${escapeHtml(c.name)}">
        <button class="actor-link" data-id="${c.id}">${escapeHtml(c.name)}</button>
      </div>
    `).join('') || '<p class="muted">No cast available.</p>';

    modalCast.querySelectorAll('.actor-link').forEach(btn => btn.addEventListener('click', ()=> openActorModal(btn.dataset.id)));

    // trailers
    const vids = data.videos?.results?.filter(v => v.site === 'YouTube') || [];
    modalVideos.innerHTML = vids.length ? vids.map(v => `<iframe src="https://www.youtube.com/embed/${v.key}" allowfullscreen></iframe>`).join('') : '<p class="muted">No trailers available.</p>';

    // watchlist button state
    const isFav = isInWatchlist(id);
    favBtn.textContent = isFav ? '★ In Watchlist' : '☆ Add to Watchlist';
    favBtn.onclick = ()=> { toggleWatchlist({ id, title, poster: data.poster_path, mediaType }); showToast(isFav ? 'Removed from Watchlist' : 'Added to Watchlist'); };

    // load download links (and stream buttons)
    await loadDownloadLinks();

  }catch(e){
    modalOverview.textContent = 'Failed to load details.';
    console.error(e);
  }
}

function closeModal(){ modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }

/* ============== ACTOR MODAL ============== */
async function openActorModal(personId){
  try{
    actorModal.classList.remove('hidden'); actorModal.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
    actorBody.innerHTML = `<p>Loading actor...</p>`;
    const data = await tmdbFetch(`${API_BASE}/person/${personId}?append_to_response=movie_credits,tv_credits`);
    actorBody.innerHTML = `
      <div style="display:flex;gap:12px;align-items:flex-start">
        <img src="${data.profile_path?IMG_BASE+data.profile_path:''}" style="width:140px;border-radius:8px">
        <div><h2>${escapeHtml(data.name)}</h2><p class="muted">${escapeHtml(data.place_of_birth||'')} • Born: ${data.birthday||''}</p><p>${escapeHtml(data.biography||'No biography available.')}</p></div>
      </div>
      <h3>Known For</h3>
      <div class="grid">
        ${(data.movie_credits?.cast || []).slice(0,8).map(m=>`<div class="card" data-id="${m.id}"><div class="poster">${m.poster_path?`<img src="${IMG_BASE+m.poster_path}">`:""}</div><div class="card-body"><h4>${escapeHtml(m.title)}</h4></div></div>`).join('')}
      </div>
    `;
    actorBody.querySelectorAll('.card').forEach(c=>c.addEventListener('click', ()=> { openModal(c.dataset.id, 'movie'); closeActorModal(); }));
  }catch(e){
    actorBody.innerHTML = `<p class="muted">Failed to load actor.</p>`;
  }
}
function closeActorModal(){ actorModal.classList.add('hidden'); actorModal.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }

/* ============== DOWNLOADS (STREAM + DOWNLOAD) ============== */
/*
  Note: your API returns top-level `results[]` (download_url, stream_url, quality, size)
  and `subtitles[]`. We'll show all results and provide:
    - "Stream" button: opens internal HTML5 player (attempt)
    - "Open in new tab" button: fallback if playback blocked
    - "Download" (direct download_url)
  We attach subtitles if available.
*/
async function loadDownloadLinks(){
  try{
    modalDownload.innerHTML = '<p class="muted">Loading download links...</p>';

    // fetch your download API directly (you reported it returns JSON)
    const res = await fetch(DOWNLOAD_API);
    if(!res.ok) throw new Error('Download API failed');
    const data = await res.json();

    const list = data.results || [];
    const subs = data.subtitles || [];

    if(list.length === 0){
      modalDownload.innerHTML = '<p class="muted">No download links available.</p>';
      return;
    }

    // Build HTML: for each available quality show stream + download + subtitles link
    modalDownload.innerHTML = list.map(item => {
      // sanitize urls/text
      const q = escapeHtml(item.quality || 'Link');
      const dl = item.download_url || item.download_url;
      const stream = item.stream_url || item.stream_url;
      const size = item.size ? (Number(item.size) >= 1024 ? Math.round(Number(item.size)/1024/1024) + ' MB' : item.size) : 'Unknown';
      return `
        <div class="download-block" style="margin-bottom:12px;">
          <strong style="color:var(--accent)">Quality: ${q}</strong><br>
          <small class="muted">Size: ${escapeHtml(String(item.size||'Unknown'))}</small>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn stream-btn" data-stream="${escapeHtml(stream)}">▶ Stream</button>
            <a class="btn outline" href="${dl}" target="_blank" rel="noopener">⬇ Download</a>
            <a class="btn" href="${stream}" target="_blank" rel="noopener" style="background:#444">Open stream</a>
          </div>
        </div>
      `;
    }).join('');

    // attach stream button handlers AFTER DOM set
    modalDownload.querySelectorAll('.stream-btn').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const streamUrl = btn.dataset.stream;
        // attempt to attach subtitles (all subtitles from API)
        openPlayer(streamUrl, subs);
      });
    });

  }catch(e){
    console.error(e);
    modalDownload.innerHTML = '<p class="muted">Failed to load download links.</p>';
  }
}

/* ============== PLAYER (HTML5 video) ============== */
/*
  openPlayer(streamUrl, subtitlesArray)
  - streamUrl: direct mp4 or HLS (mp4 recommended)
  - subtitlesArray: array of {lan, lanName, url, size}
*/
function openPlayer(streamUrl, subtitles=[]){
  if(!playerModal || !playerContainer){
    // fallback: open in new tab
    window.open(streamUrl, '_blank');
    return;
  }

  // clear previous
  playerContainer.innerHTML = '';

  // Create video element
  const video = document.createElement('video');
  video.controls = true;
  video.autoplay = true;
  video.style.width = '100%';
  video.style.height = '100%';
  video.setAttribute('playsinline','');
  video.setAttribute('webkit-playsinline','');

  // Source
  const src = document.createElement('source');
  src.src = streamUrl;
  // try to infer type
  if (streamUrl.endsWith('.m3u8')) {
    // HLS; browsers do not natively support HLS except Safari.
    // For HLS you'd need hls.js — we will fallback to open in new tab if not Safari.
    // Attempt set type, but HLS likely won't play on Chrome.
    src.type = 'application/vnd.apple.mpegurl';
  } else {
    src.type = 'video/mp4';
  }
  video.appendChild(src);

  // Attach subtitles (if any). The API gives subtitle URLs — add as <track>
  (subtitles || []).forEach(s=>{
    if(!s.url) return;
    const tr = document.createElement('track');
    tr.kind = 'subtitles';
    tr.label = s.lanName || s.lan || 'Subtitle';
    tr.srclang = (s.lan && s.lan.split('_')[0]) || 'en';
    tr.src = s.url;
    video.appendChild(tr);
  });

  // Error handling: on error, show fallback open link
  video.addEventListener('error', (ev) => {
    console.warn('Video playback error', ev);
    playerContainer.innerHTML = `<p class="muted">Playback failed in the embedded player. You can open the stream in a new tab:</p>
      <a class="btn" href="${streamUrl}" target="_blank" rel="noopener">Open stream in new tab</a>`;
  });

  // Append and show modal
  playerContainer.appendChild(video);
  playerModal.classList.remove('hidden');
  playerModal.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';

  // Play attempt (some browsers require user gesture)
  const playPromise = video.play();
  if (playPromise !== undefined) {
    playPromise.catch(err => {
      // Autoplay blocked — show notice & keep controls so user can press play
      console.info('Autoplay blocked or playback error', err);
      showToast('Tap play to start streaming');
    });
  }
}

/* player modal close */
if(playerModal){
  playerModal.querySelector('.player-close')?.addEventListener('click', ()=>{
    playerModal.classList.add('hidden');
    playerModal.setAttribute('aria-hidden','true');
    playerContainer.innerHTML = '';
    document.body.style.overflow = '';
  });
  playerModal.addEventListener('click', (e)=>{
    if(e.target === playerModal){
      playerModal.classList.add('hidden');
      playerModal.setAttribute('aria-hidden','true');
      playerContainer.innerHTML = '';
      document.body.style.overflow = '';
    }
  });
}

/* ============== CAROUSELS ============== */
function createCarouselItem(movie, mediaType='movie'){
  const item = document.createElement('div');
  item.className = 'carousel-item';
  item.dataset.id = movie.id;
  item.dataset.type = mediaType;
  const poster = movie.poster_path ? IMG_BASE + movie.poster_path : (movie.backdrop_path ? IMG_BASE + movie.backdrop_path : '');
  item.innerHTML = `<img src="${poster}" alt="${escapeHtml(movie.title || movie.name)}">`;
  return item;
}
async function loadCarousel(rowId, endpoint, mediaType='movie'){
  const row = document.getElementById(rowId);
  if(!row) return;
  row.innerHTML = `<div style="padding:12px;color:var(--muted)">Loading...</div>`;
  try{
    const data = await tmdbFetch(endpoint);
    row.innerHTML = '';
    (data.results || []).slice(0,18).forEach(m => {
      const it = createCarouselItem(m, mediaType);
      it.addEventListener('click', ()=> openModal(m.id, mediaType));
      row.appendChild(it);
    });
    makeDraggable(row);
  }catch(e){
    row.innerHTML = `<p class="muted">Failed to load.</p>`;
  }
}
function makeDraggable(el){
  let isDown=false, startX, scrollLeft;
  el.addEventListener('mousedown', e => { isDown=true; el.classList.add('active'); startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft; });
  el.addEventListener('mouseleave', ()=> { isDown=false; el.classList.remove('active'); });
  el.addEventListener('mouseup', ()=> { isDown=false; el.classList.remove('active'); });
  el.addEventListener('mousemove', e => { if(!isDown) return; e.preventDefault(); const x = e.pageX - el.offsetLeft; const walk = (x - startX) * 1.5; el.scrollLeft = scrollLeft - walk; });
}

/* initialize carousels (non-proxied tmdb endpoints here) */
loadCarousel('trendingRow', `${API_BASE}/trending/movie/week?api_key=${API_KEY}`);
loadCarousel('topRatedRow', `${API_BASE}/movie/top_rated?api_key=${API_KEY}`);
loadCarousel('nowPlayingRow', `${API_BASE}/movie/now_playing?api_key=${API_KEY}`);

/* carousel button controls */
document.querySelectorAll('.carousel-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const target = document.getElementById(btn.dataset.target);
    if(!target) return;
    const amount = btn.classList.contains('left') ? -420 : 420;
    target.scrollBy({ left: amount, behavior: 'smooth' });
  });
});

/* ============== SEARCH + SUGGESTIONS ============== */
function debounce(fn, wait=300){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), wait); }; }
const fetchSuggestions = debounce(async (q) => {
  if(!q){ suggestionsBox?.classList.add('hidden'); return; }
  try{
    const data = await tmdbFetch(`${API_BASE}/search/multi?query=${encodeURIComponent(q)}&page=1`);
    const list = (data.results||[]).filter(r=>r.media_type!=='person').slice(0,8);
    if(!list.length){ suggestionsBox?.classList.add('hidden'); return; }
    suggestionsBox.innerHTML = list.map(m => `<div class="suggest-item" data-id="${m.id}" data-type="${m.media_type}">${escapeHtml(m.title || m.name)} <small class="muted">• ${(m.release_date||m.first_air_date||'').slice(0,4)}</small></div>`).join('');
    suggestionsBox.classList.remove('hidden');
    suggestionsBox.querySelectorAll('.suggest-item').forEach(it=> it.addEventListener('click', ()=> {
      const id = it.dataset.id; const type = it.dataset.type || 'movie';
      suggestionsBox.classList.add('hidden'); searchInput.value = it.textContent.trim(); openModal(id, type);
    }));
  }catch(e){
    suggestionsBox?.classList.add('hidden');
  }
}, 300);

searchInput.addEventListener('input', e => {
  const v = e.target.value.trim();
  state.query = v;
  fetchSuggestions(v);
});
searchBtn.addEventListener('click', ()=> { const q = searchInput.value.trim(); if(q) { state.page=1; doSearch(q,1); }});
searchInput.addEventListener('keydown', e => { if(e.key==='Enter'){ e.preventDefault(); const q=searchInput.value.trim(); if(q){ state.page=1; doSearch(q,1); } } });

/* search */
async function doSearch(query, page=1){
  try{
    showSkeletons(6); showLoader();
    const data = await tmdbFetch(`${API_BASE}/search/multi?query=${encodeURIComponent(query)}&page=${page}`);
    clearSkeletons();
    const normalized = (data.results||[]).map(r=>({ id: r.id, title: r.title || r.name, name: r.name, poster_path: r.poster_path || r.backdrop_path, vote_average: r.vote_average, release_date: r.release_date || r.first_air_date }));
    renderMovies(normalized);
    state.total_pages = data.total_pages || 1;
    pageInfo.textContent = `Search: "${query}" — Page ${state.page} of ${state.total_pages}`;
  }catch(e){
    clearSkeletons(); moviesGrid.innerHTML = `<p class="muted">Search failed.</p>`; console.error(e);
  }finally{ hideLoader(); }
}

/* ============== PAGINATION ============== */
nextBtn.addEventListener('click', ()=>{ if(state.page < state.total_pages){ state.page++; loadSection(state.section, state.page);} });
prevBtn.addEventListener('click', ()=>{ if(state.page > 1){ state.page--; loadSection(state.section, state.page);} });

/* ============== WATCHLIST (localStorage) ============== */
function watchlistKey(){ return 'moviehub_watchlist_v2'; }
function getWatchlist(){ try{ return JSON.parse(localStorage.getItem(watchlistKey())||'[]'); }catch{ return []; } }
function saveWatchlist(list){ localStorage.setItem(watchlistKey(), JSON.stringify(list)); }
function isInWatchlist(id){ return getWatchlist().some(i => Number(i.id) === Number(id)); }
function toggleWatchlist(item){
  const list = getWatchlist();
  const exists = list.find(i => Number(i.id) === Number(item.id));
  if(exists){ saveWatchlist(list.filter(i => Number(i.id) !== Number(item.id))); favBtn.textContent = '☆ Add to Watchlist'; showToast('Removed from Watchlist'); }
  else { list.unshift({ id: item.id, title: item.title || item.name || '', poster: item.poster, mediaType: item.mediaType || 'movie' }); saveWatchlist(list); favBtn.textContent = '★ In Watchlist'; showToast('Added to Watchlist'); }
  renderWatchlistPanel();
}
function renderWatchlistPanel(){
  const list = getWatchlist();
  watchlistItems.innerHTML = list.length ? list.map(i=>`<div class="watch-item" data-id="${i.id}"><img src="${i.poster?IMG_BASE+i.poster:''}" style="width:72px;border-radius:6px;margin-right:8px"><div style="flex:1"><strong>${escapeHtml(i.title)}</strong><div style="margin-top:6px"><button class="btn open">Open</button> <button class="btn outline remove">Remove</button></div></div></div>`).join('') : `<p class="muted">Your watchlist is empty.</p>`;
  // attach handlers
  watchlistItems.querySelectorAll('.watch-item .open').forEach(btn => btn.addEventListener('click', (e)=>{ const id = btn.closest('.watch-item').dataset.id; openModal(id); watchlistPanel.classList.add('hidden'); }));
  watchlistItems.querySelectorAll('.watch-item .remove').forEach(btn => btn.addEventListener('click', ()=> { const id = btn.closest('.watch-item').dataset.id; saveWatchlist(getWatchlist().filter(i => Number(i.id) !== Number(id))); renderWatchlistPanel(); }));
}
watchlistBtn?.addEventListener('click', ()=> { renderWatchlistPanel(); watchlistPanel.classList.remove('hidden'); watchlistPanel.setAttribute('aria-hidden','false'); });
closeWatchlist?.addEventListener('click', ()=> { watchlistPanel.classList.add('hidden'); watchlistPanel.setAttribute('aria-hidden','true'); });
clearWatchlist?.addEventListener('click', ()=> { saveWatchlist([]); renderWatchlistPanel(); });

/* ============== THEMES ============== */
themeToggle?.addEventListener('click', ()=> document.body.classList.toggle('light'));
colorTheme?.addEventListener('change', e => {
  document.body.classList.remove('theme-sunset','theme-ocean','theme-neo','theme-galaxy','theme-gold','theme-matrix');
  if(e.target.value) document.body.classList.add('theme-'+e.target.value);
});

/* ============== MODAL CLOSE HANDLERS ============== */
modalClose?.addEventListener('click', closeModal);
modal?.addEventListener('click', (e)=> { if(e.target === modal) closeModal(); });
actorModal?.querySelectorAll('.actor-close').forEach(b => b.addEventListener('click', closeActorModal));
actorModal?.addEventListener('click', e => { if(e.target === actorModal) closeActorModal(); });
document.addEventListener('keydown', e => { if(e.key === 'Escape'){ closeModal(); closeActorModal(); playerModal?.classList.add('hidden'); watchlistPanel?.classList.add('hidden'); } });

/* ============== INIT ============== */
loadSection('popular',1);

/* close suggestions on outside click */
document.addEventListener('click', (e) => { if(!suggestionsBox?.contains(e.target) && e.target !== searchInput) suggestionsBox?.classList.add('hidden'); });

/* drag-to-scroll for carousels - touch support */
['trendingRow','topRatedRow','nowPlayingRow'].forEach(id=>{
  const el = document.getElementById(id);
  if(!el) return;
  let startX=0, scrollLeft=0, isDown=false;
  el.addEventListener('touchstart', e => { isDown=true; startX = e.touches[0].pageX - el.offsetLeft; scrollLeft = el.scrollLeft; });
  el.addEventListener('touchmove', e => { if(!isDown) return; const x = e.touches[0].pageX - el.offsetLeft; const walk = (x - startX) * 1.5; el.scrollLeft = scrollLeft - walk; });
  el.addEventListener('touchend', ()=> isDown=false );
});

/* unhandled rejection logging */
window.addEventListener('unhandledrejection', e => console.warn('Unhandled promise rejection:', e.reason));