"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { ErrorState } from "@/components/app/states";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  failed: boolean;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[spk:app] render failure", {
      name: error.name,
      componentStack: info.componentStack,
    });
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <ErrorState
          title="This page is temporarily unavailable"
          description="Refresh the page and try again."
          actionLabel="Refresh page"
          onAction={() => window.location.reload()}
        />
      );
    }
    return this.props.children;
  }
}
