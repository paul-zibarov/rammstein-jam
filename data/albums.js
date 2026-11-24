const MIN_SONGS_PER_ALBUM = 3;
const { DEEZER_TRACK_IDS } = require("./deezerTracks");

/** Songs confirmed available on Songsterr (Rammstein search results). */
const SONGSTERR_SONGS = new Set(
  [
    "Sonne",
    "Du hast",
    "Deutschland",
    "Engel",
    "Links 2 3 4",
    "Ich will",
    "Feuer frei!",
    "Mutter",
    "Radio",
    "Mein Herz brennt",
    "Rammstein",
    "Rein raus",
    "Ich tu dir weh",
    "Du riechst so gut",
    "Amerika",
    "Mein Teil",
    "Rosenrot",
    "Keine Lust",
    "Mann gegen Mann",
    "Asche zu Asche",
    "Ausländer",
    "Dicke Titten",
    "Waidmanns Heil",
    "Bück dich",
    "Pussy",
    "Ohne dich",
    "Sehnsucht",
    "Tattoo",
    "Seemann",
    "Wollt ihr das Bett in Flammen sehen?",
    "Reise, Reise",
    "Zick Zack",
    "Rammlied",
    "Bestrafe mich",
    "Los",
    "Was ich liebe",
    "Te Quiero Puta!",
    "Benzin",
    "Mein Land",
    "Zwitter",
    "Angst",
    "Puppe",
    "Spiel mit mir",
    "Zeig dich",
    "Adieu",
    "Adios",
    "Spieluhr",
    "Sex",
    "Heirate mich",
    "Moskau",
    "Amour",
    "Wo bist du",
  ].map((name) => name.toLowerCase())
);

/** Direct Songsterr song IDs (same ID across guitar/bass/drums). */
const SONGSTERR_IDS = {
  "Du hast": 13984,
  Sonne: 51438,
  Deutschland: 451140,
  Mutter: 51437,
  "Ich will": 16659,
  "Mein Teil": 16381,
  Engel: 17128,
  "Links 2 3 4": 3346828,
  "Feuer frei!": 13988,
  Amerika: 17234,
  Seemann: 379386,
  "Ohne dich": 17125,
  "Du riechst so gut": 51452,
  "Mein Herz brennt": 51447,
  "Keine Lust": 17225,
  Sehnsucht: 16428,
};

function songsterrSlug(songName) {
  return String(songName)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function youtubeUrl(songName, albumId) {
  const query = encodeURIComponent(`Rammstein ${songName} official`);
  return `https://www.youtube.com/results?search_query=${query}`;
}

function songsterrUrl(songName) {
  if (!SONGSTERR_SONGS.has(String(songName).toLowerCase())) return null;
  const id = SONGSTERR_IDS[songName];
  if (id) {
    const slug = songsterrSlug(songName);
    return `https://www.songsterr.com/a/wsa/rammstein-${slug}-tab-s${id}`;
  }
  const pattern = encodeURIComponent(`Rammstein ${songName}`);
  return `https://www.songsterr.com/?pattern=${pattern}`;
}

function youtubeVideoId(youtubeUrlValue) {
  if (!youtubeUrlValue) return null;
  try {
    const url = new URL(youtubeUrlValue);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.replace(/^\//, "") || null;
    }
    return url.searchParams.get("v");
  } catch {
    return null;
  }
}

function normalizeSong(entry) {
  if (typeof entry === "string") {
    return { name: entry, bonus: false, cover: null, year: null, youtubeUrl: null };
  }
  return {
    name: String(entry.name),
    bonus: Boolean(entry.bonus),
    cover: entry.cover || null,
    year: entry.year ?? null,
    youtubeUrl: entry.youtubeUrl || null,
  };
}

const albums = [
  {
    id: "herzeleid",
    name: "Herzeleid",
    year: 1995,
    cover: "https://upload.wikimedia.org/wikipedia/en/1/1f/Rammstein_Herzeleid_cover.jpg",
    songs: [
      "Wollt ihr das Bett in Flammen sehen?",
      "Der Meister",
      "Weißes Fleisch",
      "Asche zu Asche",
      "Seemann",
      "Du riechst so gut",
      "Das alte Leid",
      "Heirate mich",
      "Herzeleid",
      "Laichzeit",
      "Rammstein",
    ],
  },
  {
    id: "sehnsucht",
    name: "Sehnsucht",
    year: 1997,
    cover: "https://upload.wikimedia.org/wikipedia/en/b/b0/Rammstein_-_Sehnsucht.jpg",
    songs: [
      "Sehnsucht",
      "Engel",
      "Tier",
      "Bestrafe mich",
      "Du hast",
      "Bück dich",
      "Spiel mit mir",
      "Klavier",
      "Alter Mann",
      "Eifersucht",
      "Küss mich (Fellfrosch)",
    ],
  },
  {
    id: "mutter",
    name: "Mutter",
    year: 2001,
    cover: "https://upload.wikimedia.org/wikipedia/en/5/5e/Mutter.jpg",
    songs: [
      "Mein Herz brennt",
      "Links 2 3 4",
      "Sonne",
      "Ich will",
      "Feuer frei!",
      "Mutter",
      "Spieluhr",
      "Zwitter",
      "Rein raus",
      "Adios",
      "Nebel",
    ],
  },
  {
    id: "reise-reise",
    name: "Reise, Reise",
    year: 2004,
    cover: "https://upload.wikimedia.org/wikipedia/en/a/a0/ReiseReise.jpg",
    songs: [
      "Reise, Reise",
      "Mein Teil",
      "Dalai Lama",
      "Keine Lust",
      "Los",
      "Amerika",
      "Moskau",
      "Morgenstern",
      "Stein um Stein",
      "Ohne dich",
      "Amour",
    ],
  },
  {
    id: "rosenrot",
    name: "Rosenrot",
    year: 2005,
    cover: "https://upload.wikimedia.org/wikipedia/en/4/43/Rosenrot_high-res.jpg",
    songs: [
      "Benzin",
      "Mann gegen Mann",
      "Rosenrot",
      "Spring",
      "Wo bist du",
      "Stirb nicht vor mir",
      "Zerstören",
      "Hilf mir",
      "Te Quiero Puta!",
      "Feuer und Wasser",
      "Ein Lied",
    ],
  },
  {
    id: "liebe",
    name: "Liebe ist für alle da",
    year: 2009,
    cover: "https://upload.wikimedia.org/wikipedia/en/9/98/Cover_lifad.jpg",
    songs: [
      "Rammlied",
      "Ich tu dir weh",
      "Waidmanns Heil",
      "Haifisch",
      "Bückstabü",
      "Frühling in Paris",
      "Wiener Blut",
      "Pussy",
      "Liebe ist für alle da",
      "Mehr",
      "Roter Sand",
      { name: "Führe mich", bonus: true },
      { name: "Donaukinder", bonus: true },
    ],
  },
  {
    id: "rammstein-2019",
    name: "Rammstein",
    year: 2019,
    cover: "https://upload.wikimedia.org/wikipedia/en/1/16/Rammstein_-_Rammstein.png",
    songs: [
      "Deutschland",
      "Radio",
      "Zeig dich",
      "Ausländer",
      "Sex",
      "Puppe",
      "Was ich liebe",
      "Diamant",
      "Weit weg",
      "Tattoo",
      "Hallomann",
    ],
  },
  {
    id: "zeit",
    name: "Zeit",
    year: 2022,
    cover: "https://upload.wikimedia.org/wikipedia/en/a/ab/Rammstein_-_Zeit.png",
    songs: [
      "Armee der Tristen",
      "Zeit",
      "Schwarz",
      "Giftig",
      "Zick Zack",
      "OK",
      "Meine Tränen",
      "Angst",
      "Dicke Titten",
      "Lügen",
      "Adieu",
    ],
  },
  {
    id: "singles",
    name: "Сингли",
    year: "1997–2011",
    kind: "singles",
    cover: "https://cdn.rammsteinworld.com/thumb/500/uploads/discographie/singles/mein-land/mein-land.jpg",
    songs: [
      {
        name: "Das Modell",
        year: 1997,
        cover:
          "https://cdn.rammsteinworld.com/thumb/500/uploads/discographie/singles/das-modell/das-modell.jpg",
      },
      {
        name: "Kokain",
        year: 1997,
        cover:
          "https://cdn.rammsteinworld.com/thumb/500/uploads/discographie/singles/das-modell/das-modell.jpg",
        youtubeUrl: "https://www.youtube.com/watch?v=R17W_TeMejg",
      },
      {
        name: "Stripped",
        year: 1998,
        cover:
          "https://cdn.rammsteinworld.com/thumb/500/uploads/discographie/singles/stripped/stripped.jpg",
      },
      {
        name: "Halleluja",
        year: 2001,
        cover:
          "https://cdn.rammsteinworld.com/thumb/500/uploads/discographie/singles/links-2-3-4/links-2-3-4.jpg",
      },
      {
        name: "Mein Land",
        year: 2011,
        cover:
          "https://cdn.rammsteinworld.com/thumb/500/uploads/discographie/singles/mein-land/mein-land.jpg",
      },
    ],
  },
];

function getSongEntries(album) {
  return album.songs.map(normalizeSong);
}

function getSongNames(album) {
  return getSongEntries(album).map((song) => song.name);
}

function getSongKey(albumId, songName) {
  return `${albumId}::${songName}`;
}

function findSong(songKey) {
  const [albumId, ...rest] = songKey.split("::");
  const songName = rest.join("::");
  const album = albums.find((a) => a.id === albumId);
  if (!album || !getSongNames(album).includes(songName)) return null;
  return { album, songName };
}

function albumsForClient(options = {}) {
  const blockedKeys =
    options.blockedKeys instanceof Set
      ? options.blockedKeys
      : new Set(options.blockedKeys || []);

  return albums.map((album) => ({
    id: album.id,
    name: album.name,
    year: album.year,
    cover: album.cover,
    kind: album.kind || "album",
    songs: getSongEntries(album).map((song) => {
      const key = getSongKey(album.id, song.name);
      const yt = song.youtubeUrl || youtubeUrl(song.name, album.id);
      return {
        name: song.name,
        key,
        bonus: song.bonus,
        cover: song.cover,
        year: song.year,
        youtubeUrl: yt,
        youtubeVideoId: youtubeVideoId(yt),
        songsterrUrl: songsterrUrl(song.name),
        hasPreview: Boolean(DEEZER_TRACK_IDS[song.name]),
        locked: blockedKeys.has(key),
      };
    }),
  }));
}

/** One-time vote remaps/deletes after tracklist corrections */
const VOTE_SONG_FIXES = {
  deleteKeys: [
    "zeit::Meine Welt brennt",
    "zeit::Dämmerung",
  ],
  remaps: [
    { from: "sehnsucht::Spieluhr", to: "mutter::Spieluhr" },
    { from: "mutter::Spiel mit mir", to: "sehnsucht::Spiel mit mir" },
    { from: "liebe::Bückstück", to: "liebe::Bückstabü" },
    { from: "rosenrot::Stirb mir nicht weg", to: "rosenrot::Stirb nicht vor mir" },
    { from: "rosenrot::Moskau", to: "reise-reise::Moskau" },
    { from: "zeit::Gift", to: "zeit::Giftig" },
  ],
};

module.exports = {
  albums,
  getSongKey,
  findSong,
  youtubeUrl,
  songsterrUrl,
  youtubeVideoId,
  albumsForClient,
  getSongEntries,
  getSongNames,
  MIN_SONGS_PER_ALBUM,
  VOTE_SONG_FIXES,
  SONGSTERR_SONGS,
  SONGSTERR_IDS,
};
