import React from "react";

type State = { failed: boolean };

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State { return { failed: true }; }

  render() {
    if (!this.state.failed) return this.props.children;
    return <main role="alert" style={{ maxWidth: 600, margin: "4rem auto", padding: "1.5rem" }}>
      <h1>kaampi Comic kunde inte visa albumet</h1>
      <p>Dina lokalt sparade album finns kvar. Ladda om appen för att försöka igen. Om felet återkommer, återställ från en tidigare nedladdad albumbackup.</p>
      <button type="button" onClick={() => location.reload()}>Ladda om</button>
    </main>;
  }
}

