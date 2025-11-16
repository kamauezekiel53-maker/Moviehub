/* ===============================
      MOVIE HUB FINAL APP.JS
   =============================== */

const API_KEY = '7cc9abef50e4c94689f48516718607be';
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';

// CLEAN BASE — DO NOT PROXY HERE
const API_BASE = 'https://api.themoviedb.org/3';

// Download link API (your 3rd-party service)
const DOWNLOAD_API = 'https://movieapi.giftedtech.co.ke/api/sources/6127914234610600632';

/* === DOM ELEMENTS === */
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

/* === MODAL ELEMENTS === */
const modal = document.getElementById('modal');
const modalClose = document.getElementById('modalClose');
const modalPoster = document.getElementById('modalPoster');
const modalTitle = document.getElementById('modalTitle');
const modalOverview = document.getElementById('modalOverview');
const modalSub = document.getElementById('modalSub');
const modalCast = document.getElementById('modalCast');
const modalVideos = document.getElementById('modalVideos');
const modalDownload = document.getElementById('modalDownload');

/* === APP STATE === */
let state = {
    section: 'popular',
    page: 1,
    total_pages: 1,
    query: '',
    debounceTimer: null
};

/* ========================================
        PROXY WRAPPER (ONLY ONE PLACE)
   ======================================== */
function proxy(url) {
    return `https://corsproxy.io/?${encodeURIComponent(url)}`;
}

/* ========================================
        FETCH WITH API KEY + PROXY
   ======================================== */
function qs(url) {
    const u = new URL(url);
    u.searchParams.set('api_key', API_KEY);
    return fetch(proxy(u.toString())).then(r => r.json());
}

/* === HELPERS === */
function showLoader() { loader.classList.remove('hidden'); }
function hideLoader() { loader.classList.add('hidden'); }
function clearGrid() { moviesGrid.innerHTML = ''; }
function escapeHtml(s = '') {
    return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/* ========================================
        SECTION ENDPOINTS
   ======================================== */
function endpointForSection(section, page = 1) {
    if (section === 'trending') return `${API_BASE}/trending/movie/week?page=${page}`;
    if (section === 'now_playing') return `${API_BASE}/movie/now_playing?page=${page}`;
    if (section === 'top_rated') return `${API_BASE}/movie/top_rated?page=${page}`;
    return `${API_BASE}/movie/popular?page=${page}`;
}

/* ========================================
        RENDER MOVIE CARDS
   ======================================== */
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
                    ${m.release_date ? m.release_date.slice(0, 4) : '—'}
                </div>
            </div>
        `;
        
        moviesGrid.appendChild(card);
    });
}

/* ========================================
        LOAD MOVIES BY SECTION
   ======================================== */
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

/* ========================================
        OPEN MODAL
   ======================================== */
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

        /* Cast */
        modalCast.innerHTML =
            data.credits?.cast?.slice(0, 8).map(c => `
                <div>
                    <img src="${c.profile_path ? IMG_BASE + c.profile_path : ''}" style="width:100%;border-radius:6px">
                    <small>${c.name}</small>
                </div>`
            ).join('') || '';

        /* Trailers */
        const vids = data.videos?.results?.filter(v => v.type === 'Trailer' && v.site === 'YouTube') || [];
        modalVideos.innerHTML =
            vids.length
            ? vids.map(v => `<iframe src="https://www.youtube.com/embed/${v.key}" allowfullscreen></iframe>`).join('')
            : '<p class="muted">No trailers available.</p>';

        /* Download links */
        loadDownloadLinks(data.title);

    } catch (e) {
        modalOverview.textContent = 'Failed to load details.';
    }
}

/* ========================================
        DOWNLOAD LINKS
   ======================================== */
async function loadDownloadLinks(title) {
    try {
        modalDownload.innerHTML = '<p class="muted">Loading download links...</p>';

        const res = await fetch(DOWNLOAD_API);
        const data = await res.json();

        const matches = data.sources?.filter(s =>
            s.title.toLowerCase().includes(title.toLowerCase())
        );

        if (!matches || matches.length === 0) {
            modalDownload.innerHTML = '<p class="muted">No download links found.</p>';
            return;
        }

        modalDownload.innerHTML = matches.map(m => `
            <div>
                <strong style="color:var(--accent)">${m.quality || 'Link'}</strong><br>
                <a href="${m.url}" target="_blank" class="btn">Download (${m.size || 'Unknown'})</a>
            </div>
        `).join('');

    } catch (e) {
        modalDownload.innerHTML = '<p class="muted">Failed to load download links.</p>';
    }
}

/* CLOSE MODAL */
function closeModal() {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
}

/* ========================================
        EVENT LISTENERS
   ======================================== */
moviesGrid.addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (card) openModal(card.dataset.id);
});

modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

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

/* PAGINATION */
nextBtn.addEventListener('click', () => {
    if (state.page < state.total_pages) {
        state.page++;
        loadSection(state.section, state.page);
    }
});
prevBtn.addEventListener('click', () => {
    if (state.page > 1) {
        state.page--;
        loadSection(state.section, state.page);
    }
});

/* SEARCH */
searchInput.addEventListener('input', e => {
    const v = e.target.value.trim();
    state.query = v;

    if (!v) {
        state.page = 1;
        loadSection(state.section, 1);
        return;
    }

    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
        doSearch(v, 1);
    }, 300);
});

/* SEARCH REQUEST */
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

/* THEMES */
themeToggle.addEventListener('click', () =>
    document.body.classList.toggle('light')
);

colorTheme.addEventListener('change', e => {
    document.body.classList.remove('theme-sunset', 'theme-ocean', 'theme-neo');
    if (e.target.value)
        document.body.classList.add(`theme-${e.target.value}`);
});

/* INITIAL LOAD */
loadSection('popular', 1);