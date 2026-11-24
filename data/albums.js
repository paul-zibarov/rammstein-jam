const MIN_SONGS_PER_ALBUM = 3;

function youtubeUrl(songName, albumId) {
  const query = encodeURIComponent(`Rammstein ${songName} official`);
  return `https://www.youtube.com/results?search_query=${query}`;
}

function normalizeSong(entry) {
  if (typeof entry === "string") {
    return { name: entry, bonus: false };
  }
  return {
    name: String(entry.name),
    bonus: Boolean(entry.bonus),
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
    songs: getSongEntries(album).map((song) => {
      const key = getSongKey(album.id, song.name);
      return {
        name: song.name,
        key,
        bonus: song.bonus,
        youtubeUrl: youtubeUrl(song.name, album.id),
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
  albumsForClient,
  getSongEntries,
  getSongNames,
  MIN_SONGS_PER_ALBUM,
  VOTE_SONG_FIXES,
};
