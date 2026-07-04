const path = require("path");
const { getSongKey, findSong, albums, MIN_SONGS_PER_ALBUM } = require("../data/albums");

const SQLITE_SCHEMA = `
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
`;

const PG_SCHEMA = `
  CREATE TABLE IF NOT EXISTS voters (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS votes (
    id SERIAL PRIMARY KEY,
    voter_id INTEGER NOT NULL REFERENCES voters(id) ON DELETE CASCADE,
    album_id TEXT NOT NULL,
    song_name TEXT NOT NULL,
    UNIQUE(voter_id, album_id, song_name)
  );
`;

class SqliteAdapter {
  constructor(db) {
    this.db = db;
  }

  async getVoteRows() {
    return this.db
      .prepare(
        `SELECT v.name AS voter_name, vo.album_id, vo.song_name
         FROM voters v
         JOIN votes vo ON vo.voter_id = v.id
         ORDER BY v.created_at ASC, vo.album_id, vo.song_name`
      )
      .all();
  }

  async upsertVote(name, songs) {
    const existing = this.db
      .prepare("SELECT id FROM voters WHERE name = ? COLLATE NOCASE")
      .get(name);

    const tx = this.db.transaction(() => {
      let voterId;
      if (existing) {
        voterId = existing.id;
        this.db.prepare("DELETE FROM votes WHERE voter_id = ?").run(voterId);
      } else {
        const result = this.db.prepare("INSERT INTO voters (name) VALUES (?)").run(name);
        voterId = result.lastInsertRowid;
      }

      const insert = this.db.prepare(
        "INSERT INTO votes (voter_id, album_id, song_name) VALUES (?, ?, ?)"
      );
      for (const song of songs) {
        insert.run(voterId, song.albumId, song.songName);
      }

      return { voterId, updated: Boolean(existing) };
    });

    return tx();
  }

  async clearAll() {
    this.db.exec("DELETE FROM votes; DELETE FROM voters;");
  }
}

class PostgresAdapter {
  constructor(pool) {
    this.pool = pool;
  }

  async getVoteRows() {
    const { rows } = await this.pool.query(
      `SELECT v.name AS voter_name, vo.album_id, vo.song_name
       FROM voters v
       JOIN votes vo ON vo.voter_id = v.id
       ORDER BY v.created_at ASC, vo.album_id, vo.song_name`
    );
    return rows;
  }

  async upsertVote(name, songs) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        "SELECT id FROM voters WHERE LOWER(name) = LOWER($1)",
        [name]
      );

      let voterId;
      let updated = false;

      if (existing.rows.length > 0) {
        voterId = existing.rows[0].id;
        updated = true;
        await client.query("DELETE FROM votes WHERE voter_id = $1", [voterId]);
      } else {
        const inserted = await client.query(
          "INSERT INTO voters (name) VALUES ($1) RETURNING id",
          [name]
        );
        voterId = inserted.rows[0].id;
      }

      for (const song of songs) {
        await client.query(
          "INSERT INTO votes (voter_id, album_id, song_name) VALUES ($1, $2, $3)",
          [voterId, song.albumId, song.songName]
        );
      }

      await client.query("COMMIT");
      return { voterId, updated };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async clearAll() {
    await this.pool.query("DELETE FROM votes; DELETE FROM voters;");
  }
}

let adapter = null;

async function initDb() {
  if (adapter) return adapter;

  if (process.env.DATABASE_URL) {
    const { Pool } = require("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost")
        ? false
        : { rejectUnauthorized: false },
    });
    await pool.query(PG_SCHEMA);
    adapter = new PostgresAdapter(pool);
    return adapter;
  }

  let Database;
  try {
    Database = require("better-sqlite3");
  } catch {
    throw new Error(
      "DATABASE_URL не налаштовано. На Railway підключіть PostgreSQL (Variables → DATABASE_URL)."
    );
  }

  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "..", "votes.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(SQLITE_SCHEMA);
  adapter = new SqliteAdapter(db);
  return adapter;
}

function getDb() {
  if (!adapter) throw new Error("Database not initialized");
  return adapter;
}

function validateSongs(songs) {
  if (!Array.isArray(songs) || songs.length === 0) {
    return { error: "Оберіть хоча б одну пісню" };
  }

  const normalized = [];
  const seen = new Set();

  for (const item of songs) {
    const albumId = String(item?.albumId ?? "").trim();
    const songName = String(item?.songName ?? "").trim();
    const info = findSong(getSongKey(albumId, songName));
    if (!info) {
      return { error: `Невідома пісня: ${albumId} / ${songName}` };
    }
    const key = getSongKey(albumId, songName);
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ albumId, songName });
  }

  const byAlbum = new Map();
  for (const song of normalized) {
    byAlbum.set(song.albumId, (byAlbum.get(song.albumId) || 0) + 1);
  }

  for (const album of albums) {
    const count = byAlbum.get(album.id) || 0;
    if (count < MIN_SONGS_PER_ALBUM) {
      return {
        error: `З альбому «${album.name}» оберіть мінімум ${MIN_SONGS_PER_ALBUM} пісні (зараз ${count})`,
      };
    }
  }

  return { songs: normalized };
}

function validateName(name) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed || trimmed.length < 2) {
    return { error: "Введіть ім'я (мінімум 2 символи)" };
  }
  if (trimmed.length > 40) {
    return { error: "Ім'я занадто довге" };
  }
  return { name: trimmed };
}

module.exports = {
  initDb,
  getDb,
  validateName,
  validateSongs,
  MIN_SONGS_PER_ALBUM,
};
