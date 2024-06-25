import * as cron from "node-cron";
import DataDB from "./db/data.js";
import MetricsCalculator from "./metrics.js";

const startCronJob = () => {
  cron.schedule("0 * * * *", async () => {
    // Every hour
    console.log("Running cron job to calculate DORA metrics...");
    try {
      const dataDB = new DataDB();
      await dataDB.connect();
      const metric = new MetricsCalculator(dataDB);
      const metrics = await metric.calculateUserDoraMetrics("owner_name");
      console.log(`DORA Metrics: ${JSON.stringify(metrics, null, 2)}`);
      await dataDB.close();
    } catch (error) {
      console.error(`Error calculating DORA metrics: ${error}`);
    }
  });
};

export default startCronJob;
