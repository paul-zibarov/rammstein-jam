const {
  albums,
  getSongKey,
  findSong,
  getSongEntries,
  youtubeUrl,
  songsterrUrl,
  youtubeVideoId,
} = require("../data/albums");
const { DEEZER_TRACK_IDS } = require("../data/deezerTracks");

function resolveSongMedia(albumId, songName) {
  const info = findSong(getSongKey(albumId, songName));
  const entry = info
    ? getSongEntries(info.album).find((s) => s.name === songName)
    : null;
  const yt = entry?.youtubeUrl || youtubeUrl(songName, albumId);
  return {
    youtubeUrl: yt,
    youtubeVideoId: youtubeVideoId(yt),
    songsterrUrl: songsterrUrl(songName),
    hasPreview: Boolean(DEEZER_TRACK_IDS[songName]),
  };
}

function groupVotesBySong(voteRows) {
  const groups = new Map();

  for (const row of voteRows) {
    const key = getSongKey(row.album_id, row.song_name);
    if (!groups.has(key)) {
      const info = findSong(key);
      const media = resolveSongMedia(row.album_id, row.song_name);
      groups.set(key, {
        key,
        albumId: row.album_id,
        songName: row.song_name,
        albumName: info?.album.name ?? row.album_id,
        albumYear: info?.album.year ?? null,
        albumCover: info?.album.cover ?? "",
        ...media,
        voters: [],
      });
    }
    groups.get(key).voters.push(row.voter_name);
  }

  return groups;
}

function computeLeaderboard(voteRows) {
  return [...groupVotesBySong(voteRows).values()]
    .filter((g) => g.voters.length > 0)
    .sort(
      (a, b) =>
        b.voters.length - a.voters.length ||
        a.albumYear - b.albumYear ||
        a.songName.localeCompare(b.songName)
    )
    .map((g, index) => ({
      rank: index + 1,
      ...g,
      voteCount: g.voters.length,
    }));
}

function computePlaylist(voteRows) {
  const byAlbum = new Map();

  for (const group of groupVotesBySong(voteRows).values()) {
    if (!byAlbum.has(group.albumId)) {
      byAlbum.set(group.albumId, []);
    }
    byAlbum.get(group.albumId).push(group);
  }

  return albums
    .map((album) => {
      const candidates = byAlbum.get(album.id);
      if (!candidates?.length) return null;

      const maxVotes = Math.max(...candidates.map((c) => c.voters.length));
      const leaders = candidates
        .filter((c) => c.voters.length === maxVotes)
        .sort((a, b) => a.songName.localeCompare(b.songName));

      return {
        albumId: album.id,
        albumName: album.name,
        albumYear: album.year,
        albumCover: album.cover,
        kind: album.kind || "album",
        voteCount: maxVotes,
        songs: leaders.map((winner) => {
          const entry = album.songs
            .map((s) => (typeof s === "string" ? { name: s } : s))
            .find((s) => s.name === winner.songName);
          return {
            songName: winner.songName,
            voters: winner.voters,
            voteCount: winner.voters.length,
            youtubeUrl: winner.youtubeUrl,
            songsterrUrl: winner.songsterrUrl || songsterrUrl(winner.songName),
            key: winner.key,
            cover: entry?.cover || null,
          };
        }),
      };
    })
    .filter(Boolean);
}

function computeMatches(voteRows) {
  const groups = groupVotesBySong(voteRows);
  const matches = [...groups.values()]
    .filter((g) => g.voters.length >= 2)
    .sort(
      (a, b) =>
        b.voters.length - a.voters.length || a.songName.localeCompare(b.songName)
    );

  const voterMap = new Map();
  for (const row of voteRows) {
    if (!voterMap.has(row.voter_name)) {
      voterMap.set(row.voter_name, new Set());
    }
    voterMap.get(row.voter_name).add(getSongKey(row.album_id, row.song_name));
  }

  const names = [...voterMap.keys()].sort();
  const pairwise = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const shared = [...voterMap.get(names[i])].filter((k) => voterMap.get(names[j]).has(k));
      if (shared.length > 0) {
        pairwise.push({
          voterA: names[i],
          voterB: names[j],
          overlapCount: shared.length,
          sharedSongs: shared.map((key) => {
            const info = findSong(key);
            const media = info
              ? resolveSongMedia(info.album.id, info.songName)
              : { youtubeUrl: "", songsterrUrl: null, hasPreview: false };
            return {
              key,
              songName: info?.songName ?? key,
              albumName: info?.album.name ?? "",
              ...media,
            };
          }),
        });
      }
    }
  }

  pairwise.sort((a, b) => b.overlapCount - a.overlapCount);

  const voters = names.map((name) => {
    const picks = voteRows.filter((r) => r.voter_name === name);
    return {
      name,
      songs: picks.map((p) => ({
        albumId: p.album_id,
        songName: p.song_name,
        key: getSongKey(p.album_id, p.song_name),
      })),
    };
  });

  return {
    matches,
    pairwise,
    voters,
    totalVoters: names.length,
  };
}

function playlistSongKeys(voteRows) {
  const keys = new Set();
  for (const track of computePlaylist(voteRows)) {
    for (const song of track.songs) {
      keys.add(song.key);
    }
  }
  return keys;
}

function playlistFromKeys(songKeys, voteRows = []) {
  const groups = groupVotesBySong(voteRows);
  const byAlbum = new Map();

  for (const key of songKeys) {
    const info = findSong(key);
    if (!info) continue;
    const album = info.album;
    const voters = groups.get(key)?.voters ?? [];
    if (!byAlbum.has(album.id)) {
      byAlbum.set(album.id, {
        albumId: album.id,
        albumName: album.name,
        albumYear: album.year,
        albumCover: album.cover,
        songs: [],
      });
    }
    byAlbum.get(album.id).songs.push({
      songName: info.songName,
      voters,
      voteCount: voters.length,
      ...resolveSongMedia(album.id, info.songName),
      key,
    });
  }

  return albums
    .map((album) => byAlbum.get(album.id))
    .filter(Boolean)
    .map((track) => {
      const songs = track.songs.sort((a, b) => a.songName.localeCompare(b.songName));
      const voteCount = Math.max(0, ...songs.map((s) => s.voteCount));
      return {
        ...track,
        voteCount,
        songs,
      };
    });
}

module.exports = {
  computeLeaderboard,
  computePlaylist,
  computeMatches,
  playlistSongKeys,
  playlistFromKeys,
};
