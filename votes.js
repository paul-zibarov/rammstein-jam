function getSongKey(albumId, songName) {
  return `${albumId}::${songName}`;
}

function normalizeVoterName(name) {
  return String(name ?? "").trim();
}

function findVoterIndex(voters, name) {
  const normalized = normalizeVoterName(name).toLowerCase();
  return voters.findIndex((v) => normalizeVoterName(v.name).toLowerCase() === normalized);
}

function validateVoteInput(name, songs, maxSongs) {
  const trimmed = normalizeVoterName(name);
  if (!trimmed || trimmed.length < 2) {
    return { error: "Введіть ім'я (мінімум 2 символи)" };
  }
  if (trimmed.length > 40) {
    return { error: "Ім'я занадто довге" };
  }
  if (!Array.isArray(songs) || songs.length === 0) {
    return { error: "Оберіть хоча б одну пісню" };
  }
  if (songs.length > maxSongs) {
    return { error: `Можна обрати максимум ${maxSongs} пісень` };
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

  return { name: trimmed, songs: normalized };
}

function upsertVote(voters, name, songs) {
  const next = voters.map((v) => ({
    name: v.name,
    songs: [...(v.songs || [])],
    updatedAt: v.updatedAt,
  }));
  const idx = findVoterIndex(next, name);
  const entry = {
    name,
    songs,
    updatedAt: new Date().toISOString(),
  };

  if (idx >= 0) {
    next[idx] = entry;
    return { voters: next, updated: true };
  }

  next.push(entry);
  return { voters: next, updated: false };
}

function toVotesResponse(voters) {
  const list = voters.map((v) => ({
    name: v.name,
    songs: (v.songs || []).map((s) => ({
      albumId: s.albumId,
      songName: s.songName,
      key: getSongKey(s.albumId, s.songName),
    })),
  }));

  return {
    voters: list,
    totalVoters: list.length,
  };
}

function computeMatches(voters) {
  const groups = new Map();

  for (const voter of voters) {
    for (const song of voter.songs || []) {
      const key = getSongKey(song.albumId, song.songName);
      if (!groups.has(key)) {
        const info = findSong(key);
        groups.set(key, {
          key,
          albumId: song.albumId,
          songName: song.songName,
          albumName: info?.album.name ?? song.albumId,
          albumCover: info?.album.cover ?? "",
          voters: [],
        });
      }
      groups.get(key).voters.push(voter.name);
    }
  }

  const allGroups = [...groups.values()];
  const matches = allGroups
    .filter((g) => g.voters.length >= 2)
    .sort((a, b) => b.voters.length - a.voters.length || a.songName.localeCompare(b.songName));

  const allSongs = allGroups
    .filter((g) => g.voters.length > 0)
    .sort((a, b) => b.voters.length - a.voters.length || a.songName.localeCompare(b.songName));

  const voterPicks = voters.map((v) => ({
    name: v.name,
    picks: new Set((v.songs || []).map((s) => getSongKey(s.albumId, s.songName))),
  }));

  const pairwise = [];
  for (let i = 0; i < voterPicks.length; i++) {
    for (let j = i + 1; j < voterPicks.length; j++) {
      const shared = [...voterPicks[i].picks].filter((k) => voterPicks[j].picks.has(k));
      if (shared.length > 0) {
        pairwise.push({
          voterA: voterPicks[i].name,
          voterB: voterPicks[j].name,
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

  return {
    matches,
    allSongs,
    pairwise,
    totalVoters: voters.length,
  };
}
