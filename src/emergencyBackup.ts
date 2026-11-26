import type { ComicProject } from "./project";
import { ALBUM_BACKUP_KIND, albumBackupFilename, packAlbumBackup } from "./albumBackup";

let recoveryAlbums: readonly ComicProject[] = [];

export function rememberEmergencyAlbums(projects: readonly ComicProject[]) {
  recoveryAlbums = projects;
}

export function getEmergencyAlbums() {
  return recoveryAlbums;
}

export function downloadAlbumBackup(project: ComicProject, emergency = false): string {
  const date = new Date().toISOString();
  const backup = emergency
    ? { kind: ALBUM_BACKUP_KIND, format: 1, exportedAt: date, project }
    : packAlbumBackup(project, date);
  const filename = albumBackupFilename(project, date);
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  try {
    document.body.append(link);
    link.click();
    return filename;
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
