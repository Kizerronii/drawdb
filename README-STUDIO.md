# drawdb-studio

Nadbudowa na fork [drawdb-io/drawdb](https://github.com/drawdb-io/drawdb) — CLI i Docker Compose do wygodnego hostowania jednej globalnej instancji drawdb dla wielu projektów bazodanowych.

Ten fork **zachowuje pełną synchronizację z upstream** — modyfikacje są w osobnych plikach (`compose-studio.yml`, `bin/drawdb`, `install.sh`, `README-STUDIO.md`), które nie kolidują z kodem drawdb. `drawdb update` aktualizuje z upstream.

## Instalacja (jednorazowo na maszynie)

```bash
git clone https://github.com/Kizerronii/drawdb.git ~/workbench/dev/drawdb
cd ~/workbench/dev/drawdb
git remote add upstream https://github.com/drawdb-io/drawdb.git  # dla 'drawdb update'
./install.sh
```

Symlinkuje `bin/drawdb` do `~/.local/bin/drawdb`. Wymaga `~/.local/bin` w `PATH`.

Wymagania: Docker + Docker Compose.

## Użycie

W dowolnym katalogu (projekt trzyma tylko schemat JSON):

```bash
drawdb up                # prod, port 3000
drawdb dev               # dev mode, port 5173, hot-reload
drawdb down              # zatrzymaj
drawdb restart           # prod
drawdb restart dev       # dev
drawdb status            # status kontenerów
drawdb logs -f           # logi (flagi do 'docker compose logs')
drawdb rebuild           # --no-cache + restart
drawdb update            # fetch+merge upstream + rebuild
drawdb open              # xdg-open http://localhost:3000 (lub 5173)
drawdb sh [name]         # shell w kontenerze
drawdb help              # pomoc
```

## Workflow wielu projektów

drawdb trzyma aktualny projekt w IndexedDB przeglądarki (origin `localhost:3000`). Przełączanie między projektami:

1. W projekcie A: `File → Export as → JSON` → `schemas/my-db.json` → commit.
2. W projekcie B: `drawdb up`, `File → Import Diagram` → wybierz plik JSON projektu B.

Jedna instancja drawdb działa na wszystkie projekty — lokalne JSON-y w każdym projekcie są źródłem prawdy.

## Modyfikowanie drawdb

Fork pozwala na lokalne modyfikacje kodu drawdb (skróty klawiszowe, UI, itp.):

1. `drawdb dev` — vite z hot-reload.
2. Edytuj w `src/` — zmiany widoczne od razu.
3. Commituj na branch innym niż `main` (np. `studio-patches`), żeby `drawdb update` nie powodowało konfliktów przy merge z upstream.

## Dlaczego fork?

- **Modyfikacje kodu drawdb** — skróty, UI, własne funkcje (commit w forku).
- **Pliki "studio"** (CLI, compose, install) nie kolidują z upstream — są w nowych ścieżkach (`bin/`, `compose-studio.yml`, `install.sh`, `README-STUDIO.md`).
- **`drawdb update`** wciąga zmiany z `upstream/main` przez `git merge` — konflikty tylko przy modyfikacji tego samego kodu upstream.

## Struktura forka

```
~/workbench/dev/drawdb/
├── bin/drawdb              # CLI wrapper
├── compose-studio.yml      # Docker Compose (prod + dev profile)
├── install.sh              # symlink do ~/.local/bin/drawdb
├── README-STUDIO.md        # ta dokumentacja
├── Dockerfile              # (upstream, używany przez prod)
├── compose.yml             # (upstream, dev vite — pominięty przez nasze CLI)
└── ... pozostałe pliki drawdb ...
```

## Licencja

drawdb: AGPL-3.0 (patrz `LICENSE`). Warstwa studio (bin/, compose-studio.yml, install.sh, README-STUDIO.md) — rozwijana przez Kizerronii, ta sama licencja jak upstream.
