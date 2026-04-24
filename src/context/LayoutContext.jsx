import { createContext, useState } from "react";

const readStoredReadOnly = () => {
  try {
    const s = JSON.parse(localStorage.getItem("settings") || "{}");
    return s.readOnly === true;
  } catch {
    return false;
  }
};

export const LayoutContext = createContext(null);

export default function LayoutContextProvider({ children }) {
  const [layout, setLayout] = useState({
    header: true,
    sidebar: true,
    issues: true,
    toolbar: true,
    dbmlEditor: false,
    readOnly: readStoredReadOnly(),
  });

  return (
    <LayoutContext.Provider value={{ layout, setLayout }}>
      {children}
    </LayoutContext.Provider>
  );
}
