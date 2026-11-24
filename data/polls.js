const ACTIVE_POLL_ID = "tribute-vol-2";
const LEGACY_POLL_ID = "tribute-vol-1";

/** Official Tribute Vol. 1 playlist — these songs stay locked in Vol. 2 */
const TRIBUTE_VOL1_PLAYLIST_KEYS = [
  "herzeleid::Wollt ihr das Bett in Flammen sehen?",
  "sehnsucht::Engel",
  "mutter::Sonne",
  "mutter::Mein Herz brennt",
  "reise-reise::Ohne dich",
  "rosenrot::Rosenrot",
  "liebe::Rammlied",
  "rammstein-2019::Deutschland",
  "zeit::Armee der Tristen",
];

const polls = [
  {
    id: "tribute-vol-1",
    title: "Rammstein Tribute Vol. 1",
    status: "archived",
    description: "Перше голосування — фінальний плейлист по одній пісні з кожного альбому.",
    officialPlaylistKeys: TRIBUTE_VOL1_PLAYLIST_KEYS,
  },
  {
    id: "tribute-vol-2",
    title: "Rammstein Tribute Vol. 2",
    status: "active",
    description:
      "Нове голосування — знову обираємо треки з усіх альбомів для спільного плейлисту. Пісні з офіційного плейлисту Vol. 1 заблоковані.",
    blockedSongKeys: TRIBUTE_VOL1_PLAYLIST_KEYS,
  },
];

function getPoll(pollId) {
  return polls.find((poll) => poll.id === pollId) || null;
}

function getActivePoll() {
  return polls.find((poll) => poll.status === "active") || null;
}

function getArchivedPolls() {
  return polls.filter((poll) => poll.status === "archived");
}

function resolvePollId(pollId) {
  if (!pollId || pollId === "active") {
    return getActivePoll()?.id || ACTIVE_POLL_ID;
  }
  return getPoll(pollId)?.id || null;
}

function getBlockedSongKeys(poll) {
  if (!poll?.blockedSongKeys?.length) return new Set();
  return new Set(poll.blockedSongKeys);
}

module.exports = {
  polls,
  ACTIVE_POLL_ID,
  LEGACY_POLL_ID,
  TRIBUTE_VOL1_PLAYLIST_KEYS,
  getPoll,
  getActivePoll,
  getArchivedPolls,
  resolvePollId,
  getBlockedSongKeys,
};
