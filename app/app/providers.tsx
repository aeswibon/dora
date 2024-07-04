"use client";

import { ApolloProvider } from "@apollo/client";
import { createApolloClient } from "@c/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  const client = createApolloClient();
  return (
    <ApolloProvider client={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApolloProvider>
  );
}
