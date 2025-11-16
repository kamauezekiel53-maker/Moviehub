/* Movie Hub — app.js
   Replace API_KEY below if you want to rotate it.
*/
const API_KEY = "7cc9abef50e4c94689f48516718607be";
const BASE = "https://api.themoviedb.org/3";
const IMAGE = (path, size='w500') => path ? `https://image.tmdb.org/t/p/${size}${path}` : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="100%" height="100%" fill="%23ddd"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23666">No Image</text></svg>';

const appRoot = document.getElementById('app');
const moviesGrid = document.getElementById('moviesGrid');
const loadingEl = document.getElementById('loading');
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const suggestionsEl = document.getElementById('suggestions');
const sectionsNav = document.getElementById('sections');
const pagination = { prevBtn: document.getElementById('prevBtn'), nextBtn: document.getElementById('nextBtn'), pageInfo: document.getElementById('pageInfo') };
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');
const modeToggle = document.getElementById('modeToggle');
const themeSelect = document.getElementById('themeSelect');

/* State */
let state = {
  section: 'popular', // popular, trending, now_playing, top_rated
  page: 1,
  total_pages: 1,
  query: '',
  suggestionsActive: false,
  mode: 'dark', // dark | light
  theme: 'vibrant',
  lastFetchId: 0
};

/* Helpers */
function qs(path, params={}) {
  const url = new URL(BASE + path);
  url.searchParams.set('api_key', API_KEY);
  Object.entries(params).forEach(([k,v]) => { if (v !== undefined && v !== null) url.searchParams.set(k, v); });
  return url.toString();
}
function showLoading(show=true){
  loadingEl.hidden = !show;
}
function setSection(sec){
  state.section = sec;
  state.page = 1;
  document.querySelectorAll('#sections button').forEach(b => b.classList.toggle('active', b.dataset.section === sec));
  loadMovies();
}
function setMode(mode){
  state.mode = mode;
  document.documentElement.setAttribute('data-mode', mode === 'light' ? 'light' : 'dark');
  modeToggle.textContent = mode === 'light' ? '☀️' : '🌙';
  modeToggle.setAttribute('aria-pressed', mode === 'light');
}
function setTheme(theme){
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
}

/* Fetch utilities */
async function fetchJSON(url){
  const id = ++state.lastFetchId;
  showLoading(true);
  try{
    const res = await fetch(url);
    if(!res.ok) throw new Error('Network error');
    const json = await res.json();
    // If a newer fetch happened, ignore stale response
    if (id !== state.lastFetchId) return null;
    return json;
  } finally {
    showLoading(false);
  }
}

/* Load movies by current state.section, page or search query */
async function loadMovies(){
  moviesGrid.innerHTML = '';
  suggestionsEl.hidden = true;

  let url;
  if (state.query) {
    url = qs('/search/movie', { query: state.query, page: state.page, include_adult: false });
  } else {
    if (state.section === 'trending') {
      url = qs('/trending/movie/day', { page: state.page });
    } else {
      url = qs(`/movie/${state.section}`, { page: state.page });
    }
  }

  const data = await fetchJSON(url);
  if (!data) return;
  state.total_pages = data.total_pages || 1;
  renderMovies(data.results || []);
  updatePagination();
}

/* Render list */
function renderMovies(list){
  moviesGrid.innerHTML = '';
  if (!list || list.length === 0) {
    moviesGrid.innerHTML = `<div class="empty" style="padding:40px;border-radius:12px;background:rgba(0,0,0,0.12);text-align:center">No results</div>`;
    return;
  }

  list.forEach(m => {
    const card = document.createElement('article');
    card.className = 'card';
    card.tabIndex = 0;
    card.innerHTML = `
      <img class="poster" loading="lazy" src="${IMAGE(m.poster_path,'w500')}" alt="${escapeHtml(m.title)} poster" />
      <div class="info">
        <h3 class="title">${escapeHtml(m.title)}</h3>
        <div class="meta">
          <span>${m.release_date ? m.release_date.slice(0,4) : '—'}</span>
          <strong>⭐ ${m.vote_average ? Number(m.vote_average).toFixed(1) : '—'}</strong>
        </div>
        <p class="overview">${escapeHtml(m.overview || '')}</p>
      </div>
    `;
    card.addEventListener('click', ()=> openDetails(m.id));
    card.addEventListener('keydown', (e)=> { if (e.key === 'Enter') openDetails(m.id) });
    moviesGrid.appendChild(card);
  });
}

/* Pagination */
function updatePagination(){
  pagination.pageInfo.textContent = `Page ${state.page} / ${state.total_pages}`;
  pagination.prevBtn.disabled = state.page <= 1;
  pagination.nextBtn.disabled = state.page >= state.total_pages;
}
pagination.prevBtn.addEventListener('click', ()=> { if(state.page>1){ state.page--; loadMovies(); }});
pagination.nextBtn.addEventListener('click', ()=> { if(state.page<state.total_pages){ state.page++; loadMovies(); }});

/* Modal (details + trailer + cast) */
async function openDetails(movieId){
  modal.setAttribute('aria-hidden','false');
  modalBody.innerHTML = `<div style="padding:20px;text-align:center">Loading details…</div>`;
  document.body.style.overflow = 'hidden';

  const data = await fetchJSON(qs(`/movie/${movieId}`, { append_to_response: 'videos,credits,images' }));
  if (!data) return;

  // find youtube trailer
  const vids = (data.videos && data.videos.results) || [];
  const yt = vids.find(v => v.site === 'YouTube' && /trailer/i.test(v.type)) || vids.find(v => v.site === 'YouTube');
  const trailerEmbed = yt ? `<iframe width="100%" height="220" src="https://www.youtube.com/embed/${yt.key}" title="Trailer" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>` : '<div style="padding:20px;border-radius:8px;background:rgba(0,0,0,0.06);text-align:center">No trailer available</div>';

  const poster = IMAGE(data.poster_path,'w780');
  const cast = (data.credits && data.credits.cast ? data.credits.cast.slice(0,8) : []);

  modalBody.innerHTML = `
    <div>
      ${trailerEmbed}
      <h2 style="margin:12px 0 6px">${escapeHtml(data.title)} <small style="font-weight:600;color:var(--muted)">(${data.release_date ? data.release_date.slice(0,4) : '—'})</small></h2>
      <p style="color:var(--muted);margin:6px 0">${escapeHtml(data.tagline || '')}</p>
      <p style="line-height:1.4">${escapeHtml(data.overview || 'No overview available.')}</p>
      <p style="color:var(--muted);margin-top:8px">Genres: ${(data.genres || []).map(g=>g.name).join(', ') || '—'}</p>
    </div>
    <aside style="padding-left:10px">
      <img class="poster-lg" src="${poster}" alt="${escapeHtml(data.title)} poster" />
      <h4 style="margin-top:10px">Cast</h4>
      <div class="cast-list">
        ${cast.map(c => `<div class="cast-item"><img src="${c.profile_path ? IMAGE(c.profile_path,'w92') : IMAGE(null)}" alt="${escapeHtml(c.name)}" /><div><strong>${escapeHtml(c.name)}</strong><div style="color:var(--muted);font-size:13px">${escapeHtml(c.character || '')}</div></div></div>`).join('')}
      </div>
    </aside>
  `;
}

modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', (e)=> { if (e.target === modal) closeModal(); });
document.addEventListener('keydown', (e)=> { if (e.key === 'Escape') closeModal(); });

function closeModal(){
  modal.setAttribute('aria-hidden','true');
  modalBody.innerHTML = '';
  document.body.style.overflow = '';
}

/* Search suggestions (live) */
let suggTimeout = 0;
function debounce(fn, wait=300){
  let t;
  return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), wait); };
}
const fetchSuggestions = debounce(async (q) => {
  if (!q) { suggestionsEl.hidden = true; return; }
  const data = await fetchJSON(qs('/search/movie', { query: q, page: 1 }));
  if (!data) return;
  const list = (data.results || []).slice(0,8);
  suggestionsEl.innerHTML = list.map(m => `<li data-id="${m.id}" data-title="${escapeHtml(m.title)}">${escapeHtml(m.title)} <span style="opacity:.6">• ${m.release_date ? m.release_date.slice(0,4) : ''}</span></li>`).join('');
  suggestionsEl.hidden = list.length === 0;
});
searchInput.addEventListener('input', (e)=> {
  const q = e.target.value.trim();
  state.query = q;
  fetchSuggestions(q);
});
suggestionsEl.addEventListener('click', (e)=> {
  const li = e.target.closest('li');
  if (!li) return;
  const id = li.dataset.id;
  const title = li.dataset.title;
  searchInput.value = title;
  suggestionsEl.hidden = true;
  state.query = title;
  state.page = 1;
  loadMovies();
});
searchInput.addEventListener('keydown', (e)=> {
  if (e.key === 'ArrowDown') {
    const first = suggestionsEl.querySelector('li');
    if (first) first.focus();
  }
});

/* Search submit */
searchForm.addEventListener('submit', (e)=> {
  e.preventDefault();
  state.query = searchInput.value.trim();
  state.page = 1;
  loadMovies();
});

/* Sections nav */
sectionsNav.addEventListener('click', (e)=> {
  const btn = e.target.closest('button');
  if (!btn) return;
  setSection(btn.dataset.section);
});

/* Theme & Mode */
modeToggle.addEventListener('click', ()=> setMode(state.mode === 'light' ? 'dark' : 'light'));
themeSelect.addEventListener('change', (e)=> setTheme(e.target.value));

/* Utils */
function escapeHtml(str=''){
  return String(str)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

/* Initial load */
(function init(){
  setTheme(state.theme);
  setMode(state.mode);
  // mark active section
  document.querySelectorAll('#sections button').forEach(b => {
    if (b.dataset.section === state.section) b.classList.add('active');
  });
  loadMovies();
})();

/* Utility: handle no-image fallback inside modal generation */
function safeImage(path){
  return path ? IMAGE(path) : IMAGE(null);
}