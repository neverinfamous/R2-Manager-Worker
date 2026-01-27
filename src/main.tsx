import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/themes.css";
import "./app.css";
import "./styles/filters.css";
import FileManager from "./app.tsx";
import { ThemeProvider } from "./contexts/ThemeContext";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("Root element not found");
}
createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <FileManager />
    </ThemeProvider>
  </StrictMode>,
);
