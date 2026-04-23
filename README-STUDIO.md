# drawdb-studio

Nadbudowa na fork [drawdb-io/drawdb](https://github.com/drawdb-io/drawdb) — CLI, Docker Compose, **launcher projektu** i **filesystem storage** dla wygodnego hostowania jednej globalnej instancji drawdb dla wielu projektów bazodanowych.

Ten fork **zachowuje pełną synchronizację z upstream** — modyfikacje są w osobnych ścieżkach (`studio/`, `src/studio/`, `bin/`, `compose-studio.yml`, ...), które nie kolidują z kodem drawdb. `drawdb update` aktualizuje z upstream.

## Co dodaje studio

- **Launcher projektu na `/`** — zamiast marketingowej landing page, ekran wyboru projektu (styl VS Code Welcome). Włączane flagą `VITE_STUDIO_MODE=true` (default w `drawdb up/dev`).
- **Filesystem storage** — projekty trzymane jako pliki `~/drawdb-projects/*.drawdb.json` zamiast w IndexedDB przeglądarki. Multi-projektowość bez ręcznego export/import.
- **REST API + SSE** (`studio/api/`) — Node/Fastify backend, port 3001. CRUD plików + live updates (chokidar).
- **`drawdb launch`** — otwiera drawdb w Chromium app mode (okno bez UI przeglądarki, jak natywna apka).

## Instalacja

```bash
git clone https://github.com/Kizerronii/drawdb.git ~/workbench/dev/drawdb
cd ~/workbench/dev/drawdb
git remote add upstream https://github.com/drawdb-io/drawdb.git  # dla 'drawdb update'
./install.sh
```

`install.sh` tworzy też `~/drawdb-projects/` (workspace plików).

**Wymagania:** Docker + Docker Compose. Dla `drawdb launch`: `chromium` (`sudo pacman -S chromium`).

## Użycie

```bash
drawdb up                # prod (nginx + api), porty 3000 + 3001
drawdb dev               # dev (vite + api), porty 5173 + 3001, hot-reload
drawdb launch            # up + otwiera w Chromium app mode (okno bez chrome'u)
drawdb launch dev        # to samo dla dev mode
drawdb down              # zatrzymaj wszystko
drawdb restart [dev]     # restart prod (lub dev)
drawdb status            # status kontenerów
drawdb logs -f           # logi (flagi do 'docker compose logs')
drawdb rebuild           # --no-cache + restart
drawdb update            # fetch+merge upstream + rebuild
drawdb open              # xdg-open (default browser, Firefox tab)
drawdb sh [name]         # shell w kontenerze (drawdb | drawdb-dev | drawdb-api)
drawdb help              # pomoc
```

## Multi-projekt workflow (filesystem storage)

Wszystkie projekty żyją w `~/drawdb-projects/` jako pliki `*.drawdb.json`. Jeden plik = jeden projekt.

1. `drawdb launch` → launcher na `/` pokazuje listę plików.
2. **Nowy pusty diagram** → dialog z nazwą → tworzy `~/drawdb-projects/<slug>.drawdb.json` → otwiera edytor.
3. **Z szablonu** → modal z built-in szablonami → klik → tworzy nowy plik.
4. Edycja w drawdb — `Ctrl+S` zapisuje do tego samego pliku.
5. Wracasz na `/` → projekt na liście Recent.

**Live sync:** zmiany plików z dysku (np. `git pull` pobrał nowy `*.drawdb.json`) są automatycznie widoczne w launcherze (SSE + chokidar).

**Backup / sync:** `~/drawdb-projects/` to zwykły katalog — możesz go trzymać w git, syncthing, rsync, dropbox itp.

## Hyprland: dedykowane okno

Po `drawdb launch` Chromium uruchamia się z `--class=drawdb-studio`. Możesz dopisać do `~/.config/hypr/hyprland.conf` reguły:

```
windowrulev2 = workspace 5, class:^(drawdb-studio)$
windowrulev2 = noborder, class:^(drawdb-studio)$
```

Wtedy drawdb zawsze otwiera się na workspace 5, bez ramek.

## Modyfikowanie drawdb

Fork pozwala na lokalne modyfikacje kodu drawdb (skróty, UI, własne fiche):

1. `drawdb dev` — vite z hot-reload + studio API.
2. Edytuj w `src/` — zmiany widoczne od razu.
3. Commituj — pliki studio w osobnych ścieżkach nie kolidują z `drawdb update`.

### Filozofia "nie dotykać upstream"

Studio kod żyje w nowych katalogach (zero ryzyka konfliktu przy merge):
- `studio/` — backend API, MCP (faza 2), Dockerfile.studio
- `src/studio/` — Launcher, storage adapter, dexie-react-hooks shim
- `bin/`, `compose-studio.yml`, `install.sh`, `README-STUDIO.md`, `.env.studio`

Modyfikacje w plikach upstream są MINIMALNE i flag-guarded:
- `src/App.jsx` — 3 linie: conditional route w studio mode
- `src/data/db.js` — 6 linii na końcu: replace `db.diagrams` z adapterem
- `vite.config.js` — 8 linii: alias `dexie-react-hooks` → shim w studio mode

Bez `VITE_STUDIO_MODE=true` (czyli `npm run dev` bez `--mode studio`) drawdb działa identycznie z upstream — landing page, IndexedDB, vanilla flow.

## Architektura

```
Browser (Chromium app mode)
    │
    │ HTTP / SSE
    ▼
drawdb-api (Fastify, port 3001)
    │
    │ fs.readFile / writeFile / chokidar.watch
    ▼
~/drawdb-projects/*.drawdb.json
```

Drawdb SPA (port 3000 prod / 5173 dev) komunikuje się z drawdb-api przez REST + SSE. Storage adapter w SPA wystawia Dexie-compatible interfejs nad HTTP, więc istniejący kod drawdb (Workspace.jsx, ControlPanel.jsx) działa bez modyfikacji.

## Roadmap

- **Faza 1 (zaimplementowana):** launcher + filesystem storage + `drawdb launch`
- **Faza 2:** MCP server (`studio/api/mcp.js`) reużywający storage.js. Tools dla Claude Code: `list_projects`, `get_schema`, `add_table`, `add_column`, `add_relation`, `export_sql`. Komenda `drawdb mcp` startuje stdio MCP.
- **Faza 3:** UX polish launchera (Playwright MCP do wizualnej weryfikacji, ewentualnie Claude Design dla iteracji designu)

## Dlaczego fork?

- **Modyfikacje kodu drawdb** — UI, własne fiche (commit w forku).
- **Pliki "studio"** nie kolidują z upstream (osobne ścieżki).
- **`drawdb update`** wciąga zmiany z `upstream/main` przez `git merge` — konflikty tylko gdy upstream zmodyfikuje 1 z 3 wspólnie używanych plików (App.jsx, db.js, vite.config.js).

## Struktura forka

```
~/workbench/dev/drawdb/
├── bin/drawdb              # CLI wrapper
├── compose-studio.yml      # Docker Compose (prod + dev profile + drawdb-api)
├── install.sh              # symlink + workspace bootstrap
├── README-STUDIO.md        # ta dokumentacja
├── .env.studio             # VITE_STUDIO_MODE, VITE_API_URL (ładowane przez --mode studio)
├── studio/
│   ├── api/                # Node/Fastify backend (REST + SSE filesystem)
│   │   ├── server.js
│   │   ├── storage.js      # CRUD plików (reuse przez MCP w Fazie 2)
│   │   ├── package.json
│   │   └── Dockerfile
│   └── Dockerfile.studio   # prod build z VITE_STUDIO_MODE=true
├── src/studio/
│   ├── Launcher.jsx        # ekran wyboru projektu na `/`
│   ├── api-client.js       # HTTP + SSE wrapper
│   ├── storage-adapter.js  # Dexie-compatible API nad HTTP
│   └── dexie-react-hooks-shim.js  # useLiveQuery z SSE refresh
├── Dockerfile              # (upstream — nietknięty)
├── compose.yml             # (upstream — nietknięty)
└── ... pozostałe pliki drawdb (większość nietknięta) ...
```

## Licencja

drawdb: AGPL-3.0 (patrz `LICENSE`). Warstwa studio (`studio/`, `src/studio/`, `bin/`, `compose-studio.yml`, `install.sh`, `README-STUDIO.md`, `.env.studio`) — rozwijana przez Kizerronii, ta sama licencja jak upstream.
