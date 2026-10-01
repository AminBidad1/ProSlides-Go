import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "../../../shared/ui/primitives/Button.tsx";

type PresentationErrorBoundaryProps = {
  children: ReactNode;
};

type PresentationErrorBoundaryState = {
  hasError: boolean;
};

export class PresentationErrorBoundary extends Component<
  PresentationErrorBoundaryProps,
  PresentationErrorBoundaryState
> {
  state: PresentationErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): PresentationErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error(
      "[PresentationErrorBoundary] Runtime error:",
      error,
      errorInfo,
    );
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-stage px-4 text-content-inverse">
        <div className="w-full max-w-md rounded-feature border border-stage-border bg-stage-soft/50 p-6 text-center shadow-panel">
          <h2 className="text-xl font-bold">خطا در اجرای ارائه</h2>
          <p className="mt-2 text-sm text-stage-muted">
            خطایی هنگام اجرا رخ داد. برای بازیابی جلسه، لطفاً صفحه را دوباره بارگذاری کنید.
          </p>
          <Button
            type="button"
            variant="inverse"
            onClick={() => window.location.reload()}
            className="mt-5"
          >
            بارگذاری مجدد
          </Button>
        </div>
      </div>
    );
  }
}
