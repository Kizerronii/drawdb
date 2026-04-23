// HTTP + SSE klient dla studio backend (studio/api/server.js).
// Działa w przeglądarce (fetch + EventSource).

const DEFAULT_BASE = "http://localhost:3001";

class StudioEvents {
  constructor() {
    this.listeners = new Set();
    this.es = null;
    this.lastEventAt = 0;
  }

  start(baseUrl) {
    if (this.es) return;
    const url = `${baseUrl.replace(/\/$/, "")}/api/events`;
    try {
      this.es = new EventSource(url);
      this.es.onmessage = (e) => this._dispatch("message", e);
      this.es.addEventListener("add", (e) => this._dispatch("add", e));
      this.es.addEventListener("change", (e) => this._dispatch("change", e));
      this.es.addEventListener("unlink", (e) => this._dispatch("unlink", e));
      this.es.onerror = (err) => {
        // EventSource auto-reconnects; just log.
        console.warn("[studio] SSE error", err);
      };
    } catch (err) {
      console.warn("[studio] SSE unavailable", err);
    }
  }

  _dispatch(type, event) {
    this.lastEventAt = Date.now();
    let data = null;
    try {
      data = event.data ? JSON.parse(event.data) : null;
    } catch {
      data = event.data;
    }
    for (const fn of this.listeners) {
      try {
        fn({ type, data });
      } catch (err) {
        console.error("[studio] listener error", err);
      }
    }
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const studioEvents = new StudioEvents();

export class ApiClient {
  constructor(baseUrl = DEFAULT_BASE) {
    this.base = baseUrl.replace(/\/$/, "");
  }

  async _req(method, path, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers["content-type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${this.base}${path}`, opts);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`API ${method} ${path} → ${res.status}: ${text}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  list() {
    return this._req("GET", "/api/projects");
  }

  read(slug) {
    return this._req("GET", `/api/projects/${encodeURIComponent(slug)}`);
  }

  create(data) {
    return this._req("POST", "/api/projects", data);
  }

  write(slug, data) {
    return this._req("PUT", `/api/projects/${encodeURIComponent(slug)}`, data);
  }

  patch(slug, changes) {
    return this._req("PATCH", `/api/projects/${encodeURIComponent(slug)}`, changes);
  }

  remove(slug) {
    return this._req("DELETE", `/api/projects/${encodeURIComponent(slug)}`);
  }
}

let _client = null;
export function getApiClient() {
  if (!_client) {
    _client = new ApiClient(import.meta.env.VITE_API_URL || DEFAULT_BASE);
    studioEvents.start(_client.base);
  }
  return _client;
}
