import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryState {
  failed: boolean;
}

/** Last-resort screen if rendering fails; keeps the wallboard from going blank. */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Dashboard render failed', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-8 text-center">
        <h1 className="text-title font-bold">Display unavailable</h1>
        <p className="text-label text-ink-muted">Something went wrong while drawing the screen.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-control bg-accent px-8 py-3 text-label font-semibold text-white"
        >
          Reload
        </button>
      </main>
    );
  }
}
