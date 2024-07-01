import DataDB from "./db/data.js";
import gitHubClient from "./github.js";
import logger from "./logger.js";

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
    logger.debug(`Getting repos for ${owner}`);
    const endDate = getStartOfDayGMT();
    const repos = await gitHubClient.getRepos(owner, startDate, endDate);
    const client = db.db;
    await client.repos.createMany({
      data: repos.map((repo) => ({
        owner: owner,
        repo: repo.name,
        user: repo.owner.name || "unknown",
        timestamp: repo.created_at || new Date(),
      })),
    });
    for (const repo of repos) {
      logger.debug(`Getting releases for ${owner}/${repo.name}`);
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
      await client.releases.createMany({
        data: releases.map((release) => ({
          org: owner,
          repo: repo.name,
          user: release.author?.login || "unknown",
          release,
          timestamp: release.created_at,
        })),
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

      logger.debug(`Getting commits for ${owner}/${repo.name}`);
      for (const pr of prs) {
        if (pr.merged_at) {
          const commits = await gitHubClient.getPRCommits(
            owner,
            repo.name,
            pr.number,
            startDate,
            endDate
          );
          if (commits.length === 0) {
            logger.error(
              `No commits found for PR ${pr.number} in ${owner}/${repo.name}`
            );
            continue;
          }
          await client.prs.create({
            data: {
              org: owner,
              repo: repo.name,
              user: pr.user?.login || "unknown",
              pr,
              commit: commits[0],
              timestamp: pr.created_at,
            },
          });
        }
      }
      logger.info(`Inserted ${prs.length} PRs for ${owner}/${repo.name}`);

      logger.debug(`Getting issues for ${owner}/${repo}`);
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

      await client.issues.createMany({
        data: issues.map((issue) => ({
          org: owner,
          repo: repo.name,
          user: issue.user?.login || "unknown",
          issue,
          timestamp: issue.created_at,
        })),
      });
      logger.info(`Inserted ${issues.length} issues for ${owner}/${repo.name}`);
    }
  } catch (error) {
    logger.error(`Error fetching data for ${owner}: ${error}`);
  }
};

(async () => {
  const dataDB = new DataDB();
  await dataDB.connect();
  const startDate = new Date("2008-02-01T00:00:00Z");
  await fetchData("coronasafe", dataDB, startDate);
  await dataDB.close();
})();

export default fetchData;
