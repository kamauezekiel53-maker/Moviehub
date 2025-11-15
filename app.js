// PublicMovieHub multi-file app.js
const resultsEl = document.getElementById('results');
const emptyEl = document.getElementById('empty');
const searchBtn = document.getElementById('searchBtn');
const browseBtn = document.getElementById('browseBtn');
const qInput = document.getElementById('q');

const modal = document.getElementById('modal');
const player = document.getElementById('player');
const pTitle = document.getElementById('p-title');
const pMeta = document.getElementById('p-meta');
const pDesc = document.getElementById('p-desc');
const closeModal = document.getElementById('closeModal') || document.getElementById('closeModal');
const openSource = document.getElementById('openSource');
const statusEl = document.getElementById('status');
const fullscreenBtn = document.getElementById('fullscreenBtn');
let hlsInstance = null;
let movies = [];

// Load local curated list
async function loadMovies() {
  try {
    const res = await fetch('movies.json');
    movies = await res.json();
  } catch (e) {
    console.warn('Failed to load movies.json, using empty list', e);
    movies = [];
  }
}

// create card
function createCard(item) {
  const div = document.createElement('div');
  div.className = 'card';
  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  thumb.textContent = item.title || item.id;
  const cb = document.createElement('div'); cb.className='card-body';
  const t = document.createElement('h4'); t.className='title'; t.textContent = item.title || item.id;
  const m = document.createElement('div'); m.className='meta'; m.textContent = item.year ? ('Year: '+item.year) : '';
  const btn = document.createElement('button'); btn.className='play-btn'; btn.textContent='Play';
  btn.onclick = () => openPlayer(item);
  cb.appendChild(t); cb.appendChild(m); cb.appendChild(btn);
  div.appendChild(thumb); div.appendChild(cb);
  return div;
}

async function populateResults(list) {
  resultsEl.innerHTML = '';
  if(!list || list.length === 0){
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';
  for(const item of list){
    const card = createCard(item);
    resultsEl.appendChild(card);
  }
}

function showStatus(s){ if(statusEl) statusEl.textContent = s; }

function openPlayer(item) {
  pTitle.textContent = item.title || item.id;
  pMeta.textContent = item.year ? ('Year: '+item.year) : '';
  pDesc.textContent = item.description || '';
  openSource.onclick = () => window.open(item.sourcePage || '#', '_blank');

  if(hlsInstance){ hlsInstance.destroy(); hlsInstance = null; }
  player.pause();
  player.removeAttribute('src');
  player.load();

  const src = item.source;
  showStatus('Loading source...');
  if(src && src.endsWith('.m3u8') && Hls.isSupported()){
    hlsInstance = new Hls();
    hlsInstance.loadSource(src);
    hlsInstance.attachMedia(player);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED, function(){
      player.play();
      showStatus('Playing (HLS)');
    });
    hlsInstance.on(Hls.Events.ERROR, function(e,d){ console.warn(e,d); showStatus('HLS error'); });
  } else {
    player.src = src;
    player.crossOrigin = 'anonymous';
    player.load();
    player.play().then(()=> showStatus('Playing')).catch(err=> {
      console.warn(err);
      showStatus('Playback failed — CORS or unsupported format.');
    });
  }

  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
}

function closePlayer(){
  if(hlsInstance){ hlsInstance.destroy(); hlsInstance=null; }
  player.pause();
  player.removeAttribute('src');
  player.load();
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden','true');
  showStatus('Ready');
}

document.addEventListener('click', (e)=> {
  if(e.target && e.target.id === 'closeModal') closePlayer();
});

fullscreenBtn.addEventListener('click', ()=> {
  if(document.fullscreenElement) document.exitFullscreen();
  else document.querySelector('.player-wrap').requestFullscreen().catch(()=>{});
});

// Search function: naive filter over local list
function searchLocal(q) {
  const ql = q.trim().toLowerCase();
  if(!ql) return movies;
  return movies.filter(m => (m.title || '').toLowerCase().includes(ql) || (m.description || '').toLowerCase().includes(ql));
}

// Event handlers
searchBtn.addEventListener('click', async ()=>{
  const q = qInput.value || '';
  const found = searchLocal(q);
  await populateResults(found);
});

browseBtn.addEventListener('click', async ()=> {
  await populateResults(movies);
});

// initial boot
(async ()=> {
  await loadMovies();
  await populateResults(movies);
  showStatus('Ready — browse sample or search the local list.');
})();