<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/logo-dark.png">
    <img src="public/logo.png" alt="kaampi Comic" width="420">
  </picture>
</p>

<p align="center">A local-first comic creation tool. Shape the story, compose the page, make it yours.</p>

kaampi Comic turns literary text into illustrated comics — from a manuscript and visual beats to panel layouts, images, dialogue, and finished pages. Start with your own text or import a kaampi Write export, bring your own pictures or generate them with AI, and keep control of the script and page.

**Your albums stay local.** Manuscripts, reference images, and artwork are stored on your computer. Editing and export work offline once the album's resources are available locally. AI is optional: text and image models are chosen separately, and generation may use local servers or cloud services. Importing or editing a manuscript never automatically sends it to AI.

**Status:** a working prototype with a Tauri desktop shell. Windows installation and desktop workflows still need verification; see [Desktop setup](DESKTOP.md) for the current build status.

## What's inside

- **Manuscript → Beats → Storyboard → Images → Pages** — adapt prose into visual moments, edit the script, and connect panels to the story. Select manuscript text to create beats yourself or ask a local text model for suggestions.
- **Characters and image prompts** — keep reference images and editable prompts alongside the artwork, with a library of visual styles.
- **Page composition** — choose page formats, margins, and panel spacing; move and resize panels, edit their contours, and fit neighbouring angled panels together.
- **Images and layers** — upload artwork, adjust cropping and zoom, add page backgrounds and foreground images, and keep unused panels in a panel pool.
- **Dialogue and typography** — edit speech and thought bubbles, captions, tails, connections, and sound effects. Mix fonts, sizes, and weights within a text area.
- **Backup and recovery** — local album storage in IndexedDB, recovery points, and downloadable album backups. Browser and desktop installations have separate storage; use backup and restore to move albums between them.
- **Export** — PDF, PNG, and JPEG reading copies, with page selection and resolution settings. IDML export (beta) packages editable text, vector bubble shapes, and linked images for further layout work.

IDML still needs import testing in InDesign and Affinity. Text and bubbles extending beyond a panel are not yet clipped to its contour in IDML. Print bleed, CMYK, CBZ, and EPUB are not included.

See the [getting started guide](docs/GETTING_STARTED.md) for a first page with your own pictures — no AI setup required — and the [feature reference](docs/FEATURE_REFERENCE.md) for detailed layout and export instructions.

## The kaampi family

kaampi Comic is one of four sibling apps:

- **[kaampi Write](https://github.com/kaampi/Write)** — long-form prose
- **[kaampi Comic](https://github.com/kaampi/Comic)** (this app) — comic scripting and panel layout
- **[kaampi Explore](https://github.com/kaampi/Explore)** — tabletop campaign sandbox
- **[kaampi Codex](https://github.com/kaampi/Codex)** — local Story Bible sharing and sync for supported sibling apps

Each app is independent. Comic currently imports user-selected kaampi Write / StoryBook export files as a separate copy. It never changes Write's files, settings, or source data. Direct Codex pairing is not documented as a supported Comic workflow.

## Quickstart

**Run in a browser from source:**

```bash
npm install
npm run dev
```

**Run the desktop development app** after installing the Windows prerequisites in [DESKTOP.md](DESKTOP.md):

```bash
npm install
npm run desktop:dev
```

Tauri starts the development server on port 5176. Stop an existing web development server before starting the desktop command. To build a Windows installer, run `npm run desktop:build`.

Existing browser albums do not appear automatically in the desktop app. Create an album backup in the browser, restore it in the desktop app, and check its contents before continuing.

For optional local text AI, see [Local AI](LOCAL_AI.md) for Ollama and OpenAI-compatible servers such as LM Studio or llama.cpp.

## Documentation

- [Getting started](docs/GETTING_STARTED.md) — create a first page, add dialogue, back up, and export
- [Desktop setup](DESKTOP.md) — Windows prerequisites, development, installer builds, and moving albums
- [Local AI](LOCAL_AI.md) — connect a local text model and propose beats
- [Page layout](PAGE_LAYOUT.md) — panel geometry, contours, and placement
- [Feature reference](docs/FEATURE_REFERENCE.md) — detailed image, typography, storage, and export instructions
- [Current tasks](TODO.md) — completed work, verification, and next steps
- [Project specification](PROJECT_SPEC.md) — product scope, architecture, and data model
- [Repository rules](AGENTS.md) — guidance for contributors

## Development checks

Run `npm run typecheck` and `npm run build`. Feature checks are listed in `package.json`, including `npm run test:export`, `npm run test:idml`, and `npm run test:project-storage`. Desktop verification is tracked separately in [DESKTOP.md](DESKTOP.md).
