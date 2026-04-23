// Dexie-compatible adapter dla db.diagrams nad HTTP API.
// Zastępuje db.diagrams w studio mode (src/data/db.js).
//
// Implementuje TYLKO metody używane w drawdb codebase:
//   - .toArray()
//   - .add(obj) → returns thenable z diagramId
//   - .get(criteria)
//   - .where(field).equals(val).first() / .modify(changes) / .delete()
//   - .orderBy(field) → .last() / .reverse() / .reverse().limit(N).toArray()
//   - .each(fn)
//   - .clear() (used by exportSavedData)
//
// Każda mutacja wywołuje API + emituje studioEvents żeby useLiveQuery shim się odświeżył.

import { getApiClient, studioEvents } from "./api-client.js";

const FIELD_DIAGRAM_ID = "diagramId";

function mtime(item) {
  // API zwraca lastModified jako ISO string, Dexie używa Date.
  return item.lastModified instanceof Date ? item.lastModified : new Date(item.lastModified);
}

function hydrate(item) {
  return { ...item, lastModified: mtime(item) };
}

function emit() {
  // Powiadom shim useLiveQuery (lokalne zmiany nie generują SSE od backend, bo
  // SSE nadaje tylko zmiany z dysku — które też przyjdą, ale później).
  studioEvents._dispatch("local", { data: null });
}

class WhereClause {
  constructor(adapter, field) {
    this.adapter = adapter;
    this.field = field;
  }

  equals(value) {
    return new EqualsClause(this.adapter, this.field, value);
  }
}

class EqualsClause {
  constructor(adapter, field, value) {
    this.adapter = adapter;
    this.field = field;
    this.value = value;
  }

  async first() {
    if (this.field === FIELD_DIAGRAM_ID) {
      try {
        return hydrate(await this.adapter.api.read(this.value));
      } catch {
        return undefined;
      }
    }
    // fallback: scan
    const list = await this.adapter.api.list();
    const found = list.find((it) => it[this.field] === this.value);
    if (!found) return undefined;
    return hydrate(await this.adapter.api.read(found.diagramId));
  }

  async modify(changes) {
    if (this.field !== FIELD_DIAGRAM_ID) {
      throw new Error(`storage-adapter: modify supports only ${FIELD_DIAGRAM_ID} filter`);
    }
    await this.adapter.api.patch(this.value, changes);
    emit();
    return 1;
  }

  async delete() {
    if (this.field !== FIELD_DIAGRAM_ID) {
      throw new Error(`storage-adapter: delete supports only ${FIELD_DIAGRAM_ID} filter`);
    }
    await this.adapter.api.remove(this.value);
    emit();
    return 1;
  }
}

class OrderByChain {
  constructor(adapter, field, { reversed = false, limit = null } = {}) {
    this.adapter = adapter;
    this.field = field;
    this.reversed = reversed;
    this.limitN = limit;
  }

  reverse() {
    return new OrderByChain(this.adapter, this.field, {
      reversed: !this.reversed,
      limit: this.limitN,
    });
  }

  limit(n) {
    return new OrderByChain(this.adapter, this.field, {
      reversed: this.reversed,
      limit: n,
    });
  }

  async toArray() {
    const list = (await this.adapter.api.list()).map(hydrate);
    list.sort((a, b) => {
      const av = a[this.field];
      const bv = b[this.field];
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    if (this.reversed) list.reverse();
    return this.limitN != null ? list.slice(0, this.limitN) : list;
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

class DiagramsTable {
  constructor(apiClient) {
    this.api = apiClient;
  }

  async toArray() {
    return (await this.api.list()).map(hydrate);
  }

  // Dexie .add() returns a Promise<id> ALE też zachowuje się jak thenable obiekt
  // pozwalający na .then(...) chaining. Returns string (slug).
  add(obj) {
    return this.api.create(obj).then((res) => {
      emit();
      return res.diagramId;
    });
  }

  async put(obj) {
    if (!obj.diagramId) throw new Error("storage-adapter: put requires diagramId");
    await this.api.write(obj.diagramId, obj);
    emit();
    return obj.diagramId;
  }

  async update(slug, changes) {
    await this.api.patch(slug, changes);
    emit();
    return 1;
  }

  async delete(slug) {
    await this.api.remove(slug);
    emit();
    return 1;
  }

  // Dexie .get(criteriaObject) — zwraca pierwszy match po indeksie.
  async get(criteria) {
    if (typeof criteria === "string") {
      // .get(slug) variant
      try {
        return hydrate(await this.api.read(criteria));
      } catch {
        return undefined;
      }
    }
    const [field, value] = Object.entries(criteria)[0];
    return new EqualsClause(this, field, value).first();
  }

  where(field) {
    return new WhereClause(this, field);
  }

  orderBy(field) {
    return new OrderByChain(this, field);
  }

  async each(fn) {
    const list = await this.toArray();
    for (const item of list) {
      await fn(item);
    }
  }

  async clear() {
    const list = await this.api.list();
    for (const item of list) {
      await this.api.remove(item.diagramId);
    }
    emit();
  }

  // Dexie hooks API — no-op w studio mode (Workspace.jsx nie używa, ale src/data/db.js
  // installuje hook przy populate — patrz `db.on('populate')` tam).
  hook() { /* no-op */ }
}

export function makeDiagramsAdapter() {
  return new DiagramsTable(getApiClient());
}
