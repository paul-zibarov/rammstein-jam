const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const docs = path.join(root, "docs");
const publicDir = path.join(root, "public");
const dataDir = path.join(docs, "data");

fs.mkdirSync(dataDir, { recursive: true });

fs.copyFileSync(path.join(publicDir, "styles.css"), path.join(docs, "styles.css"));

const albumsSource = fs.readFileSync(path.join(root, "data/albums.js"), "utf8");
const albumsBrowser = albumsSource
  .replace("module.exports = { albums, getSongKey, findSong };", "")
  .trim();
fs.writeFileSync(path.join(docs, "albums.js"), `${albumsBrowser}\n`);

fs.copyFileSync(path.join(root, "data/votes.json"), path.join(dataDir, "votes.json"));

const repo = process.env.GITHUB_REPOSITORY || "paul-zibarov/rammstein-jam";
const branch = process.env.GITHUB_REF_NAME || process.env.GITHUB_BRANCH || "main";

const config = `window.APP_CONFIG = ${JSON.stringify(
  {
    repo,
    branch,
    votesPath: "data/votes.json",
  },
  null,
  2
)};\n`;

fs.writeFileSync(path.join(docs, "config.js"), config);

console.log("docs/ built for GitHub Pages");
