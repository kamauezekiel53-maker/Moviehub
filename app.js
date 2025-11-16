/* =========================
   Config
   ========================= */

// TMDB API key (you shared this)
const TMDB_API_KEY = "7cc9abef50e4c94689f48516718607be";

// GiftedTech movie sources API base (pattern: /api/sources/{id})
const GIFTED_BASE = "https://movieapi.giftedtech.co.ke/api/sources/";

/* =========================
   Helpers
   ========================= */

const qs = (sel) => document.querySelector(sel);
const createEl = (tag, cls) => { const el = document.createElement(tag); if (cls) el.className = cls; return el; };
const status = qs("#status");
const results = qs("#results");

// TMDB image helper
const tmdbImg = (path, size = "w342") =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : "";

// Basic celebratory confetti
function confettiBurst() {
  const canvas = qs("#confetti-canvas");
  const ctx = canvas.getContext("2d");
  const w = canvas.width = window.innerWidth;
  const h = canvas.height = window.innerHeight;
  const pieces = Array.from({ length: 80 }, () => ({
    x: Math.random() * w,
    y: -20,
    r: 4 + Math.random() * 6,
    c: Math.random() < 0.5 ? "#7c3aed" : "#22d3ee",
    vy: 2 + Math.random() * 4,
    vx: -1 + Math.random() * 2,
  }));
  let frames = 0;
  function draw() {
    frames++;
    ctx.clearRect(0, 0, w, h);
    for (const p of pieces) {
      p.x += p.vx; p.y += p.vy;
      ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    if (frames < 120) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, w, h);
  }
  draw();
}

/* =========================
   Search and render
   ========================= */

async function searchMovies(query) {
  status.textContent = "Searching…";
  try {
    const url = new URL("https://api.themoviedb.org/3/search/movie");
    url.searchParams.set("api_key", TMDB_API_KEY);
    url.searchParams.set("query", query);
    url.searchParams.set("include_adult", "false");
    const res = await fetch(url);
    if (!res.ok) throw new Error("TMDB search failed");
    const data = await res.json();
    renderResults(data.results ?? []);
    status.textContent = data.results?.length ? `Found ${data.results.length} result(s).` : "No results.";
  } catch (e) {
    console.error(e);
    status.textContent = "Search error. Check API key or network.";
  }
}

function renderResults(items) {
  results.innerHTML = "";
  for (const m of items) {
    const card = createEl("article", "card");
    const img = createEl("img", "poster");
    img.src = tmdbImg(m.poster_path);
    img.alt = `${m.title} poster`;

    const body = createEl("div", "card-body");
    const title = createEl("div", "title");
    title.textContent = m.title;

    const year = (m.release_date || "").split("-")[0] || "—";
    const meta = createEl("div", "meta");
    meta.textContent = `Year: ${year} • Rating: ${m.vote_average?.toFixed?.(1) ?? "N/A"}`;

    const actions = createEl("div", "actions");
    const openBtn = createEl("button", "primary");
    openBtn.textContent = "Open";
    openBtn.addEventListener("click", () => openModal(m));

    const trailerBtn = createEl("button", "ghost");
    trailerBtn.textContent = "Trailer";
    trailerBtn.addEventListener("click", async () => {
      await openModal(m, { showTrailer: true });
    });

    actions.append(openBtn, trailerBtn);
    body.append(title, meta, actions);
    card.append(img, body);
    results.append(card);
  }
}

/* =========================
   Modal logic
   ========================= */

const modal = qs("#modal");
const modalClose = qs("#modal-close");
const streamPlayer = qs("#stream-player");
const downloadLink = qs("#download-link");
const trailerWrap = qs("#trailer");
const trailerFrame = qs("#trailer-frame");
const movieTitleEl = qs("#movie-title");
const movieMetaEl = qs("#movie-meta");
const movieOverviewEl = qs("#movie-overview");
const controlsWrap = document.querySelector(".controls");

let currentMovie = null;
let currentSources = [];   // Array of {quality, stream_url, download_url, size, format}
let currentSubtitles = []; // Array of {lan, lanName, url, ...}

function setModalVisible(visible) {
  modal.setAttribute("aria-hidden", visible ? "false" : "true");
  if (!visible) {
    streamPlayer.pause();
    streamPlayer.removeAttribute("src");
    trailerFrame.removeAttribute("src");
    trailerWrap.classList.add("hidden");
    // Clear any <track> elements when closing
    Array.from(streamPlayer.querySelectorAll("track")).forEach(t => t.remove());
  }
}

modalClose.addEventListener("click", () => setModalVisible(false));

async function openModal(movie, opts = {}) {
  currentMovie = movie;
  movieTitleEl.textContent = movie.title;
  const year = (movie.release_date || "").split("-")[0] || "—";
  movieMetaEl.textContent = `Year: ${year} • Rating: ${movie.vote_average?.toFixed?.(1) ?? "N/A"}`;
  movieOverviewEl.textContent = movie.overview || "No overview available.";
  streamPlayer.poster = tmdbImg(movie.backdrop_path, "w780") || tmdbImg(movie.poster_path, "w342");

  status.textContent = "Loading sources…";
  try {
    const payload = await fetchGiftedPayload(movie);
    currentSources = payload.results || [];
    currentSubtitles = payload.subtitles || [];
  } catch (e) {
    console.error(e);
    currentSources = [];
    currentSubtitles = [];
  }

  // Build dynamic controls: quality buttons + download + trailer
  buildControls(currentSources, year);

  // Preload subtitles tracks (optional)
  attachSubtitles(currentSubtitles);

  // Trailer
  if (opts.showTrailer) {
    await loadTrailer(movie);
  } else {
    trailerWrap.classList.add("hidden");
    trailerFrame.removeAttribute("src");
  }

  setModalVisible(true);
  status.textContent = "";
}

function buildControls(sources, year) {
  controlsWrap.innerHTML = "";

  if (!sources.length) {
    const warn = createEl("button", "secondary");
    warn.textContent = "No sources available";
    warn.disabled = true;
    controlsWrap.appendChild(warn);
  }

  // Create a play button for each quality
  sources.forEach(src => {
    const btn = createEl("button", "primary");
    btn.textContent = `Play ${src.quality}`;
    btn.addEventListener("click", () => {
      // Set the stream URL and play
      streamPlayer.src = src.stream_url;
      streamPlayer.play().catch(() => {});
      confettiBurst();
      // Update download link
      downloadLink.href = src.download_url;
      downloadLink.setAttribute("download", sanitizeFileName(`${currentMovie.title}-${year}-${src.quality}`) + ".mp4");
      downloadLink.style.display = "inline-flex";
    });
    controlsWrap.appendChild(btn);
  });

  // Trailer button
  const trailerBtn = createEl("button", "ghost");
  trailerBtn.textContent = "Watch trailer";
  trailerBtn.addEventListener("click", async () => {
    await loadTrailer(currentMovie);
  });
  controlsWrap.appendChild(trailerBtn);
}

function attachSubtitles(subtitles) {
  // Remove any existing tracks first
  Array.from(streamPlayer.querySelectorAll("track")).forEach(t => t.remove());
  subtitles.forEach(sub => {
    const track = document.createElement("track");
    track.kind = "subtitles";
    track.label = sub.lanName || sub.lan || "Subtitle";
    track.srclang = (sub.lan || "en").slice(0, 2);
    track.src = sub.url;
    streamPlayer.appendChild(track);
  });
}

/* =========================
   GiftedTech payload (sources + subtitles)
   ========================= */

/**
 * The endpoint returns:
 * {
 *   status: 200,
 *   success: true,
 *   creator: "GiftedTech",
 *   results: [{ id, quality, download_url, stream_url, size, format }, ...],
 *   subtitles: [{ id, lan, lanName, url, size, delay }, ...]
 * }
 */
async function fetchGiftedPayload(movie) {
  // Mapping note:
  // If your GiftedTech IDs are NOT TMDB IDs, replace this with the correct mapping (e.g., another field you store).
  const giftedId = movie.id; // adjust if needed
  const url = `${GIFTED_BASE}${giftedId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("GiftedTech sources fetch failed");
  const data = await res.json();
  return data;
}

/* =========================
   Trailer
   ========================= */

async function loadTrailer(movie) {
  try {
    const url = new URL(`https://api.themoviedb.org/3/movie/${movie.id}/videos`);
    url.searchParams.set("api_key", TMDB_API_KEY);
    const res = await fetch(url);
    if (!res.ok) throw new Error("TMDB videos failed");
    const data = await res.json();
    const yt = (data.results || []).find(v => v.site === "YouTube" && v.type === "Trailer");
    if (yt) {
      trailerFrame.src = `https://www.youtube.com/embed/${yt.key}`;
      trailerWrap.classList.remove("hidden");
    } else {
      trailerWrap.classList.add("hidden");
      trailerFrame.removeAttribute("src");
      alert("No trailer found.");
    }
  } catch (e) {
    console.error(e);
    alert("Error loading trailer.");
  }
}

/* =========================
   Wire up search form
   ========================= */

const form = qs("#search-form");
const input = qs("#search-input");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  searchMovies(q);
});

// Initial popular fallback
(async function loadPopular() {
  status.textContent = "Loading popular…";
  try {
    const url = new URL("https://api.themoviedb.org/3/movie/popular");
    url.searchParams.set("api_key", TMDB_API_KEY);
    const res = await fetch(url);
    const data = await res.json();
    renderResults(data.results ?? []);
    status.textContent = "Popular now.";
  } catch (e) {
    status.textContent = "Unable to load popular movies.";
  }
})();

/* =========================
   Utilities
   ========================= */

function sanitizeFileName(name) {
  return String(name).replace(/[^\w\-]+/g, "_");
}