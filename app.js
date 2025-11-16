/** --------------- CONFIG ---------------- */
const API_KEY = "7cc9abef50e4c94689f48516718607be";
const API_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/w500";

/** GiftedTech / Download API base
 * - DEFAULT_DOWNLOAD_ID: the original sample id you provided
 * - If you have per-movie GiftedTech IDs later, pass them into openModal() or
 *   ensure your card elements have data-gifted-id attributes and the code will use those.
 */
const DOWNLOAD_API_BASE = "https://movieapi.giftedtech.co.ke/api/sources";
const DEFAULT_DOWNLOAD_ID = "6127914234610600632"; // fallback (your earlier hard-coded one)
const DEFAULT_DOWNLOAD_API = `${DOWNLOAD_API_BASE}/${DEFAULT_DOWNLOAD_ID}`;

/** DOM ELEMENTS */
const moviesGrid = document.getElementById("moviesGrid");
const loader = document.getElementById("loader");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const sectionButtons = document.querySelectorAll(".sec-btn");
const pageInfo = document.getElementById("pageInfo");
const prevBtn = document.getElementById("prevPage");
const nextBtn = document.getElementById("nextPage");
const themeToggle = document.getElementById("themeToggle");
const colorTheme = document.getElementById("colorTheme");

const modal = document.getElementById("modal");
const modalClose = document.getElementById("modalClose");
const modalPoster = document.getElementById("modalPoster");
const modalTitle = document.getElementById("modalTitle");
const modalSub = document.getElementById("modalSub");
const modalOverview = document.getElementById("modalOverview");
const modalVideos = document.getElementById("modalVideos");
const modalCast = document.getElementById("modalCast");
const modalDownload = document.getElementById("modalDownload");
const modalStream = document.getElementById("modalStream"); // NEW: container for the video player

/** CAROUSELS */
const trendingRow = document.getElementById("trendingRow");
const topRatedRow = document.getElementById("topRatedRow");
const nowPlayingRow = document.getElementById("nowPlayingRow");

/*** STATE */
let state = {
  section: "popular",
  page: 1,
  total_pages: 1,
  query: "",
  debounce: null,
};

/** HLS instance holder so we can destroy when closing modal */
let currentHls = null;

/** ----------- HELPERS ----------- */

function qs(url) {
  const u = new URL(url);
  u.searchParams.set("api_key", API_KEY);
  return fetch(u).then((r) => r.json());
}

function showLoader() {
  loader.classList.remove("hidden");
}
function hideLoader() {
  loader.classList.add("hidden");
}

function clearGrid() {
  moviesGrid.innerHTML = "";
}

function movieEndpoint(section, page = 1) {
  switch (section) {
    case "trending":
      return `${API_BASE}/trending/movie/week?page=${page}`;
    case "now_playing":
      return `${API_BASE}/movie/now_playing?page=${page}`;
    case "top_rated":
      return `${API_BASE}/movie/top_rated?page=${page}`;
    case "tv_popular":
      return `${API_BASE}/tv/popular?page=${page}`;
    case "anime":
      return `${API_BASE}/discover/tv?with_genres=16&page=${page}`;
    default:
      return `${API_BASE}/movie/popular?page=${page}`;
  }
}

/** ----------- RENDER MOVIE GRID ----------- */
function renderMovies(list) {
  clearGrid();

  if (!list || list.length === 0) {
    moviesGrid.innerHTML = `<p class="muted">No results found.</p>`;
    return;
  }

  list.forEach((m) => {
    const poster = m.poster_path ? IMG_BASE + m.poster_path : "";

    const card = document.createElement("div");
    card.className = "card";
    card.dataset.id = m.id;
    card.dataset.type = m.media_type || "movie";
    // Optional: If you have a GiftedTech source id for this movie, set it on the card like:
    // card.dataset.giftedId = "148479..."; // <-- if available

    card.innerHTML = `
      <div class="poster">
        ${
          poster
            ? `<img src="${poster}" alt="${m.title || m.name}">`
            : `<div class="muted" style="padding:20px">No Image</div>`
        }
      </div>
      <div class="card-body">
        <div class="title-row">
          <h3>${m.title || m.name}</h3>
          <span class="badge">⭐ ${m.vote_average?.toFixed(1) || "—"}</span>
        </div>
        <div class="muted">${(m.release_date || m.first_air_date || "—").slice(
          0,
          4
        )}</div>
      </div>
    `;

    moviesGrid.appendChild(card);
  });
}

/** ----------- LOAD SECTION ----------- */
async function loadSection(section = state.section, page = state.page) {
  try {
    showLoader();
    const url = movieEndpoint(section, page);
    const data = await qs(url);

    renderMovies(data.results || []);
    state.total_pages = data.total_pages || 1;

    pageInfo.textContent = `Page ${state.page} of ${state.total_pages}`;
    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page >= state.total_pages;
  } catch (err) {
    moviesGrid.innerHTML = `<p class="muted">Failed to load movies.</p>`;
  } finally {
    hideLoader();
  }
}

/** ----------- CAROUSEL LOADER ----------- */
async function loadCarousel(row, url) {
  const data = await qs(url);
  row.innerHTML = "";

  data.results.slice(0, 20).forEach((m) => {
    const item = document.createElement("div");
    item.className = "carousel-item";
    item.dataset.id = m.id;
    item.dataset.type = m.media_type || "movie";

    const poster = m.poster_path ? IMG_BASE + m.poster_path : "";

    item.innerHTML = `
      <img src="${poster}" alt="${m.title || m.name}">
    `;

    row.appendChild(item);
  });
}

/** INITIAL CAROUSELS */
loadCarousel(
  trendingRow,
  `${API_BASE}/trending/movie/week?api_key=${API_KEY}`
);
loadCarousel(
  topRatedRow,
  `${API_BASE}/movie/top_rated?api_key=${API_KEY}`
);
loadCarousel(
  nowPlayingRow,
  `${API_BASE}/movie/now_playing?api_key=${API_KEY}`
);

/** ----------- OPEN MOVIE MODAL ----------- */
async function openModal(id, type = "movie", giftedSourceId = null) {
  try {
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    // Reset modal content
    modalPoster.src = "";
    modalTitle.textContent = "Loading...";
    modalOverview.textContent = "";
    modalCast.innerHTML = "";
    modalVideos.innerHTML = "";
    modalDownload.innerHTML = "";
    modalStream.innerHTML = "";

    // Clean up any previous Hls instance
    destroyHlsIfAny();

    const data = await qs(
      `${API_BASE}/${type}/${id}?append_to_response=videos,credits`
    );

    modalPoster.src = data.poster_path ? IMG_BASE + data.poster_path : "";
    modalTitle.textContent = data.title || data.name;
    modalSub.textContent = `${data.release_date || data.first_air_date || ""}`;
    modalOverview.textContent = data.overview || "No description available.";

    /** CAST */
    modalCast.innerHTML = data.credits?.cast
      ?.slice(0, 10)
      .map(
        (c) => `
      <div>
        <img src="${c.profile_path ? IMG_BASE + c.profile_path : ""}">
        <small>${c.name}</small>
      </div>
    `
      )
      .join("");

    /** TRAILERS */
    const vids = data.videos?.results?.filter(
      (v) => v.site === "YouTube" && v.type === "Trailer"
    );

    modalVideos.innerHTML =
      vids?.length > 0
        ? vids
            .map(
              (v) => `
      <iframe src="https://www.youtube.com/embed/${v.key}" allowfullscreen></iframe>
    `
            )
            .join("")
        : `<p class="muted">No trailers available.</p>`;

    /** DOWNLOAD + STREAM LINKS — pass giftedSourceId if provided, otherwise attempt to read from card dataset or fallback to default */
    // If card that opened modal had a dataset.giftedId we should use it; otherwise - use giftedSourceId parameter if passed; otherwise fallback to DEFAULT_DOWNLOAD_API.
    // The click handler below will attempt to pass card.dataset.giftedId automatically if you set it on cards.
    const finalGiftedId = giftedSourceId || null;

    await loadDownloadLinks(finalGiftedId);
  } catch (err) {
    console.error(err);
    modalOverview.textContent = "Failed to load details.";
  }
}

/** ----------- LOAD STREAMING PLAYER -------------- */
/**
 * streamUrl - a direct playable url (mp4 or .m3u8) or GiftedTech-proxied stream_url
 * subtitles - array of subtitle objects { lan, lanName, url, delay, id }
 */
async function loadStreamingPlayer(streamUrl, subtitles = []) {
  // Clear previous player
  modalStream.innerHTML = "";

  // build video element
  const videoEl = document.createElement("video");
  videoEl.id = "streamPlayer";
  videoEl.controls = true;
  videoEl.autoplay = true;
  videoEl.width = 640;
  videoEl.style.maxWidth = "100%";
  videoEl.playsInline = true; // mobile

  modalStream.appendChild(videoEl);

  // remove existing tracks
  while (videoEl.firstChild) videoEl.removeChild(videoEl.firstChild);

  // attach subtitles as <track>
  subtitles.forEach((s) => {
    const track = document.createElement("track");
    track.kind = "subtitles";
    track.label = s.lanName || s.lan || "subtitle";
    track.srclang = (s.lan || "en").replace("_", "-");
    track.src = s.url;
    // default to English if available
    if ((s.lan || "").startsWith("en")) track.default = true;
    videoEl.appendChild(track);
  });

  // Choose player method: if .m3u8 -> try Hls.js, otherwise assign src
  const isHls = /\.m3u8($|\?)/i.test(streamUrl);

  if (isHls) {
    await ensureHlsJsLoaded();
    if (window.Hls && window.Hls.isSupported()) {
      destroyHlsIfAny();
      currentHls = new window.Hls();
      currentHls.loadSource(streamUrl);
      currentHls.attachMedia(videoEl);
      currentHls.on(window.Hls.Events.ERROR, function (event, data) {
        console.warn("Hls error", data);
      });
    } else if (videoEl.canPlayType("application/vnd.apple.mpegURL")) {
      // native HLS (Safari)
      videoEl.src = streamUrl;
    } else {
      console.error("HLS not supported in this browser");
      videoEl.innerHTML =
        "<p class='muted'>This browser cannot play HLS streams.</p>";
    }
  } else {
    // direct mp4 or other container
    videoEl.src = streamUrl;
  }

  try {
    await videoEl.play().catch(() => {});
  } catch (e) {
    // autoplay might be blocked by browser - it's ok, user can click play
  }
}

/** ensure Hls.js script is injected once (CDN) */
function ensureHlsJsLoaded() {
  return new Promise((resolve) => {
    if (window.Hls) return resolve();
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      console.warn("Failed to load Hls.js from CDN.");
      resolve();
    };
    document.head.appendChild(script);
  });
}

function destroyHlsIfAny() {
  if (currentHls && typeof currentHls.destroy === "function") {
    try {
      currentHls.destroy();
    } catch (e) {
      // ignore
    }
    currentHls = null;
  }
}

/** ----------- DOWNLOAD API & UI ----------- */
/**
 * giftedIdOrUrl - optional:
 *  - if null -> uses the DEFAULT_DOWNLOAD_API
 *  - if a string that starts with "http" -> treated as a full URL
 *  - otherwise it's treated as GiftedTech ID and we call `${DOWNLOAD_API_BASE}/{giftedIdOrUrl}`
 */
async function loadDownloadLinks(giftedIdOrUrl = null) {
  try {
    modalDownload.innerHTML = `<p class="muted">Loading...</p>`;

    let endpoint;
    if (!giftedIdOrUrl) {
      endpoint = DEFAULT_DOWNLOAD_API;
    } else if (typeof giftedIdOrUrl === "string" && giftedIdOrUrl.startsWith("http")) {
      endpoint = giftedIdOrUrl;
    } else {
      endpoint = `${DOWNLOAD_API_BASE}/${giftedIdOrUrl}`;
    }

    const res = await fetch(endpoint);
    if (!res.ok) throw new Error("Failed to fetch GiftedTech source");
    const data = await res.json();

    // Build quality selector & primary stream
    const results = data.results || [];
    const subs = data.subtitles || [];

    // If no results, show message
    if (!results.length) {
      modalDownload.innerHTML = `<p class="muted">No downloadable/streamable sources found.</p>`;
      return;
    }

    // Build quality selector UI
    const qualityHtml = results
      .map((v, i) => {
        // Use stream_url when available (recommended), otherwise download_url
        const playable = v.stream_url || v.download_url;
        return `<button class="quality-btn" data-url="${encodeURIComponent(
          playable
        )}" data-quality="${v.quality}">${v.quality}</button>`;
      })
      .join(" ");

    // Build download links list
    const downloadsHtml = results
      .map(
        (v) => `
      <div class="download-item">
        <strong>${v.quality}</strong> — ${(Number(v.size) / 1024 / 1024).toFixed(
          1
        )} MB<br>
        <a href="${v.download_url}" class="btn" target="_blank" rel="noopener noreferrer">Download</a>
      </div>
    `
      )
      .join("");

    // Subtitles list
    const subsHtml =
      subs.length > 0
        ? subs
            .map(
              (s) => `
        <div>
          <strong>${s.lanName}</strong><br>
          <a href="${s.url}" class="btn outline" target="_blank" rel="noopener noreferrer">Download Subtitle</a>
        </div>
      `
            )
            .join("")
        : `<p class="muted">No subtitles available.</p>`;

    modalDownload.innerHTML = `
      <h3>Stream / Qualities</h3>
      <div id="qualitySelector" style="margin-bottom:12px">${qualityHtml}</div>
      <h3>Download Links</h3>
      ${downloadsHtml}
      <h3>Subtitles</h3>
      ${subsHtml}
    `;

    // Wire up quality buttons to start streaming
    const qSel = document.getElementById("qualitySelector");
    if (qSel) {
      qSel.querySelectorAll(".quality-btn").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const url = decodeURIComponent(btn.dataset.url);
          // prefer stream_url -> may be a GiftedTech proxy that returns actual file bytes
          await loadStreamingPlayer(url, subs);
          // highlight selected
          qSel.querySelectorAll(".quality-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
        });
      });

      // auto-click best available quality (prefer highest: 1080, 720, 480, 360)
      const order = ["1080", "720", "480", "360"];
      let chosen = null;
      for (let pref of order) {
        chosen = Array.from(qSel.querySelectorAll(".quality-btn")).find((b) =>
          b.dataset.quality.includes(pref)
        );
        if (chosen) break;
      }
      // fallback to the first
      if (!chosen) chosen = qSel.querySelector(".quality-btn");
      if (chosen) chosen.click();
    }
  } catch (err) {
    console.error(err);
    modalDownload.innerHTML = `<p class="muted">Failed to load links.</p>`;
  }
}

/** ----------- CLOSE MODAL ----------- */
function closeModal() {
  modal.classList.add("hidden");
  document.body.style.overflow = "";
  // destroy any HLS and stop video playback
  destroyHlsIfAny();
  const player = document.getElementById("streamPlayer");
  if (player) {
    try {
      player.pause();
      player.src = "";
      player.load();
    } catch (e) {}
  }
  modalStream.innerHTML = "";
}

/** EVENT: MOVIE CLICK (GRID + CAROUSELS) */
document.addEventListener("click", (e) => {
  const card = e.target.closest(".card, .carousel-item");
  if (!card) return;

  // If you have a GiftedTech source id for this specific movie, set it as data-gifted-id on the card element.
  // Example: <div class="card" data-id="550" data-gifted-id="1484793580861508576">...
  const giftedId = card.dataset.giftedId || null;
  openModal(card.dataset.id, card.dataset.type || "movie", giftedId);
});

/** CLOSE MODALS */
modalClose.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

/** SECTION BUTTONS */
sectionButtons.forEach((btn) =>
  btn.addEventListener("click", () => {
    sectionButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    state.section = btn.dataset.sec;
    state.page = 1;
    loadSection();
  })
);

/** PAGINATION */
nextBtn.addEventListener("click", () => {
  if (state.page < state.total_pages) {
    state.page++;
    loadSection();
  }
});
prevBtn.addEventListener("click", () => {
  if (state.page > 1) {
    state.page--;
    loadSection();
  }
});

/** SEARCH */
searchBtn.addEventListener("click", () => {
  doSearch(searchInput.value.trim());
});
searchInput.addEventListener("input", () => {
  clearTimeout(state.debounce);
  state.debounce = setTimeout(() => {
    doSearch(searchInput.value.trim());
  }, 300);
});

async function doSearch(q) {
  if (!q) return loadSection();

  showLoader();
  const data = await qs(
    `${API_BASE}/search/movie?query=${encodeURIComponent(q)}`
  );
  hideLoader();

  renderMovies(data.results);
  pageInfo.textContent = `Search Results: ${data.results.length}`;
}

/** THEMES */
themeToggle.addEventListener("click", () =>
  document.body.classList.toggle("light")
);
colorTheme.addEventListener("change", (e) => {
  document.body.classList.remove("theme-sunset", "theme-ocean", "theme-neo");
  if (e.target.value) document.body.classList.add(`theme-${e.target.value}`);
});

/** LOAD DEFAULT SECTION */
loadSection();