import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./panelEditorOverrides.css";
import "./typography.css";
import "./adaptation.css";
import "./formTheme.css";

const root = document.getElementById("root");
if (!root) throw new Error("ComicBook AI kunde inte hitta appens rot.");

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);