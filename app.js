/* ======================================================
   Movie Hub - app.js
   - All features: skeletons, carousels, TV, anime,
     actor pages, watchlist, themes, trailers, background
   - Uses corsproxy.io to avoid CORS issues
   ====================================================== */

const API_KEY = '7cc9abef50e4c94689f48516718607be';
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';
const API_BASE = 'https://api.themoviedb.org/3';
const DOWNLOAD_API = 'https://movieapi.giftedtech.co.ke/api/sources/6127914234610600632';

/* DOM */
const moviesGrid = document.getElementById('moviesGrid');
const loader = document.getElementById('loader');
const searchInput = document.getElementById('searchInput');
const suggestionsBox = document.getElementById('suggestions');
const sectionButtons = document.querySelectorAll('.sec-btn');
const pageInfo = document.getElementById('pageInfo');
const prevBtn = document.getElementById('prevPage');
const nextBtn = document.getElementById('nextPage');
const themeToggle = document.getElementById('themeToggle');
const colorTheme = document.getElementById('colorTheme');
const favoritesBtn = document.getElementById('favoritesBtn');

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
const moreLink = document.getElementById('moreLink');

const actorModal = document.getElementById('actorModal');
const actorBody = document.getElementById('actorBody');

const trendingRow = document.getElementById('trendingRow');
const topRatedRow = document.getElementById('topRatedRow');
const nowPlayingRow = document.getElementById('nowPlayingRow');

const watchlistPanel = document.getElementById('watchlistPanel');
const watchlistItems = document.getElementById('watchlistItems');
const closeWatchlist = document.getElementById('closeWatchlist');

/* STATE */
let state = { section: 'popular', page: 1, total_pages: 1, query: '', debounceTimer: null, lastFetchId: 0 };

/* ---------- utility: proxy and fetch with timeout ---------- */
function proxy(url) { return `https://corsproxy.io/?${encodeURIComponent(url)}`; }
function fetchWithTimeout(input, init = {}, timeout = 12000) {
  return Promise.race([
    fetch(input, init),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), timeout))
  ]);
}
function qs(url) {
  const u = new URL(url);
  u.searchParams.set('api_key', API_KEY);
  return fetchWithTimeout(proxy(u.toString()))
    .then(r => {
      if (!r.ok) throw new Error('Network error');
      return r.json();
    });
}

/* ---------- helpers ---------- */
function showLoader() { loader.classList.remove('hidden'); }
function hideLoader() { loader.classList.add('hidden'); }
function clearGrid() { moviesGrid.innerHTML = ''; }
function escapeHtml(s = '') { return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }

/* ---------- skeletons ---------- */
function showSkeletons(count = 8) {
  clearGrid();
  moviesGrid.classList.add('skeleton-grid');
  for (let i = 0; i < count; i++) {
    const sk = document.createElement('div');
    sk.className = 'skeleton-card';
    sk.innerHTML = `<div class="sk-poster"></div><div class="sk-body"><div class="skeleton-line sk-w-85"></div><div class="skeleton-line sk-w-70"></div><div class="skeleton-line sk-w-50"></div></div>`;
    moviesGrid.appendChild(sk);
  }
}
function clearSkeletons() { moviesGrid.classList.remove('skeleton-grid'); clearGrid(); }

/* ---------- endpoints ---------- */
function endpointForSection(section, page = 1) {
  if (section === 'trending') return `${API_BASE}/trending/movie/week?page=${page}`;
  if (section === 'now_playing') return `${API_BASE}/movie/now_playing?page=${page}`;
  if (section === 'top_rated') return `${API_BASE}/movie/top_rated?page=${page}`;
  if (section === 'tv_popular') return `${API_BASE}/tv/popular?page=${page}`;
  if (section === 'anime') return `${API_BASE}/discover/movie?with_genres=16&page=${page}`; // Animation
  return `${API_BASE}/movie/popular?page=${page}`;
}

/* ---------- render cards ---------- */
function renderMovies(list, mediaType = 'movie') {
  clearGrid();
  if (!list || list.length === 0) {
    moviesGrid.innerHTML = `<p class="muted">No results found.</p>`;
    return;
  }
  list.forEach(m => {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.id = m.id;
    card.dataset.type = mediaType;

    const poster = (m.poster_path || m.backdrop_path) ? IMG_BASE + (m.poster_path || m.backdrop_path) : '';
    card.innerHTML = `
      <div class="poster">${poster ? `<img src="${poster}" alt="${escapeHtml(m.title || m.name)}">` : `<div style="padding:20px;color:var(--muted)">No Image</div>`}</div>
      <div class="card-body">
        <div class="title-row">
          <h3>${escapeHtml(m.title || m.name)}</h3>
          <span class="badge">⭐ ${m.vote_average ? Number(m.vote_average).toFixed(1) : '—'}</span>
        </div>
        <div style="font-size:13px;color:var(--muted)">${(m.release_date || m.first_air_date) ? (m.release_date || m.first_air_date).slice(0,4) : '—'}</div>
      </div>
    `;
    card.addEventListener('click', () => openModal(m.id, mediaType));
    moviesGrid.appendChild(card);
  });
}

/* ---------- load section ---------- */
async function loadSection(section = state.section, page = state.page) {
  try {
    showSkeletons(8);
    showLoader();
    state.section = section; state.page = page;
    const url = endpointForSection(section, page);
    const data = await qs(url);
    clearSkeletons();

    // When selecting TV, TMDb returns different structure
    if (section === 'tv_popular') {
      renderMovies(data.results, 'tv');
    } else {
      renderMovies(data.results, 'movie');
    }

    state.total_pages = data.total_pages || 1;
    pageInfo.textContent = `Page ${state.page} of ${state.total_pages}`;
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page >= state.total_pages;
  } catch (e) {
    clearSkeletons();
    moviesGrid.innerHTML = `<p class="muted">Failed to load movies.</p>`;
    console.error(e);
  } finally {
    hideLoader();
  }
}

/* ---------- modal: movie details, trailers, cast ---------- */
async function openModal(id, mediaType = 'movie') {
  try {
    modal.classList.remove('hidden'); modal.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
    modalPoster.src = ''; modalTitle.textContent = 'Loading...'; modalOverview.textContent = ''; modalCast.innerHTML = ''; modalVideos.innerHTML = ''; modalDownload.innerHTML = ''; favBtn.textContent = '☆ Add to Watchlist';

    const path = mediaType === 'tv' ? `${API_BASE}/tv/${id}` : `${API_BASE}/movie/${id}`;
    const data = await qs(`${path}?append_to_response=videos,credits`);
    const title = data.title || data.name || 'Untitled';
    modalPoster.src = data.poster_path ? IMG_BASE + data.poster_path : '';
    modalTitle.textContent = title;
    modalSub.textContent = `${data.release_date ?? data.first_air_date ?? ''} • ${data.runtime ? data.runtime + ' min' : (data.episode_run_time ? data.episode_run_time[0] + ' min ep' : '')}`;
    modalOverview.textContent = data.overview || 'No description available.';
    moreLink.href = `https://www.themoviedb.org/${mediaType}/${id}`;

    // cast
    modalCast.innerHTML = data.credits?.cast?.slice(0,8).map(c => `
      <div class="cast-item">
        <img src="${c.profile_path ? IMG_BASE + c.profile_path : ''}" alt="${escapeHtml(c.name)}">
        <button class="actor-link" data-id="${c.id}">${escapeHtml(c.name)}</button>
      </div>
    `).join('') || '<p class="muted">No cast available.</p>';

    // attach actor listeners
    modalCast.querySelectorAll('.actor-link').forEach(btn => {
      btn.addEventListener('click', () => openActorModal(btn.dataset.id));
    });

    // trailers (improved: multiple in grid)
    const vids = data.videos?.results?.filter(v => v.site === 'YouTube') || [];
    modalVideos.innerHTML = vids.length ? vids.map(v => `<iframe src="https://www.youtube.com/embed/${v.key}" allowfullscreen></iframe>`).join('') : '<p class="muted">No trailers available.</p>';

    // update favorite button state
    const isFav = isInWatchlist(id);
    favBtn.textContent = isFav ? '★ In Watchlist' : '☆ Add to Watchlist';
    favBtn.onclick = () => toggleWatchlist({ id, title, poster: data.poster_path, mediaType });

    // downloads
    loadDownloadLinks(title);
  } catch (e) {
    modalOverview.textContent = 'Failed to load details.';
    console.error(e);
  }
}

/* ---------- actor modal ---------- */
async function openActorModal(personId) {
  try {
    actorModal.classList.remove('hidden'); actorModal.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
    actorBody.innerHTML = `<p>Loading actor...</p>`;
    const data = await qs(`${API_BASE}/person/${personId}?append_to_response=movie_credits,tv_credits`);
    actorBody.innerHTML = `
      <div style="display:flex;gap:12px;align-items:flex-start">
        <img src="${data.profile_path ? IMG_BASE+data.profile_path : ''}" style="width:140px;border-radius:8px">
        <div>
          <h2>${escapeHtml(data.name)}</h2>
          <p class="muted">${escapeHtml(data.place_of_birth || '')} • Born: ${data.birthday || ''}</p>
          <p>${escapeHtml(data.biography || 'No biography available.')}</p>
        </div>
      </div>
      <h3>Known For</h3>
      <div class="grid">
        ${(data.movie_credits?.cast || []).slice(0,8).map(m=>`<div class="card" data-id="${m.id}"><div class="poster">${m.poster_path?`<img src="${IMG_BASE+m.poster_path}">`:""}</div><div class="card-body"><h4>${escapeHtml(m.title)}</h4></div></div>`).join('')}
      </div>
    `;
    // attach click handlers for known-for cards
    actorBody.querySelectorAll('.card').forEach(c=>c.addEventListener('click',()=>{ openModal(c.dataset.id,'movie'); closeActorModal(); }));
  } catch (e) {
    actorBody.innerHTML = `<p class="muted">Failed to load actor.</p>`;
  }
}
function closeActorModal(){ actorModal.classList.add('hidden'); actorModal.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }

/* ---------- download links ---------- */
async function loadDownloadLinks(title){
  try {
    modalDownload.innerHTML = `<p class="muted">Loading download links...</p>`;
    const res = await fetch(DOWNLOAD_API);
    const data = await res.json();
    const matches = (data.sources || []).filter(s => s.title.toLowerCase().includes(title.toLowerCase()));
    if (!matches.length) { modalDownload.innerHTML = `<p class="muted">No download links found.</p>`; return; }
    modalDownload.innerHTML = matches.map(m => `<div style="margin-bottom:8px"><b style="color:var(--accent)">${m.quality||'Link'}</b><br><a class="btn" href="${m.url}" target="_blank">Download (${m.size || 'Unknown'})</a></div>`).join('');
  } catch (e) {
    modalDownload.innerHTML = `<p class="muted">Failed to load download links.</p>`;
  }
}

/* ---------- carousels ---------- */
function createCarouselItem(movie, mediaType='movie') {
  const item = document.createElement('div');
  item.className = 'carousel-item';
  item.dataset.id = movie.id;
  const poster = movie.poster_path ? IMG_BASE + movie.poster_path : (movie.backdrop_path ? IMG_BASE + movie.backdrop_path : '');
  item.innerHTML = `<img src="${poster}" alt="${escapeHtml(movie.title || movie.name)}">`;
  item.addEventListener('click', () => openModal(movie.id, mediaType));
  return item;
}
async function loadCarousel(rowId, endpoint, mediaType='movie') {
  const row = document.getElementById(rowId);
  row.innerHTML = `<div style="padding:12px;color:var(--muted)">Loading...</div>`;
  try {
    const data = await qs(endpoint);
    row.innerHTML = '';
    (data.results || []).slice(0, 18).forEach(m => row.appendChild(createCarouselItem(m, mediaType)));
    // enable drag-to-scroll
    makeDraggable(row);
  } catch (e) {
    row.innerHTML = `<p class="muted">Failed to load.</p>`;
  }
}
function makeDraggable(el) {
  let isDown=false,startX,scrollLeft;
  el.addEventListener('mousedown', e => { isDown=true; el.classList.add('active'); startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft; });
  el.addEventListener('mouseleave', ()=> { isDown=false; el.classList.remove('active'); });
  el.addEventListener('mouseup', ()=> { isDown=false; el.classList.remove('active'); });
  el.addEventListener('mousemove', e => { if(!isDown) return; e.preventDefault(); const x = e.pageX - el.offsetLeft; const walk = (x - startX) * 1.5; el.scrollLeft = scrollLeft - walk; });
}

/* carousel scroll buttons */
document.querySelectorAll('.carousel-btn').forEach(btn=>{
  btn.addEventListener('click', () => {
    const target = document.getElementById(btn.dataset.target);
    const amount = btn.classList.contains('left') ? -420 : 420;
    target.scrollBy({ left: amount, behavior: 'smooth' });
  });
});

/* ---------- search + suggestions ---------- */
function debounce(fn, wait=300){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), wait); }; }
const fetchSuggestions = debounce(async q => {
  if (!q) { suggestionsBox.classList.add('hidden'); return; }
  try {
    const data = await qs(`${API_BASE}/search/movie?query=${encodeURIComponent(q)}&page=1`);
    const list = (data.results || []).slice(0, 7);
    if (!list.length) { suggestionsBox.classList.add('hidden'); return; }
    suggestionsBox.innerHTML = list.map(m => `<div class="suggestion-item" data-id="${m.id}">${escapeHtml(m.title)} <small class="muted">• ${m.release_date ? m.release_date.slice(0,4):''}</small></div>`).join('');
    suggestionsBox.classList.remove('hidden');
    suggestionsBox.querySelectorAll('.suggestion-item').forEach(it => it.addEventListener('click', () => {
      searchInput.value = it.textContent.trim();
      suggestionsBox.classList.add('hidden');
      doSearch(searchInput.value, 1);
    }));
  } catch (e) {
    suggestionsBox.classList.add('hidden');
  }
}, 300);

searchInput.addEventListener('input', e => {
  const v = e.target.value.trim();
  state.query = v;
  fetchSuggestions(v);
});
document.getElementById('searchBtn').addEventListener('click', ()=> {
  const q = searchInput.value.trim();
  if (q) { state.page = 1; doSearch(q,1); }
});

/* ---------- search function ---------- */
async function doSearch(query, page = 1) {
  try {
    showSkeletons(6); showLoader();
    const url = `${API_BASE}/search/multi?query=${encodeURIComponent(query)}&page=${page}`; // multi: movies + tv
    const data = await qs(url);
    clearSkeletons();
    // we need to handle mixed results
    renderMovies((data.results || []).map(r => {
      // normalize to common shape for renderMovies
      return { id: r.id, title: r.title || r.name, name: r.name, poster_path: r.poster_path, backdrop_path: r.backdrop_path, vote_average: r.vote_average || r.vote_average, release_date: r.release_date || r.first_air_date };
    }));
    state.total_pages = data.total_pages || 1;
    pageInfo.textContent = `Search: "${query}" — Page ${state.page} of ${state.total_pages}`;
  } catch (e) {
    clearSkeletons(); moviesGrid.innerHTML = `<p class="muted">Search failed.</p>`; console.error(e);
  } finally { hideLoader(); }
}

/* ---------- pagination ---------- */
nextBtn.addEventListener('click', () => { if (state.page < state.total_pages) { state.page++; loadSection(state.section, state.page); } });
prevBtn.addEventListener('click', () => { if (state.page > 1) { state.page--; loadSection(state.section, state.page); } });

/* ---------- watchlist (localStorage) ---------- */
function watchlistKey(){ return 'moviehub_watchlist_v1'; }
function getWatchlist(){ try{ return JSON.parse(localStorage.getItem(watchlistKey())||'[]'); }catch{ return []; } }
function saveWatchlist(list){ localStorage.setItem(watchlistKey(), JSON.stringify(list)); }
function isInWatchlist(id){ return getWatchlist().some(i => Number(i.id) === Number(id)); }
function toggleWatchlist(item){
  const list = getWatchlist();
  const exists = list.find(i => Number(i.id) === Number(item.id));
  if (exists) {
    const filtered = list.filter(i => Number(i.id) !== Number(item.id));
    saveWatchlist(filtered);
    favBtn.textContent = '☆ Add to Watchlist';
  } else {
    list.unshift({ id: item.id, title: item.title || item.name || '', poster: item.poster, mediaType: item.mediaType || 'movie' });
    saveWatchlist(list);
    favBtn.textContent = '★ In Watchlist';
  }
  renderWatchlistPanel();
}
function renderWatchlistPanel(){
  const list = getWatchlist();
  watchlistItems.innerHTML = list.length ? list.map(i => `<div class="watch-item" data-id="${i.id}"><img src="${i.poster? IMG_BASE + i.poster : ''}" style="width:72px;border-radius:6px;margin-right:8px"><div style="flex:1"><strong>${escapeHtml(i.title)}</strong><div style="margin-top:6px"><button class="btn open">Open</button> <button class="btn outline remove">Remove</button></div></div></div>`).join('') : `<p class="muted">Your watchlist is empty.</p>`;
  // attach handlers
  watchlistItems.querySelectorAll('.watch-item .open').forEach(btn => btn.addEventListener('click', e => {
    const id = btn.closest('.watch-item').dataset.id;
    openModal(id); watchlistPanel.classList.add('hidden');
  }));
  watchlistItems.querySelectorAll('.watch-item .remove').forEach(btn => btn.addEventListener('click', e => {
    const id = btn.closest('.watch-item').dataset.id;
    saveWatchlist(getWatchlist().filter(i => Number(i.id) !== Number(id)));
    renderWatchlistPanel();
  }));
}
favoritesBtn.addEventListener('click', () => { renderWatchlistPanel(); watchlistPanel.classList.remove('hidden'); });
closeWatchlist.addEventListener('click', () => watchlistPanel.classList.add('hidden'));

/* ---------- themes ---------- */
themeToggle.addEventListener('click', () => document.body.classList.toggle('light'));
colorTheme.addEventListener('change', e => {
  document.body.classList.remove('theme-sunset','theme-ocean','theme-neo','theme-galaxy','theme-gold','theme-matrix');
  if (e.target.value) document.body.classList.add('theme-' + e.target.value);
});

/* ---------- event: open/close modal ---------- */
modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
function closeModal(){ modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }

/* actor modal close */
actorModal.querySelectorAll('.actor-close').forEach(btn => btn.addEventListener('click', closeActorModal));
actorModal.addEventListener('click', e => { if (e.target === actorModal) closeActorModal(); });

/* ---------- grid click (open movie) ---------- */
moviesGrid.addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (!card) return;
  const id = card.dataset.id;
  const type = card.dataset.type || 'movie';
  openModal(id, type);
});

/* ---------- initial carousels load ---------- */
loadCarousel('trendingRow', `${API_BASE}/trending/movie/week`);
loadCarousel('topRatedRow', `${API_BASE}/movie/top_rated`);
loadCarousel('nowPlayingRow', `${API_BASE}/movie/now_playing`);

/* ---------- initial main load ---------- */
loadSection('popular', 1);

/* ---------- suggestions close on outside click ---------- */
document.addEventListener('click', (e) => {
  if (!document.getElementById('suggestions').contains(e.target) && e.target !== searchInput) {
    suggestionsBox.classList.add('hidden');
  }
});

/* ---------- accessibility: keyboard close ---------- */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeModal(); closeActorModal();
    watchlistPanel.classList.add('hidden');
  }
});

/* ---------- simple error logging for console (optional) ---------- */
window.addEventListener('unhandledrejection', e => console.warn('Unhandled promise:', e.reason));