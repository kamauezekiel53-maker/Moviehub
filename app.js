/* MovieHub — Full feature script
   - Themes (all 5), Watchlist, Streams, Downloads
   - Skeleton loading, trailers autoplay, fast search
*/

const API_KEY = '7cc9abef50e4c94689f48516718607be';
const IMG = 'https://image.tmdb.org/t/p/w500';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_PROXY = url => `https://corsproxy.io/?${encodeURIComponent(url)}`;

const GIFT_SEARCH = 'https://movieapi.giftedtech.co.ke/api/search?query=';
const GIFT_GET = 'https://movieapi.giftedtech.co.ke/api/getById?id=';

/* DOM */
const moviesGrid = document.getElementById('moviesGrid');
const loader = document.getElementById('loader');
const searchInput = document.getElementById('searchInput');
const themeSelect = document.getElementById('themeSelect');
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

const watchlistBtn = document.getElementById('watchlistBtn');
const watchlistPanel = document.getElementById('watchlistPanel');
const watchlistItems = document.getElementById('watchlistItems');
const closeWatchlist = document.getElementById('closeWatchlist');
const clearWatchlist = document.getElementById('clearWatchlist');

const playerModal = document.getElementById('playerModal');
const playerContainer = document.getElementById('playerContainer');

let state = { section:'popular', page:1, total_pages:1, debounce:null };

/* ---------- helper fetch for TMDb with proxy and key ---------- */
async function tmdbFetch(url){
  const u = new URL(url);
  u.searchParams.set('api_key', API_KEY);
  const res = await fetch(TMDB_PROXY(u.toString()));
  if(!res.ok) throw new Error('TMDb fetch failed');
  return res.json();
}
async function plainFetch(url){
  const r = await fetch(url);
  return r.json();
}

/* ---------- UI helpers ---------- */
function showLoader(){ loader.classList.remove('hidden'); }
function hideLoader(){ loader.classList.add('hidden'); }
function clearGrid(){ moviesGrid.innerHTML = ''; }
function escapeHtml(s=''){ return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

/* ---------- skeletons ---------- */
function showSkeletons(n=8){
  clearGrid();
  moviesGrid.classList.add('skeleton-grid');
  for(let i=0;i<n;i++){
    const sk = document.createElement('div');
    sk.className = 'skeleton-card';
    sk.innerHTML = `<div class="sk-poster"></div><div class="sk-body"><div class="skeleton-line sk-w-85"></div><div class="skeleton-line sk-w-70"></div><div class="skeleton-line sk-w-50"></div></div>`;
    moviesGrid.appendChild(sk);
  }
}
function clearSkeletons(){ moviesGrid.classList.remove('skeleton-grid'); clearGrid(); }

/* ---------- endpoints ---------- */
function endpointFor(section,page=1){
  if(section==='trending') return `${TMDB_BASE}/trending/movie/week?page=${page}`;
  if(section==='now_playing') return `${TMDB_BASE}/movie/now_playing?page=${page}`;
  if(section==='top_rated') return `${TMDB_BASE}/movie/top_rated?page=${page}`;
  if(section==='tv') return `${TMDB_BASE}/tv/popular?page=${page}`;
  if(section==='anime') return `${TMDB_BASE}/discover/tv?with_genres=16&page=${page}`;
  return `${TMDB_BASE}/movie/popular?page=${page}`;
}

/* ---------- render movies ---------- */
function renderMovies(list){
  clearGrid();
  if(!list || list.length===0){ moviesGrid.innerHTML = '<p class="muted">No results found.</p>'; return; }
  for(const m of list){
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = m.id;
    card.dataset.type = m.media_type || (m.first_air_date ? 'tv' : 'movie');
    const title = escapeHtml(m.title || m.name || '');
    const poster = m.poster_path ? IMG + m.poster_path : '';
    card.innerHTML = `<div class="poster">${poster?`<img src="${poster}" alt="${title}">`:`<div style="padding:18px;color:var(--muted)">No Image</div>`}</div>
      <div class="card-body"><div class="title-row"><h3>${title}</h3><span class="badge">⭐ ${m.vote_average?Number(m.vote_average).toFixed(1):'—'}</span></div><div style="font-size:13px;color:var(--muted)">${(m.release_date||m.first_air_date)?(m.release_date||m.first_air_date).slice(0,4):'—'}</div></div>`;
    card.addEventListener('click', ()=> openModal(m.id, card.dataset.type));
    moviesGrid.appendChild(card);
  }
}

/* ---------- load section ---------- */
async function loadSection(section=state.section,page=state.page){
  try{
    showSkeletons(8); showLoader();
    state.section = section; state.page = page;
    const data = await tmdbFetch(endpointFor(section,page));
    clearSkeletons();
    renderMovies(data.results);
    state.total_pages = data.total_pages || 1;
    pageInfo.textContent = `Page ${state.page} of ${state.total_pages}`;
    prevBtn.disabled = state.page <= 1; nextBtn.disabled = state.page >= state.total_pages;
  } catch(e){ clearSkeletons(); moviesGrid.innerHTML = '<p class="muted">Failed to load movies.</p>'; console.error(e); } finally { hideLoader(); }
}

/* ---------- open modal ---------- */
async function openModal(id, mediaType='movie'){
  modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
  modalPoster.src=''; modalTitle.textContent='Loading...'; modalOverview.textContent=''; modalCast.innerHTML=''; modalVideos.innerHTML=''; modalDownload.innerHTML='';
  try{
    const path = mediaType==='tv' ? `${TMDB_BASE}/tv/${id}` : `${TMDB_BASE}/movie/${id}`;
    const data = await tmdbFetch(`${path}?append_to_response=videos,credits`);
    const title = data.title || data.name || 'Untitled';
    modalPoster.src = data.poster_path ? IMG + data.poster_path : '';
    modalTitle.textContent = title;
    modalSub.textContent = `${data.release_date ?? data.first_air_date ?? ''} • ${data.runtime?data.runtime+' min':''}`;
    modalOverview.textContent = data.overview || 'No description.';
    modalCast.innerHTML = data.credits?.cast?.slice(0,8).map(c=>`<div><img src="${c.profile_path?IMG+c.profile_path:''}"><small>${escapeHtml(c.name)}</small></div>`).join('') || '<p class="muted">No cast available.</p>';
    const vids = data.videos?.results?.filter(v=>v.site==='YouTube')||[];
    modalVideos.innerHTML = vids.length ? vids.map(v=>`<iframe src="https://www.youtube.com/embed/${v.key}?autoplay=1" allowfullscreen></iframe>`).join('') : '<p class="muted">No trailers available.</p>';
    // watchlist button
    favBtn.textContent = isInWatchlist(id)?'★ In Watchlist':'☆ Add to Watchlist';
    favBtn.onclick = ()=> { toggleWatchlist({ id, title, poster: data.poster_path, mediaType }); showToast(isInWatchlist(id)?'Removed from Watchlist':'Added to Watchlist'); };
    openTmdb.href = `https://www.themoviedb.org/${mediaType}/${id}`;
    // load gift sources (search then get)
    await loadGiftedSources(title);
  } catch(e){ modalOverview.textContent = 'Failed to load details.'; console.error(e); }
}

/* ---------- GiftedTech flow (search -> getById) ---------- */
async function loadGiftedSources(title){
  modalDownload.innerHTML = '<p class="muted">Loading download links...</p>';
  try{
    const sr = await plainFetch(GIFT_SEARCH + encodeURIComponent(title));
    if(!sr.success || !sr.results || sr.results.length===0){ modalDownload.innerHTML = '<p class="muted">No download links found.</p>'; return; }
    const movie = sr.results[0]; // best guess
    const sourcesRes = await plainFetch(GIFT_GET + encodeURIComponent(movie.movieid || movie.id || movie._id || ''));
    if(!sourcesRes.status || !sourcesRes.sources || sourcesRes.sources.length===0){ modalDownload.innerHTML = '<p class="muted">No sources available.</p>'; return; }
    const sources = sourcesRes.sources;
    // stream player: pick best quality
    const best = sources.find(s=>s.quality==='1080p') || sources[0];
    modalVideos.innerHTML += `<video controls style="width:100%;margin-top:10px;border-radius:8px"><source src="${best.stream_url||best.url||best.link}" type="video/mp4"></video>`;
    // downloads list
    modalDownload.innerHTML = sources.map(s=>`<div style="margin-bottom:10px"><strong style="color:var(--accent)">${escapeHtml(s.quality||'Link')}</strong><br><a class="btn" href="${s.download_url||s.url||s.link}" target="_blank">Open / Download (${escapeHtml(String(s.size||'Unknown'))})</a></div>`).join('');
    // subtitles
    if(sourcesRes.subtitles && sourcesRes.subtitles.length){
      modalDownload.innerHTML += `<h4>Subtitles</h4>` + sourcesRes.subtitles.map(sub=>`<div><a class="btn outline" href="${sub.url}" target="_blank">${escapeHtml(sub.lanName||sub.lan)}</a></div>`).join('');
    }
  }catch(e){ console.error(e); modalDownload.innerHTML = '<p class="muted">Failed to load download links.</p>'; }
}

/* ---------- player modal (for external play) ---------- */
function openPlayerWithUrl(url){
  playerContainer.innerHTML = `<video controls autoplay style="width:100%"><source src="${encodeURI(url)}" type="video/mp4"></video>`;
  playerModal.classList.remove('hidden'); playerModal.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
}
playerModal.querySelector('.player-close')?.addEventListener('click', ()=>{ playerModal.classList.add('hidden'); playerContainer.innerHTML=''; document.body.style.overflow=''; });
playerModal.addEventListener('click', e=>{ if(e.target===playerModal){ playerModal.classList.add('hidden'); playerContainer.innerHTML=''; document.body.style.overflow=''; } });

/* ---------- search (debounced) ---------- */
function debounce(fn,ms=300){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }
const doSuggest = debounce(async q => {
  if(!q) return;
  try{
    const data = await tmdbFetch(`${TMDB_BASE}/search/multi?query=${encodeURIComponent(q)}&page=1`);
    // simple suggestions UI omitted for brevity — searching triggers result immediately
  }catch(e){/* ignore */ }
},300);
searchInput.addEventListener('input', e=>{ const v=e.target.value.trim(); if(!v){ loadSection(state.section,1); return; } doSearch(v,1); });

async function doSearch(query,page=1){
  try{ showSkeletons(6); showLoader(); const data = await tmdbFetch(`${TMDB_BASE}/search/multi?query=${encodeURIComponent(query)}&page=${page}`); clearSkeletons(); renderMovies((data.results||[]).slice(0,48)); state.total_pages = data.total_pages||1; pageInfo.textContent = `Search: "${query}" — Page ${state.page} of ${state.total_pages}`; } catch(e){ clearSkeletons(); moviesGrid.innerHTML = '<p class="muted">Search failed.</p>'; } finally{ hideLoader(); }
}

/* ---------- pagination & sections ---------- */
nextBtn.addEventListener('click', ()=>{ if(state.page < state.total_pages){ state.page++; loadSection(state.section,state.page); }});
prevBtn.addEventListener('click', ()=>{ if(state.page > 1){ state.page--; loadSection(state.section,state.page); }});
sectionButtons.forEach(b => b.addEventListener('click', e => { sectionButtons.forEach(x=>x.classList.remove('active')); e.currentTarget.classList.add('active'); state.section = e.currentTarget.dataset.sec; state.page = 1; searchInput.value = ''; loadSection(state.section,1); }));

/* ---------- watchlist (localStorage) ---------- */
const WATCH_KEY = 'moviehub_watch_v1';
function getWatchlist(){ try{ return JSON.parse(localStorage.getItem(WATCH_KEY)||'[]'); }catch{return [];}}
function saveWatchlist(list){ localStorage.setItem(WATCH_KEY, JSON.stringify(list)); }
function isInWatchlist(id){ return getWatchlist().some(i => Number(i.id) === Number(id)); }
function toggleWatchlist(item){
  const list = getWatchlist(); const exists = list.find(i=>Number(i.id)===Number(item.id));
  if(exists){ saveWatchlist(list.filter(i=>Number(i.id)!==Number(item.id))); showToast('Removed from watchlist'); } else { list.unshift(item); saveWatchlist(list); showToast('Added to watchlist'); }
  renderWatchlistPanel();
}
function renderWatchlistPanel(){
  const list = getWatchlist();
  watchlistItems.innerHTML = list.length ? list.map(i=>`<div class="watch-item" data-id="${i.id}"><img src="${i.poster?IMG+i.poster:''}" style="width:64px;border-radius:6px;margin-right:8px"><div style="flex:1"><strong>${escapeHtml(i.title)}</strong><div style="margin-top:6px"><button class="btn open">Open</button> <button class="btn outline remove">Remove</button></div></div></div>`).join('') : `<p class="muted">Your watchlist is empty.</p>`;
  watchlistItems.querySelectorAll('.watch-item .open').forEach(btn=>btn.addEventListener('click', e=>{ const id = btn.closest('.watch-item').dataset.id; openModal(id); watchlistPanel.classList.add('hidden'); }));
  watchlistItems.querySelectorAll('.watch-item .remove').forEach(btn=>btn.addEventListener('click', e=>{ const id = btn.closest('.watch-item').dataset.id; saveWatchlist(getWatchlist().filter(i=>Number(i.id)!==Number(id))); renderWatchlistPanel(); }));
}
watchlistBtn.addEventListener('click', ()=>{ renderWatchlistPanel(); watchlistPanel.classList.remove('hidden'); watchlistPanel.setAttribute('aria-hidden','false'); });
closeWatchlist?.addEventListener('click', ()=>{ watchlistPanel.classList.add('hidden'); watchlistPanel.setAttribute('aria-hidden','true'); });
clearWatchlist?.addEventListener('click', ()=>{ saveWatchlist([]); renderWatchlistPanel(); });

/* ---------- theme select ---------- */
themeSelect.addEventListener('change', e => {
  document.body.classList.remove('theme-netflix','theme-disney','theme-anime','theme-imdb','theme-glass');
  const v = e.target.value;
  if(v) document.body.classList.add('theme-' + v);
});

/* ---------- modal close ---------- */
modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if(e.target === modal) closeModal(); });
function closeModal(){ modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }

/* ---------- toast ---------- */
function showToast(msg, t=2200){ const el = document.getElementById('toast') || (function(){ const d=document.createElement('div'); d.id='toast'; d.className='toast hidden'; document.body.appendChild(d); return d; })(); el.textContent=msg; el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'), t); }

/* ---------- init carousels (optional) - minimal here ---------- */

/* ---------- start ---------- */
loadSection('popular',1);
window.addEventListener('unhandledrejection', e=>console.warn('Unhandled rejection', e.reason));