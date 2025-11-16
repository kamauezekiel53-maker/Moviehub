const API_KEY='7cc9abef50e4c94689f48516718607be';
const IMG_BASE='https://image.tmdb.org/t/p/w500';
const API_BASE='https://api.themoviedb.org/3';
const DOWNLOAD_API='https://movieapi.giftedtech.co.ke/api/sources/6127914234610600632';

const moviesGrid=document.getElementById('moviesGrid');
const loader=document.getElementById('loader');
const searchInput=document.getElementById('searchInput');
const sectionButtons=document.querySelectorAll('.sec-btn');
const pageInfo=document.getElementById('pageInfo');
const prevBtn=document.getElementById('prevPage');
const nextBtn=document.getElementById('nextPage');
const themeToggle=document.getElementById('themeToggle');
const colorTheme=document.getElementById('colorTheme');

const modal=document.getElementById('modal');
const modalClose=document.getElementById('modalClose');
const modalPoster=document.getElementById('modalPoster');
const modalTitle=document.getElementById('modalTitle');
const modalOverview=document.getElementById('modalOverview');
const modalSub=document.getElementById('modalSub');
const modalCast=document.getElementById('modalCast');
const modalVideos=document.getElementById('modalVideos');
const modalDownload=document.getElementById('modalDownload');
const favBtn = document.getElementById('favBtn');

let favorites = JSON.parse(localStorage.getItem("favorites") || "[]");

let state={
    section:'popular',
    page:1,
    total_pages:1,
    query:'',
    debounceTimer:null
};

function proxy(url){
    return `https://corsproxy.io/?${encodeURIComponent(url)}`;
}

function qs(url){
    const u=new URL(url);
    u.searchParams.set('api_key',API_KEY);
    return fetch(proxy(u)).then(r=>r.json());
}

function showLoader(){ loader.classList.remove('hidden'); }
function hideLoader(){ loader.classList.add('hidden'); }
function clearGrid(){ moviesGrid.innerHTML=''; }

function endpointForSection(section,page=1){
    switch(section){
        case "trending": return `${API_BASE}/trending/movie/week?page=${page}`;
        case "now_playing": return `${API_BASE}/movie/now_playing?page=${page}`;
        case "top_rated": return `${API_BASE}/movie/top_rated?page=${page}`;
        case "tv": return `${API_BASE}/tv/popular?page=${page}`;
        case "anime": return `${API_BASE}/discover/tv?with_genres=16&page=${page}`;
        case "favorites": return "favorites";
        default: return `${API_BASE}/movie/popular?page=${page}`;
    }
}

function renderMovies(list){
    clearGrid();
    if(!list || list.length === 0){
        moviesGrid.innerHTML = `<p>No results.</p>`;
        return;
    }

    list.forEach(m => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.id = m.id;
        card.dataset.type = m.media_type || "movie";

        card.innerHTML = `
            <div class="poster">
                <img src="${m.poster_path ? IMG_BASE+m.poster_path : ""}">
            </div>
            <div class="card-body">
                <div class="title-row">
                    <h3>${m.title || m.name}</h3>
                    <span class="badge">⭐ ${m.vote_average?.toFixed(1) || "—"}</span>
                </div>
            </div>
        `;
        moviesGrid.appendChild(card);
    });
}

async function loadSection(section=state.section,page=state.page){
    try{
        showLoader();

        if(section === "favorites"){
            renderMovies(favorites);
            hideLoader();
            return;
        }

        const url = endpointForSection(section,page);
        const data = await qs(url);

        renderMovies(data.results);
        state.total_pages = data.total_pages || 1;

        prevBtn.disabled = state.page <= 1;
        nextBtn.disabled = state.page >= state.total_pages;

        pageInfo.textContent = `Page ${state.page}/${state.total_pages}`;
    }catch(e){
        moviesGrid.innerHTML = "<p>Failed to load.</p>";
    }finally{
        hideLoader();
    }
}

sectionButtons.forEach(btn => {
    btn.onclick = () => {
        sectionButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        state.section = btn.dataset.sec;
        state.page = 1;

        loadSection(state.section,1);
    };
});

moviesGrid.addEventListener("click",e=>{
    const card=e.target.closest(".card");
    if(card) openMovie(card.dataset.id, card.dataset.type);
});

async function openMovie(id,type="movie"){
    modal.classList.remove("hidden");
    document.body.style.overflow="hidden";

    modalPoster.src="";
    modalTitle.textContent="Loading...";
    modalOverview.textContent="";
    modalCast.innerHTML="";
    modalVideos.innerHTML="";
    modalDownload.innerHTML="";

    const data = await qs(`${API_BASE}/${type}/${id}?append_to_response=videos,credits`);

    modalPoster.src = data.poster_path ? IMG_BASE+data.poster_path : "";
    modalTitle.textContent = data.title || data.name;
    modalSub.textContent = data.release_date || data.first_air_date || "";

    modalOverview.textContent = data.overview || "No description";

    modalCast.innerHTML = data.credits.cast.slice(0,8).map(c => `
        <div>
            <img src="${c.profile_path?IMG_BASE+c.profile_path:''}">
            <small>${c.name}</small>
        </div>
    `).join("");

    const trailers = data.videos.results.filter(v => v.site==="YouTube");

    modalVideos.innerHTML = trailers.length ?
        trailers.map(v=> `<iframe src="https://www.youtube.com/embed/${v.key}"></iframe>`).join("") :
        `<p>No trailers.</p>`;

    loadDownloadLinks(data.title || data.name);

    favBtn.onclick = () => toggleFavorite(data);
}

async function loadDownloadLinks(title){
    try{
        modalDownload.innerHTML = "Loading...";

        const res = await fetch(proxy(DOWNLOAD_API));
        const data = await res.json();

        let list = data.sources || [];

        let matches = list.filter(s =>
            s.title.toLowerCase().includes(title.toLowerCase())
        );

        if(matches.length === 0){
            let clean = title.replace(/[^a-z0-9]/gi,"").toLowerCase();
            matches = list.filter(s =>
                s.title.replace(/[^a-z0-9]/gi,"").toLowerCase().includes(clean)
            );
        }

        if(matches.length === 0){
            modalDownload.innerHTML = list.map(s => `
                <div>
                    <b>${s.title}</b><br>
                    <a class="btn" target="_blank" href="${s.url}">Download</a>
                </div>
            `).join("");
            return;
        }

        modalDownload.innerHTML = matches.map(s => `
            <div>
                <b>${s.quality}</b><br>
                <a class="btn" target="_blank" href="${s.url}">Download</a>
            </div>
        `).join("");

    }catch{
        modalDownload.innerHTML="Failed to load links";
    }
}

function toggleFavorite(movie){
    const exists = favorites.some(m => m.id === movie.id);
    if(exists){
        favorites = favorites.filter(m => m.id !== movie.id);
    } else {
        favorites.push(movie);
    }
    localStorage.setItem("favorites", JSON.stringify(favorites));
}

modalClose.onclick = () => closeModal();
modal.onclick = e => { if(e.target === modal) closeModal(); };

function closeModal(){
    modal.classList.add("hidden");
    document.body.style.overflow="";
}

prevBtn.onclick = () => {
    if(state.page>1){ state.page--; loadSection(); }
}

nextBtn.onclick = () => {
    if(state.page<state.total_pages){ state.page++; loadSection(); }
}

loadSection();