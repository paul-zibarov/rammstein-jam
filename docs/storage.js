const MAX_SONGS = 5;
const TOKEN_STORAGE_KEY = "rammstein_jam_github_token";

function getConfig() {
  return window.APP_CONFIG || {};
}

function getToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || "";
}

function setToken(token) {
  const value = String(token ?? "").trim();
  if (value) localStorage.setItem(TOKEN_STORAGE_KEY, value);
  else localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function hasToken() {
  return Boolean(getToken());
}

function apiBase() {
  const { repo } = getConfig();
  return `https://api.github.com/repos/${repo}`;
}

function rawVotesUrl() {
  const { repo, branch, votesPath } = getConfig();
  return `https://raw.githubusercontent.com/${repo}/${branch}/${votesPath}`;
}

function authHeaders() {
  const token = getToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

async function loadVotesFromApi() {
  const { votesPath } = getConfig();
  const data = await fetchJson(`${apiBase()}/contents/${votesPath}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...authHeaders(),
    },
  });

  const content = JSON.parse(atob(data.content.replace(/\n/g, "")));
  return {
    voters: content.voters || [],
    sha: data.sha,
  };
}

async function loadVotesFromStatic() {
  const data = await fetchJson(`${rawVotesUrl()}?t=${Date.now()}`);
  return {
    voters: data.voters || [],
    sha: null,
  };
}

async function loadVotesFromLocal() {
  const data = await fetchJson(`./data/votes.json?t=${Date.now()}`);
  return {
    voters: data.voters || [],
    sha: null,
  };
}

async function loadVotes() {
  try {
    return await loadVotesFromApi();
  } catch {
    try {
      return await loadVotesFromStatic();
    } catch {
      return await loadVotesFromLocal();
    }
  }
}

function toBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function saveVotes(voters, sha) {
  const { votesPath } = getConfig();
  if (!hasToken()) {
    throw new Error(
      "Спочатку введіть GitHub токен у налаштуваннях зверху (потрібен для збереження голосу)."
    );
  }

  const payload = JSON.stringify({ voters }, null, 2);
  const body = {
    message: `Vote update (${voters.length} voters)`,
    content: toBase64Utf8(payload),
    branch: getConfig().branch || "main",
  };

  if (sha) body.sha = sha;

  const res = await fetch(`${apiBase()}/contents/${votesPath}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    if (res.status === 409) {
      throw new Error("Хтось щойно проголосував — спробуйте ще раз");
    }
    throw new Error(data.message || "Не вдалося зберегти голос");
  }

  return {
    voters,
    sha: data.content.sha,
  };
}

async function submitVote(name, songs) {
  const validation = validateVoteInput(name, songs, MAX_SONGS);
  if (validation.error) {
    throw new Error(validation.error);
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    let voters;
    let sha;
    try {
      ({ voters, sha } = await loadVotesFromApi());
    } catch {
      ({ voters, sha } = await loadVotesFromStatic());
    }

    const result = upsertVote(voters, validation.name, validation.songs);
    try {
      await saveVotes(result.voters, sha);
      return {
        ok: true,
        updated: result.updated,
        name: validation.name,
        songs: validation.songs.map((s) => ({
          ...s,
          key: getSongKey(s.albumId, s.songName),
        })),
      };
    } catch (err) {
      if (attempt < 2 && String(err.message).includes("щойно")) continue;
      throw err;
    }
  }
}

async function getVotesData() {
  const { voters } = await loadVotes();
  return toVotesResponse(voters);
}

async function getMatchesData() {
  const { voters } = await loadVotes();
  return computeMatches(voters);
}
