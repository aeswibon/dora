import * as cron from "node-cron";
import fetchData from "./bulk";
import DataDB from "./db/data";
import logger from "./logger";

const startCronJob = () => {
  cron.schedule("0 0 * * *", async () => {
    // Run the cron job every day at midnight
    logger.info("Running cron job");
    try {
      const dataDB = new DataDB();
      await dataDB.connect();
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      startDate.setUTCHours(0, 0, 0, 0);
      await fetchData("coronasafe", dataDB, startDate);
      await dataDB.close();
    } catch (error) {
      logger.error(`Error running cron job: ${error}`);
    }
  });
};

export default startCronJob;
