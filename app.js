/** --------------- CONFIG ---------------- */
const API_KEY = "7cc9abef50e4c94689f48516718607be";
const API_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/w500";

const DOWNLOAD_API =
  "https://movieapi.giftedtech.co.ke/api/sources/6127914234610600632";

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

/*** CAROUSELS */
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
async function openModal(id, type = "movie") {
  try {
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    modalPoster.src = "";
    modalTitle.textContent = "Loading...";
    modalOverview.textContent = "";
    modalCast.innerHTML = "";
    modalVideos.innerHTML = "";
    modalDownload.innerHTML = "";

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

    /** DOWNLOAD LINKS — ALWAYS SHOW */
    loadDownloadLinks();

  } catch (err) {
    modalOverview.textContent = "Failed to load details.";
  }
}

/** ----------- DOWNLOAD API ----------- */
async function loadDownloadLinks() {
  try {
    modalDownload.innerHTML = `<p class="muted">Loading...</p>`;

    const res = await fetch(DOWNLOAD_API);
    const data = await res.json();

    modalDownload.innerHTML = `
      <h3>Download Links</h3>
      ${data.results
        .map(
          (v) => `
        <div class="download-item">
          <strong>${v.quality}</strong> — ${(v.size / 1024 / 1024).toFixed(
            1
          )} MB<br>
          <a href="${v.download_url}" class="btn" target="_blank">Download</a>
        </div>
      `
        )
        .join("")}

      <h3>Subtitles</h3>
      ${data.subtitles
        .map(
          (s) => `
        <div>
          <strong>${s.lanName}</strong><br>
          <a href="${s.url}" class="btn outline" target="_blank">Download Subtitle</a>
        </div>
      `
        )
        .join("")}
    `;
  } catch (err) {
    modalDownload.innerHTML = `<p class="muted">Failed to load links.</p>`;
  }
}

/** ----------- CLOSE MODAL ----------- */
function closeModal() {
  modal.classList.add("hidden");
  document.body.style.overflow = "";
}

/** EVENT: MOVIE CLICK (GRID + CAROUSELS) */
document.addEventListener("click", (e) => {
  const card = e.target.closest(".card, .carousel-item");
  if (!card) return;

  openModal(card.dataset.id, card.dataset.type || "movie");
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
  if (e.target.value)
    document.body.classList.add(`theme-${e.target.value}`);
});

/** LOAD DEFAULT SECTION */
loadSection();