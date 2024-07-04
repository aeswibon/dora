import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

export function createApolloClient() {
  return new ApolloClient({
    link: new HttpLink({
      // uri: process.env.NEXT_PUBLIC_GRAPHQL_URL,
      uri: "http://localhost:8080",
    }),
    cache: new InMemoryCache(),
  });
}
