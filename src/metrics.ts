import { PrismaClient } from "@prisma/client";
import DataDB from "./db/data.js";
import logger from "./logger.js";

interface UserMetrics {
  user: string;
  deploymentFrequency: number;
  leadTimeForChanges: number;
  changeFailureRate: number;
  timeToRestoreService: number;
}

interface DoraMetrics {
  users: UserMetrics[];
}

class MetricsCalculator {
  private db: PrismaClient;
  constructor(dataDB: DataDB) {
    this.db = dataDB.db;
  }

  async calculateDeploymentFrequency(
    owner: string
  ): Promise<Record<string, number>> {
    const userDeployments: Record<string, number> = {};
    const releaseDocs = await this.db.releases.findMany({
      where: { org: owner },
    });
    logger.debug(
      `Calculating deployment frequency for ${releaseDocs.length} releases`
    );
    releaseDocs.forEach((releaseDoc) => {
      const release = releaseDoc.release;
      const user: string = releaseDoc.user;
      logger.debug(`Release ${release.name} by ${user}`);
      userDeployments[user] = (userDeployments[user] || 0) + 1;
    });
    return userDeployments;
  }

  async calculateLeadTimeForChanges(
    owner: string,
    repos: string[]
  ): Promise<Record<string, number>> {
    const userLeadTime: Record<string, number> = {};
    const userPRCount: Record<string, number> = {};
    for (const repo of repos) {
      const prDocs = await this.db.prs.findMany({
        where: { org: owner, repo: repo },
      });
      logger.debug(`Calculating lead time for ${prDocs.length} PRs`);
      for (const prDoc of prDocs) {
        const pr = prDoc.pr;
        const commit = prDoc.commit;
        if (pr.merged_at) {
          const firstCommit = new Date(
            commit.commit.committer.date || 0
          ).getTime();
          const leadTime = new Date(pr.merged_at).getTime() - firstCommit;
          const user = prDoc.user;

          userLeadTime[user] = (userLeadTime[user] || 0) + leadTime;
          userPRCount[user] = (userPRCount[user] || 0) + 1;
        }
      }
      for (const user in userLeadTime) {
        userLeadTime[user] = userLeadTime[user] / userPRCount[user];
      }
    }
    return userLeadTime;
  }

  async calculateChangeFailureRate(
    owner: string,
    repos: string[]
  ): Promise<Record<string, number>> {
    const userFailureRates: Record<string, number> = {};
    const userFailures: Record<string, number> = {};
    const userTotal: Record<string, number> = {};

    for (const repo of repos) {
      const issueDocs = await this.db.issues.findMany({
        where: { org: owner, repo: repo },
      });
      logger.debug(`Calculating failure rate for ${issueDocs.length} issues`);
      issueDocs.forEach((issueDoc) => {
        const issue = issueDoc.issue;
        const user = issueDoc.user;
        userTotal[user] = (userTotal[user] || 0) + 1;

        if (issue.labels.some((label: any) => label.name === "failure")) {
          userFailures[user] = (userFailures[user] || 0) + 1;
        }
      });
    }

    for (const user in userTotal) {
      userFailureRates[user] =
        ((userFailures[user] || 0) / userTotal[user]) * 100;
    }
    return userFailureRates;
  }

  async calculateTimeToRestoreService(
    owner: string,
    repos: string[]
  ): Promise<Record<string, number>> {
    const userRestoreTime: Record<string, number> = {};
    const userFailureCount: Record<string, number> = {};

    for (const repo of repos) {
      const issueDocs = await this.db.issues.findMany({
        where: { org: owner, repo: repo },
      });
      logger.debug(`Calculating restore time for ${issueDocs.length} issues`);
      issueDocs.forEach((issueDoc) => {
        const issue = issueDoc.issue;
        const user = issueDoc.user;
        if (
          issue.labels.some((label: any) => label.name === "failure") &&
          issue.closed_at
        ) {
          const restoreTime =
            new Date(issue.closed_at).getTime() -
            new Date(issue.created_at).getTime();
          userRestoreTime[user] = (userRestoreTime[user] || 0) + restoreTime;
          userFailureCount[user] = (userFailureCount[user] || 0) + 1;
        }
      });
    }

    for (const user in userRestoreTime) {
      userRestoreTime[user] = userRestoreTime[user] / userFailureCount[user];
    }

    return userRestoreTime;
  }

  async calculateUserDoraMetrics(
    owner: string,
    repo?: string
  ): Promise<DoraMetrics> {
    logger.debug(`Calculating DORA metrics for org: ${owner}`);
    const repos = repo
      ? [repo]
      : (await this.db.repos.findMany({ where: { owner: owner } })).map(
          (r) => r.repo
        );
    const userDeployments = await this.calculateDeploymentFrequency(owner);
    logger.debug("Deployment frequency: ", userDeployments);
    const userLeadTime = await this.calculateLeadTimeForChanges(owner, repos);
    logger.debug("Lead time: ", userLeadTime);
    const userFailureRates = await this.calculateChangeFailureRate(
      owner,
      repos
    );
    logger.debug("Failure rates: ", userFailureRates);
    const userRestoreTime = await this.calculateTimeToRestoreService(
      owner,
      repos
    );
    logger.debug("Restore time: ", userRestoreTime);

    const metrics: UserMetrics[] = [];
    const users = new Set<string>([
      ...Object.keys(userDeployments),
      ...Object.keys(userLeadTime),
      ...Object.keys(userFailureRates),
      ...Object.keys(userRestoreTime),
    ]);

    logger.debug("Users with metrics: ", users);
    users.forEach((user) => {
      metrics.push({
        user,
        deploymentFrequency: userDeployments[user] || 0,
        leadTimeForChanges: userLeadTime[user] || 0,
        changeFailureRate: userFailureRates[user] || 0,
        timeToRestoreService: userRestoreTime[user] || 0,
      });
    });

    return { users: metrics };
  }
}

export default MetricsCalculator;
