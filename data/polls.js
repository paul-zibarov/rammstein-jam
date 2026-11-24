const ACTIVE_POLL_ID = "tribute-vol-2";
const LEGACY_POLL_ID = "tribute-vol-1";

const polls = [
  {
    id: "tribute-vol-1",
    title: "Rammstein Tribute Vol. 1",
    status: "archived",
    description: "Перше голосування — фінальний плейлист по одній пісні з кожного альбому.",
  },
  {
    id: "tribute-vol-2",
    title: "Rammstein Tribute Vol. 2",
    status: "active",
    description: "Нове голосування — знову обираємо треки з усіх альбомів для спільного плейлисту. Пісні з плейлисту Vol. 1 заблоковані.",
    blockedFromPollId: "tribute-vol-1",
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

module.exports = {
  polls,
  ACTIVE_POLL_ID,
  LEGACY_POLL_ID,
  getPoll,
  getActivePoll,
  getArchivedPolls,
  resolvePollId,
};
