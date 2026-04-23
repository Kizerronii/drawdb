import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useLayoutEffect } from "react";
import Editor from "./pages/Editor";
import BugReport from "./pages/BugReport";
import Templates from "./pages/Templates";
import LandingPage from "./pages/LandingPage";
import StudioLauncher from "./studio/Launcher";
import SettingsContextProvider from "./context/SettingsContext";
import NotFound from "./pages/NotFound";

const STUDIO_MODE = import.meta.env.VITE_STUDIO_MODE === "true";

export default function App() {
  return (
    <SettingsContextProvider>
      <BrowserRouter>
        <RestoreScroll />
        <Routes>
          <Route path="/" element={STUDIO_MODE ? <StudioLauncher /> : <LandingPage />} />
          <Route path="/editor" element={<Editor />} />
          <Route path="/editor/diagrams/:id" element={<Editor />} />
          <Route path="/editor/templates/:id" element={<Editor />} />
          <Route path="/bug-report" element={<BugReport />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </SettingsContextProvider>
  );
}

function RestoreScroll() {
  const location = useLocation();
  useLayoutEffect(() => {
    window.scroll(0, 0);
  }, [location.pathname]);
  return null;
}
