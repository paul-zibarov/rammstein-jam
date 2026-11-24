let MIN_SONGS_PER_ALBUM = 3;
let albums = [];
let currentPoll = null;

const PAGE = document.body.dataset.page || "vote";
const IMG = 'referrerpolicy="no-referrer"';

const els = {
  albums: document.getElementById("albums"),
  form: document.getElementById("vote-form"),
  name: document.getElementById("voter-name"),
  selectedCount: document.getElementById("selected-count"),
  albumsReady: document.getElementById("albums-ready"),
  albumsTotal: document.getElementById("albums-total"),
  minPerAlbum: document.getElementById("min-per-album"),
  minTotal: document.getElementById("min-total"),
  submitBtn: document.getElementById("submit-btn"),
  toast: document.getElementById("vote-toast"),
  tabs: document.querySelectorAll(".tab"),
  panels: {
    vote: document.getElementById("panel-vote"),
    results: document.getElementById("panel-results"),
  },
  pollTitle: document.getElementById("poll-title"),
  pollDescription: document.getElementById("poll-description"),
  archiveList: document.getElementById("archive-list"),
  archiveResults: document.getElementById("archive-results"),
  archivePollTitle: document.getElementById("archive-poll-title"),
  archivePollDescription: document.getElementById("archive-poll-description"),
  statVoters: document.getElementById("stat-voters"),
  statAlbums: document.getElementById("stat-albums"),
  statMatches: document.getElementById("stat-matches"),
  playlist: document.getElementById("playlist"),
  leaderboardBody: document.getElementById("leaderboard-body"),
  matchesList: document.getElementById("matches-list"),
  pairwiseList: document.getElementById("pairwise-list"),
  votersList: document.getElementById("voters-list"),
};

const selected = new Set();

function pollApi(path) {
  if (!currentPoll?.id) throw new Error("Голосування не завантажено");
  return `/api/polls/${currentPoll.id}${path}`;
}

function countByAlbum() {
  const counts = new Map();
  for (const key of selected) {
    const albumId = key.split("::")[0];
    counts.set(albumId, (counts.get(albumId) || 0) + 1);
  }
  return counts;
}

function isVoteValid() {
  if (!els.name?.value.trim()) return false;
  const counts = countByAlbum();
  if (counts.size !== albums.length) return false;
  return albums.every((album) => (counts.get(album.id) || 0) >= MIN_SONGS_PER_ALBUM);
}

function showToast(message, isError = false) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.toggle("error", isError);
  els.toast.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => els.toast.classList.add("hidden"), 4500);
}

function updateSelectionUI() {
  if (!els.albums) return;

  const counts = countByAlbum();
  let ready = 0;

  els.selectedCount.textContent = selected.size;
  els.albumsTotal.textContent = albums.length;
  els.minPerAlbum.textContent = MIN_SONGS_PER_ALBUM;
  els.minTotal.textContent = albums.length * MIN_SONGS_PER_ALBUM;

  document.querySelectorAll(".album").forEach((article) => {
    const albumId = article.dataset.album;
    const count = counts.get(albumId) || 0;
    const ok = count >= MIN_SONGS_PER_ALBUM;
    if (ok) ready += 1;

    const badge = article.querySelector(".album-pick-count");
    if (badge) {
      badge.textContent = `${count} / ${MIN_SONGS_PER_ALBUM}`;
      badge.classList.toggle("ok", ok);
      badge.classList.toggle("need", !ok);
    }
  });

  els.albumsReady.textContent = ready;

  document.querySelectorAll(".song-item").forEach((item) => {
    const key = item.dataset.key;
    const checked = selected.has(key);
    item.classList.toggle("selected", checked);
    const input = item.querySelector("input");
    input.checked = checked;
  });

  els.submitBtn.disabled = !isVoteValid();
}

function renderAlbums() {
  if (!els.albums) return;

  els.albums.innerHTML = albums
    .map(
      (album) => `
    <article class="album${album.kind === "singles" ? " album-singles" : ""}" data-album="${album.id}">
      <header class="album-header">
        <img class="album-cover" src="${album.cover}" alt="${album.name}" loading="lazy" width="72" height="72" ${IMG} />
        <div class="album-meta">
          <h3>${album.name}</h3>
          <span>${album.year ?? ""}</span>
        </div>
        <span class="album-pick-count need">0 / ${MIN_SONGS_PER_ALBUM}</span>
      </header>
      <div class="song-list">
        ${album.songs
          .map((song) => {
            const classes = ["song-item"];
            if (song.locked) classes.push("song-locked");
            if (song.bonus) classes.push("song-bonus");
            const title = song.locked
              ? ' title="Вже в плейлисті Vol. 1"'
              : song.bonus
                ? ' title="Бонус-трек"'
                : song.year
                  ? ` title="Сингл ${song.year}"`
                  : "";
            return `
          <label class="${classes.join(" ")}" data-key="${song.key}"${title}>
            <input type="checkbox" value="${song.key}" ${song.locked ? "disabled" : ""} />
            ${
              song.cover
                ? `<img class="song-cover" src="${song.cover}" alt="" loading="lazy" width="36" height="36" ${IMG} />`
                : ""
            }
            <span class="song-title">${song.name}${song.year ? ` <em class="song-year">${song.year}</em>` : ""}</span>
            ${song.bonus ? '<span class="song-bonus-badge">бонус</span>' : ""}
            ${song.locked ? '<span class="song-locked-badge">Vol. 1</span>' : ""}
            <span class="song-links">
              ${
                song.songsterrUrl
                  ? `<a class="song-tab" href="${song.songsterrUrl}" target="_blank" rel="noopener" title="Songsterr" onclick="event.stopPropagation()">TAB</a>`
                  : ""
              }
              <a class="song-yt" href="${song.youtubeUrl}" target="_blank" rel="noopener" title="YouTube" onclick="event.stopPropagation()">▶</a>
            </span>
          </label>`;
          })
          .join("")}
      </div>
    </article>`
    )
    .join("");

  els.albums.addEventListener("change", (e) => {
    const input = e.target;
    if (input.type !== "checkbox" || input.disabled) return;
    if (input.checked) selected.add(input.value);
    else selected.delete(input.value);
    updateSelectionUI();
  });
}

function switchTab(tabId) {
  els.tabs.forEach((tab) => {
    const active = tab.dataset.tab === tabId;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", active);
  });

  Object.entries(els.panels).forEach(([id, panel]) => {
    if (!panel) return;
    const active = id === tabId;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });

  if (tabId === "results") loadResults();
}

function emptyState(text) {
  return `<p class="empty-state">${text}</p>`;
}

function ytLink(url, label = "YouTube") {
  return `<a class="yt-link" href="${url}" target="_blank" rel="noopener">${label}</a>`;
}

function tabLink(url) {
  if (!url) return "";
  return `<a class="tab-link" href="${url}" target="_blank" rel="noopener">TAB</a>`;
}

async function ensureAlbumsLoaded() {
  if (albums.length) return;
  const res = await fetch(pollApi("/albums"));
  const data = await res.json();
  albums = data.albums;
  MIN_SONGS_PER_ALBUM = data.minSongsPerAlbum || 3;
}

async function loadResults() {
  if (!els.playlist) return;

  try {
    await ensureAlbumsLoaded();

    const [playlistRes, leaderboardRes, matchesRes, votesRes] = await Promise.all([
      fetch(pollApi("/playlist")),
      fetch(pollApi("/leaderboard")),
      fetch(pollApi("/matches")),
      fetch(pollApi("/votes")),
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
          <img class="playlist-cover" src="${track.albumCover}" alt="" loading="lazy" ${IMG} />
          <div class="playlist-info">
            <p class="playlist-album">${track.albumName} <span>${track.albumYear ?? ""}</span></p>
            ${track.songs
              .map((song) => {
                const votes = song.voteCount ?? song.voters?.length ?? track.voteCount ?? 0;
                const voters = song.voters?.length ? ` · ${song.voters.join(", ")}` : "";
                return `
            <div class="playlist-song-row${track.songs.length > 1 ? " playlist-tie" : ""}">
              <p class="playlist-song">${song.songName}</p>
              <p class="playlist-meta">${votes} голосів${voters}</p>
              <p class="playlist-links">${tabLink(song.songsterrUrl)} ${ytLink(song.youtubeUrl, "▶ Слухати")}</p>
            </div>`;
              })
              .join("")}
          </div>
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
          <td><img class="table-cover" src="${row.albumCover}" alt="" loading="lazy" ${IMG} /></td>
          <td class="song-cell">${row.songName}</td>
          <td>${row.albumName}</td>
          <td class="votes-cell">${row.voteCount}</td>
          <td class="links-cell">${tabLink(row.songsterrUrl)} ${ytLink(row.youtubeUrl, "▶")}</td>
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
          <img class="match-cover" src="${m.albumCover}" alt="" loading="lazy" ${IMG} />
          <div class="match-info">
            <p class="match-song">${m.songName} ${tabLink(m.songsterrUrl)} ${ytLink(m.youtubeUrl, "▶")}</p>
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
              return `<span class="chip">
                ${album ? `<img src="${album.cover}" alt="" ${IMG} />` : ""}
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

function applyPollMeta(poll) {
  currentPoll = poll;
  if (els.pollTitle) els.pollTitle.textContent = poll.title;
  if (els.pollDescription) els.pollDescription.textContent = poll.description;
  document.title = `${poll.title} — голосування`;
}

function setActiveArchiveCard(pollId) {
  document.querySelectorAll(".archive-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.pollId === pollId);
  });
}

async function openArchivedPoll(poll) {
  currentPoll = poll;
  albums = [];

  if (els.archivePollTitle) els.archivePollTitle.textContent = poll.title;
  if (els.archivePollDescription) els.archivePollDescription.textContent = poll.description;
  if (els.archiveResults) els.archiveResults.classList.remove("hidden");

  setActiveArchiveCard(poll.id);
  const url = new URL(window.location.href);
  url.searchParams.set("poll", poll.id);
  history.replaceState({}, "", url);

  await loadResults();
  els.archiveResults?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function initVotePage() {
  const res = await fetch("/api/polls");
  const data = await res.json();
  const active = data.polls.find((p) => p.id === data.activePollId) || data.polls.find((p) => p.status === "active");
  if (!active) throw new Error("Немає активного голосування");

  applyPollMeta(active);
  await ensureAlbumsLoaded();
  renderAlbums();
  updateSelectionUI();

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  els.name?.addEventListener("input", updateSelectionUI);

  els.form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = els.name.value.trim();
    if (!isVoteValid()) return;

    const songs = [...selected].map((key) => {
      const [albumId, ...rest] = key.split("::");
      return { albumId, songName: rest.join("::") };
    });

    els.submitBtn.disabled = true;
    els.submitBtn.textContent = "Зберігаємо…";

    try {
      const res = await fetch(pollApi("/votes"), {
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
}

async function initArchivePage() {
  const res = await fetch("/api/polls");
  const data = await res.json();
  const archived = data.archived?.length
    ? data.archived
    : data.polls.filter((p) => p.status === "archived");

  if (!els.archiveList) return;

  if (archived.length === 0) {
    els.archiveList.innerHTML = emptyState("Поки немає завершених голосувань");
    return;
  }

  els.archiveList.innerHTML = archived
    .map(
      (poll) => `
    <button type="button" class="archive-card" data-poll-id="${poll.id}">
      <span class="archive-card-badge">Архів</span>
      <span class="archive-card-title">${poll.title}</span>
      <span class="archive-card-desc">${poll.description}</span>
      <span class="archive-card-action">Переглянути результати →</span>
    </button>`
    )
    .join("");

  els.archiveList.addEventListener("click", (e) => {
    const card = e.target.closest(".archive-card");
    if (!card) return;
    const poll = archived.find((p) => p.id === card.dataset.pollId);
    if (poll) openArchivedPoll(poll);
  });

  const selectedId = new URLSearchParams(window.location.search).get("poll");
  const initial = archived.find((p) => p.id === selectedId) || archived[0];
  if (initial) await openArchivedPoll(initial);
}

async function init() {
  if (PAGE === "archive") {
    await initArchivePage();
    return;
  }

  await initVotePage();
}

init().catch((err) => {
  console.error(err);
  if (els.albums) {
    els.albums.innerHTML = emptyState("Не вдалося завантажити голосування");
  }
  if (els.archiveList) {
    els.archiveList.innerHTML = emptyState("Не вдалося завантажити архів");
  }
});
