const MAX_SONGS = 5;
const selected = new Set();
let albums = [];

const els = {
  albums: document.getElementById("albums"),
  form: document.getElementById("vote-form"),
  name: document.getElementById("voter-name"),
  selectedCount: document.getElementById("selected-count"),
  submitBtn: document.getElementById("submit-btn"),
  toast: document.getElementById("vote-toast"),
  tabs: document.querySelectorAll(".tab"),
  panels: {
    vote: document.getElementById("panel-vote"),
    results: document.getElementById("panel-results"),
  },
  statVoters: document.getElementById("stat-voters"),
  statMatches: document.getElementById("stat-matches"),
  matchesList: document.getElementById("matches-list"),
  pairwiseList: document.getElementById("pairwise-list"),
  rankingList: document.getElementById("ranking-list"),
  votersList: document.getElementById("voters-list"),
};

function songKey(albumId, songName) {
  return `${albumId}::${songName}`;
}

function showToast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.classList.toggle("error", isError);
  els.toast.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => els.toast.classList.add("hidden"), 4500);
}

function updateSelectionUI() {
  els.selectedCount.textContent = selected.size;
  const atMax = selected.size >= MAX_SONGS;

  document.querySelectorAll(".song-item").forEach((item) => {
    const key = item.dataset.key;
    const checked = selected.has(key);
    item.classList.toggle("selected", checked);
    const input = item.querySelector("input");
    input.checked = checked;
    item.classList.toggle("disabled", !checked && atMax);
    input.disabled = !checked && atMax;
  });

  els.submitBtn.disabled = selected.size === 0 || !els.name.value.trim();
}

function renderAlbums() {
  els.albums.innerHTML = albums
    .map(
      (album) => `
    <article class="album" data-album="${album.id}">
      <header class="album-header">
        <img
          class="album-cover"
          src="${album.cover}"
          alt="Обкладинка альбому ${album.name}"
          loading="lazy"
          width="72"
          height="72"
        />
        <div class="album-meta">
          <h3>${album.name}</h3>
          <span>${album.year}</span>
        </div>
      </header>
      <div class="song-list">
        ${album.songs
          .map((song) => {
            const key = songKey(album.id, song);
            return `
          <label class="song-item" data-key="${key}">
            <input type="checkbox" value="${key}" />
            <span>${song}</span>
          </label>`;
          })
          .join("")}
      </div>
    </article>`
    )
    .join("");

  els.albums.addEventListener("change", (e) => {
    const input = e.target;
    if (input.type !== "checkbox") return;

    const key = input.value;
    if (input.checked) {
      if (selected.size >= MAX_SONGS) {
        input.checked = false;
        showToast(`Максимум ${MAX_SONGS} пісень`, true);
        return;
      }
      selected.add(key);
    } else {
      selected.delete(key);
    }
    updateSelectionUI();
  });

  els.albums.addEventListener("click", (e) => {
    const item = e.target.closest(".song-item");
    if (!item || e.target.tagName === "INPUT") return;
    const input = item.querySelector("input");
    if (input.disabled) return;
    input.checked = !input.checked;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function switchTab(tabId) {
  els.tabs.forEach((tab) => {
    const active = tab.dataset.tab === tabId;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active);
  });

  Object.entries(els.panels).forEach(([id, panel]) => {
    const active = id === tabId;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });

  if (tabId === "results") loadResults();
}

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => switchTab(tab.dataset.tab));
});

els.name.addEventListener("input", updateSelectionUI);

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = els.name.value.trim();
  if (!name || selected.size === 0) return;

  const songs = [...selected].map((key) => {
    const [albumId, ...rest] = key.split("::");
    return { albumId, songName: rest.join("::") };
  });

  els.submitBtn.disabled = true;
  els.submitBtn.textContent = "Зберігаємо…";

  try {
    const data = await submitVote(name, songs);
    showToast(
      data.updated ? `Голос оновлено, ${name}!` : `Дякуємо, ${name}! Голос збережено.`
    );
    switchTab("results");
  } catch (err) {
    showToast(err.message, true);
  } finally {
    els.submitBtn.textContent = "Відправити голос";
    updateSelectionUI();
  }
});

function emptyState(text) {
  return `<p class="empty-state">${text}</p>`;
}

async function loadResults() {
  try {
    const [matchesData, votesData] = await Promise.all([getMatchesData(), getVotesData()]);

    els.statVoters.textContent = matchesData.totalVoters;
    els.statMatches.textContent = matchesData.matches.length;

    if (matchesData.matches.length === 0) {
      els.matchesList.innerHTML = emptyState(
        matchesData.totalVoters < 2
          ? "Потрібно щонайменше 2 учасники для збігів"
          : "Поки немає спільних пісень — оберіть однакові треки!"
      );
    } else {
      els.matchesList.innerHTML = matchesData.matches
        .map(
          (m) => `
        <div class="match-item">
          <img class="match-cover" src="${m.albumCover}" alt="" loading="lazy" />
          <div class="match-info">
            <p class="match-song">${m.songName}</p>
            <p class="match-album">${m.albumName}</p>
            <span class="match-badge">${m.voters.length} голосів</span>
            <p class="match-voters">${m.voters.join(", ")}</p>
          </div>
        </div>`
        )
        .join("");
    }

    if (matchesData.pairwise.length === 0) {
      els.pairwiseList.innerHTML = emptyState("Поки немає парних збігів");
    } else {
      els.pairwiseList.innerHTML = matchesData.pairwise
        .map(
          (p) => `
        <div class="pair-item">
          <p class="pair-names">${p.voterA} + ${p.voterB} — ${p.overlapCount} спільних</p>
          <p class="pair-songs">${p.sharedSongs.map((s) => s.songName).join(" · ")}</p>
        </div>`
        )
        .join("");
    }

    const ranked = matchesData.allSongs.filter((s) => s.voters.length > 0);
    if (ranked.length === 0) {
      els.rankingList.innerHTML = emptyState("Ще ніхто не голосував");
    } else {
      els.rankingList.innerHTML = ranked
        .map((s, i) => {
          const cover = albums.find((a) => a.id === s.albumId)?.cover ?? "";
          return `
        <div class="rank-row">
          <span class="rank-num">${i + 1}</span>
          <img class="rank-cover" src="${cover}" alt="" loading="lazy" />
          <div>
            <p class="rank-title">${s.songName}</p>
            <p class="rank-album">${s.albumName}</p>
          </div>
          <span class="rank-count">${s.voters.length}</span>
        </div>`;
        })
        .join("");
    }

    if (votesData.voters.length === 0) {
      els.votersList.innerHTML = emptyState("Поки немає голосів");
    } else {
      els.votersList.innerHTML = votesData.voters
        .map((v) => {
          const chips = v.songs
            .map((s) => {
              const album = albums.find((a) => a.id === s.albumId);
              return `<span class="chip">
              ${album ? `<img src="${album.cover}" alt="" />` : ""}
              ${s.songName}
            </span>`;
            })
            .join("");
          return `
        <div class="voter-block">
          <p class="voter-name">${v.name}</p>
          <div class="voter-songs">${chips}</div>
        </div>`;
        })
        .join("");
    }
  } catch (err) {
    els.matchesList.innerHTML = emptyState(err.message || "Не вдалося завантажити результати");
  }
}

async function init() {
  document.getElementById("max-songs").textContent = MAX_SONGS;
  document.getElementById("max-songs-2").textContent = MAX_SONGS;

  albums = window.RAMMSTEIN_ALBUMS || [];
  renderAlbums();
  updateSelectionUI();

  if (!getConfig().token) {
    showToast("Режим перегляду: для голосування налаштуйте VOTES_TOKEN (README)", true);
  }
}

init();
