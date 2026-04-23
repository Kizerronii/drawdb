import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// CRUD nad workspace = katalog z plikami *.drawdb.json.
// Jeden plik = jeden projekt. diagramId = basename bez rozszerzenia (slug).
// Reuse: ten moduł będzie też podstawą MCP server (Faza 2).

const EXT = ".drawdb.json";

export class Storage {
  constructor(workspaceRoot) {
    this.root = workspaceRoot;
  }

  async init() {
    await fs.mkdir(this.root, { recursive: true });
  }

  filePath(slug) {
    return path.join(this.root, `${slug}${EXT}`);
  }

  // Slug ze stringa: lowercase, alfanumeryczne + myślniki, bez kolizji z istniejącymi plikami.
  async makeSlug(name, { excludeSlug = null } = {}) {
    const base =
      String(name || "untitled")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64) || "untitled";
    let slug = base;
    let n = 2;
    while ((await this.exists(slug)) && slug !== excludeSlug) {
      slug = `${base}-${n++}`;
    }
    return slug;
  }

  async exists(slug) {
    try {
      await fs.access(this.filePath(slug));
      return true;
    } catch {
      return false;
    }
  }

  // Lista projektów: scan workspace, zwraca metadata (bez payloadu).
  async list() {
    const entries = await fs.readdir(this.root, { withFileTypes: true });
    const items = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(EXT)) continue;
      const slug = entry.name.slice(0, -EXT.length);
      try {
        const meta = await this.metadata(slug);
        items.push(meta);
      } catch (err) {
        // skip unreadable / malformed
        console.warn(`[storage] skip ${entry.name}: ${err.message}`);
      }
    }
    return items;
  }

  async metadata(slug) {
    const fp = this.filePath(slug);
    const stat = await fs.stat(fp);
    const raw = await fs.readFile(fp, "utf8");
    const data = JSON.parse(raw);
    return {
      diagramId: slug,
      name: data.name ?? slug,
      database: data.database ?? "generic",
      lastModified: stat.mtime,
      size: stat.size,
    };
  }

  // Pełen payload: zwraca obiekt zgodny z Dexie schema (Workspace.jsx:94-110).
  async read(slug) {
    const raw = await fs.readFile(this.filePath(slug), "utf8");
    const data = JSON.parse(raw);
    const stat = await fs.stat(this.filePath(slug));
    return {
      ...data,
      diagramId: slug,
      lastModified: stat.mtime,
    };
  }

  // Zapis nowego: derive slug z `name` (lub explicit data.diagramId), tworzy plik.
  // Zwraca { diagramId } — caller użyje go do navigacji.
  async create(data) {
    let slug;
    if (data.diagramId) {
      // Caller (np. upstream Workspace.jsx flow) podał własne ID (UUID).
      slug = data.diagramId;
      if (await this.exists(slug)) {
        throw new Error(`project '${slug}' already exists`);
      }
    } else {
      slug = await this.makeSlug(data.name);
    }
    const payload = this._sanitize({ ...data, diagramId: slug });
    await fs.writeFile(this.filePath(slug), JSON.stringify(payload, null, 2));
    return { diagramId: slug };
  }

  // Upsert: zapis pełen (PUT). Jeśli plik nie istnieje → tworzy.
  async write(slug, data) {
    const payload = this._sanitize({ ...data, diagramId: slug });
    await fs.writeFile(this.filePath(slug), JSON.stringify(payload, null, 2));
    return { diagramId: slug };
  }

  // Częściowa modyfikacja (PATCH): merge na top-level. Używane przez Dexie .modify().
  async patch(slug, changes) {
    const current = JSON.parse(await fs.readFile(this.filePath(slug), "utf8"));
    const merged = this._sanitize({ ...current, ...changes, diagramId: slug });
    await fs.writeFile(this.filePath(slug), JSON.stringify(merged, null, 2));
    return { diagramId: slug };
  }

  async remove(slug) {
    await fs.unlink(this.filePath(slug));
    return { deleted: slug };
  }

  // Usuń pola które nie powinny lądować w pliku (np. id Dexie internal, runtime-only).
  _sanitize(obj) {
    const { id: _dexieId, ...rest } = obj;
    // Date → ISO string (JSON.stringify defaultowo robi to samo, ale jawnie)
    if (rest.lastModified instanceof Date) {
      rest.lastModified = rest.lastModified.toISOString();
    }
    return rest;
  }
}

// Helper dla CLI / testów: utworzenie unikalnego slugu nawet bez instancji.
export function randomSlug() {
  return `untitled-${crypto.randomBytes(3).toString("hex")}`;
}
