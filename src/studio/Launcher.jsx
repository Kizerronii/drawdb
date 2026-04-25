import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Button,
  Modal,
  Input,
  Empty,
  Toast,
  Spin,
  Banner,
} from "@douyinfe/semi-ui";
import {
  IconPlus,
  IconFolder,
  IconGithubLogo,
  IconFile,
} from "@douyinfe/semi-icons";
import { db } from "../data/db";
import { databases } from "../data/databases";
import { DB } from "../data/constants";
import { useSettings } from "../hooks";
import Thumbnail from "../components/Thumbnail";
import { Tag } from "@douyinfe/semi-ui";
import {
  isFSAMode,
  isFSASupported,
  openFile as fsaOpenFile,
  openFromHandle,
} from "./fsa-storage";
import { listRecent, removeRecent } from "./recent-files";

const BLANK_DIAGRAM = {
  tables: [],
  references: [],
  notes: [],
  areas: [],
  pan: { x: 0, y: 0 },
  zoom: 1,
};

function relativeTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "przed chwilą";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min temu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} godz. temu`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} dni temu`;
  return d.toLocaleDateString();
}

export default function Launcher() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  // FSA mode → recent files persistowane w db.recentFiles (handle + metadata).
  // Legacy api mode → lista projektów z db.diagrams.
  const fsaMode = isFSAMode();
  const projects = useLiveQuery(
    () => (fsaMode ? listRecent(50) : db.diagrams.toArray()),
    [fsaMode],
    [],
  );
  const templates = useLiveQuery(() => db.templates.toArray(), [], []);

  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDb, setNewDb] = useState(DB.GENERIC);

  useEffect(() => {
    document.title = "drawDB studio";
    document.body.setAttribute("theme-mode", settings.mode || "light");
  }, [settings.mode]);

  const createBlank = async (name, database) => {
    setCreating(true);
    try {
      const dbMeta = databases[database];
      const slug = await db.diagrams.add({
        ...BLANK_DIAGRAM,
        database,
        name: name || "Untitled",
        lastModified: new Date(),
        ...(dbMeta?.hasEnums && { enums: [] }),
        ...(dbMeta?.hasTypes && { types: [] }),
      });
      navigate(`/editor/diagrams/${slug}`);
    } catch (err) {
      Toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  // FSA: otwarcie dowolnego pliku z dysku przez file picker (showOpenFilePicker).
  const handleOpenFile = async () => {
    if (!isFSASupported()) {
      Toast.error("Wymagana przeglądarka Chromium (File System Access API).");
      return;
    }
    try {
      const result = await fsaOpenFile();
      if (!result) return; // user anulował
      navigate(`/editor/diagrams/${result.sessionId}`);
    } catch (err) {
      Toast.error(`Błąd otwarcia: ${err.message}`);
    }
  };

  // FSA: otwarcie z recent — wymaga user gesture dla requestPermission, dlatego tu.
  const openRecent = async (entry) => {
    try {
      const result = await openFromHandle(entry.handle);
      if (!result) {
        Toast.warning(
          "Brak uprawnień do pliku — kliknij ponownie i zaakceptuj prompt przeglądarki.",
        );
        return;
      }
      navigate(`/editor/diagrams/${result.sessionId}`);
    } catch (err) {
      // NotFoundError = plik usunięty z dysku
      if (err?.name === "NotFoundError") {
        Toast.warning(`Plik "${entry.fileName}" nie istnieje na dysku.`);
        await removeRecent(entry.id);
        return;
      }
      Toast.error(`Błąd: ${err.message}`);
    }
  };

  const createFromTemplate = async (template) => {
    setCreating(true);
    setShowTemplates(false);
    try {
      const slug = await db.diagrams.add({
        name: template.title || "Untitled",
        database: template.database || "generic",
        tables: template.tables || [],
        references: template.relationships || [],
        notes: template.notes || [],
        areas: template.subjectAreas || [],
        pan: { x: 0, y: 0 },
        zoom: 1,
        ...(template.types && { types: template.types }),
        ...(template.enums && { enums: template.enums }),
        lastModified: new Date(),
      });
      navigate(`/editor/diagrams/${slug}`);
    } catch (err) {
      Toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{
        background:
          settings.mode === "dark" ? "#1a1a1a" : "#f4f4f5",
        color: settings.mode === "dark" ? "#e4e4e7" : "#18181b",
      }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <img src="/favicon.ico" alt="" className="w-7 h-7" />
          <div>
            <div className="text-lg font-semibold">drawDB studio</div>
            <div className="text-xs text-zinc-500">
              {fsaMode
                ? "pliki: dowolna lokalizacja na dysku"
                : "workspace: ~/drawdb-projects"}
            </div>
          </div>
        </div>
        <a
          href="https://github.com/Kizerronii/drawdb"
          target="_blank"
          rel="noreferrer"
          className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          title="GitHub"
        >
          <IconGithubLogo size="large" />
        </a>
      </header>

      {/* Banner gdy FSA niedostępne (np. Firefox) */}
      {fsaMode && !isFSASupported() && (
        <Banner
          fullMode={false}
          type="warning"
          icon={null}
          closeIcon={null}
          description={
            <div className="text-sm">
              Twoja przeglądarka nie obsługuje File System Access API. Otwieranie
              i zapisywanie plików nie zadziała. Użyj{" "}
              <strong>Chromium</strong>, <strong>Chrome</strong> lub{" "}
              <strong>Edge</strong>, najlepiej przez{" "}
              <code>drawdb launch</code> (app mode).
            </div>
          }
        />
      )}

      {/* Body: 2 columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: actions */}
        <aside
          className="w-72 flex flex-col gap-2 p-6 border-r border-zinc-200 dark:border-zinc-800"
        >
          <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">
            Start
          </div>
          <Button
            theme="solid"
            type="primary"
            icon={<IconPlus />}
            onClick={() => {
              setNewName("");
              setShowNew(true);
            }}
            block
            size="large"
            className="!justify-start"
          >
            Nowy pusty diagram
          </Button>
          <Button
            icon={<IconFolder />}
            onClick={() => setShowTemplates(true)}
            block
            size="large"
            className="!justify-start"
          >
            Z szablonu
          </Button>
          {fsaMode && (
            <Button
              icon={<IconFile />}
              onClick={handleOpenFile}
              block
              size="large"
              className="!justify-start"
            >
              Otwórz plik…
            </Button>
          )}

          <div className="mt-auto pt-4 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 space-y-1">
            {fsaMode ? (
              <>
                <div>Storage: File System Access API</div>
                <div>Każdy diagram = jeden plik <code>*.drawdb.json</code></div>
              </>
            ) : (
              <>
                <div>Pliki: <code>~/drawdb-projects/*.drawdb.json</code></div>
                <div>API: <code>localhost:3001</code></div>
              </>
            )}
          </div>
        </aside>

        {/* Right: recent */}
        <main className="flex-1 overflow-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Ostatnie projekty</h2>
            <span className="text-xs text-zinc-500">
              {projects?.length ?? 0} {projects?.length === 1 ? "projekt" : "projektów"}
            </span>
          </div>

          {projects === undefined ? (
            <div className="flex justify-center py-12">
              <Spin />
            </div>
          ) : projects.length === 0 ? (
            <Empty
              title={fsaMode ? "Brak ostatnio otwartych" : "Brak projektów"}
              description={
                <div className="text-sm text-zinc-500">
                  {fsaMode ? (
                    <>
                      Stwórz nowy diagram lub otwórz istniejący plik{" "}
                      <code>*.drawdb.json</code>.
                    </>
                  ) : (
                    <>
                      Zacznij od pustego diagramu lub wybierz szablon.
                      <br />
                      Pliki będą zapisywane w <code>~/drawdb-projects/</code>.
                    </>
                  )}
                </div>
              }
            />
          ) : fsaMode ? (
            <div className="grid gap-2">
              {[...projects]
                .sort(
                  (a, b) => new Date(b.lastOpened) - new Date(a.lastOpened),
                )
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => openRecent(p)}
                    className={`text-left flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      settings.mode === "dark"
                        ? "border-zinc-800 hover:bg-zinc-800/50"
                        : "border-zinc-200 hover:bg-white"
                    }`}
                  >
                    <IconFile size="extra-large" className="text-zinc-400" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-zinc-500">
                        {relativeTime(p.lastOpened)} ·{" "}
                        {databases[p.database]?.name ?? "Generic"}
                      </div>
                    </div>
                    <code className="text-xs text-zinc-400 hidden md:inline">
                      {p.fileName}
                    </code>
                  </button>
                ))}
            </div>
          ) : (
            <div className="grid gap-2">
              {[...projects]
                .sort(
                  (a, b) =>
                    new Date(b.lastModified) - new Date(a.lastModified),
                )
                .map((p) => (
                  <button
                    key={p.diagramId}
                    onClick={() => navigate(`/editor/diagrams/${p.diagramId}`)}
                    className={`text-left flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      settings.mode === "dark"
                        ? "border-zinc-800 hover:bg-zinc-800/50"
                        : "border-zinc-200 hover:bg-white"
                    }`}
                  >
                    <IconFile size="extra-large" className="text-zinc-400" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p.name}</div>
                      <div className="text-xs text-zinc-500">
                        {relativeTime(p.lastModified)} ·{" "}
                        {databases[p.database]?.name ?? "Generic"} ·{" "}
                        {Math.round(p.size / 102.4) / 10} KB
                      </div>
                    </div>
                    <code className="text-xs text-zinc-400 hidden md:inline">
                      {p.diagramId}.drawdb.json
                    </code>
                  </button>
                ))}
            </div>
          )}
        </main>
      </div>

      {/* New blank dialog */}
      <Modal
        title="Nowy pusty diagram"
        visible={showNew}
        onCancel={() => setShowNew(false)}
        onOk={() => {
          setShowNew(false);
          createBlank(newName, newDb);
        }}
        okText={creating ? "Tworzenie…" : "Utwórz"}
        confirmLoading={creating}
        cancelText="Anuluj"
        width={640}
      >
        <div className="space-y-4">
          <div>
            <div className="text-sm mb-1">Nazwa projektu:</div>
            <Input
              value={newName}
              onChange={setNewName}
              placeholder="np. Blog DB, Surf Manager"
              autoFocus
              onEnterPress={() => {
                if (creating) return;
                setShowNew(false);
                createBlank(newName, newDb);
              }}
            />
            <div className="text-xs text-zinc-500 mt-1">
              {fsaMode
                ? "Lokalizację pliku wybierzesz przy pierwszym zapisie (Ctrl+S)."
                : "Plik: "}
              {!fsaMode && (
                <code>~/drawdb-projects/&lt;slug&gt;.drawdb.json</code>
              )}
            </div>
          </div>

          <div>
            <div className="text-sm mb-2">Typ bazy danych:</div>
            <div className="grid grid-cols-3 gap-2">
              {Object.values(databases).map((x) => (
                <div
                  key={x.label}
                  onClick={() => setNewDb(x.label)}
                  className={`cursor-pointer p-3 rounded-md border-2 select-none transition-colors ${
                    settings.mode === "dark"
                      ? "bg-zinc-800 hover:bg-zinc-700"
                      : "bg-zinc-50 hover:bg-zinc-100"
                  } ${newDb === x.label ? "border-blue-500" : "border-transparent"}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm">{x.name}</div>
                    {x.beta && (
                      <Tag size="small" color="light-blue">
                        Beta
                      </Tag>
                    )}
                  </div>
                  {x.image && (
                    <img
                      src={x.image}
                      alt={x.name}
                      className="h-6 mt-2"
                      style={{
                        filter:
                          "opacity(0.5) drop-shadow(0 0 0 currentColor) drop-shadow(0 0 0 currentColor)",
                      }}
                    />
                  )}
                  {x.description && (
                    <div className="text-xs text-zinc-500 mt-1 line-clamp-2">
                      {x.description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Template picker */}
      <Modal
        title="Wybierz szablon"
        visible={showTemplates}
        onCancel={() => setShowTemplates(false)}
        footer={null}
        width={720}
      >
        <div className="grid grid-cols-3 gap-3 max-h-[60vh] overflow-auto pt-2">
          <div
            onClick={() => createFromTemplate({ title: "Untitled", database: "generic" })}
            className={`cursor-pointer rounded-md h-[180px] border-2 hover:border-blue-400 ${
              settings.mode === "dark" ? "border-zinc-700" : "border-zinc-300"
            } flex items-center justify-center`}
          >
            <div className="text-zinc-400">
              <IconPlus size="extra-large" />
              <div className="text-sm mt-2">Pusty</div>
            </div>
          </div>
          {(templates || []).map((tmpl) => (
            <div
              key={tmpl.templateId}
              onClick={() => createFromTemplate(tmpl)}
              className={`cursor-pointer rounded-md h-[180px] border-2 hover:border-blue-400 overflow-hidden ${
                settings.mode === "dark" ? "border-zinc-700" : "border-zinc-300"
              }`}
            >
              <Thumbnail
                i={tmpl.templateId}
                diagram={tmpl}
                zoom={0.24}
                theme={settings.mode}
              />
              <div className="text-center text-sm py-1 truncate px-2">
                {tmpl.title}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
