// CRUD nad tabelą db.recentFiles dla trybu FSA (File System Access API).
// File handles są strukturalnie klonowalne — IndexedDB persistuje je między sesjami.
//
// Format entry:
//   { id, handle: FileSystemFileHandle, name, fileName, lastOpened: Date, database }
//
// `name` = nazwa diagramu z JSON-a (user-editable w UI),
// `fileName` = handle.name (nazwa pliku na dysku),
// dedup po handle.isSameEntry() — porównanie po identyczności zasobu, nie po stringu.

import { db } from "../data/db";
import { studioEvents } from "./api-client";

function emit() {
  studioEvents._dispatch("local", { data: null });
}

// Upsert: jeśli istnieje wpis dla tego samego pliku, podmień metadata + lastOpened.
// W przeciwnym razie dodaj nowy.
export async function addOrUpdateRecent({ handle, name, database }) {
  const all = await db.recentFiles.toArray();
  for (const entry of all) {
    try {
      if (await entry.handle.isSameEntry(handle)) {
        await db.recentFiles.update(entry.id, {
          handle, // re-store, w razie gdyby browser invalidował poprzedni
          name: name ?? entry.name,
          fileName: handle.name,
          lastOpened: new Date(),
          database: database ?? entry.database,
        });
        emit();
        return entry.id;
      }
    } catch {
      // isSameEntry rzuca jeśli handle stale (np. plik usunięty); pomiń ten wpis
    }
  }
  const id = await db.recentFiles.add({
    handle,
    name: name ?? handle.name.replace(/\.drawdb\.json$/i, ""),
    fileName: handle.name,
    lastOpened: new Date(),
    database: database ?? "generic",
  });
  emit();
  return id;
}

export async function listRecent(limit = 10) {
  return db.recentFiles.orderBy("lastOpened").reverse().limit(limit).toArray();
}

export async function removeRecent(id) {
  await db.recentFiles.delete(id);
  emit();
}

// queryPermission + opcjonalnie requestPermission. Wymaga user gesture dla request.
// Returns: 'granted' | 'denied' | 'prompt' (przy initial query bez request).
export async function checkPermission(handle, mode = "readwrite") {
  if (!handle?.queryPermission) return "denied";
  return await handle.queryPermission({ mode });
}

// Wywołać tylko z user gesture (click handler).
export async function ensurePermission(handle, mode = "readwrite") {
  const status = await checkPermission(handle, mode);
  if (status === "granted") return true;
  if (!handle?.requestPermission) return false;
  const requested = await handle.requestPermission({ mode });
  return requested === "granted";
}
