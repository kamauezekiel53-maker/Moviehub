const API_KEY = '7cc9abef50e4c94689f48516718607be';
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';
const API_BASE = 'https://corsproxy.io/?https://api.themoviedb.org/3';
const GIFTED_API = "https://movieapi.giftedtech.co.ke/api/getSources?title=";

const moviesGrid = document.getElementById('moviesGrid');
const loader = document.getElementById('loader');
const searchInput = document.getElementById('searchInput');
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

let state = {
    section:'popular',
    page:1,
    total_pages:1,
    query:''
};

// -------------------- API HELPERS ----------------------

function qs(url){
    const u = new URL(url);
    u.searchParams.set('api_key', API_KEY);
    return fetch(`https://corsproxy.io/?${encodeURIComponent(u.toString())}`).then(r => r.json());
}

// -------------------- UI HELPERS ----------------------

function showLoader(){ loader.classList.remove('hidden'); }
function hideLoader(){ loader.classList.add('hidden'); }

function clearGrid(){ moviesGrid.innerHTML = ''; }

function escapeHtml(s=''){
    return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

function endpoint(section,page=1){
    if(section==='trending') return `${API_BASE}/trending/movie/week?page=${page}`;
    if(section==='now_playing') return `${API_BASE}/movie/now_playing?page=${page}`;
    if(section==='top_rated') return `${API_BASE}/movie/top_rated?page=${page}`;
    return `${API_BASE}/movie/popular?page=${page}`;
}

// -------------------- MOVIE RENDER ----------------------

function renderMovies(list){
    clearGrid();

    if(!list || list.length === 0){
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

// -------------------- SECTIONS ----------------------

async function loadSection(section=state.section,page=state.page){
    try{
        showLoader();
        const url = endpoint(section,page);
        const data = await qs(url);

        renderMovies(data.results);
        state.total_pages = data.total_pages || 1;

        pageInfo.textContent = `Page ${state.page} of ${state.total_pages}`;
        prevBtn.disabled = state.page <= 1;
        nextBtn.disabled = state.page >= state.total_pages;
    }
    catch(e){
        moviesGrid.innerHTML = '<p class="muted">Failed to load movies.</p>';
    }
    finally{ hideLoader(); }
}

// -------------------- MODAL (MOVIE DETAILS + STREAM + DOWNLOAD) ----------------------

async function openModal(movieId){
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    modalTitle.textContent = 'Loading...';
    modalOverview.textContent = '';
    modalVideos.innerHTML = '';
    modalDownload.innerHTML = '';

    try{
        const data = await qs(`${API_BASE}/movie/${movieId}?append_to_response=videos,credits`);

        modalPoster.src = data.poster_path ? IMG_BASE + data.poster_path : '';
        modalTitle.textContent = data.title;
        modalOverview.textContent = data.overview || 'No description available.';
        modalSub.textContent = `${data.release_date ?? ''} • ${data.runtime ? data.runtime + " min" : ""}`;

        // Cast
        modalCast.innerHTML = data.credits?.cast?.slice(0,8).map(c => `
            <div>
                <img src="${c.profile_path ? IMG_BASE + c.profile_path : ''}">
                <small>${c.name}</small>
            </div>`
        ).join('');

        // Trailers
        const vids = data.videos?.results?.filter(v => v.type === 'Trailer' && v.site === 'YouTube') || [];
        modalVideos.innerHTML = vids.length ?
            vids.map(v => `<iframe src="https://www.youtube.com/embed/${v.key}" allowfullscreen></iframe>`).join('')
            : '<p class="muted">No trailers.</p>';

        // STREAM + DOWNLOAD + SUBTITLES
        await loadGiftedLinks(data.title);

    }catch(e){
        modalOverview.textContent = 'Failed to load details.';
    }
}

async function loadGiftedLinks(title){
    try{
        modalDownload.innerHTML = `<p class="muted">Fetching download links...</p>`;

        const url = `${GIFTED_API}${encodeURIComponent(title)}`;
        const res = await fetch(url);
        const json = await res.json();

        if(!json.success || !json.results){
            modalDownload.innerHTML = `<p class="muted">No download links.</p>`;
            return;
        }

        const results = json.results;
        const subs = json.subtitles || [];

        // STREAM PLAYER
        const best = results.find(r=>r.quality==="1080p") || results[0];
        modalVideos.innerHTML = `
            <video controls style="width:100%;border-radius:10px;" src="${best.stream_url}">
                Your browser does not support video playback.
            </video>
        ` + modalVideos.innerHTML;

        // DOWNLOAD BUTTONS
        modalDownload.innerHTML = results.map(r => `
            <div style="margin-bottom:15px;">
                <strong>${r.quality}</strong><br>
                <a class="btn" target="_blank" href="${r.download_url}">
                    Download (${(r.size/1024/1024).toFixed(1)} MB)
                </a>
            </div>
        `).join('');

        // SUBTITLES
        if(subs.length > 0){
            modalDownload.innerHTML += `
                <h3 style="margin-top:10px;">Subtitles</h3>
                ${subs.map(s => `
                    <a class="btn" target="_blank" href="${s.url}">
                        ${s.lanName}
                    </a>
                `).join('')}
            `;
        }
    }
    catch(e){
        modalDownload.innerHTML = `<p class="muted">Failed to load download sources.</p>`;
    }
}

function closeModal(){
    modal.classList.add('hidden');
    document.body.style.overflow='';
}

// -------------------- EVENTS ----------------------

moviesGrid.addEventListener('click', e=>{
    const card = e.target.closest('.card');
    if(card) openModal(card.dataset.id);
});

modalClose.addEventListener('click', closeModal);
modal.addEventListener('click', e=>{ if(e.target===modal) closeModal(); });

sectionButtons.forEach(b=>{
    b.addEventListener('click', ev=>{
        sectionButtons.forEach(x=>x.classList.remove('active'));
        ev.currentTarget.classList.add('active');

        state.section = ev.currentTarget.dataset.sec;
        state.page = 1;
        state.query = '';

        loadSection(state.section, 1);
    });
});

nextBtn.addEventListener('click', ()=>{
    if(state.page < state.total_pages){
        state.page++;
        loadSection(state.section, state.page);
    }
});
prevBtn.addEventListener('click', ()=>{
    if(state.page > 1){
        state.page--;
        loadSection(state.section, state.page);
    }
});

// -------------------- SEARCH ----------------------

searchInput.addEventListener('input', e=>{
    const v = e.target.value.trim();
    state.query = v;

    if(!v) return loadSection('popular',1);

    doSearch(v,1);
});

async function doSearch(query,page=1){
    try{
        showLoader();
        const url = `${API_BASE}/search/movie?query=${encodeURIComponent(query)}&page=${page}`;
        const data = await qs(url);

        renderMovies(data.results);
        state.total_pages = data.total_pages || 1;
    }
    catch(e){
        moviesGrid.innerHTML = '<p class="muted">Search failed.</p>';
    }
    finally{ hideLoader(); }
}

// -------------------- INITIAL LOAD ----------------------
loadSection('popular',1);