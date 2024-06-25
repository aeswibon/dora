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

interface OrgMetrics {
  deploymentFrequency: number;
  leadTimeForChanges: number;
  changeFailureRate: number;
  timeToRestoreService: number;
}

interface RepoMetrics {
  deploymentFrequency: number;
  leadTimeForChanges: number;
  changeFailureRate: number;
  timeToRestoreService: number;
}

interface DoraMetrics {
  users: UserMetrics[];
  orgMetrics: OrgMetrics;
  repoMetrics: Record<string, RepoMetrics>;
}

class MetricsCalculator {
  private db: PrismaClient;
  constructor(dataDB: DataDB) {
    this.db = dataDB.db;
  }

  private calculateAverage(
    metrics: Record<string, number>,
    count: Record<string, number>
  ): Record<string, number> {
    const averages: Record<string, number> = {};
    for (const key in metrics) {
      averages[key] = metrics[key] / (count[key] || 1);
    }
    return averages;
  }

  private getDateRangeFilter(days: number): Date {
    const now = new Date();
    now.setDate(now.getDate() - days);
    return now;
  }

  async calculateDeploymentFrequency(
    owner: string,
    startDate: Date = this.getDateRangeFilter(30)
  ): Promise<{
    userDeployments: Record<string, number>;
    orgDeployment: number;
    repoDeployments: Record<string, number>;
  }> {
    const userDeployments: Record<string, number> = {};
    let orgDeployment = 0;
    const repoDeployments: Record<string, number> = {};

    const releaseDocs = await this.db.releases.findMany({
      where: {
        org: owner,
        timestamp: {
          gte: startDate,
        },
      },
    });
    logger.debug(
      `Calculating deployment frequency for ${releaseDocs.length} releases`
    );
    releaseDocs.forEach((releaseDoc) => {
      const release = releaseDoc.release;
      const user: string = releaseDoc.user;
      const repo: string = releaseDoc.repo;
      logger.debug(`Release ${release.name} by ${user}`);
      userDeployments[user] = (userDeployments[user] || 0) + 1;
      orgDeployment += 1;
      repoDeployments[repo] = (repoDeployments[repo] || 0) + 1;
    });
    return { userDeployments, orgDeployment, repoDeployments };
  }

  async calculateLeadTimeForChanges(
    owner: string,
    repos: string[],
    startDate: Date = this.getDateRangeFilter(30)
  ): Promise<{
    userLeadTime: Record<string, number>;
    orgLeadTime: number;
    repoLeadTime: Record<string, number>;
  }> {
    const userLeadTime: Record<string, number> = {};
    const userPRCount: Record<string, number> = {};
    let orgLeadTime = 0;
    let orgPRCount = 0;
    const repoLeadTime: Record<string, number> = {};
    const repoPRCount: Record<string, number> = {};

    for (const repo of repos) {
      const prDocs = await this.db.prs.findMany({
        where: {
          org: owner,
          repo: repo,
          timestamp: {
            gte: startDate,
          },
        },
      });
      logger.debug(`Calculating lead time for ${prDocs.length} PRs`);
      for (const prDoc of prDocs) {
        const pr = prDoc.pr;
        const commit = prDoc.commit;
        const user = prDoc.user;
        if (pr.merged_at) {
          const firstCommitTime = new Date(
            commit.commit.committer.date || 0
          ).getTime();
          const mergedTime = new Date(pr.merged_at).getTime();
          const leadTime = mergedTime - firstCommitTime;

          userLeadTime[user] = (userLeadTime[user] || 0) + leadTime;
          userPRCount[user] = (userPRCount[user] || 0) + 1;
          orgLeadTime += leadTime;
          orgPRCount += 1;
          repoLeadTime[repo] = (repoLeadTime[repo] || 0) + leadTime;
          repoPRCount[repo] = (repoPRCount[repo] || 0) + 1;
        }
      }
    }
    const avgUserLeadTime = this.calculateAverage(userLeadTime, userPRCount);
    const avgOrgLeadTime = orgLeadTime / (orgPRCount || 1);
    const avgRepoLeadTime = this.calculateAverage(repoLeadTime, repoPRCount);

    return {
      userLeadTime: avgUserLeadTime,
      orgLeadTime: avgOrgLeadTime,
      repoLeadTime: avgRepoLeadTime,
    };
  }

  async calculateChangeFailureRate(
    owner: string,
    repos: string[],
    startDate: Date = this.getDateRangeFilter(30)
  ): Promise<{
    userFailureRates: Record<string, number>;
    orgFailureRate: number;
    repoFailureRates: Record<string, number>;
  }> {
    const userFailures: Record<string, number> = {};
    const userTotal: Record<string, number> = {};
    let orgFailures = 0;
    let orgTotal = 0;
    const repoFailures: Record<string, number> = {};
    const repoTotal: Record<string, number> = {};

    for (const repo of repos) {
      const issueDocs = await this.db.issues.findMany({
        where: {
          org: owner,
          repo: repo,
          timestamp: {
            gte: startDate,
          },
        },
      });
      logger.debug(`Calculating failure rate for ${issueDocs.length} issues`);
      issueDocs.forEach((issueDoc) => {
        const issue = issueDoc.issue;
        const user = issueDoc.user;
        userTotal[user] = (userTotal[user] || 0) + 1;
        orgTotal += 1;
        repoTotal[repo] = (repoTotal[repo] || 0) + 1;

        if (issue.labels.some((label: any) => label.name === "failure")) {
          userFailures[user] = (userFailures[user] || 0) + 1;
          orgFailures += 1;
          repoFailures[repo] = (repoFailures[repo] || 0) + 1;
        }
      });
    }
    const userFailureRates: Record<string, number> = {};
    for (const user in userTotal) {
      userFailureRates[user] =
        ((userFailures[user] || 0) / userTotal[user]) * 100;
    }

    const orgFailureRate = (orgFailures / orgTotal) * 100;
    const repoFailureRates: Record<string, number> = {};
    for (const repo in repoTotal) {
      repoFailureRates[repo] =
        ((repoFailures[repo] || 0) / repoTotal[repo]) * 100;
    }
    return { userFailureRates, orgFailureRate, repoFailureRates };
  }

  async calculateTimeToRestoreService(
    owner: string,
    repos: string[],
    startDate: Date = this.getDateRangeFilter(30)
  ): Promise<{
    userRestoreTime: Record<string, number>;
    orgRestoreTime: number;
    repoRestoreTime: Record<string, number>;
  }> {
    const userRestoreTime: Record<string, number> = {};
    const userFailureCount: Record<string, number> = {};
    let orgRestoreTime = 0;
    let orgFailureCount = 0;
    const repoRestoreTime: Record<string, number> = {};
    const repoFailureCount: Record<string, number> = {};

    for (const repo of repos) {
      const issueDocs = await this.db.issues.findMany({
        where: {
          org: owner,
          repo: repo,
          timestamp: {
            gte: startDate,
          },
        },
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
          orgRestoreTime += restoreTime;
          orgFailureCount += 1;
          repoRestoreTime[repo] = (repoRestoreTime[repo] || 0) + restoreTime;
          repoFailureCount[repo] = (repoFailureCount[repo] || 0) + 1;
        }
      });
    }

    const avgUserRestoreTime = this.calculateAverage(
      userRestoreTime,
      userFailureCount
    );
    const avgOrgRestoreTime = orgRestoreTime / (orgFailureCount || 1);
    const avgRepoRestoreTime = this.calculateAverage(
      repoRestoreTime,
      repoFailureCount
    );

    return {
      userRestoreTime: avgUserRestoreTime,
      orgRestoreTime: avgOrgRestoreTime,
      repoRestoreTime: avgRepoRestoreTime,
    };
  }

  async calculateUserDoraMetrics(
    owner: string,
    repo?: string,
    days: number = 30
  ): Promise<DoraMetrics> {
    logger.debug(`Calculating DORA metrics for org: ${owner}`);
    const repos = repo
      ? [repo]
      : (await this.db.repos.findMany({ where: { owner: owner } })).map(
          (r) => r.repo
        );

    const startDate = this.getDateRangeFilter(days);
    const { userDeployments, orgDeployment, repoDeployments } =
      await this.calculateDeploymentFrequency(owner, startDate);
    logger.debug(
      "Deployment frequency: ",
      userDeployments,
      orgDeployment,
      repoDeployments
    );

    const { userLeadTime, orgLeadTime, repoLeadTime } =
      await this.calculateLeadTimeForChanges(owner, repos, startDate);
    logger.debug("Lead time: ", userLeadTime, orgLeadTime, repoLeadTime);

    const { userFailureRates, orgFailureRate, repoFailureRates } =
      await this.calculateChangeFailureRate(owner, repos, startDate);
    logger.debug(
      "Failure rates: ",
      userFailureRates,
      orgFailureRate,
      repoFailureRates
    );

    const { userRestoreTime, orgRestoreTime, repoRestoreTime } =
      await this.calculateTimeToRestoreService(owner, repos, startDate);
    logger.debug(
      "Restore time: ",
      userRestoreTime,
      orgRestoreTime,
      repoRestoreTime
    );

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

    const orgMetrics: OrgMetrics = {
      deploymentFrequency: orgDeployment,
      leadTimeForChanges: orgLeadTime,
      changeFailureRate: orgFailureRate,
      timeToRestoreService: orgRestoreTime,
    };

    const repoMetrics: Record<string, RepoMetrics> = {};
    for (const repo of repos) {
      repoMetrics[repo] = {
        deploymentFrequency: repoDeployments[repo] || 0,
        leadTimeForChanges: repoLeadTime[repo] || 0,
        changeFailureRate: repoFailureRates[repo] || 0,
        timeToRestoreService: repoRestoreTime[repo] || 0,
      };
    }
    return { users: metrics, orgMetrics, repoMetrics };
  }
}

export default MetricsCalculator;
