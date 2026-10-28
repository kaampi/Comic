import React from "react";
import { installDiagnostics } from "./diagnostics";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import "./panelEditorOverrides.css";
import "./typography.css";
import "./adaptation.css";
import "./formTheme.css";
import "./stylePreviews.css";
import "./localAi.css";
import "./albumExport.css";
import "./fontPicker.css";
import "./panelShape.css";
import "./panelEditorWorkspace.css";

installDiagnostics();

const root = document.getElementById("root");
if (!root) throw new Error("kaampi Comic kunde inte hitta appens rot.");

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);



