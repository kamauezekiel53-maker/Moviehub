/*-----------------------------------------
🔥 FIXED + OPTIMIZED MOVIE HUB SCRIPT
------------------------------------------*/

const API_KEY = "7cc9abef50e4c94689f48516718607be";
const IMG = "https://image.tmdb.org/t/p/w500";

// FIXED: clean BASE URL (NO DOUBLE PROXY!)
const BASE = "https://api.themoviedb.org/3";

// NEW WORKING STREAM/DOWNLOAD API
const SEARCH_API = "https://movieapi.giftedtech.co.ke/api/search?query=";
const SOURCE_API = "https://movieapi.giftedtech.co.ke/api/getById?id=";

const grid = document.getElementById("moviesGrid");
const loader = document.getElementById("loader");
const search = document.getElementById("searchInput");
const prev = document.getElementById("prevPage");
const next = document.getElementById("nextPage");
const pageInfo = document.getElementById("pageInfo");
const modal = document.getElementById("modal");
const closeModalBtn = document.getElementById("modalClose");

let state = { section: "popular", page: 1, total: 1 };

function show() { loader.classList.remove("hidden"); }
function hide() { loader.classList.add("hidden"); }

function proxy(url){
    return `https://corsproxy.io/?${encodeURIComponent(url)}`;
}

async function q(url){
    const u = new URL(url);
    u.searchParams.set("api_key", API_KEY);
    const res = await fetch(proxy(u.toString()));
    return res.json();
}

/*-----------------------------------------
🔥 RENDER MOVIES
------------------------------------------*/

function render(list){
    grid.innerHTML = "";
    if(!list?.length){
        grid.innerHTML = "<p>No results.</p>";
        return;
    }
    list.forEach(m=>{
        grid.innerHTML += `
        <div class="card" data-id="${m.id}" data-type="${m.media_type || "movie"}">
            <img src="${m.poster_path ? IMG+m.poster_path : ""}">
            <div class="title-row">
                <h3>${m.title || m.name}</h3>
                <span class="badge">⭐ ${(m.vote_average || 0).toFixed(1)}</span>
            </div>
        </div>`;
    });
}

/*-----------------------------------------
🔥 ENDPOINTS
------------------------------------------*/

function endpoint(sec,p){
    switch(sec){
        case "trending": return `${BASE}/trending/movie/week?page=${p}`;
        case "top_rated": return `${BASE}/movie/top_rated?page=${p}`;
        case "now_playing": return `${BASE}/movie/now_playing?page=${p}`;
        case "tv": return `${BASE}/tv/popular?page=${p}`;
        case "anime": return `${BASE}/discover/tv?with_genres=16&page=${p}`;
        default: return `${BASE}/movie/popular?page=${p}`;
    }
}

/*-----------------------------------------
🔥 LOAD MOVIES
------------------------------------------*/

async function load(){
    try{
        show();
        const data = await q(endpoint(state.section, state.page));
        render(data.results);
        state.total = data.total_pages;
        pageInfo.textContent = `Page ${state.page} / ${state.total}`;
    } finally { hide(); }
}

/*-----------------------------------------
🔥 OPEN MODAL
------------------------------------------*/

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

    poster.src="";
    cast.innerHTML = "Loading...";
    videos.innerHTML = "Loading...";
    downloads.innerHTML = "Loading...";

    const data = await q(`${BASE}/${type}/${id}?append_to_response=videos,credits`);

    title.textContent = data.title || data.name;
    poster.src = data.poster_path ? IMG + data.poster_path : "";
    overview.textContent = data.overview || "No description.";
    sub.textContent = data.release_date || data.first_air_date;

    cast.innerHTML = data.credits.cast.slice(0,8).map(c=>`
        <div><img src="${c.profile_path ? IMG+c.profile_path : ""}"><small>${c.name}</small></div>
    `).join("");

    const yt = data.videos.results.filter(v => v.site === "YouTube");
    videos.innerHTML = yt.length ?
        yt.map(v=>`<iframe src="https://www.youtube.com/embed/${v.key}" allowfullscreen></iframe>`).join("")
        : "No trailer available";

    loadStreamSources(title.textContent);
}

/*-----------------------------------------
🔥 STREAM + DOWNLOAD (WORKING)
------------------------------------------*/

async function loadStreamSources(title){
    const box = document.getElementById("modalDownload");
    const player = document.getElementById("modalVideos");

    const searchRes = await fetch(SEARCH_API + encodeURIComponent(title));
    const found = await searchRes.json();

    if(!found.status || !found.results.length){
        box.innerHTML = "No download links.";
        return;
    }

    const movie = found.results[0];
    const id = movie.movieid;

    const srcRes = await fetch(SOURCE_API + id);
    const src = await srcRes.json();

    if(!src.status){
        box.innerHTML = "No sources available.";
        return;
    }

    const best = src.sources.find(x=>x.quality==="1080p") || src.sources[0];

    player.innerHTML = `
        <video controls width="100%" src="${best.url}" style="border-radius:10px;"></video>
    `;

    box.innerHTML = src.sources.map(s=>`
        <a href="${s.url}" class="btn" target="_blank">${s.quality}</a>
    `).join("");
}

/*-----------------------------------------
🔥 EVENTS
------------------------------------------*/

grid.addEventListener("click",e=>{
    const card = e.target.closest(".card");
    if(card) openModal(card.dataset.id, card.dataset.type);
});

closeModalBtn.onclick = ()=>{
    modal.classList.add("hidden");
    document.body.style.overflow="";
};

document.querySelectorAll(".sec-btn").forEach(btn=>{
    btn.onclick=()=>{
        document.querySelectorAll(".sec-btn").forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        state.section = btn.dataset.sec;
        state.page = 1;
        load();
    };
});

next.onclick = ()=>{ if(state.page < state.total){ state.page++; load(); }};
prev.onclick = ()=>{ if(state.page > 1){ state.page--; load(); }};

search.oninput = async ()=>{
    if(!search.value.trim()) return load();
    show();
    const data = await q(`${BASE}/search/multi?query=${search.value.trim()}`);
    render(data.results.slice(0,20));
    hide();
};

/*-----------------------------------------
🔥 INITIAL LOAD
------------------------------------------*/
load();