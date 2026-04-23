import Dexie from "dexie";
import { templateSeeds } from "./seeds";

export const db = new Dexie("drawDB");

db.version(67)
  .stores({
    diagrams: "++id, lastModified, loadedFromGistId, diagramId",
    templates: "++id, custom, templateId",
  })
  .upgrade(async (tx) => {
    await tx.diagrams.toCollection().modify((diagram) => {
      if (!diagram.diagramId) {
        diagram.diagramId = crypto.randomUUID();
      }
    });
    await tx.templates.toCollection().modify((template) => {
      if (!template.templateId) {
        template.templateId = crypto.randomUUID();
      }
    });
  });

db.on("populate", (transaction) => {
  transaction.templates.bulkAdd(templateSeeds).catch((e) => console.log(e));
});

// === STUDIO MODE === (poza upstream — patrz studio/api, src/studio/)
// Zastępuje db.diagrams HTTP-backed adapterem nad ~/drawdb-projects/*.drawdb.json.
// db.templates zostaje w Dexie (statyczne seedy).
// Statyczny import: gdy VITE_STUDIO_MODE !== 'true', Vite tree-shake'uje całość
// (define inlines flag → if(false) → dead code elimination).
import { makeDiagramsAdapter } from "../studio/storage-adapter";
if (import.meta.env.VITE_STUDIO_MODE === "true") {
  db.diagrams = makeDiagramsAdapter();
}
