const path = require("path");
const { getSongKey, findSong, albums, MIN_SONGS_PER_ALBUM, FORBIDDEN_SONGS } = require("../data/albums");
const { LEGACY_POLL_ID } = require("../data/polls");

const SQLITE_TABLES = `
  CREATE TABLE IF NOT EXISTS voters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id TEXT NOT NULL,
    name TEXT NOT NULL,
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

const SQLITE_INDEX = `
  CREATE UNIQUE INDEX IF NOT EXISTS voters_poll_name_idx
    ON voters(poll_id, name COLLATE NOCASE);
`;

const PG_SCHEMA = `
  CREATE TABLE IF NOT EXISTS voters (
    id SERIAL PRIMARY KEY,
    poll_id TEXT NOT NULL DEFAULT '${LEGACY_POLL_ID}',
    name TEXT NOT NULL,
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

  async getVoteRows(pollId) {
    return this.db
      .prepare(
        `SELECT v.name AS voter_name, vo.album_id, vo.song_name
         FROM voters v
         JOIN votes vo ON vo.voter_id = v.id
         WHERE v.poll_id = ?
         ORDER BY v.created_at ASC, vo.album_id, vo.song_name`
      )
      .all(pollId);
  }

  async upsertVote(pollId, name, songs) {
    const existing = this.db
      .prepare("SELECT id FROM voters WHERE poll_id = ? AND name = ? COLLATE NOCASE")
      .get(pollId, name);

    const tx = this.db.transaction(() => {
      let voterId;
      if (existing) {
        voterId = existing.id;
        this.db.prepare("DELETE FROM votes WHERE voter_id = ?").run(voterId);
      } else {
        const result = this.db
          .prepare("INSERT INTO voters (poll_id, name) VALUES (?, ?)")
          .run(pollId, name);
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

  async clearAll(pollId) {
    if (pollId) {
      this.db
        .prepare(
          `DELETE FROM votes WHERE voter_id IN (SELECT id FROM voters WHERE poll_id = ?)`
        )
        .run(pollId);
      this.db.prepare("DELETE FROM voters WHERE poll_id = ?").run(pollId);
      return;
    }
    this.db.exec("DELETE FROM votes; DELETE FROM voters;");
  }
}

class PostgresAdapter {
  constructor(pool) {
    this.pool = pool;
  }

  async getVoteRows(pollId) {
    const { rows } = await this.pool.query(
      `SELECT v.name AS voter_name, vo.album_id, vo.song_name
       FROM voters v
       JOIN votes vo ON vo.voter_id = v.id
       WHERE v.poll_id = $1
       ORDER BY v.created_at ASC, vo.album_id, vo.song_name`,
      [pollId]
    );
    return rows;
  }

  async upsertVote(pollId, name, songs) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const existing = await client.query(
        "SELECT id FROM voters WHERE poll_id = $1 AND LOWER(name) = LOWER($2)",
        [pollId, name]
      );

      let voterId;
      let updated = false;

      if (existing.rows.length > 0) {
        voterId = existing.rows[0].id;
        updated = true;
        await client.query("DELETE FROM votes WHERE voter_id = $1", [voterId]);
      } else {
        const inserted = await client.query(
          "INSERT INTO voters (poll_id, name) VALUES ($1, $2) RETURNING id",
          [pollId, name]
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

  async clearAll(pollId) {
    if (pollId) {
      await this.pool.query(
        `DELETE FROM votes WHERE voter_id IN (SELECT id FROM voters WHERE poll_id = $1)`,
        [pollId]
      );
      await this.pool.query("DELETE FROM voters WHERE poll_id = $1", [pollId]);
      return;
    }
    await this.pool.query("DELETE FROM votes; DELETE FROM voters;");
  }
}

async function migratePostgres(pool) {
  await pool.query(PG_SCHEMA);

  const columns = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'voters' AND column_name = 'poll_id'`
  );

  if (columns.rows.length === 0) {
    await pool.query(
      `ALTER TABLE voters ADD COLUMN poll_id TEXT NOT NULL DEFAULT '${LEGACY_POLL_ID}'`
    );
  } else {
    await pool.query(
      `UPDATE voters SET poll_id = $1 WHERE poll_id IS NULL OR poll_id = ''`,
      [LEGACY_POLL_ID]
    );
  }

  await pool.query(`ALTER TABLE voters ALTER COLUMN poll_id SET DEFAULT '${LEGACY_POLL_ID}'`);

  // Drop legacy unique-on-name constraints/indexes so one person can vote in multiple polls.
  const constraints = await pool.query(
    `SELECT conname FROM pg_constraint
     WHERE conrelid = 'voters'::regclass AND contype = 'u'`
  );
  for (const row of constraints.rows) {
    await pool.query(`ALTER TABLE voters DROP CONSTRAINT IF EXISTS "${row.conname}"`);
  }

  const indexes = await pool.query(
    `SELECT indexname FROM pg_indexes
     WHERE tablename = 'voters' AND indexdef ILIKE '%UNIQUE%' AND indexdef ILIKE '%name%'`
  );
  for (const row of indexes.rows) {
    if (row.indexname === "voters_poll_name_idx") continue;
    await pool.query(`DROP INDEX IF EXISTS "${row.indexname}"`);
  }

  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS voters_poll_name_idx
     ON voters (poll_id, LOWER(name))`
  );
}

function migrateSqlite(db) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='voters'")
    .all();

  if (tables.length === 0) {
    db.exec(SQLITE_TABLES);
    db.exec(SQLITE_INDEX);
    return;
  }

  const columns = db.prepare("PRAGMA table_info(voters)").all();
  const hasPollId = columns.some((col) => col.name === "poll_id");

  if (!hasPollId) {
    // Keep votes intact while rebuilding voters (UNIQUE moves from name → poll_id+name).
    db.pragma("foreign_keys = OFF");
    db.exec(`
      BEGIN;
      ALTER TABLE voters RENAME TO voters_legacy;

      CREATE TABLE voters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        poll_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO voters (id, poll_id, name, created_at)
      SELECT id, '${LEGACY_POLL_ID}', name, created_at FROM voters_legacy;

      DROP TABLE voters_legacy;
      COMMIT;
    `);
    db.pragma("foreign_keys = ON");
  } else {
    db.prepare(`UPDATE voters SET poll_id = ? WHERE poll_id IS NULL OR poll_id = ''`).run(
      LEGACY_POLL_ID
    );
  }

  db.exec(SQLITE_TABLES);
  db.exec(SQLITE_INDEX);
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
    await migratePostgres(pool);
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
  migrateSqlite(db);
  adapter = new SqliteAdapter(db);
  return adapter;
}

function getDb() {
  if (!adapter) throw new Error("Database not initialized");
  return adapter;
}

function validateSongs(songs, options = {}) {
  if (!Array.isArray(songs) || songs.length === 0) {
    return { error: "Оберіть хоча б одну пісню" };
  }

  const blockedKeys =
    options.blockedKeys instanceof Set
      ? options.blockedKeys
      : new Set(options.blockedKeys || []);

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

  for (const song of normalized) {
    const key = getSongKey(song.albumId, song.songName);
    if (FORBIDDEN_SONGS.has(key)) {
      return { error: "NEIN!" };
    }
    if (blockedKeys.has(key)) {
      return {
        error: `«${song.songName}» вже була в плейлисті попереднього голосування`,
      };
    }
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
