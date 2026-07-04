# Rammstein Jam

Міні веб-додаток для голосування за улюблені пісні Rammstein. Друзі обирають треки з усіх альбомів — сайт рахує збіги голосів і показує, за які пісні проголосували однаково.

## Можливості

- 8 студійних альбомів з обкладинками та повним треклістом
- Кожен учасник обирає до 5 пісень
- Голоси зберігаються спільно (файл `data/votes.json` у репозиторії)
- Повторне голосування під тим самим ім'ям оновлює вибір
- Результати: збіги (2+ голоси), пари учасників зі спільними піснями, рейтинг

## GitHub Pages (онлайн)

Сайт деплоїться автоматично через GitHub Actions на **GitHub Pages**.

**URL:** `https://paul-zibarov.github.io/rammstein-jam/`

### Налаштування голосування

1. Створіть [fine-grained Personal Access Token](https://github.com/settings/tokens?type=beta):
   - Repository access: тільки цей репозиторій
   - Permissions: **Contents → Read and write**
2. На сайті розгорніть **«GitHub токен для голосування»** і вставте токен
3. Токен зберігається лише у вашому браузері (localStorage)

Кожен учасник може використати той самий токен або створити свій власний.

> GitHub **блокує** вбудовування токена в код сайту (push protection), тому секрет `VOTES_TOKEN` у Actions **не використовується** — токен вводиться вручну на сайті.

### Увімкнення GitHub Pages

1. **Settings → Pages → Build and deployment**
   - **Source:** Deploy from a branch
   - **Branch:** `gh-pages` → `/ (root)` → Save

   Альтернатива: гілка `main`, папка `/docs`.

2. Після push у `main` workflow автоматично оновлює гілку `gh-pages`

**URL:** `https://paul-zibarov.github.io/rammstein-jam/`

## Локальний запуск (Node + SQLite)

```bash
npm install
npm start
```

Відкрийте [http://localhost:3000](http://localhost:3000).

## Локальний перегляд статичної версії (як на GitHub Pages)

```bash
npm run build:docs
npx --yes serve docs
```

## Структура

| Шлях | Опис |
|------|------|
| `docs/` | Статичний сайт для GitHub Pages |
| `data/votes.json` | Спільне сховище голосів |
| `server.js` | Локальний сервер з SQLite |
| `.github/workflows/deploy-pages.yml` | Деплой на GitHub Pages |
