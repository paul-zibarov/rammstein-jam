const { initDb, getDb } = require("../lib/db");

initDb()
  .then(async () => {
    await getDb().clearAll();
    console.log("Голоси видалено.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
