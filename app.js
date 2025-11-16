const API_KEY='7cc9abef50e4c94689f48516718607be';
const IMG='https://image.tmdb.org/t/p/w500';
const BASE='https://corsproxy.io/?https://api.themoviedb.org/3';
const GIFT='https://movieapi.giftedtech.co.ke/api/getSources?title=';

const grid=document.getElementById("moviesGrid");
const loader=document.getElementById("loader");
const search=document.getElementById("searchInput");
const prev=document.getElementById("prevPage");
const next=document.getElementById("nextPage");
const pageInfo=document.getElementById("pageInfo");
const modal=document.getElementById("modal");
const closeModalBtn=document.getElementById("modalClose");

let state={section:"popular",page:1,total:1};

function proxy(u){
    return `https://corsproxy.io/?${encodeURIComponent(u)}`;
}

async function q(url){
    const u=new URL(url);
    u.searchParams.set("api_key",API_KEY);
    const res=await fetch(proxy(u.toString()));
    return res.json();
}

function show(){ loader.classList.remove("hidden"); }
function hide(){ loader.classList.add("hidden"); }

function render(list){
    grid.innerHTML="";
    if(!list?.length){
        grid.innerHTML="<p>No results.</p>";
        return;
    }
    list.forEach(m=>{
        grid.innerHTML+=`
        <div class="card" data-id="${m.id}" data-type="${m.media_type||"movie"}">
            <img src="${m.poster_path?IMG+m.poster_path:""}">
            <div class="title-row">
                <h3>${m.title||m.name}</h3>
                <span class="badge">⭐ ${(m.vote_average||0).toFixed(1)}</span>
            </div>
        </div>`;
    });
}

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

async function load(){
    try{
        show();
        const data=await q(endpoint(state.section,state.page));
        render(data.results);
        state.total=data.total_pages;
        pageInfo.textContent=`Page ${state.page} / ${state.total}`;
    } finally { hide(); }
}

async function openModal(id,type="movie"){
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
    cast.innerHTML=videos.innerHTML=downloads.innerHTML="Loading...";

    const data=await q(`${BASE}/${type}/${id}?append_to_response=videos,credits`);
    
    title.textContent=data.title||data.name;
    poster.src=data.poster_path?IMG+data.poster_path:"";
    overview.textContent=data.overview||"No description.";
    sub.textContent=`${data.release_date||data.first_air_date}`;

    cast.innerHTML=data.credits.cast.slice(0,8).map(c=>`
        <div><img src="${c.profile_path?IMG+c.profile_path:""}"><small>${c.name}</small></div>
    `).join("");

    const vids=data.videos.results.filter(v=>v.site==="YouTube");
    videos.innerHTML= vids.length ?
        vids.map(v=>`<iframe src="https://www.youtube.com/embed/${v.key}" allowfullscreen></iframe>`).join("")
        : "No trailer";

    loadGifted(title.textContent);
}

async function loadGifted(title){
    const box=document.getElementById("modalDownload");
    const player=document.getElementById("modalVideos");

    const r=await fetch(`${GIFT}${encodeURIComponent(title)}`);
    const data=await r.json();

    if(!data.success){
        box.innerHTML="No download links.";
        return;
    }

    const best=data.results.find(x=>x.quality==="1080p") || data.results[0];
    player.innerHTML = `
        <video controls width="100%" src="${best.stream_url}" style="border-radius:10px;"></video>
    `;

    box.innerHTML = data.results.map(m=>`
        <a class="btn" href="${m.download_url}" target="_blank">
            ${m.quality} (${(m.size/1024/1024).toFixed(1)} MB)
        </a>
    `).join("");

    if(data.subtitles.length){
        box.innerHTML+=`<h3>Subtitles:</h3>` +
        data.subtitles.map(s=>`
            <a class="btn" href="${s.url}" target="_blank">${s.lanName}</a>
        `).join("");
    }
}

// CLICK EVENTS
grid.addEventListener("click",e=>{
    const card=e.target.closest(".card");
    if(card) openModal(card.dataset.id, card.dataset.type);
});

closeModalBtn.onclick=()=>{
    modal.classList.add("hidden");
    document.body.style.overflow="";
};

document.querySelectorAll(".sec-btn").forEach(btn=>{
    btn.onclick=()=>{
        document.querySelectorAll(".sec-btn").forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        state.section=btn.dataset.sec;
        state.page=1;
        load();
    };
});

next.onclick=()=>{ if(state.page<state.total){ state.page++; load(); }};
prev.onclick=()=>{ if(state.page>1){ state.page--; load(); }};

search.oninput=()=>{
    if(!search.value.trim()) return load();
    fastSearch(search.value.trim());
};

async function fastSearch(qr){
    show();
    const data=await q(`${BASE}/search/multi?query=${qr}`);
    render(data.results.slice(0,20));
    hide();
}

// LOAD DEFAULT
load();