# Rammstein Jam

Голосування за пісні Rammstein серед друзів. Кожен обирає треки з усіх альбомів — у фінальний плейлист потрапляє **по одному лідеру з кожного альбому**.

## Можливості

- Кілька раундів голосування (зараз активний **Rammstein Tribute Vol. 2**)
- Архів попередніх голосувань на `/archive.html`
- 8 альбомів з обкладинками та посиланнями на YouTube
- Мінімум 3 пісні з кожного альбому
- **Фінальний плейлист** — по 1 треку з кожного альбому (або всі лідери при нічиїй)
- **Таблиця лідерів** усіх пісень
- Збіги голосів між учасниками
- Без токенів

## Локально

```bash
npm install
npm start
```

→ http://localhost:3000 (голоси в `votes.db`)

---

## Деплой на Railway (рекомендовано)

**Один аккаунт** — і хостинг, і база даних. Безкоштовно ~$5 кредитів/міс.

### Крок 1 — Railway

1. Відкрийте [railway.app](https://railway.app/) → увійдіть через **GitHub**
2. **New Project** → **Deploy from GitHub repo** → оберіть `rammstein-jam`
3. Railway сам збере і запустить додаток

### Крок 2 — База даних

1. У тому ж проєкті натисніть **+ New** → **Database** → **PostgreSQL**
2. Відкрийте сервіс **rammstein-jam** (ваш додаток) → вкладка **Variables**
3. Натисніть **Add Reference** → оберіть PostgreSQL → `DATABASE_URL`
4. Railway перезапустить додаток — голоси зберігатимуться постійно

### Крок 3 — Публічний URL

1. Сервіс додатку → **Settings** → **Networking** → **Generate Domain**
2. Отримаєте посилання на кшталт `rammstein-jam-production.up.railway.app`
3. Поділіться ним із друзями

Готово.

---

## Голосування

| ID | Назва | Статус |
|----|-------|--------|
| `tribute-vol-1` | Rammstein Tribute Vol. 1 | архів |
| `tribute-vol-2` | Rammstein Tribute Vol. 2 | активне |

Існуючі голоси автоматично належать до Vol. 1 після міграції `poll_id`.

## API

| Метод | Шлях | Опис |
|-------|------|------|
| GET | `/api/polls` | Список голосувань |
| GET | `/api/polls/:id/albums` | Альбоми для голосування |
| POST | `/api/polls/:id/votes` | `{ name, songs: [{ albumId, songName }] }` |
| GET | `/api/polls/:id/playlist` | Фінальний плейлист |
| GET | `/api/polls/:id/leaderboard` | Таблиця лідерів |
| GET | `/api/polls/:id/matches` | Збіги між учасниками |
| GET | `/api/polls/:id/votes` | Хто за що голосував |

Аліаси без `:id` (`/api/albums`, `/api/votes`, …) ведуть на активне голосування.
