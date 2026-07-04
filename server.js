const express = require("express");
const path = require("path");
const { albumsForClient, MIN_SONGS_PER_ALBUM } = require("./data/albums");
const { initDb, getDb, validateName, validateSongs } = require("./lib/db");
const { computeLeaderboard, computePlaylist, computeMatches } = require("./lib/stats");

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/albums", (_req, res) => {
  res.json({ albums: albumsForClient(), minSongsPerAlbum: MIN_SONGS_PER_ALBUM });
});

app.get("/api/votes", async (_req, res, next) => {
  try {
    const rows = await getDb().getVoteRows();
    const { voters } = computeMatches(rows);
    res.json({ voters, totalVoters: voters.length });
  } catch (err) {
    next(err);
  }
});

app.get("/api/leaderboard", async (_req, res, next) => {
  try {
    const rows = await getDb().getVoteRows();
    res.json({ leaderboard: computeLeaderboard(rows) });
  } catch (err) {
    next(err);
  }
});

app.get("/api/playlist", async (_req, res, next) => {
  try {
    const rows = await getDb().getVoteRows();
    res.json({ playlist: computePlaylist(rows) });
  } catch (err) {
    next(err);
  }
});

app.get("/api/matches", async (_req, res, next) => {
  try {
    const rows = await getDb().getVoteRows();
    const data = computeMatches(rows);
    res.json({
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
    const nameResult = validateName(req.body?.name);
    if (nameResult.error) return res.status(400).json({ error: nameResult.error });

    const songsResult = validateSongs(req.body?.songs);
    if (songsResult.error) return res.status(400).json({ error: songsResult.error });

    const { voterId, updated } = await getDb().upsertVote(
      nameResult.name,
      songsResult.songs
    );

    res.status(updated ? 200 : 201).json({
      ok: true,
      updated,
      voterId,
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
      await getDb().clearAll();
      console.log("Базу очищено (CLEAR_DB=1)");
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
