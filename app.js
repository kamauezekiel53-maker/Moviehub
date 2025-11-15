// PublicMovieHub app.js - static, local-only accounts + watchlist + offline caching
// Uses movies.json as data source (sample demo sources are playable).

// DOM
const rowsContainer = document.getElementById('rowsContainer');
const searchInput = document.getElementById('search');
const browseAllBtn = document.getElementById('browseAll');
const openMockupBtn = document.getElementById('openMockup');
const signinBtn = document.getElementById('signinBtn');
const userChip = document.getElementById('userChip');
const emptyEl = document.getElementById('empty');

// Player modal
const playerModal = document.getElementById('playerModal');
const videoPlayer = document.getElementById('videoPlayer');
const videoTitle = document.getElementById('videoTitle');
const videoDesc = document.getElementById('videoDesc');
const closePlayerBtn = document.getElementById('closePlayer');
const addWatchlistBtn = document.getElementById('addWatchlist');
const openSourceBtn = document.getElementById('openSource');

// Auth modal
const authModal = document.getElementById('authModal');
const authUser = document.getElementById('authUser');
const authPass = document.getElementById('authPass');
const authSignIn = document.getElementById('authSignIn');
const authSignUp = document.getElementById('authSignUp');
const authClose = document.getElementById('authClose');
const authMsg = document.getElementById('authMsg');

let movies = [];
let currentUser = null;
let currentMovie = null;

// Basic utils for local accounts & watchlist
const STORAGE_KEYS = {
  USERS: 'pm_users', // object: {username: {password, watchlist: [id,...]}}
  SESSION: 'pm_session' // username
};

function loadUsers(){
  try{
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}
function saveUsers(users){ localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users)); }

function setSession(username){
  if(username){ localStorage.setItem(STORAGE_KEYS.SESSION, username); currentUser = username; }
  else { localStorage.removeItem(STORAGE_KEYS.SESSION); currentUser = null; }
  renderUserChip();
}

function getSession(){ return localStorage.getItem(STORAGE_KEYS.SESSION); }

function ensureUserExists(username){
  const users = loadUsers();
  if(!users[username]) users[username] = { password: null, watchlist: [] };
  saveUsers(users);
}

function addToWatchlist(username, movieId){
  const users = loadUsers();
  if(!users[username]) return false;
  if(!users[username].watchlist.includes(movieId)) users[username].watchlist.push(movieId);
  saveUsers(users);
  return true;
}
function removeFromWatchlist(username, movieId){
  const users = loadUsers();
  if(!users[username]) return false;
  users[username].watchlist = users[username].watchlist.filter(x=>x!==movieId);
  saveUsers(users);
  return true;
}
function isInWatchlist(username, movieId){
  const users = loadUsers();
  if(!users[username]) return false;
  return users[username].watchlist.includes(movieId);
}
function getWatchlist(username){
  const users = loadUsers();
  return users[username] ? (users[username].watchlist || []) : [];
}

// Authentication handlers (local-only)
authSignUp.addEventListener('click', ()=>{
  const u = (authUser.value||'').trim(); const p = (authPass.value||'').trim();
  if(!u || !p){ authMsg.textContent='Enter username & password.'; return; }
  const users = loadUsers();
  if(users[u]){ authMsg.textContent='User exists — sign in instead.'; return; }
  users[u] = { password: p, watchlist: [] };
  saveUsers(users);
  setSession(u);
  authMsg.textContent='Account created. Signed in.';
  setTimeout(()=> closeAuthModal(),700);
});
authSignIn.addEventListener('click', ()=>{
  const u = (authUser.value||'').trim(); const p = (authPass.value||'').trim();
  if(!u || !p){ authMsg.textContent='Enter username & password.'; return; }
  const users = loadUsers();
  if(!users[u] || users[u].password !== p){ authMsg.textContent='Invalid credentials.'; return; }
  setSession(u);
  authMsg.textContent='Signed in.';
  setTimeout(()=> closeAuthModal(),400);
});
authClose.addEventListener('click', ()=> closeAuthModal());

function openAuthModal(){
  authModal.classList.add('open'); authModal.setAttribute('aria-hidden','false');
  authMsg.textContent='Local-only accounts saved in your browser.';
}
function closeAuthModal(){
  authModal.classList.remove('open'); authModal.setAttribute('aria-hidden','true');
  authUser.value=''; authPass.value=''; authMsg.textContent='';
}

// Render user chip
function renderUserChip(){
  const session = getSession();
  if(session){ userChip.classList.remove('hidden'); userChip.textContent = session + ' • Watchlist'; signinBtn.textContent = 'Sign Out'; currentUser = session; }
  else { userChip.classList.add('hidden'); signinBtn.textContent = 'Sign In'; currentUser = null; }
}
signinBtn.addEventListener('click', ()=>{
  const session = getSession();
  if(session){ // sign out
    setSession(null);
  } else {
    openAuthModal();
  }
});

// Load movies.json
async function loadMovies(){
  try{
    const res = await fetch('movies.json');
    movies = await res.json();
  }catch(e){ console.warn('movies.json load failed', e); movies = []; }
}

// Build UI rows (simple buckets: Featured, Classics, Demos)
function buildRows(){
  rowsContainer.innerHTML = '';
  const buckets = [
    {title:'Featured', items: movies.slice(0,10)},
    {title:'Classics', items: movies.slice(10,40)},
    {title:'Open & Demo Movies', items: movies.slice(40,80)},
    {title:'More to Explore', items: movies.slice(80,100)}
  ];
  for(const b of buckets){
    const row = document.createElement('div'); row.className='row';
    const h = document.createElement('h3'); h.textContent = b.title; row.appendChild(h);
    const carousel = document.createElement('div'); carousel.className='carousel';
    for(const m of b.items){
      const tile = createTile(m);
      carousel.appendChild(tile);
    }
    row.appendChild(carousel);
    rowsContainer.appendChild(row);
  }
}

// create tile element
function createTile(m){
  const t = document.createElement('div'); t.className='tile';
  const th = document.createElement('div'); th.className='thumb'; th.textContent = m.title;
  const meta = document.createElement('div'); meta.className='meta';
  const title = document.createElement('div'); title.className='title'; title.textContent = m.title;
  const year = document.createElement('div'); year.className='meta small'; year.style.marginTop='6px'; year.textContent = m.year || '';
  meta.appendChild(title); meta.appendChild(year);
  t.appendChild(th); t.appendChild(meta);
  t.addEventListener('click', ()=> openPlayer(m));
  return t;
}

// player controls
function openPlayer(m){
  currentMovie = m;
  videoTitle.textContent = m.title;
  videoDesc.textContent = m.description || '';
  openSourceBtn.onclick = ()=> window.open(m.sourcePage || '#','_blank');

  // set watchlist button text
  if(getSession() && isInWatchlist(getSession(), m.id)) addWatchlistBtn.textContent = 'Remove from Watchlist';
  else addWatchlistBtn.textContent = 'Add to Watchlist';

  if(window.hlsjs && m.source && m.source.endsWith('.m3u8') && Hls.isSupported()){
    if(window.hls) window.hls.destroy();
    window.hls = new Hls();
    window.hls.loadSource(m.source);
    window.hls.attachMedia(videoPlayer);
    window.hls.on(Hls.Events.MANIFEST_PARSED, ()=> videoPlayer.play().catch(()=>{}));
  } else {
    // native mp4
    videoPlayer.src = m.source;
    videoPlayer.crossOrigin = 'anonymous';
    videoPlayer.load();
    videoPlayer.play().catch(()=>{});
  }

  playerModal.classList.add('open'); playerModal.setAttribute('aria-hidden','false');
}
closePlayerBtn.addEventListener('click', closePlayer);
function closePlayer(){
  if(window.hls) { window.hls.destroy(); window.hls = null; }
  videoPlayer.pause(); videoPlayer.removeAttribute('src'); videoPlayer.load();
  playerModal.classList.remove('open'); playerModal.setAttribute('aria-hidden','true');
}

// watchlist button
addWatchlistBtn.addEventListener('click', ()=>{
  const user = getSession();
  if(!user){ openAuthModal(); return; }
  if(!currentMovie) return;
  if(isInWatchlist(user, currentMovie.id)){
    removeFromWatchlist(user, currentMovie.id);
    addWatchlistBtn.textContent = 'Add to Watchlist';
  } else {
    addToWatchlist(user, currentMovie.id);
    addWatchlistBtn.textContent = 'Remove from Watchlist';
  }
});

// search & browse
searchInput.addEventListener('input', (e)=> {
  const q = (e.target.value || '').trim().toLowerCase();
  if(!q){ buildRows(); emptyEl.style.display='none'; return; }
  const found = movies.filter(m => (m.title||'').toLowerCase().includes(q) || (m.description||'').toLowerCase().includes(q));
  renderSearchResults(found);
});
browseAllBtn.addEventListener('click', ()=> buildRows());
openMockupBtn.addEventListener('click', ()=> window.open('mockup.html','_blank'));

// render search results
function renderSearchResults(list){
  rowsContainer.innerHTML = '';
  if(!list || list.length===0){ emptyEl.style.display='block'; return; }
  emptyEl.style.display='none';
  const row = document.createElement('div'); row.className='row';
  const h = document.createElement('h3'); h.textContent='Search Results'; row.appendChild(h);
  const carousel = document.createElement('div'); carousel.className='carousel';
  for(const m of list){ carousel.appendChild(createTile(m)); }
  row.appendChild(carousel);
  rowsContainer.appendChild(row);
}

// initial boot
(async function init(){
  // expose Hls lib if available
  window.hlsjs = typeof Hls !== 'undefined';
  await loadMovies();
  buildRows();
  renderUserChip();
  const sess = getSession();
  if(sess) currentUser = sess;
})();