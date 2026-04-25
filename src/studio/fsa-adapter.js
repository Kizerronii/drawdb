// Dexie-compatible adapter dla db.diagrams w trybie FSA (File System Access).
// Odpowiada za mapowanie wywołań Workspace.jsx (Dexie API) na operacje
// in-memory session map + zapis przez File System Access API.
//
// Sessions są ulotne (per session window) — recent files są oddzielnie persistowane
// w db.recentFiles. Adapter NIE używa db.recentFiles do listy projektów; Launcher
// i ControlPanel czytają recent bezpośrednio przez recent-files.js.
//
// Operacje wspierane (wszystko czego używa Workspace.jsx):
//   .add(obj) — przyjmuje obj.diagramId jako sessionId, jeśli podany
//   .get(id) / .get({field: val})
//   .where("diagramId").equals(id).first() / .modify(changes) / .delete()
//   .orderBy("lastModified").last() — w FSA zwraca undefined (Workspace pokaże modal
//      wyboru bazy; user wraca do Launcher po recent files)
//   .each(fn) / .clear() / .toArray() — operują na in-memory sessions
//
// Każda mutacja emituje studioEvents (useLiveQuery shim ich słucha).

import { fsaSessions, writeSession } from "./fsa-storage";
import { studioEvents } from "./api-client";

const FIELD_DIAGRAM_ID = "diagramId";

function emit() {
  studioEvents._dispatch("local", { data: null });
}

function hydrateSession(sessionId, session) {
  const base = session.data ?? {};
  return {
    ...base,
    diagramId: sessionId,
    name: session.name ?? base.name ?? "Untitled",
    database: session.database ?? base.database ?? "generic",
    lastModified: session.lastSavedAt ?? base.lastModified ?? new Date(),
  };
}

function ensureSessionPatch(prev, changes) {
  const data = { ...(prev ?? {}), ...changes };
  return data;
}

class FSAEqualsClause {
  constructor(field, value) {
    this.field = field;
    this.value = value;
  }

  async first() {
    if (this.field === FIELD_DIAGRAM_ID) {
      const session = fsaSessions.get(this.value);
      return session ? hydrateSession(this.value, session) : undefined;
    }
    // np. loadedFromGistId — niewspierane w FSA
    return undefined;
  }

  async modify(changes) {
    if (this.field !== FIELD_DIAGRAM_ID) {
      throw new Error(`fsa-adapter: modify supports only ${FIELD_DIAGRAM_ID}`);
    }
    const session = fsaSessions.get(this.value);
    if (!session) {
      throw new Error(`fsa-adapter: session ${this.value} not found`);
    }
    const nextData = ensureSessionPatch(session.data, changes);
    fsaSessions.update(this.value, {
      data: nextData,
      name: changes.name ?? session.name,
      database: changes.database ?? session.database,
      dirty: true,
    });
    if (session.handle) {
      // Cichy autosave do otwartego pliku. Jeśli rzuci (permission revoked),
      // pozostaw dirty=true — Workspace.jsx zobaczy błąd i ustawi State.SAVING_FAILED.
      await writeSession(this.value, nextData);
    }
    // Bez handle: in-memory only. User musi zrobić "Save As" (manual user gesture).
    emit();
    return 1;
  }

  async delete() {
    if (this.field !== FIELD_DIAGRAM_ID) {
      throw new Error(`fsa-adapter: delete supports only ${FIELD_DIAGRAM_ID}`);
    }
    fsaSessions.close(this.value);
    emit();
    return 1;
  }
}

class FSAWhereClause {
  constructor(field) {
    this.field = field;
  }

  equals(value) {
    return new FSAEqualsClause(this.field, value);
  }
}

class FSAOrderByChain {
  constructor(field, { reversed = false, limit = null } = {}) {
    this.field = field;
    this.reversed = reversed;
    this.limitN = limit;
  }

  reverse() {
    return new FSAOrderByChain(this.field, { reversed: !this.reversed, limit: this.limitN });
  }

  limit(n) {
    return new FSAOrderByChain(this.field, { reversed: this.reversed, limit: n });
  }

  async toArray() {
    // W FSA mode lista projektów żyje w db.recentFiles, nie w sessions.
    // Komponenty Launcher/ControlPanel czytają recent bezpośrednio (recent-files.js).
    // Adapter zwraca tylko aktywne sesje — przydatne dla flow który tego wymaga.
    const items = [];
    for (const [id, session] of fsaSessions.map) {
      items.push(hydrateSession(id, session));
    }
    items.sort((a, b) => {
      const av = a[this.field];
      const bv = b[this.field];
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    if (this.reversed) items.reverse();
    return this.limitN != null ? items.slice(0, this.limitN) : items;
  }

  async last() {
    const list = await this.toArray();
    return list[list.length - 1];
  }

  async first() {
    const list = await this.toArray();
    return list[0];
  }
}

class FSADiagramsTable {
  async toArray() {
    return new FSAOrderByChain("lastModified").toArray();
  }

  // Workspace.jsx (lin. 94) generuje własny diagramId i wkłada w obj.diagramId.
  // Launcher.jsx (lin. 69) NIE generuje — adapter wygeneruje sessionId i zwróci.
  add(obj) {
    const sessionId = fsaSessions.create({
      sessionId: obj.diagramId,
      name: obj.name,
      database: obj.database,
      data: { ...obj, lastModified: obj.lastModified ?? new Date() },
    });
    emit();
    return Promise.resolve(sessionId);
  }

  async put(obj) {
    if (!obj.diagramId) throw new Error("fsa-adapter: put requires diagramId");
    const session = fsaSessions.get(obj.diagramId);
    if (session) {
      fsaSessions.update(obj.diagramId, {
        data: obj,
        name: obj.name ?? session.name,
        database: obj.database ?? session.database,
      });
      if (session.handle) await writeSession(obj.diagramId, obj);
    } else {
      fsaSessions.create({
        sessionId: obj.diagramId,
        name: obj.name,
        database: obj.database,
        data: obj,
      });
    }
    emit();
    return obj.diagramId;
  }

  async update(sessionId, changes) {
    return new FSAEqualsClause(FIELD_DIAGRAM_ID, sessionId).modify(changes);
  }

  async delete(sessionId) {
    return new FSAEqualsClause(FIELD_DIAGRAM_ID, sessionId).delete();
  }

  async get(criteria) {
    if (typeof criteria === "string") {
      const session = fsaSessions.get(criteria);
      return session ? hydrateSession(criteria, session) : undefined;
    }
    const [field, value] = Object.entries(criteria)[0];
    return new FSAEqualsClause(field, value).first();
  }

  where(field) {
    return new FSAWhereClause(field);
  }

  orderBy(field) {
    return new FSAOrderByChain(field);
  }

  async each(fn) {
    for (const [id, session] of fsaSessions.map) {
      await fn(hydrateSession(id, session));
    }
  }

  async clear() {
    for (const id of [...fsaSessions.map.keys()]) {
      fsaSessions.close(id);
    }
    emit();
  }

  hook() {
    /* no-op (Dexie hooks nieużywane przez storage-adapter ani fsa-adapter) */
  }
}

export function makeDiagramsAdapter() {
  return new FSADiagramsTable();
}
