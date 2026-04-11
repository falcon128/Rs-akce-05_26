# City Task Game

Jednoduchá webová aplikace pro týmovou městskou hru se skautskými úkoly. Každý tým se přihlásí vlastním názvem a heslem, vidí jen svou kartu 5×5 a společný leaderboard.

## Technologie

- Frontend: čisté HTML, CSS a JavaScript
- Backend: čistý Node.js bez Expressu
- Ukládání dat: JSON soubory v `data/`
- Synchronizace: HTTP endpointy + polling
- Obrázky: ukládání do `uploads/`

## Struktura projektu

```text
city-task-game/
├── server.js
├── package.json
├── Dockerfile
├── README.md
├── data/
│   ├── config.json
│   ├── teams.json
│   ├── cards.json
│   └── game-state.json
├── public/
│   ├── index.html
│   ├── login.html
│   ├── admin.html
│   ├── style.css
│   ├── app.js
│   ├── admin.js
│   └── assets/
└── uploads/
```

## Lokální spuštění

1. Otevři terminál ve složce projektu.
2. Spusť:

```bash
npm start
```

3. Aplikace poběží na adrese [http://localhost:3000](http://localhost:3000).

## Docker

Build a spuštění:

```bash
docker build -t city-task-game .
docker run -p 3000:3000 city-task-game
```

Image používá `node:20-alpine`, která je vhodná i pro ARM zařízení včetně Raspberry Pi.

## Přístup z mobilu v lokální síti

1. Spusť aplikaci na počítači nebo Raspberry Pi ve stejné síti.
2. Zjisti lokální IP adresu zařízení, například `192.168.1.50`.
3. Na mobilu otevři `http://192.168.1.50:3000`.

## Hráčská a admin část

- Hráčská část: `/` nebo `/login.html`
- Herní karta po přihlášení: `/index.html`
- Admin login: `/admin`
- Admin panel po přihlášení: `/admin-panel.html`

Výchozí admin heslo je `87654321`.

Po prvním spuštění není vytvořený žádný tým. Týmy založ admin v `/admin-panel.html`.

## Jak funguje ukládání dat

- `data/config.json` ukládá admin heslo, bonus za řady, stav hry a verzi změn.
- `data/teams.json` ukládá týmy, hesla a přiřazené karty.
- `data/cards.json` ukládá obsah všech 5 karet.
- `data/game-state.json` ukládá rozehraný stav týmů.
- `uploads/` obsahuje nahrané obrázky k úkolům.

Po restartu serveru zůstane herní i administrační stav zachovaný. Nepersistují se jen přihlašovací session, takže po restartu je potřeba se znovu přihlásit.

## Jak aplikace funguje

- Tým se přihlásí a server mu podle přiřazení vrátí jednu konkrétní kartu.
- Zavřené políčko ukazuje jen typ úkolu, po otevření se odkryje detail.
- Tým může mít současně maximálně 3 otevřené nesplněné úkoly.
- Úkol může být omezen pevným deadlinem nebo časem od otevření.
- Body se počítají za splněné úkoly, rychlé bonusy a celé řady.
- Klienti si pravidelně stahují nový stav přes polling.
