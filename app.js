/* ===============================
      MOVIE HUB FINAL APP.JS
   =============================== */

/* -----------------------------
   CONFIG
   ----------------------------- */
const API_KEY = '7cc9abef50e4c94689f48516718607be';
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';
const API_BASE = 'https://api.themoviedb.org/3';
const GIFTED_BASE = 'https://movieapi.giftedtech.co.ke/api'; // GiftedTech base

/* -----------------------------
   DOM
   ----------------------------- */
const moviesGrid = document.getElementById('moviesGrid');
const loader = document.getElementById('loader');
const searchInput = document.getElementById('searchInput');
const sectionButtons = document.querySelectorAll('.sec-btn');
const pageInfo = document.getElementById('pageInfo');
const prevBtn = document.getElementById('prevPage');
const nextBtn = document.getElementById('nextPage');
const themeToggle = document.getElementById('themeToggle');
const colorTheme = document.getElementById('colorTheme');

const modal = document.getElementById('modal');
const modalClose = document.getElementById('modalClose');
const modalPoster = document.getElementById('modalPoster');
const modalTitle = document.getElementById('modalTitle');
const modalOverview = document.getElementById('modalOverview');
const modalSub = document.getElementById('modalSub');
const modalCast = document.getElementById('modalCast');
const modalVideos = document.getElementById('modalVideos');
const modalDownload = document.getElementById('modalDownload');

/* -----------------------------
   STATE
   ----------------------------- */
let state = {
  section: 'popular',
  page: 1,
  total_pages: 1,
  query: '',
  debounceTimer: null
};

/* -----------------------------
   PROXY (only for TMDB)
   ----------------------------- */
function proxy(url) {
  return `https://corsproxy.io/?${encodeURIComponent(url)}`;
}

function qs(url) {
  const u = new URL(url);
  u.searchParams.set('api_key', API_KEY);
  // We proxy only TMDB endpoints to avoid CORS issues
  return fetch(proxy(u.toString())).then(r => {
    if (!r.ok) throw new Error('Network error');
    return r.json();
  });
}

/* -----------------------------
   UI Helpers
   ----------------------------- */
function showLoader() { loader.classList.remove('hidden'); }
function hideLoader() { loader.classList.add('hidden'); }
function clearGrid() { moviesGrid.innerHTML = ''; }
function escapeHtml(s = '') {
  return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/* -----------------------------
   Endpoints
   ----------------------------- */
function endpointForSection(section, page = 1) {
  if (section === 'trending') return `${API_BASE}/trending/movie/week?page=${page}`;
  if (section === 'now_playing') return `${API_BASE}/movie/now_playing?page=${page}`;
  if (section === 'top_rated') return `${API_BASE}/movie/top_rated?page=${page}`;
  return `${API_BASE}/movie/popular?page=${page}`;
}

/* -----------------------------
   Render movies
   ----------------------------- */
function renderMovies(list) {
  clearGrid();

  if (!list || list.length === 0) {
    moviesGrid.innerHTML = '<p class="muted">No results found.</p>';
    return;
  }

  list.forEach(m => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = m.id;

    const poster = m.poster_path ? IMG_BASE + m.poster_path : '';

    card.innerHTML = `
      <div class="poster">
        ${poster ? `<img src="${poster}" alt="${escapeHtml(m.title)}">`
        : '<div style="padding:18px;color:var(--muted)">No Image</div>'}
      </div>
      <div class="card-body">
        <div class="title-row">
          <h3>${escapeHtml(m.title)}</h3>
          <span class="badge">⭐ ${m.vote_average ? m.vote_average.toFixed(1) : '—'}</span>
        </div>
        <div style="font-size:13px;color:var(--muted)">
          ${m.release_date ? m.release_date.slice(0,4) : '—'}
        </div>
      </div>
    `;

    moviesGrid.appendChild(card);
  });
}

/* -----------------------------
   Load section
   ----------------------------- */
async function loadSection(section = state.section, page = state.page) {
  try {
    showLoader();
    const url = endpointForSection(section, page);
    const data = await qs(url);
    renderMovies(data.results);
    state.total_pages = data.total_pages || 1;
    pageInfo.textContent = `Page ${state.page} of ${state.total_pages}`;
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page >= state.total_pages;
  } catch (e) {
    moviesGrid.innerHTML = '<p class="muted">Failed to load movies.</p>';
  } finally {
    hideLoader();
  }
}

/* -----------------------------
   GiftedTech helpers
   ----------------------------- */

// Search GiftedTech by title -> returns internal ID or null
async function giftedSearch(title) {
  try {
    const url = `${GIFTED_BASE}/search?query=${encodeURIComponent(title)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;
    return data.results[0].id;
  } catch (e) {
    console.warn('Gifted search error', e);
    return null;
  }
}

// Fetch sources by internal ID -> returns normalized object {items: [...], subtitles: [...]}
async function giftedSources(id) {
  try {
    const res = await fetch(`${GIFTED_BASE}/sources/${id}`);
    if (!res.ok) return { items: [], subtitles: [] };
    const data = await res.json();
    // GiftedTech sometimes returns results[] (your sample) or sources[]; normalize:
    const items = data.results ?? data.sources ?? data.items ?? [];
    const subtitles = data.subtitles ?? data.subs ?? [];
    return { items, subtitles };
  } catch (e) {
    console.warn('Gifted sources error', e);
    return { items: [], subtitles: [] };
  }
}

/* -----------------------------
   Open modal (movie details + links)
   ----------------------------- */
async function openModal(movieId) {
  try {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    modalPoster.src = '';
    modalTitle.textContent = 'Loading...';
    modalOverview.textContent = '';
    modalCast.innerHTML = '';
    modalVideos.innerHTML = '';
    modalDownload.innerHTML = '';

    const data = await qs(`${API_BASE}/movie/${movieId}?append_to_response=videos,credits`);

    modalPoster.src = data.poster_path ? IMG_BASE + data.poster_path : '';
    modalTitle.textContent = data.title || 'Untitled';
    modalSub.textContent = `${data.release_date ?? ''} • ${data.runtime ? data.runtime + ' min' : ''}`;
    modalOverview.textContent = data.overview || 'No description available.';

    modalCast.innerHTML = data.credits?.cast?.slice(0,8).map(c => `
      <div>
        <img src="${c.profile_path ? IMG_BASE + c.profile_path : ''}" style="width:100%;border-radius:6px">
        <small>${c.name}</small>
      </div>
    `).join('') || '';

    const vids = data.videos?.results?.filter(v => v.type === 'Trailer' && v.site === 'YouTube') || [];
    modalVideos.innerHTML = vids.length ? vids.map(v => `<iframe src="https://www.youtube.com/embed/${v.key}" allowfullscreen></iframe>`).join('') : '<p class="muted">No trailers available.</p>';

    // Load GiftedTech links
    await loadDownloadLinks(data.title);

  } catch (e) {
    modalOverview.textContent = 'Failed to load details.';
    console.error(e);
  }
}

/* -----------------------------
   Load download/stream links (GiftedTech)
   ----------------------------- */
async function loadDownloadLinks(title) {
  try {
    modalDownload.innerHTML = '<p class="muted">Loading download links...</p>';

    // 1) find internal id
    const giftedId = await giftedSearch(title);
    if (!giftedId) {
      modalDownload.innerHTML = '<p class="muted">No download links found.</p>';
      return;
    }

    // 2) fetch sources
    const { items, subtitles } = await giftedSources(giftedId);
    if (!items || items.length === 0) {
      modalDownload.innerHTML = '<p class="muted">No download links available.</p>';
      return;
    }

    // 3) render list — items have fields like: quality, download_url, stream_url, size, format
    modalDownload.innerHTML = items.map(it => {
      const quality = it.quality || it.q || 'Link';
      const size = it.size ? formatBytes(Number(it.size)) : (it.size || 'Unknown');
      const href = it.download_url ?? it.download ?? it.url ?? it.stream_url ?? '#';
      return `
        <div style="margin-bottom:10px">
          <strong style="color:var(--accent)">${escapeHtml(quality)}</strong><br>
          <a class="btn" href="${href}" target="_blank" rel="noopener noreferrer">
            Download / Open (${escapeHtml(size)})
          </a>
          ${it.stream_url ? `<a class="btn" style="margin-left:8px;background:transparent;border:1px solid rgba(255,255,255,0.06)">Stream</a>` : ''}
        </div>
      `;
    }).join('');

    // Optionally show subtitles
    if (subtitles && subtitles.length) {
      modalDownload.innerHTML += `<div style="margin-top:8px"><strong>Subtitles:</strong><br>` +
        subtitles.map(s => `<div style="font-size:13px">${escapeHtml(s.lanName || s.lan || 'Subtitle')} — <a href="${s.url}" target="_blank">Download</a></div>`).join('') +
        `</div>`;
    }

  } catch (e) {
    console.error(e);
    modalDownload.innerHTML = '<p class="muted">Failed to load links.</p>';
  }
}

/* -----------------------------
   Utilities
   ----------------------------- */
function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return String(bytes);
  const kb = 1024;
  if (bytes < kb) return bytes + ' B';
  if (bytes < kb * kb) return (bytes / kb).toFixed(1) + ' KB';
  if (bytes < kb * kb * kb) return (bytes / (kb * kb)).toFixed(1) + ' MB';
  return (bytes / (kb * kb * kb)).toFixed(1) + ' GB';
}

/* -----------------------------
   Events
   ----------------------------- */
moviesGrid.addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (card) openModal(card.dataset.id);
});

modalClose.addEventListener('click', () => {
  modal.classList.add('hidden');
  document.body.style.overflow = '';
});
modal.addEventListener('click', e => { if (e.target === modal) { modal.classList.add('hidden'); document.body.style.overflow = ''; } });

sectionButtons.forEach(b => {
  b.addEventListener('click', ev => {
    sectionButtons.forEach(x => x.classList.remove('active'));
    ev.currentTarget.classList.add('active');
    state.section = ev.currentTarget.dataset.sec;
    state.page = 1;
    state.query = '';
    searchInput.value = '';
    loadSection(state.section, 1);
  });
});

nextBtn.addEventListener('click', () => {
  if (state.page < state.total_pages) { state.page++; loadSection(state.section, state.page); }
});
prevBtn.addEventListener('click', () => {
  if (state.page > 1) { state.page--; loadSection(state.section, state.page); }
});

searchInput.addEventListener('input', e => {
  const v = e.target.value.trim();
  state.query = v;
  if (!v) { state.page = 1; loadSection(state.section, 1); return; }
  clearTimeout(state.debounceTimer);
  state.debounceTimer = setTimeout(() => doSearch(v, 1), 350);
});

async function doSearch(query, page = 1) {
  try {
    showLoader();
    const url = `${API_BASE}/search/movie?query=${encodeURIComponent(query)}&page=${page}`;
    const data = await qs(url);
    renderMovies(data.results);
    state.total_pages = data.total_pages || 1;
    pageInfo.textContent = `Search: "${query}" — Page ${state.page} of ${state.total_pages}`;
  } catch (e) {
    moviesGrid.innerHTML = '<p class="muted">Search failed.</p>';
  } finally {
    hideLoader();
  }
}

/* theme handlers */
themeToggle.addEventListener('click', () => document.body.classList.toggle('light'));
colorTheme.addEventListener('change', e => {
  document.body.classList.remove('theme-sunset', 'theme-ocean', 'theme-neo');
  if (e.target.value) document.body.classList.add(`theme-${e.target.value}`);
});

/* -----------------------------
   Initial load
   ----------------------------- */
loadSection('popular', 1);