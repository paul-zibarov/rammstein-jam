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
  statAlbums: document.getElementById("stat-albums"),
  statMatches: document.getElementById("stat-matches"),
  playlist: document.getElementById("playlist"),
  leaderboardBody: document.getElementById("leaderboard-body"),
  matchesList: document.getElementById("matches-list"),
  pairwiseList: document.getElementById("pairwise-list"),
  votersList: document.getElementById("voters-list"),
};

function showToast(message, isError = false) {
  els.toast.textContent = message;
  els.toast.classList.toggle("error", isError);
  els.toast.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => els.toast.classList.add("hidden"), 4000);
}

function updateSelectionUI() {
  els.selectedCount.textContent = selected.size;

  document.querySelectorAll(".song-item").forEach((item) => {
    const key = item.dataset.key;
    const checked = selected.has(key);
    item.classList.toggle("selected", checked);
    const input = item.querySelector("input");
    input.checked = checked;
  });

  els.submitBtn.disabled = selected.size === 0 || !els.name.value.trim();
}

function renderAlbums() {
  els.albums.innerHTML = albums
    .map(
      (album) => `
    <article class="album" data-album="${album.id}">
      <header class="album-header">
        <img class="album-cover" src="${album.cover}" alt="${album.name}" loading="lazy" width="72" height="72" />
        <div class="album-meta">
          <h3>${album.name}</h3>
          <span>${album.year}</span>
        </div>
      </header>
      <div class="song-list">
        ${album.songs
          .map(
            (song) => `
          <label class="song-item" data-key="${song.key}">
            <input type="checkbox" value="${song.key}" />
            <span class="song-title">${song.name}</span>
            <a class="song-yt" href="${song.youtubeUrl}" target="_blank" rel="noopener" title="YouTube" onclick="event.stopPropagation()">▶</a>
          </label>`
          )
          .join("")}
      </div>
    </article>`
    )
    .join("");

  els.albums.addEventListener("change", (e) => {
    const input = e.target;
    if (input.type !== "checkbox") return;
    if (input.checked) selected.add(input.value);
    else selected.delete(input.value);
    updateSelectionUI();
  });

  els.albums.addEventListener("click", (e) => {
    if (e.target.closest(".song-yt")) return;
    const item = e.target.closest(".song-item");
    if (!item || e.target.tagName === "INPUT") return;
    const input = item.querySelector("input");
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
    const res = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, songs }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Помилка збереження");

    showToast(data.updated ? `Голос оновлено, ${name}!` : `Дякуємо, ${name}!`);
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

function ytLink(url, label = "YouTube") {
  return `<a class="yt-link" href="${url}" target="_blank" rel="noopener">${label}</a>`;
}

async function loadResults() {
  try {
    const [playlistRes, leaderboardRes, matchesRes, votesRes] = await Promise.all([
      fetch("/api/playlist"),
      fetch("/api/leaderboard"),
      fetch("/api/matches"),
      fetch("/api/votes"),
    ]);

    const playlistData = await playlistRes.json();
    const leaderboardData = await leaderboardRes.json();
    const matchesData = await matchesRes.json();
    const votesData = await votesRes.json();

    els.statVoters.textContent = matchesData.totalVoters;
    els.statAlbums.textContent = playlistData.playlist.length;
    els.statMatches.textContent = matchesData.matches.length;

    if (playlistData.playlist.length === 0) {
      els.playlist.innerHTML = emptyState("Ще немає голосів для плейлисту");
    } else {
      els.playlist.innerHTML = playlistData.playlist
        .map(
          (track) => `
        <div class="playlist-item">
          <img class="playlist-cover" src="${track.albumCover}" alt="" loading="lazy" />
          <div class="playlist-info">
            <p class="playlist-album">${track.albumName} <span>${track.albumYear}</span></p>
            <p class="playlist-song">${track.songName}</p>
            <p class="playlist-meta">${track.voteCount} голосів · ${track.voters.join(", ")}</p>
          </div>
          ${ytLink(track.youtubeUrl, "▶ Слухати")}
        </div>`
        )
        .join("");
    }

    const rows = leaderboardData.leaderboard;
    if (rows.length === 0) {
      els.leaderboardBody.innerHTML = `<tr><td colspan="6" class="empty-cell">Ще ніхто не голосував</td></tr>`;
    } else {
      els.leaderboardBody.innerHTML = rows
        .map(
          (row) => `
        <tr>
          <td class="rank-cell">${row.rank}</td>
          <td><img class="table-cover" src="${row.albumCover}" alt="" loading="lazy" /></td>
          <td class="song-cell">${row.songName}</td>
          <td>${row.albumName}</td>
          <td class="votes-cell">${row.voteCount}</td>
          <td>${ytLink(row.youtubeUrl, "▶")}</td>
        </tr>`
        )
        .join("");
    }

    if (matchesData.matches.length === 0) {
      els.matchesList.innerHTML = emptyState(
        matchesData.totalVoters < 2
          ? "Потрібно щонайменше 2 учасники"
          : "Поки немає спільних пісень"
      );
    } else {
      els.matchesList.innerHTML = matchesData.matches
        .map(
          (m) => `
        <div class="match-item">
          <img class="match-cover" src="${m.albumCover}" alt="" loading="lazy" />
          <div class="match-info">
            <p class="match-song">${m.songName} ${ytLink(m.youtubeUrl, "▶")}</p>
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

    if (votesData.voters.length === 0) {
      els.votersList.innerHTML = emptyState("Поки немає голосів");
    } else {
      els.votersList.innerHTML = votesData.voters
        .map((v) => {
          const chips = v.songs
            .map((s) => {
              const album = albums.find((a) => a.id === s.albumId);
              const song = album?.songs.find((t) => t.key === s.key);
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
  } catch {
    els.playlist.innerHTML = emptyState("Не вдалося завантажити результати");
  }
}

async function init() {
  const res = await fetch("/api/albums");
  albums = await res.json();
  renderAlbums();
  updateSelectionUI();
}

init();
