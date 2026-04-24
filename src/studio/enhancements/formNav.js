// [studio-ux] Globalny handler Enter-to-commit dla wszystkich <input>/<textarea>
// w aplikacji. Enter → blur (odpala istniejący onBlur → undo stack),
// tj. zatwierdza wartość i wychodzi z edycji.
// Shift+Enter w <textarea> pozostawiamy natywne (nowa linia).
// Opt-out dla komponentów Semi, które mają własną semantykę Enter.

const OPT_OUT_SELECTOR = [
  ".semi-select",
  ".semi-tagInput",
  ".semi-autoComplete",
  ".semi-cascader",
  ".semi-datePicker",
  ".semi-timePicker",
].join(",");

function onKeyDown(e) {
  if (e.key !== "Enter") return;

  const el = e.target;
  if (!el || !(el instanceof HTMLElement)) return;

  const tag = el.tagName;
  if (tag !== "INPUT" && tag !== "TEXTAREA") return;

  if (el.closest(OPT_OUT_SELECTOR)) return;

  if (tag === "TEXTAREA" && e.shiftKey) return;

  e.preventDefault();
  el.blur();
}

export function installFormNav() {
  if (typeof window === "undefined") return;
  if (window.__studioFormNavInstalled) return;
  window.__studioFormNavInstalled = true;
  document.addEventListener("keydown", onKeyDown, true);
}
