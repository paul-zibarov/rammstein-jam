function youtubeUrl(songName, albumId) {
  const query = encodeURIComponent(`Rammstein ${songName} official`);
  return `https://www.youtube.com/results?search_query=${query}`;
}

const albums = [
  {
    id: "herzeleid",
    name: "Herzeleid",
    year: 1995,
    cover: "https://upload.wikimedia.org/wikipedia/en/7/7c/RammsteinHerzeleid.jpg",
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
    cover: "https://upload.wikimedia.org/wikipedia/en/6/60/RammsteinSehnsucht.jpg",
    songs: [
      "Sehnsucht",
      "Engel",
      "Tier",
      "Bestrafe mich",
      "Du hast",
      "Bück dich",
      "Spieluhr",
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
    cover: "https://upload.wikimedia.org/wikipedia/en/4/49/RammsteinMutter.jpg",
    songs: [
      "Mein Herz brennt",
      "Links 2 3 4",
      "Sonne",
      "Ich will",
      "Feuer frei!",
      "Mutter",
      "Spiel mit mir",
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
    cover: "https://upload.wikimedia.org/wikipedia/en/8/8e/RammsteinReiseReise.jpg",
    songs: [
      "Reise, Reise",
      "Mein Teil",
      "Dalai Lama",
      "Keine Lust",
      "Los",
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
    cover: "https://upload.wikimedia.org/wikipedia/en/9/9f/RammsteinRosenrot.jpg",
    songs: [
      "Benzin",
      "Mann gegen Mann",
      "Rosenrot",
      "Spring",
      "Wo bist du",
      "Stirb mir nicht weg",
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
    cover: "https://upload.wikimedia.org/wikipedia/en/2/2e/Rammstein_Liebe_ist_f%C3%BCr_alle_da.jpg",
    songs: [
      "Rammlied",
      "Ich tu dir weh",
      "Waidmanns Heil",
      "Haifisch",
      "Bückstück",
      "Frühling in Paris",
      "Wiener Blut",
      "Pussy",
      "Liebe ist für alle da",
      "Mehr",
      "Roter Sand",
    ],
  },
  {
    id: "rammstein-2019",
    name: "Rammstein",
    year: 2019,
    cover: "https://upload.wikimedia.org/wikipedia/en/4/4a/Rammstein_-_Rammstein.png",
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
    cover: "https://upload.wikimedia.org/wikipedia/en/8/8b/Rammstein_-_Zeit.png",
    songs: [
      "Armee der Tristen",
      "Zeit",
      "Schwarz",
      "Gift",
      "OK",
      "Meine Welt brennt",
      "Angst",
      "Dämmerung",
      "Adieu",
      "Zick Zack",
    ],
  },
];

function getSongKey(albumId, songName) {
  return `${albumId}::${songName}`;
}

function findSong(songKey) {
  const [albumId, ...rest] = songKey.split("::");
  const songName = rest.join("::");
  const album = albums.find((a) => a.id === albumId);
  if (!album || !album.songs.includes(songName)) return null;
  return { album, songName };
}

function albumsForClient() {
  return albums.map((album) => ({
    ...album,
    songs: album.songs.map((songName) => ({
      name: songName,
      key: getSongKey(album.id, songName),
      youtubeUrl: youtubeUrl(songName, album.id),
    })),
  }));
}

module.exports = { albums, getSongKey, findSong, youtubeUrl, albumsForClient };
