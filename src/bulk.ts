import DataDB from "./db/data.js";
import gitHubClient from "./github.js";
import logger from "./logger.js";

const db = new DataDB();

// Fetches the releases for the given owner and pushes in the database
async function fetchData(owner: string): Promise<void> {
  try {
    logger.debug(`Getting repos for ${owner}`);
    const repos = await gitHubClient.getRepos(owner);
    const client = db.db;
    await client.repos.createMany({
      data: repos.map((repo) => ({ owner, repo, timestamp: new Date() })),
    });
    for (const repo of repos) {
      logger.debug(`Getting releases for ${owner}/${repo}`);
      const releases = await gitHubClient.getReleases(owner, repo);
      if (releases.length === 0) {
        logger.error(`No releases found for ${owner}/${repo}`);
        continue;
      }
      await client.releases.createMany({
        data: releases.map((release) => ({
          org: owner,
          repo,
          user: release.author?.login || "unknown",
          release,
          timestamp: new Date(),
        })),
      });
      logger.info(`Inserted ${releases.length} releases for ${owner}/${repo}`);

      logger.debug(`Getting PRs for ${owner}/${repo}`);
      const prs = await gitHubClient.getPullRequests(owner, repo);
      if (prs.length === 0) {
        logger.error(`No PRs found for ${owner}/${repo}`);
        continue;
      }

      logger.debug(`Getting commits for ${owner}/${repo}`);
      for (const pr of prs) {
        if (pr.merged_at) {
          const commits = await gitHubClient.getPRCommits(
            owner,
            repo,
            pr.number
          );
          if (commits.length === 0) {
            logger.error(
              `No commits found for PR ${pr.number} in ${owner}/${repo}`
            );
            continue;
          }
          await client.prs.create({
            data: {
              org: owner,
              repo,
              user: pr.user?.login || "unknown",
              pr,
              commit: commits[0],
              timestamp: new Date(),
            },
          });
        }
      }
      logger.info(`Inserted ${prs.length} PRs for ${owner}/${repo}`);

      logger.debug(`Getting issues for ${owner}/${repo}`);
      const issues = await gitHubClient.getIssues(owner, repo);
      if (issues.length === 0) {
        logger.error(`No issues found for ${owner}/${repo}`);
        continue;
      }

      await client.issues.createMany({
        data: issues.map((issue) => ({
          org: owner,
          repo,
          user: issue.user?.login || "unknown",
          issue,
          timestamp: new Date(),
        })),
      });
      logger.info(`Inserted ${issues.length} issues for ${owner}/${repo}`);
    }
  } catch (error) {
    logger.error(`Error fetching data for ${owner}: ${error}`);
  }
}

(async () => {
  await db.connect();
  await fetchData("amplication");
  await db.close();
})();
