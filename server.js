const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");
const { albums, getSongKey, findSong } = require("./data/albums");

const PORT = process.env.PORT || 3000;
const MAX_SONGS_PER_VOTER = 5;
const dbPath = path.join(__dirname, "votes.db");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS voters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voter_id INTEGER NOT NULL,
    album_id TEXT NOT NULL,
    song_name TEXT NOT NULL,
    FOREIGN KEY (voter_id) REFERENCES voters(id) ON DELETE CASCADE,
    UNIQUE(voter_id, album_id, song_name)
  );
`);

app.get("/api/albums", (_req, res) => {
  res.json(albums);
});

app.get("/api/votes", (_req, res) => {
  const rows = db
    .prepare(
      `
      SELECT v.id AS voter_id, v.name, vo.album_id, vo.song_name
      FROM voters v
      JOIN votes vo ON vo.voter_id = v.id
      ORDER BY v.created_at ASC, vo.album_id, vo.song_name
    `
    )
    .all();

  const byVoter = new Map();
  for (const row of rows) {
    if (!byVoter.has(row.voter_id)) {
      byVoter.set(row.voter_id, { name: row.name, songs: [] });
    }
    byVoter.get(row.voter_id).songs.push({
      albumId: row.album_id,
      songName: row.song_name,
      key: getSongKey(row.album_id, row.song_name),
    });
  }

  res.json({
    voters: [...byVoter.values()],
    totalVoters: byVoter.size,
  });
});

app.get("/api/matches", (_req, res) => {
  const songVotes = db
    .prepare(
      `
      SELECT vo.album_id, vo.song_name, v.name AS voter_name
      FROM votes vo
      JOIN voters v ON v.id = vo.voter_id
      ORDER BY vo.album_id, vo.song_name, v.name
    `
    )
    .all();

  const groups = new Map();
  for (const row of songVotes) {
    const key = getSongKey(row.album_id, row.song_name);
    if (!groups.has(key)) {
      const info = findSong(key);
      groups.set(key, {
        key,
        albumId: row.album_id,
        songName: row.song_name,
        albumName: info?.album.name ?? row.album_id,
        albumCover: info?.album.cover ?? "",
        voters: [],
      });
    }
    groups.get(key).voters.push(row.voter_name);
  }

  const matches = [...groups.values()]
    .filter((g) => g.voters.length >= 2)
    .sort((a, b) => b.voters.length - a.voters.length || a.songName.localeCompare(b.songName));

  const allSongs = [...groups.values()].sort(
    (a, b) => b.voters.length - a.voters.length || a.songName.localeCompare(b.songName)
  );

  const voterRows = db
    .prepare(
      `
      SELECT v.name, GROUP_CONCAT(vo.album_id || '::' || vo.song_name, '|') AS picks
      FROM voters v
      JOIN votes vo ON vo.voter_id = v.id
      GROUP BY v.id
      ORDER BY v.name
    `
    )
    .all();

  const pairwise = [];
  for (let i = 0; i < voterRows.length; i++) {
    for (let j = i + 1; j < voterRows.length; j++) {
      const a = new Set((voterRows[i].picks || "").split("|").filter(Boolean));
      const b = new Set((voterRows[j].picks || "").split("|").filter(Boolean));
      const shared = [...a].filter((k) => b.has(k));
      if (shared.length > 0) {
        pairwise.push({
          voterA: voterRows[i].name,
          voterB: voterRows[j].name,
          overlapCount: shared.length,
          sharedSongs: shared.map((key) => {
            const info = findSong(key);
            return {
              key,
              songName: info?.songName ?? key,
              albumName: info?.album.name ?? "",
            };
          }),
        });
      }
    }
  }

  pairwise.sort((a, b) => b.overlapCount - a.overlapCount);

  res.json({
    matches,
    allSongs,
    pairwise,
    totalVoters: voterRows.length,
  });
});

app.post("/api/votes", (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  const songs = Array.isArray(req.body?.songs) ? req.body.songs : [];

  if (!name || name.length < 2) {
    return res.status(400).json({ error: "Введіть ім'я (мінімум 2 символи)" });
  }

  if (name.length > 40) {
    return res.status(400).json({ error: "Ім'я занадто довге" });
  }

  if (songs.length === 0) {
    return res.status(400).json({ error: "Оберіть хоча б одну пісню" });
  }

  if (songs.length > MAX_SONGS_PER_VOTER) {
    return res.status(400).json({
      error: `Можна обрати максимум ${MAX_SONGS_PER_VOTER} пісень`,
    });
  }

  const normalized = [];
  const seen = new Set();
  for (const item of songs) {
    const albumId = String(item?.albumId ?? "").trim();
    const songName = String(item?.songName ?? "").trim();
    const info = findSong(getSongKey(albumId, songName));
    if (!info) {
      return res.status(400).json({ error: `Невідома пісня: ${albumId} / ${songName}` });
    }
    const key = getSongKey(albumId, songName);
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ albumId, songName });
  }

  const existing = db.prepare("SELECT id FROM voters WHERE name = ? COLLATE NOCASE").get(name);

  const saveVote = db.transaction(() => {
    let voterId;
    if (existing) {
      voterId = existing.id;
      db.prepare("DELETE FROM votes WHERE voter_id = ?").run(voterId);
    } else {
      const result = db.prepare("INSERT INTO voters (name) VALUES (?)").run(name);
      voterId = result.lastInsertRowid;
    }

    const insert = db.prepare(
      "INSERT INTO votes (voter_id, album_id, song_name) VALUES (?, ?, ?)"
    );
    for (const song of normalized) {
      insert.run(voterId, song.albumId, song.songName);
    }

    return voterId;
  });

  const voterId = saveVote();

  res.status(existing ? 200 : 201).json({
    ok: true,
    updated: Boolean(existing),
    voterId,
    name,
    songs: normalized.map((s) => ({
      ...s,
      key: getSongKey(s.albumId, s.songName),
    })),
  });
});

app.listen(PORT, () => {
  console.log(`Rammstein Jam: http://localhost:${PORT}`);
});
