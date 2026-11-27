import { albumBackupFilename, packAlbumBackup } from "./albumBackup";
import type { ComicProject } from "./project";

// Uses the in-memory album and the browser download API only. It remains
// available when local database writes or reads have failed.
export function downloadEmergencyBackup(project: ComicProject): string {
  const date = new Date().toISOString();
  const filename = albumBackupFilename(project, date);
  const blob = new Blob([JSON.stringify(packAlbumBackup(project, date), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    try { link.click(); } finally { link.remove(); }
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  return filename;
}

