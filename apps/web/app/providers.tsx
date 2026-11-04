"use client";

import { useState, type PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { DesignThemeProvider, type DesignTheme } from "./design-theme-provider";

import { AppErrorBoundary } from "@/components/app/error-boundary";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth-context";
import { createAppQueryClient } from "@/lib/query-client";

export function AppProviders({ children, designTheme }: PropsWithChildren<{ designTheme: DesignTheme }>) {
  const [queryClient] = useState(createAppQueryClient);

  return (
    <AppErrorBoundary>
      <DesignThemeProvider designTheme={designTheme}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TooltipProvider>
              {children}
              <Toaster position="top-right" richColors closeButton />
            </TooltipProvider>
          </AuthProvider>
        </QueryClientProvider>
      </DesignThemeProvider>
    </AppErrorBoundary>
  );
}
