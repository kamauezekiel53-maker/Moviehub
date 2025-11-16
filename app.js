const API_KEY='7cc9abef50e4c94689f48516718607be';
const IMG='https://image.tmdb.org/t/p/w500';
const BASE='https://api.themoviedb.org/3';
const GIFT='https://movieapi.giftedtech.co.ke/api/getSources?title=';

// UI elements
const grid=document.getElementById("moviesGrid");
const loader=document.getElementById("loader");
const search=document.getElementById("searchInput");
const prev=document.getElementById("prevPage");
const next=document.getElementById("nextPage");
const pageInfo=document.getElementById("pageInfo");
const modal=document.getElementById("modal");
const closeModalBtn=document.getElementById("modalClose");

let state={ section:"popular", page:1, total:1 };


// ------------------------------
// PROXY
// ------------------------------
function proxy(url){
    return `https://corsproxy.io/?${encodeURIComponent(url)}`;
}


// ------------------------------
// API REQUEST
// ------------------------------
async function q(url){
    const full = `${url}${url.includes("?") ? "&" : "?"}api_key=${API_KEY}`;
    const r = await fetch(proxy(full));
    const j = await r.json();
    return j;
}


// ------------------------------
// LOADER
// ------------------------------
function show(){ loader.classList.remove("hidden"); }
function hide(){ loader.classList.add("hidden"); }


// ------------------------------
// RENDER CARDS
// ------------------------------
function render(list){
    grid.innerHTML = "";

    if(!list || list.length === 0){
        grid.innerHTML = "<p>No results.</p>";
        return;
    }

    list.forEach(m => {
        const poster = m.poster_path ? IMG + m.poster_path : "";
        const title = m.title || m.name || "Untitled";
        const rating = m.vote_average ? m.vote_average.toFixed(1) : "N/A";
        const type = m.media_type || (m.first_air_date ? "tv" : "movie");

        grid.innerHTML += `
            <div class="card" data-id="${m.id}" data-type="${type}">
                <img src="${poster}" alt="${title}">
                <div class="title-row">
                    <h3>${title}</h3>
                    <span class="badge">⭐ ${rating}</span>
                </div>
            </div>
        `;
    });
}


// ------------------------------
// ENDPOINTS
// ------------------------------
function endpoint(section, page){
    switch(section){
        case "trending": return `${BASE}/trending/movie/week?page=${page}`;
        case "top_rated": return `${BASE}/movie/top_rated?page=${page}`;
        case "now_playing": return `${BASE}/movie/now_playing?page=${page}`;
        case "tv": return `${BASE}/tv/popular?page=${page}`;
        case "anime": return `${BASE}/discover/tv?with_genres=16&page=${page}&sort_by=popularity.desc`;
        default: return `${BASE}/movie/popular?page=${page}`;
    }
}


// ------------------------------
// LOAD CONTENT
// ------------------------------
async function load(){
    show();
    try{
        const d = await q(endpoint(state.section, state.page));
        render(d.results);
        state.total = d.total_pages || 1;
        pageInfo.textContent = `Page ${state.page} / ${state.total}`;
    } catch(e){
        grid.innerHTML = "<p>Error loading movies.</p>";
    }
    hide();
}


// ------------------------------
// OPEN MODAL
// ------------------------------
async function openModal(id, type="movie"){
    modal.classList.remove("hidden");
    document.body.style.overflow="hidden";

    const poster=document.getElementById("modalPoster");
    const title=document.getElementById("modalTitle");
    const sub=document.getElementById("modalSub");
    const overview=document.getElementById("modalOverview");
    const cast=document.getElementById("modalCast");
    const videos=document.getElementById("modalVideos");
    const downloads=document.getElementById("modalDownload");

    cast.innerHTML = videos.innerHTML = downloads.innerHTML = "Loading...";
    poster.src = "";

    const data = await q(`${BASE}/${type}/${id}?append_to_response=videos,credits`);

    title.textContent = data.title || data.name;
    poster.src = data.poster_path ? IMG + data.poster_path : "";
    overview.textContent = data.overview || "No description available.";
    sub.textContent = `${data.release_date || data.first_air_date || ""}`;

    // CAST
    cast.innerHTML = data.credits?.cast?.slice(0, 8).map(c => `
        <div>
            <img src="${c.profile_path ? IMG + c.profile_path : ""}">
            <small>${c.name}</small>
        </div>
    `).join("") || "No cast info.";

    // TRAILERS (YOUTUBE)
    const yt = (data.videos?.results || []).filter(v => v.site === "YouTube");
    videos.innerHTML = yt.length
        ? yt.map(v => `<iframe src="https://www.youtube.com/embed/${v.key}" allowfullscreen></iframe>`).join("")
        : "<p>No trailer available.</p>";

    // STREAM + DOWNLOAD
    loadGifted(title.textContent);
}


// ------------------------------
// STREAM + DOWNLOAD (GIFTED API)
// ------------------------------
async function loadGifted(title){
    const downloads=document.getElementById("modalDownload");
    const videos=document.getElementById("modalVideos");

    try{
        const r = await fetch(`${GIFT}${encodeURIComponent(title)}`);
        const d = await r.json();

        if(!d.success || !d.results.length){
            downloads.innerHTML = "No download links found.";
            return;
        }

        // best source = 1080p -> 720p -> first
        const best =
            d.results.find(x => x.quality === "1080p") ||
            d.results.find(x => x.quality === "720p") ||
            d.results[0];

        // STREAM PLAYER
        videos.innerHTML += `
            <video controls width="100%" style="margin-top:15px;border-radius:10px;">
                <source src="${best.stream_url}" type="video/mp4">
            </video>
        `;

        // DOWNLOAD LINKS
        downloads.innerHTML = d.results.map(s => `
            <a class="btn" href="${s.download_url}" target="_blank">
                ${s.quality} (${(s.size/1024/1024).toFixed(1)} MB)
            </a>
        `).join("");

    } catch(e){
        downloads.innerHTML = "Streaming source unavailable.";
    }
}


// ------------------------------
// EVENTS
// ------------------------------
grid.addEventListener("click", e=>{
    const card = e.target.closest(".card");
    if(card) openModal(card.dataset.id, card.dataset.type);
});

closeModalBtn.onclick = () => {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
};


// TABS
document.querySelectorAll(".sec-btn").forEach(btn=>{
    btn.onclick = () => {
        document.querySelectorAll(".sec-btn").forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");

        state.section = btn.dataset.sec;
        state.page = 1;

        load();
    };
});


// PAGINATION
next.onclick = () => { if(state.page < state.total){ state.page++; load(); }};
prev.onclick = () => { if(state.page > 1){ state.page--; load(); }};


// SEARCH
search.oninput = () => {
    const q = search.value.trim();
    if(!q) return load();
    fastSearch(q);
};

async function fastSearch(qr){
    show();
    const d = await q(`${BASE}/search/multi?query=${encodeURIComponent(qr)}`);
    render((d.results || []).slice(0, 20));
    hide();
}


// INIT
load();