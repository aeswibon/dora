import DataDB from "./db/data";
import logger from "./logger";
import MetricsCalculator from "./metrics";

export const resolvers = {
  Query: {
    server: () => "Server is up and running!",
    dora: async (
      _: any,
      {
        owner,
        startDate,
        endDate,
        granularity,
        repo,
      }: {
        owner: string;
        startDate: string;
        endDate: string;
        granularity: string;
        repo?: string;
      }
    ) => {
      const dataDB = new DataDB();
      await dataDB.connect();
      if (!owner || !startDate || !endDate || !granularity) {
        throw new Error(
          "owner, startDate, endDate, and granularity are required"
        );
      }
      const metric = new MetricsCalculator(dataDB);
      logger.debug(
        `Query: ${owner} ${repo} ${startDate} ${endDate} ${granularity}`
      );
      const metrics = await metric.calculateUserDoraMetrics(
        owner,
        startDate,
        endDate,
        granularity,
        repo
      );
      await dataDB.close();
      return {
        code: 200,
        message: "Successfully fetched DORA metrics",
        data: {
          users: Object.entries(metrics.users).map(([key, value]) => ({
            key,
            value,
          })),
          repos: Object.entries(metrics.repos).map(([key, value]) => ({
            key,
            value,
          })),
          orgs: Object.entries(metrics.orgs).map(([key, value]) => ({
            key,
            value: [value],
          })),
        },
      };
    },
  },
};
