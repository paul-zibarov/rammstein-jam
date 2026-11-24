const { DEEZER_TRACK_IDS } = require("../data/deezerTracks");

const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  cache.set(key, { at: Date.now(), value });
}

async function fetchDeezerTrack(deezerId) {
  const cached = cacheGet(`dz:${deezerId}`);
  if (cached) return cached;

  const res = await fetch(`https://api.deezer.com/track/${deezerId}`);
  if (!res.ok) throw new Error(`Deezer ${res.status}`);
  const track = await res.json();
  if (!track || track.error || !track.id) return null;

  const value = {
    deezerId: track.id,
    title: track.title,
    artist: track.artist?.name || "Rammstein",
    albumTitle: track.album?.title || null,
    artwork: track.album?.cover_medium || track.album?.cover || null,
    previewUrl: track.preview || null,
    deezerUrl: track.link || `https://www.deezer.com/track/${track.id}`,
    embedUrl: `https://widget.deezer.com/widget/dark/track/${track.id}`,
    youtubeMusicSearchUrl: `https://music.youtube.com/search?q=${encodeURIComponent(
      `Rammstein ${track.title}`
    )}`,
  };
  cacheSet(`dz:${deezerId}`, value);
  return value;
}

async function getPreviewForSong(songName) {
  const deezerId = DEEZER_TRACK_IDS[songName];
  if (!deezerId) return null;
  return fetchDeezerTrack(deezerId);
}

function hasPreview(songName) {
  return Boolean(DEEZER_TRACK_IDS[songName]);
}

module.exports = {
  getPreviewForSong,
  hasPreview,
  DEEZER_TRACK_IDS,
};
