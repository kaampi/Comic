import { Component, type ReactNode } from "react";
import { diagnosticErrorName, recordDiagnostic } from "./diagnostics";
import { downloadAlbumBackup, getEmergencyAlbums } from "./emergencyBackup";
import { LocalRecovery } from "./LocalRecovery";
import { readLocale } from "./settings";
import type { ComicProject } from "./project";

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; feedback: string }> {
  state = { failed: false, feedback: "" };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    recordDiagnostic("render-error", { name: diagnosticErrorName(error) });
  }

  private download(project: ComicProject, sv: boolean) {
    try {
      const filename = downloadAlbumBackup(project, true);
      this.setState({ feedback: filename });
    } catch {
      this.setState({ feedback: sv ? "Nödbackupen kunde inte skapas." : "Could not create the emergency backup." });
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const locale = readLocale();
    const sv = locale === "sv";
    const projects = getEmergencyAlbums();
    return (
      <main className="home">
        <section className="workspace-card">
          <h1>{sv ? "Comic kunde inte visas" : "Comic could not display this screen"}</h1>
          {projects.length > 0 && <>
            <p>{sv ? "Skapa en nödbackup innan du laddar om. Den innehåller albumet som det senast fanns i minnet." : "Create an emergency backup before reloading. It contains the latest available in-memory album."}</p>
            <ul>{projects.map(project => (
              <li key={project.id}>
                <button type="button" onClick={() => this.download(project, sv)}>
                  {sv ? "Nödbackup" : "Emergency backup"} · {project.title}
                </button>
              </li>
            ))}</ul>
            {this.state.feedback && <p role="status">{this.state.feedback}</p>}
          </>}
          <button type="button" onClick={() => window.location.reload()}>{sv ? "Ladda om" : "Reload"}</button>
          <LocalRecovery locale={locale} />
        </section>
      </main>
    );
  }
}
