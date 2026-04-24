import { useEffect } from "react";
import { useSelect } from "../../hooks";

// [studio-ux] Enter zamyka panel edycji (SideSheet lub rozwinięty Collapse
// w sidebarze) otwarty dwuklikiem na element kanwy. Uruchamia się po formNav.js
// (który robi blur focusowanego Inputa w capture phase) — dzięki temu wartość
// zostaje scommitowana zanim panel się zamknie.
// Opt-out dla komponentów Semi, które mają własną semantykę Enter.

const OPT_OUT_SELECTOR = [
  ".semi-select",
  ".semi-tagInput",
  ".semi-autoComplete",
  ".semi-cascader",
  ".semi-datePicker",
  ".semi-timePicker",
].join(",");

export default function StudioFormNav() {
  const { selectedElement, setSelectedElement } = useSelect();

  useEffect(() => {
    const handler = (e) => {
      if (e.key !== "Enter") return;
      if (e.shiftKey) return;
      if (!selectedElement.open) return;

      const el = e.target;
      if (el instanceof HTMLElement && el.closest(OPT_OUT_SELECTOR)) return;

      setSelectedElement((prev) => ({ ...prev, open: false }));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedElement.open, setSelectedElement]);

  return null;
}
