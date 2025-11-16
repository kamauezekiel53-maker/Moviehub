/* -------------------------------------
   MOVIE HUB — FULL UPDATED APP.JS
-------------------------------------- */

const API_KEY = '7cc9abef50e4c94689f48516718607be';
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';
const API_BASE = 'https://api.themoviedb.org/3';
const DOWNLOAD_API = 'https://movieapi.giftedtech.co.ke/api/sources/6127914234610600632';

/* HTML ELEMENTS */
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

/* MODAL */
const modal = document.getElementById('modal');
const modalClose = document.getElementById('modalClose');
const modalPoster = document.getElementById('modalPoster');
const modalTitle = document.getElementById('modalTitle');
const modalOverview = document.getElementById('modalOverview');
const modalSub = document.getElementById('modalSub');
const modalCast = document.getElementById('modalCast');
const modalVideos = document.getElementById('modalVideos');
const modalDownload = document.getElementById('modalDownload');

/* STATE */
let state = {
  section: 'popular',
  page: 1,
  total_pages: 1,
  query: '',
  debounceTimer: null
};

/* PROXY FOR CORS */
function proxy(url) {
  return `https://corsproxy.io/?${encodeURIComponent(url)}`;
}

/* TMDB FETCH */
function qs(url) {
  const u = new URL(url);
  u.searchParams.set('api_key', API_KEY);
  return fetch(proxy(u.toString())).then(r => r.json());
}

/* UI HELPERS */
function showLoader() { loader.classList.remove('hidden'); }
function hideLoader() { loader.classList.add('hidden'); }
function clearGrid() { moviesGrid.innerHTML = ''; }
function escapeHtml(s = '') {
  return s.replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
}

/* API ENDPOINTS */
function endpointForSection(section, page = 1) {
  if (section === 'trending') return `${API_BASE}/trending/movie/week?page=${page}`;
  if (section === 'now_playing') return `${API_BASE}/movie/now_playing?page=${page}`;
  if (section === 'top_rated') return `${API_BASE}/movie/top_rated?page=${page}`;
  return `${API_BASE}/movie/popular?page=${page}`;
}

/* RENDER MOVIE CARDS */
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
        ${poster
          ? `<img src="${poster}" alt="${escapeHtml(m.title)}">`
          : '<div style="padding:20px;color:#888">No Image</div>'}
      </div>
      <div class="card-body">
        <div class="title-row">
          <h3>${escapeHtml(m.title)}</h3>
          <span class="badge">⭐ ${m.vote_average ? m.vote_average.toFixed(1) : "—"}</span>
        </div>
        <div style="font-size:13px;color:var(--muted);">
          ${m.release_date ? m.release_date.slice(0, 4) : "—"}
        </div>
      </div>
    `;

    moviesGrid.appendChild(card);
  });
}

/* LOAD MOVIE LIST */
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

  } catch (err) {
    console.error(err);
    moviesGrid.innerHTML = '<p class="muted">Failed to load movies.</p>';
  } finally {
    hideLoader();
  }
}

/* OPEN MODAL */
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
    modalSub.textContent = `${data.release_date || ""} • ${data.runtime ? data.runtime + " min" : ""}`;
    modalOverview.textContent = data.overview || "No description available.";

    /* CAST */
    modalCast.innerHTML =
      data.credits?.cast?.slice(0, 8).map(c => `
        <div>
          <img src="${c.profile_path ? IMG_BASE + c.profile_path : ''}" style="width:100%;border-radius:6px">
          <small>${c.name}</small>
        </div>
      `).join('') || '<p class="muted">No cast info.</p>';

    /* TRAILERS */
    const vids = data.videos?.results?.filter(v => v.type === 'Trailer' && v.site === 'YouTube') || [];
    modalVideos.innerHTML = vids.length
      ? vids.map(v => `<iframe src="https://www.youtube.com/embed/${v.key}" allowfullscreen></iframe>`).join('')
      : '<p class="muted">No trailers available.</p>';

    /* DOWNLOAD LINKS */
    loadDownloadLinks();

  } catch (e) {
    console.error(e);
    modalOverview.textContent = 'Failed to load details.';
  }
}

/* NEW: ALWAYS SHOW DOWNLOAD LINKS FROM YOUR API */
async function loadDownloadLinks() {
  try {
    modalDownload.innerHTML = '<p class="muted">Loading download links...</p>';

    const res = await fetch(proxy(DOWNLOAD_API));
    const data = await res.json();

    let list = data.results || [];

    if (list.length === 0) {
      modalDownload.innerHTML = '<p class="muted">No download links available.</p>';
      return;
    }

    modalDownload.innerHTML = list.map(item => `
      <div style="margin-bottom:12px;">
        <strong style="color:var(--accent)">Quality: ${item.quality}</strong><br>
        <a href="${item.download_url}" target="_blank" class="btn">Download (${item.size || "Unknown"})</a>
        <a href="${item.stream_url}" target="_blank" class="btn" style="background:#333;margin-top:4px;">Stream Now</a>
      </div>
    `).join("");

  } catch (e) {
    console.error(e);
    modalDownload.innerHTML = '<p class="muted">Failed to load download links.</p>';
  }
}

/* CLOSE MODAL */
function closeModal() {
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

/* EVENTS */
moviesGrid.addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (card) openModal(card.dataset.id);
});

modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', e => {
  if (e.target === modal) closeModal();
});

/* FIXED TABS */
sectionButtons.forEach(btn => {
  btn.onclick = () => {
    sectionButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    state.section = btn.dataset.sec;
    state.page = 1;
    state.query = '';
    searchInput.value = '';
    suggestionsBox.classList.add('hidden');

    loadSection(state.section, 1);
  };
});

/* PAGINATION */
nextBtn.onclick = () => {
  if (state.page < state.total_pages) {
    state.page++;
    loadSection(state.section, state.page);
  }
};

prevBtn.onclick = () => {
  if (state.page > 1) {
    state.page--;
    loadSection(state.section, state.page);
  }
};

/* SEARCH */
searchInput.addEventListener('input', e => {
  const v = e.target.value.trim();
  state.query = v;

  if (!v) {
    loadSection(state.section, 1);
    return;
  }

  clearTimeout(state.debounceTimer);
  state.debounceTimer = setTimeout(() => doSearch(v, 1), 300);
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
    console.error(e);
    moviesGrid.innerHTML = '<p class="muted">Search failed.</p>';
  } finally {
    hideLoader();
  }
}

/* THEME */
themeToggle.onclick = () => document.body.classList.toggle('light');

colorTheme.onchange = e => {
  document.body.className = '';
  if (e.target.value) document.body.classList.add(`theme-${e.target.value}`);
};

/* INITIAL LOAD */
loadSection('popular', 1);