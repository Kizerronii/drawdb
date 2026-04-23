// Vite alias mapping kieruje `dexie-react-hooks` import → ten plik (tylko w mode=studio).
// W upstream mode Vite ładuje real package z node_modules.
//
// Po co shim: storage-adapter.js zastępuje db.diagrams własną implementacją (HTTP),
// a real useLiveQuery subskrybuje TYLKO Dexie internal events. W studio mode
// db.diagrams nie ma tych eventów, więc lista nie odświeża się reactive.
//
// Shim: re-runs query() na initial mount + na każdy studioEvents.dispatch.
// Templates (db.templates) zostają w Dexie — query'na nim też re-runs przy SSE,
// ale to bezpieczne (templates są statyczne seedy).

import { useEffect, useState } from "react";
import { studioEvents } from "./api-client.js";

export function useLiveQuery(queryFn, deps = [], defaultResult = undefined) {
  const [result, setResult] = useState(defaultResult);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const r = await queryFn();
        if (!cancelled) setResult(r);
      } catch (err) {
        console.error("[studio] useLiveQuery error", err);
      }
    };
    run();
    const unsub = studioEvents.subscribe(run);
    return () => {
      cancelled = true;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return result;
}

// Real package eksportuje też useObservable, usePermissions — drawdb ich nie używa
// (zweryfikowane grep'em). Re-export omijamy żeby nie tworzyć circular alias.
// Jeśli upstream w przyszłości zaimportuje te symbole, dopisz je tu z osobnym
// alias path (np. resolveDexieRealPackage).
