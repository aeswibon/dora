import * as dotenv from "dotenv";
import express, { Request, Response } from "express";
import DataDB from "./src/db/data.js";
import MetricsCalculator from "./src/metrics.js";

dotenv.config({ path: ".env" });

const dataDB = new DataDB();
const app: express.Application = express();
const PORT = process.env.PORT;

app.get("/health", (_, res: Response) => {
  console.log("Health check");
  res.status(200).send("OK");
});

app.get("/dora", async (req: Request, res: Response) => {
  await dataDB.connect();
  const owner = req.query.owner as string;
  const repo = req.query.repo as string;
  if (!owner) {
    return res.status(400).send("owner query parameters are required");
  }
  try {
    const metric = new MetricsCalculator(dataDB);
    const metrics = await metric.calculateUserDoraMetrics(owner, repo);
    await dataDB.close();
    res.status(200).send(metrics);
  } catch (error) {
    console.error(`Error calculating DORA metrics: ${error}`);
    res.status(500).send("Failed to calculate DORA metrics");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
