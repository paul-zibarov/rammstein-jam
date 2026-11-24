const express = require("express");
const path = require("path");
const { albumsForClient, MIN_SONGS_PER_ALBUM } = require("./data/albums");
const {
  polls,
  getPoll,
  getActivePoll,
  getArchivedPolls,
  resolvePollId,
  getBlockedSongKeys,
} = require("./data/polls");
const { initDb, getDb, validateName, validateSongs } = require("./lib/db");
const {
  computeLeaderboard,
  computePlaylist,
  computeMatches,
  playlistFromKeys,
} = require("./lib/stats");

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function requirePoll(req, res) {
  const pollId = resolvePollId(req.params.pollId || req.query.poll);
  if (!pollId) {
    res.status(404).json({ error: "Голосування не знайдено" });
    return null;
  }
  const poll = getPoll(pollId);
  if (!poll) {
    res.status(404).json({ error: "Голосування не знайдено" });
    return null;
  }
  return poll;
}

async function getBlockedKeysForPoll(poll) {
  return getBlockedSongKeys(poll);
}

function playlistForPoll(poll, rows) {
  if (poll?.officialPlaylistKeys?.length) {
    return playlistFromKeys(poll.officialPlaylistKeys, rows);
  }
  return computePlaylist(rows);
}

async function albumsPayloadForPoll(poll) {
  const blockedKeys = await getBlockedKeysForPoll(poll);
  return {
    poll,
    albums: albumsForClient({ blockedKeys }),
    minSongsPerAlbum: MIN_SONGS_PER_ALBUM,
    blockedSongKeys: [...blockedKeys],
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/polls", (_req, res) => {
  const active = getActivePoll();
  res.json({
    polls,
    activePollId: active?.id || null,
    archived: getArchivedPolls(),
  });
});

app.get("/api/polls/:pollId", (req, res) => {
  const poll = requirePoll(req, res);
  if (!poll) return;
  res.json({ poll });
});

app.get("/api/polls/:pollId/albums", async (req, res, next) => {
  try {
    const poll = requirePoll(req, res);
    if (!poll) return;
    res.json(await albumsPayloadForPoll(poll));
  } catch (err) {
    next(err);
  }
});

app.get("/api/polls/:pollId/votes", async (req, res, next) => {
  try {
    const poll = requirePoll(req, res);
    if (!poll) return;
    const rows = await getDb().getVoteRows(poll.id);
    const { voters } = computeMatches(rows);
    res.json({ poll, voters, totalVoters: voters.length });
  } catch (err) {
    next(err);
  }
});

app.get("/api/polls/:pollId/leaderboard", async (req, res, next) => {
  try {
    const poll = requirePoll(req, res);
    if (!poll) return;
    const rows = await getDb().getVoteRows(poll.id);
    res.json({ poll, leaderboard: computeLeaderboard(rows) });
  } catch (err) {
    next(err);
  }
});

app.get("/api/polls/:pollId/playlist", async (req, res, next) => {
  try {
    const poll = requirePoll(req, res);
    if (!poll) return;
    const rows = await getDb().getVoteRows(poll.id);
    res.json({ poll, playlist: playlistForPoll(poll, rows) });
  } catch (err) {
    next(err);
  }
});

app.get("/api/polls/:pollId/matches", async (req, res, next) => {
  try {
    const poll = requirePoll(req, res);
    if (!poll) return;
    const rows = await getDb().getVoteRows(poll.id);
    const data = computeMatches(rows);
    res.json({
      poll,
      matches: data.matches,
      pairwise: data.pairwise,
      totalVoters: data.totalVoters,
    });
  } catch (err) {
    next(err);
  }
});

app.post("/api/polls/:pollId/votes", async (req, res, next) => {
  try {
    const poll = requirePoll(req, res);
    if (!poll) return;

    if (poll.status !== "active") {
      return res.status(403).json({ error: "Це голосування вже завершене" });
    }

    const nameResult = validateName(req.body?.name);
    if (nameResult.error) return res.status(400).json({ error: nameResult.error });

    const blockedKeys = await getBlockedKeysForPoll(poll);
    const songsResult = validateSongs(req.body?.songs, { blockedKeys });
    if (songsResult.error) return res.status(400).json({ error: songsResult.error });

    const { voterId, updated } = await getDb().upsertVote(
      poll.id,
      nameResult.name,
      songsResult.songs
    );

    res.status(updated ? 200 : 201).json({
      ok: true,
      updated,
      voterId,
      pollId: poll.id,
      name: nameResult.name,
      songs: songsResult.songs,
    });
  } catch (err) {
    next(err);
  }
});

// Backward-compatible aliases → active poll
app.get("/api/albums", async (_req, res, next) => {
  try {
    const poll = getActivePoll();
    res.json(await albumsPayloadForPoll(poll));
  } catch (err) {
    next(err);
  }
});

app.get("/api/votes", async (_req, res, next) => {
  try {
    const poll = getActivePoll();
    const rows = await getDb().getVoteRows(poll.id);
    const { voters } = computeMatches(rows);
    res.json({ poll, voters, totalVoters: voters.length });
  } catch (err) {
    next(err);
  }
});

app.get("/api/leaderboard", async (_req, res, next) => {
  try {
    const poll = getActivePoll();
    const rows = await getDb().getVoteRows(poll.id);
    res.json({ poll, leaderboard: computeLeaderboard(rows) });
  } catch (err) {
    next(err);
  }
});

app.get("/api/playlist", async (_req, res, next) => {
  try {
    const poll = getActivePoll();
    const rows = await getDb().getVoteRows(poll.id);
    res.json({ poll, playlist: playlistForPoll(poll, rows) });
  } catch (err) {
    next(err);
  }
});

app.get("/api/matches", async (_req, res, next) => {
  try {
    const poll = getActivePoll();
    const rows = await getDb().getVoteRows(poll.id);
    const data = computeMatches(rows);
    res.json({
      poll,
      matches: data.matches,
      pairwise: data.pairwise,
      totalVoters: data.totalVoters,
    });
  } catch (err) {
    next(err);
  }
});

app.post("/api/votes", async (req, res, next) => {
  try {
    const poll = getActivePoll();
    if (!poll || poll.status !== "active") {
      return res.status(403).json({ error: "Немає активного голосування" });
    }

    const nameResult = validateName(req.body?.name);
    if (nameResult.error) return res.status(400).json({ error: nameResult.error });

    const blockedKeys = await getBlockedKeysForPoll(poll);
    const songsResult = validateSongs(req.body?.songs, { blockedKeys });
    if (songsResult.error) return res.status(400).json({ error: songsResult.error });

    const { voterId, updated } = await getDb().upsertVote(
      poll.id,
      nameResult.name,
      songsResult.songs
    );

    res.status(updated ? 200 : 201).json({
      ok: true,
      updated,
      voterId,
      pollId: poll.id,
      name: nameResult.name,
      songs: songsResult.songs,
    });
  } catch (err) {
    next(err);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Внутрішня помилка сервера" });
});

initDb()
  .then(async () => {
    if (process.env.CLEAR_DB === "1") {
      const pollId = process.env.CLEAR_POLL || null;
      await getDb().clearAll(pollId);
      console.log(pollId ? `Очищено голоси для ${pollId}` : "Базу очищено (CLEAR_DB=1)");
    }

    app.listen(PORT, "0.0.0.0", () => {
      const storage = process.env.DATABASE_URL ? "PostgreSQL" : "SQLite";
      console.log(`Rammstein Jam (${storage}): http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start:", err);
    process.exit(1);
  });
