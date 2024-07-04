import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import cors from "cors";
import * as dotenv from "dotenv";
import express, { Response } from "express";
import fs from "fs";
import gql from "graphql-tag";
import http from "http";
import path from "path";
import { resolvers } from "./src/resolvers";

dotenv.config({ path: ".env" });

const app: express.Application = express();
const PORT = process.env.PORT;

const typeDefs = gql(
  fs.readFileSync(path.join(__dirname, "./src/schema.graphql"), "utf8")
);

(async () => {
  const httpServer = http.createServer(app);
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await server.start();

  app.get("/health", (_, res: Response) => {
    console.log("Health check");
    res.status(200).send("OK");
  });

  app.use(
    "/",
    cors<cors.CorsRequest>(),
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => ({ token: req.headers.token }),
    })
  );

  await new Promise<void>((resolve) =>
    httpServer.listen({ port: PORT }, resolve)
  );
  console.log(`🚀 Server ready at ${PORT}`);
})();
