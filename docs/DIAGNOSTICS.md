# Diagnosing an intermittent crash

1. Update kaampi Comic and reload the app.
2. Open **Project → About kaampi Comic → Diagnostics**. This is available before opening an album.
3. Select **Enable diagnostics logging** and close the dialog.
4. Repeat the action that causes the problem, such as typing text or dragging in the color picker.
5. If the app crashes, reopen or reload it at the same address in the same browser.
6. Open Diagnostics again and select **Download diagnostic log**. Send `kaampi-comic-diagnostics.json` with a description of the action and any browser error code shown on the crashed tab.
7. Disable logging when you have finished testing.

The log records estimated serialized album sizes, serialization and database write durations, superseded save counts, input event counts, long tasks where supported, and JavaScript error types and application source locations. Every two seconds it records activity, timer intervals and JavaScript heap measurements where the browser supports them. Error messages and arbitrary rejected values are omitted because they may contain private content.

The log does not record manuscript text, field values, album names, images, prompts or API keys. The downloaded report includes the browser user agent. It is kept locally; nothing is uploaded automatically.

The log holds at most 160 events. It is written to browser storage every two seconds and on errors and visibility changes. The last moments before a browser-process crash may be missing. If storage is blocked or full, logging continues in memory but may not survive a reload. Browser crashes and out-of-memory termination do not necessarily produce a JavaScript error.

## Additional browser evidence

For a white screen or JavaScript failure, open browser developer tools with **F12** (or **Ctrl+Shift+I**; **Command+Option+I** on macOS), choose **Console**, and enable **Preserve log** before reproducing the problem. Copy the red error and its stack trace. Review console output before sharing: it can contain information from browser extensions or other code that is outside this diagnostic logger.

In Chrome or Edge, the browser task manager (**Shift+Esc**) can help show whether the app tab's memory usage keeps rising while typing or dragging. Report the approximate starting and ending memory usage, how long you tested, and whether just the app became unresponsive or the browser displayed a crashed-tab page.

## Save queue behavior

IndexedDB saves retain at most one active serialized collection and one pending collection. New edits replace the pending snapshot. Callers waiting on that batch receive success only after the newest snapshot commits, or failure if its transaction fails. The active transaction remains atomic and is never interrupted by newer edits. Serialization still happens for each save request; the log helps identify whether that remains a bottleneck for large albums.

Run `npm run test:diagnostics`, `npm run test:project-storage`, `npm run test:save-errors`, `npm run test:about` and `npm run build` when changing these paths.
