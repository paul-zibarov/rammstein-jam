const path = require("path");
const { getSongKey, findSong } = require("../data/albums");

const SCHEMA = `
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

class SqliteAdapter {
  constructor(db) {
    this.db = db;
  }

  async getVoteRows() {
    return this.db
      .prepare(
        `
        SELECT v.name AS voter_name, vo.album_id, vo.song_name
        FROM voters v
        JOIN votes vo ON vo.voter_id = v.id
        ORDER BY v.created_at ASC, vo.album_id, vo.song_name
      `
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
}

class TursoAdapter {
  constructor(client) {
    this.client = client;
  }

  async getVoteRows() {
    const result = await this.client.execute(`
      SELECT v.name AS voter_name, vo.album_id, vo.song_name
      FROM voters v
      JOIN votes vo ON vo.voter_id = v.id
      ORDER BY v.created_at ASC, vo.album_id, vo.song_name
    `);
    return result.rows.map((row) => ({
      voter_name: row.voter_name,
      album_id: row.album_id,
      song_name: row.song_name,
    }));
  }

  async upsertVote(name, songs) {
    const existing = await this.client.execute({
      sql: "SELECT id FROM voters WHERE name = ? COLLATE NOCASE",
      args: [name],
    });

    let voterId;
    let updated = false;

    if (existing.rows.length > 0) {
      voterId = existing.rows[0].id;
      updated = true;
      await this.client.execute({
        sql: "DELETE FROM votes WHERE voter_id = ?",
        args: [voterId],
      });
    } else {
      const inserted = await this.client.execute({
        sql: "INSERT INTO voters (name) VALUES (?) RETURNING id",
        args: [name],
      });
      voterId = inserted.rows[0].id;
    }

    for (const song of songs) {
      await this.client.execute({
        sql: "INSERT INTO votes (voter_id, album_id, song_name) VALUES (?, ?, ?)",
        args: [voterId, song.albumId, song.songName],
      });
    }

    return { voterId, updated };
  }
}

let adapter = null;

async function initDb() {
  if (adapter) return adapter;

  if (process.env.TURSO_DATABASE_URL) {
    const { createClient } = require("@libsql/client");
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    await client.executeMultiple(SCHEMA);
    adapter = new TursoAdapter(client);
    return adapter;
  }

  const Database = require("better-sqlite3");
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "..", "votes.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
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
};
