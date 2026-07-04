const { albums, getSongKey, findSong, youtubeUrl } = require("../data/albums");

function groupVotesBySong(voteRows) {
  const groups = new Map();

  for (const row of voteRows) {
    const key = getSongKey(row.album_id, row.song_name);
    if (!groups.has(key)) {
      const info = findSong(key);
      groups.set(key, {
        key,
        albumId: row.album_id,
        songName: row.song_name,
        albumName: info?.album.name ?? row.album_id,
        albumYear: info?.album.year ?? null,
        albumCover: info?.album.cover ?? "",
        youtubeUrl: youtubeUrl(row.song_name, row.album_id),
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
        voteCount: maxVotes,
        songs: leaders.map((winner) => ({
          songName: winner.songName,
          voters: winner.voters,
          youtubeUrl: winner.youtubeUrl,
          key: winner.key,
        })),
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
            return {
              key,
              songName: info?.songName ?? key,
              albumName: info?.album.name ?? "",
              youtubeUrl: info ? youtubeUrl(info.songName, info.album.id) : "",
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

module.exports = {
  computeLeaderboard,
  computePlaylist,
  computeMatches,
};
