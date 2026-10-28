import assert from "node:assert/strict";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import { JSDOM } from "jsdom";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(join(root, ".about-test-"));
const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost:5176/" });
for (const key of ["window", "document", "navigator", "localStorage", "HTMLElement", "Node", "Event", "MouseEvent"]) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let networkRequests = 0;
globalThis.fetch = async () => { networkRequests++; throw new Error("offline"); };
symlinkSync(join(root, "node_modules"), join(temporary, "node_modules"), process.platform === "win32" ? "junction" : "dir");

function compile(directory = "") {
  for (const entry of readdirSync(join(root, "src", directory), { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) { compile(path); continue; }
    if (!/\.tsx?$/.test(entry.name) || entry.name === "main.tsx") continue;
    const output = ts.transpileModule(readFileSync(join(root, "src", path), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText.replace(/import "[^"\n]+\.css";?/g, "").replace(/from "(\.[^"]+)"/g, (_, imported) => {
      if (imported.endsWith(".json")) return 'from "' + pathToFileURL(resolve(root, "src", dirname(path), imported)) + '" with { type: "json" }';
      return 'from "' + imported + '.mjs"';
    });
    mkdirSync(join(temporary, directory), { recursive: true });
    writeFileSync(join(temporary, path.replace(/\.tsx?$/, ".mjs")), output);
  }
}

try {
  compile();
  const React = await import("react");
  const { render, screen, within, cleanup } = await import("@testing-library/react");
  const { default: userEvent } = await import("@testing-library/user-event");
  const { App } = await import(pathToFileURL(join(temporary, "App.mjs")));
  const { FONT_NOTICES } = await import(pathToFileURL(join(temporary, "fontNotices.mjs")));
  const { OVERLAY_FONTS } = await import(pathToFileURL(join(temporary, "overlayTypography.mjs")));
  const packageInfo = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(FONT_NOTICES.length, 15);
  for (const font of OVERLAY_FONTS.map(font => font.split(",")[0])) {
    if (!["Action Man", "Impact"].includes(font)) assert.ok(FONT_NOTICES.some(notice => notice.name === font), font);
  }
  for (const notice of FONT_NOTICES) {
    assert.ok(notice.designer && notice.url.startsWith("https://fonts.google.com/specimen/"));
    assert.ok(notice.licenseText.includes(notice.license.startsWith("Apache") ? "TERMS AND CONDITIONS" : "SIL OPEN FONT LICENSE"));
  }
  for (const [locale, project, title, close] of [
    ["sv", "Projekt", "Om kaampi Comic", "Stäng"],
    ["en", "Project", "About kaampi Comic", "Close"],
    ["nb", "Prosjekt", "Om kaampi Comic", "Lukk"],
  ]) {
    localStorage.clear();
    localStorage.setItem("comicbook-ai.locale", locale);
    const user = userEvent.setup({ document });
    render(React.createElement(App));
    const trigger = screen.getByRole("button", { name: project, exact: true });
    await user.click(trigger);
    const menu = screen.getByRole("menu");
    assert.equal(within(menu).getAllByRole("menuitem").at(-1).textContent, title);
    await user.click(within(menu).getByRole("menuitem", { name: title }));
    assert.equal(screen.queryByRole("menu"), null);
    const dialog = screen.getByRole("dialog", { name: title });
    assert.ok(dialog.textContent.includes(packageInfo.version));
    const loggingButton = within(dialog).getByRole("button", { name: locale === "sv" ? "Slå på diagnostiklogg" : locale === "nb" ? "Slå på diagnostikk" : "Enable diagnostics logging" });
    assert.equal(loggingButton.getAttribute("aria-pressed"), "false");
    await user.click(loggingButton);
    assert.equal(loggingButton.getAttribute("aria-pressed"), "true");
    assert.equal(localStorage.getItem("comicbook-ai.diagnostics.enabled"), "1");
    await user.click(loggingButton);
    assert.equal(loggingButton.getAttribute("aria-pressed"), "false");
    assert.ok(within(dialog).getByRole("button", { name: locale === "sv" ? "Hämta diagnostiklogg" : locale === "nb" ? "Last ned diagnostikklogg" : "Download diagnostic log" }));
    assert.equal(within(dialog).getAllByRole("link", { name: "Google Fonts ↗" }).length, 15);
    assert.equal(dialog.querySelectorAll("details").length, 15);
    const details = dialog.querySelector("details");
    await user.click(details.querySelector("summary"));
    assert.equal(details.open, true);
    assert.ok(details.querySelector("pre").textContent.includes("SIL OPEN FONT LICENSE"));
    const closeButton = within(dialog).getByRole("button", { name: close, exact: true });
    closeButton.focus();
    await user.keyboard("{Shift>}{Tab}{/Shift}");
    const lastLink = within(dialog).getAllByRole("link").at(-1);
    assert.equal(document.activeElement, lastLink);
    await user.keyboard("{Tab}");
    assert.equal(document.activeElement, closeButton);
    await user.keyboard("{Escape}");
    assert.equal(screen.queryByRole("dialog"), null);
    assert.equal(document.activeElement, trigger);
    await user.click(trigger);
    await user.click(screen.getByRole("menuitem", { name: title }));
    await user.click(screen.getByRole("button", { name: close, exact: true }));
    assert.equal(screen.queryByRole("dialog"), null);
    cleanup();
  }
  assert.equal(networkRequests, 0);
  console.log("PASS: About menu, 15 bundled font notices, offline licenses, three languages and keyboard focus");
} finally {
  rmSync(temporary, { recursive: true, force: true });
  dom.window.close();
}

