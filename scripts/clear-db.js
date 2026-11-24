const { initDb, getDb } = require("../lib/db");

const pollId = process.argv[2] || process.env.CLEAR_POLL || null;

initDb()
  .then(async () => {
    await getDb().clearAll(pollId);
    console.log(pollId ? `Голоси видалено для ${pollId}.` : "Усі голоси видалено.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
