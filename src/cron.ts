import * as cron from "node-cron";
import metricsCalculator from "./metrics.js";

const startCronJob = () => {
  cron.schedule("0 * * * *", async () => {
    // Every hour
    console.log("Running cron job to calculate DORA metrics...");
    try {
      const metrics = await metricsCalculator.calculateUserDoraMetrics(
        "owner_name",
        "repo_name"
      );
      console.log(`DORA Metrics: ${JSON.stringify(metrics, null, 2)}`);
    } catch (error) {
      console.error(`Error calculating DORA metrics: ${error}`);
    }
  });
};

export default startCronJob;
