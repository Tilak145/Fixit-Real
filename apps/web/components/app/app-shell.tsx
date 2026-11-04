import type { PropsWithChildren } from "react";

/**
 * The one place the application's global appearance lives: header, navigation,
 * sidebar, footer. Pages render only their own content inside it. It wraps
 * every route from app/layout.tsx, so a change here is a change everywhere.
 */
export function AppShell({ children }: PropsWithChildren) {
  return <div className="flex min-h-screen flex-col">{children}</div>;
}
