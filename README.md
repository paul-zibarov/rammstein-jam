# Rammstein Jam

Голосування за пісні Rammstein серед друзів. Кожен обирає скільки завгодно треків — у фінальний плейлист потрапляє **по одному лідеру з кожного альбому**.

## Можливості

- 8 альбомів з обкладинками та посиланнями на YouTube
- Необмежена кількість пісень на одного учасника
- **Фінальний плейлист** — по 1 треку з кожного альбому (найбільше голосів)
- **Таблиця лідерів** усіх пісень
- Збіги голосів між учасниками
- Без токенів — звичайний бекенд із базою даних

## Локальний запуск

```bash
npm install
npm start
```

Відкрийте [http://localhost:3000](http://localhost:3000). Голоси зберігаються в `votes.db` (SQLite).

## Деплой на Render (безкоштовно)

1. Створіть базу на [Turso](https://turso.tech/) (безкоштовно, постійне сховище):
   ```bash
   turso db create rammstein-jam
   turso db tokens create rammstein-jam
   ```
2. На [Render](https://render.com/) → **New → Blueprint** → підключіть цей репозиторій
3. Додайте змінні середовища:
   - `TURSO_DATABASE_URL` — URL бази
   - `TURSO_AUTH_TOKEN` — токен Turso
4. Після деплою сайт буде на `https://rammstein-jam.onrender.com`

Без Turso на Render дані SQLite зникнуть після перезапуску — для продакшену потрібна Turso.

## API

| Метод | Шлях | Опис |
|-------|------|------|
| GET | `/api/albums` | Альбоми, пісні, YouTube |
| POST | `/api/votes` | `{ name, songs: [{ albumId, songName }] }` |
| GET | `/api/playlist` | Фінальний плейлист (1 трек / альбом) |
| GET | `/api/leaderboard` | Таблиця лідерів |
| GET | `/api/matches` | Збіги між учасниками |
| GET | `/api/votes` | Хто за що голосував |
