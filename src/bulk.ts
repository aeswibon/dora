import DataDB from "./db/data";
import gitHubClient from "./github";
import logger from "./logger";

const getStartOfDayGMT = (): Date => {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return now;
};

// Fetches the releases for the given owner and pushes in the database
const fetchData = async (
  owner: string,
  db: DataDB,
  startDate: Date
): Promise<void> => {
  try {
    if (!gitHubClient.isAuthenticated()) {
      await gitHubClient.initializeAppAuth();
    }
    logger.debug(`Getting repos for ${owner} since ${startDate}`);
    const endDate = getStartOfDayGMT();
    const repos = await gitHubClient.getRepos(owner, startDate, endDate, true);
    const client = db.db;
    logger.info(`Found ${repos.length} repos for ${owner}`);
    for (const repo of repos) {
      logger.debug(`Getting releases for ${owner}/${repo.name}`);
      const count = { issue: 0, pr: 0 };
      const releases = await gitHubClient.getReleases(
        owner,
        repo.name,
        startDate,
        endDate
      );
      if (releases.length === 0) {
        logger.error(`No releases found for ${owner}/${repo.name}`);
        continue;
      }
      const releaseData = releases.map((release) => ({
        org: owner,
        repo: repo.name,
        user: release.author?.login || "unknown",
        release,
        timestamp: release.createdAt,
      }));

      await client.releases.createMany({
        data: releaseData,
      });

      logger.info(
        `Inserted ${releases.length} releases for ${owner}/${repo.name}`
      );

      logger.debug(`Getting PRs for ${owner}/${repo.name}`);
      const prs = await gitHubClient.getPullRequests(
        owner,
        repo.name,
        startDate,
        endDate
      );
      if (prs.length === 0) {
        logger.error(`No PRs found for ${owner}/${repo.name}`);
        continue;
      }

      await client.prs.createMany({
        data: prs.map((pr) => ({
          org: owner,
          repo: repo.name,
          user: pr.author?.login || "unknown",
          pr,
          timestamp: pr.createdAt,
        })),
      });
      count.pr += prs.length;
      logger.info(`Inserted ${prs.length} PRs for ${owner}/${repo.name}`);

      logger.debug(`Getting issues for ${owner}/${repo.name}`);
      const issues = await gitHubClient.getIssues(
        owner,
        repo.name,
        startDate,
        endDate
      );
      if (issues.length === 0) {
        logger.error(`No issues found for ${owner}/${repo.name}`);
        continue;
      }
      count.issue += issues.length;
      await client.issues.createMany({
        data: issues.map((issue) => ({
          org: owner,
          repo: repo.name,
          user: issue.author?.login || "unknown",
          issue,
          timestamp: issue.createdAt,
        })),
      });
      logger.info(`Inserted ${issues.length} issues for ${owner}/${repo.name}`);
      await client.repos.create({
        data: {
          owner,
          repo: repo.name,
          issue: count.issue,
          pr: count.pr,
          timestamp: repo.createdAt || new Date(),
        },
      });
    }
  } catch (error) {
    logger.error(`Error fetching data for ${owner}: ${error}`);
  }
};

(async () => {
  const dataDB = new DataDB();
  await dataDB.connect();
  const startDate = getStartOfDayGMT();
  startDate.setMonth(startDate.getMonth() - 12);
  await fetchData("appsmithorg", dataDB, startDate);
  await dataDB.close();
})();

export default fetchData;
