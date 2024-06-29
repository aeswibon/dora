import { PrismaClient } from "@prisma/client";
import { DateTime } from "luxon";
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
  repo: string;
  deploymentFrequency: number;
  leadTimeForChanges: number;
  changeFailureRate: number;
  timeToRestoreService: number;
}

interface DoraMetrics {
  users: Record<string, UserMetrics[]>;
  orgMetrics: Record<string, OrgMetrics>;
  repoMetrics: Record<string, RepoMetrics[]>;
}

function* dateRange(
  startDate: string,
  endDate: string,
  granularity: "day" | "week" | "month" = "week"
): Generator<[string, string], void, unknown> {
  const start = DateTime.fromISO(startDate);
  const end = DateTime.fromISO(endDate);

  if (granularity === "day") {
    let current = start.startOf("day");
    while (current <= end) {
      yield [current.toISODate() ?? "", current.toISODate() ?? ""];
      current = current.plus({ days: 1 });
    }
  } else if (granularity === "week") {
    let current = start.startOf("week");
    while (current <= end) {
      const intervalEnd = DateTime.min(current.plus({ days: 6 }), end);
      yield [current.toISODate() ?? "", intervalEnd.toISODate() ?? ""];
      current = current.plus({ weeks: 1 });
    }
  } else if (granularity === "month") {
    let current = start.startOf("month");
    while (current <= end) {
      const intervalEnd = DateTime.min(current.endOf("month"), end);
      yield [current.toISODate() ?? "", intervalEnd.toISODate() ?? ""];
      current = current.plus({ months: 1 });
    }
  } else {
    throw new Error(
      "Unsupported granularity. Use 'daily' or 'week' or 'month'."
    );
  }
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

  async calculateDeploymentFrequency(
    owner: string,
    startDate: Date,
    endDate: Date
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
          lte: endDate,
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
    startDate: Date,
    endDate: Date
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
            lte: endDate,
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
    startDate: Date,
    endDate: Date
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
            lte: endDate,
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
    startDate: Date,
    endDate: Date
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
            lte: endDate,
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
    startDate: string,
    endDate: string,
    granularity?: string,
    repo?: string
  ): Promise<DoraMetrics> {
    const dates = [];
    if (granularity === "week") {
      for (const [start, end] of dateRange(startDate, endDate, "week")) {
        dates.push([new Date(start), new Date(end)]);
      }
    } else if (granularity === "month") {
      for (const [start, end] of dateRange(startDate, endDate, "month")) {
        dates.push([new Date(start), new Date(end)]);
      }
    }
    logger.debug(`Dates: ${JSON.stringify(dates)}`);
    logger.debug(`Calculating DORA metrics for org: ${owner}`);
    const repos = repo
      ? [repo]
      : (await this.db.repos.findMany({ where: { owner: owner } })).map(
          (r) => r.repo
        );

    const metrics: DoraMetrics = {
      users: {},
      orgMetrics: {},
      repoMetrics: {},
    };

    for (const [start, end] of dates) {
      const { userDeployments, orgDeployment, repoDeployments } =
        await this.calculateDeploymentFrequency(owner, start, end);
      logger.debug(
        "Deployment frequency: ",
        userDeployments,
        orgDeployment,
        repoDeployments
      );

      const { userLeadTime, orgLeadTime, repoLeadTime } =
        await this.calculateLeadTimeForChanges(owner, repos, start, end);
      logger.debug("Lead time: ", userLeadTime, orgLeadTime, repoLeadTime);

      const { userFailureRates, orgFailureRate, repoFailureRates } =
        await this.calculateChangeFailureRate(owner, repos, start, end);
      logger.debug(
        "Failure rates: ",
        userFailureRates,
        orgFailureRate,
        repoFailureRates
      );

      const { userRestoreTime, orgRestoreTime, repoRestoreTime } =
        await this.calculateTimeToRestoreService(owner, repos, start, end);
      logger.debug(
        "Restore time: ",
        userRestoreTime,
        orgRestoreTime,
        repoRestoreTime
      );

      const userMetric: UserMetrics[] = [];
      const users = new Set<string>([
        ...Object.keys(userDeployments),
        ...Object.keys(userLeadTime),
        ...Object.keys(userFailureRates),
        ...Object.keys(userRestoreTime),
      ]);

      logger.debug("Users with metrics: ", users);
      users.forEach((user) => {
        userMetric.push({
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

      const repoMetrics: RepoMetrics[] = [];
      repos.forEach((repo) => {
        repoMetrics.push({
          repo,
          deploymentFrequency: repoDeployments[repo] || 0,
          leadTimeForChanges: repoLeadTime[repo] || 0,
          changeFailureRate: repoFailureRates[repo] || 0,
          timeToRestoreService: repoRestoreTime[repo] || 0,
        });
      });
      metrics.users[start.toISOString()] = userMetric;
      metrics.orgMetrics[start.toISOString()] = orgMetrics;
      metrics.repoMetrics[start.toISOString()] = repoMetrics;
    }
    return metrics;
  }
}

export default MetricsCalculator;
