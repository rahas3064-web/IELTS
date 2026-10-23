import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">بارگذاری این صفحه ناکام ماند</h1>
          <p className="mt-2 text-sm text-muted-foreground">This page failed to load. Nothing was submitted.</p>
          <button
            type="button"
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
            onClick={() => this.setState({ failed: false })}
          >
            تلاش دوباره
          </button>
        </div>
      </main>
    );
  }
}
