import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThirdwebProvider } from "thirdweb/react";
import { LanguageProvider } from "@/contexts/language-context";

import AppRouter from "./app-router";
import "@app/lib/i18n"; // initializes i18next (used by format.ts and dashboard)
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThirdwebProvider>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
          <AppRouter />
        </LanguageProvider>
      </QueryClientProvider>
    </ThirdwebProvider>
  </StrictMode>,
);
