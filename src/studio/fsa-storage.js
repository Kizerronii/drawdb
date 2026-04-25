// File System Access API layer dla studio mode (FSA storage).
// Pojedynczy diagram = jeden plik *.drawdb.json na dysku użytkownika.
//
// Dwa stany:
//   1. In-memory session — sessionId → { handle, name, dirty, lastSavedAt, data }
//      Sesja żyje od openFile/saveFileAs/createBlank do reload (F5) lub close.
//   2. Persisted recent — w IndexedDB (recent-files.js), serializuje handles
//      między sesjami przeglądarki.
//
// Routing: /editor/diagrams/:sessionId — sessionId jest UUID per session.
// Reload czyści in-memory map, więc routing musi obsłużyć "stale sessionId".

import { addOrUpdateRecent, ensurePermission } from "./recent-files";

const FILE_EXT = ".drawdb.json";
const PICKER_TYPES = [
  {
    description: "drawDB diagram",
    accept: { "application/json": [".drawdb.json", ".json"] },
  },
];

class Sessions {
  constructor() {
    this.map = new Map();
  }

  create({ sessionId, handle = null, name = "Untitled", database = "generic", data = null } = {}) {
    const id = sessionId ?? crypto.randomUUID();
    this.map.set(id, {
      handle,
      name,
      database,
      dirty: handle == null,
      lastSavedAt: handle ? new Date() : null,
      data,
    });
    return id;
  }

  get(sessionId) {
    return this.map.get(sessionId) ?? null;
  }

  has(sessionId) {
    return this.map.has(sessionId);
  }

  update(sessionId, patch) {
    const cur = this.map.get(sessionId);
    if (!cur) return null;
    const next = { ...cur, ...patch };
    this.map.set(sessionId, next);
    return next;
  }

  setHandle(sessionId, handle) {
    return this.update(sessionId, {
      handle,
      lastSavedAt: new Date(),
      dirty: false,
    });
  }

  markDirty(sessionId) {
    return this.update(sessionId, { dirty: true });
  }

  markSaved(sessionId) {
    return this.update(sessionId, { dirty: false, lastSavedAt: new Date() });
  }

  close(sessionId) {
    this.map.delete(sessionId);
  }
}

const sessions = new Sessions();

export const fsaSessions = sessions;

export function isFSASupported() {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}

// Otwiera dialog wyboru pliku, czyta jego zawartość i tworzy session.
// Zwraca: { sessionId, data } albo null jeśli user anulował.
export async function openFile() {
  if (!isFSASupported()) {
    throw new Error("File System Access API niedostępne — wymagana przeglądarka Chromium-based.");
  }
  let handles;
  try {
    handles = await window.showOpenFilePicker({
      types: PICKER_TYPES,
      multiple: false,
      excludeAcceptAllOption: false,
    });
  } catch (err) {
    if (err?.name === "AbortError") return null;
    throw err;
  }
  const [handle] = handles;
  const data = await readHandle(handle);
  const sessionId = sessions.create({
    handle,
    name: data?.name ?? handle.name.replace(/\.drawdb\.json$/i, ""),
    database: data?.database ?? "generic",
    data,
  });
  await addOrUpdateRecent({ handle, name: data?.name, database: data?.database });
  return { sessionId, data };
}

// Save As: dialog wyboru lokalizacji + pierwszy zapis. Wymaga user gesture.
// Zwraca: { sessionId, handle } albo null jeśli user anulował.
export async function saveFileAs(sessionId, data) {
  if (!isFSASupported()) {
    throw new Error("File System Access API niedostępne — wymagana przeglądarka Chromium-based.");
  }
  const session = sessions.get(sessionId);
  const suggestedName = `${(data?.name ?? session?.name ?? "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled"}${FILE_EXT}`;

  let handle;
  try {
    handle = await window.showSaveFilePicker({
      suggestedName,
      types: PICKER_TYPES,
      excludeAcceptAllOption: false,
    });
  } catch (err) {
    if (err?.name === "AbortError") return null;
    throw err;
  }
  await writeHandle(handle, data);
  if (session) {
    sessions.setHandle(sessionId, handle);
    sessions.update(sessionId, {
      name: data?.name ?? session.name,
      database: data?.database ?? session.database,
      data,
    });
  }
  await addOrUpdateRecent({
    handle,
    name: data?.name,
    database: data?.database,
  });
  return { sessionId, handle };
}

// Zapis do otwartej sesji (autosave / Ctrl+S). Cicho no-op jeśli brak handle.
export async function writeSession(sessionId, data) {
  const session = sessions.get(sessionId);
  if (!session?.handle) return false;
  const granted = await ensurePermission(session.handle, "readwrite");
  if (!granted) {
    throw new Error("Brak uprawnień do zapisu pliku — spróbuj ponownie i zaakceptuj prompt.");
  }
  await writeHandle(session.handle, data);
  sessions.update(sessionId, {
    name: data?.name ?? session.name,
    database: data?.database ?? session.database,
    data,
    dirty: false,
    lastSavedAt: new Date(),
  });
  await addOrUpdateRecent({
    handle: session.handle,
    name: data?.name ?? session.name,
    database: data?.database ?? session.database,
  });
  return true;
}

// Otwiera sesję na podstawie zapisanego handle (z recent files).
// Wymaga user gesture (klik), bo ensurePermission może wywołać requestPermission.
export async function openFromHandle(handle) {
  const granted = await ensurePermission(handle, "readwrite");
  if (!granted) return null;
  const data = await readHandle(handle);
  const sessionId = sessions.create({
    handle,
    name: data?.name ?? handle.name.replace(/\.drawdb\.json$/i, ""),
    database: data?.database ?? "generic",
    data,
  });
  await addOrUpdateRecent({ handle, name: data?.name, database: data?.database });
  return { sessionId, data };
}

// Tworzy untitled session bez handle. Pierwszy zapis triggeruje Save As.
export function createBlank({ name = "Untitled", database = "generic", data = null } = {}) {
  return sessions.create({ name, database, data });
}

async function readHandle(handle) {
  const file = await handle.getFile();
  const text = await file.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Plik ${handle.name} nie jest poprawnym JSON-em: ${err.message}`);
  }
}

async function writeHandle(handle, data) {
  const writable = await handle.createWritable();
  try {
    await writable.write(JSON.stringify(data, null, 2));
  } finally {
    await writable.close();
  }
}
