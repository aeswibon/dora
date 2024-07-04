import { PrismaClient } from "@prisma/client";
import { DateTime } from "luxon";
import DataDB from "./db/data";
import logger from "./logger";

interface Metrics {
  deploymentFrequency: number;
  leadTimeForChanges: number;
  changeFailureRate: number;
  timeToRestoreService: number;
}

interface UserMetrics extends Metrics {
  user: string;
}

interface OrgMetrics extends Metrics {
  org: string;
}

interface RepoMetrics extends Metrics {
  repo: string;
}

interface DoraMetrics {
  users: Record<string, UserMetrics[]>;
  orgs: Record<string, OrgMetrics>;
  repos: Record<string, RepoMetrics[]>;
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
        // const commit = prDoc.commit;
        const user = prDoc.user;
        if (pr.mergedAt) {
          const firstCommitTime = new Date(pr.createdAt).getTime();
          const mergedTime = new Date(pr.mergedAt).getTime();
          const leadTime =
            Math.round(
              (mergedTime - firstCommitTime / (1000 * 60 * 60)) * 100
            ) / 100;

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

        if (
          issue.labels &&
          Array.isArray(issue.labels) &&
          issue.labels.some((label: any) => label.name === "failure")
        ) {
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
          issue.labels &&
          Array.isArray(issue.labels) &&
          issue.labels.some((label: any) => label.name === "failure") &&
          issue.closedAt
        ) {
          const restoreTime =
            Math.round(
              (new Date(issue.closedAt).getTime() -
                new Date(issue.createdAt).getTime() / (1000 * 60 * 60)) *
                100
            ) / 100;

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

  private async getCachedMetrics(
    owner: string,
    dates: [Date, Date][],
    granularity: string
  ): Promise<Record<string, any>> {
    const cachedMetrics: Record<string, any> = {};
    const cachedScores = await this.db.score.findMany({
      where: {
        org: owner,
        granularity: granularity,
        start: { in: dates.map(([start]) => start) },
      },
    });

    cachedScores.forEach((score) => {
      cachedMetrics[score.start.toISOString()] = {
        orgs: {
          deploymentFrequency: score.score.deploymentFrequency,
          leadTimeForChanges: score.score.leadTime,
          changeFailureRate: score.score.changeFailureRate,
          timeToRestoreService: score.score.meanTimeToRestore,
        },
        repos: [],
        users: [],
      };
    });

    logger.debug(`Cached metrics: ${JSON.stringify(cachedMetrics)}`);
    return cachedMetrics;
  }

  private combineMetrics(
    owner: string,
    deploymentData: any,
    leadTimeData: any,
    failureRateData: any,
    restoreTimeData: any
  ): {
    orgs: Partial<OrgMetrics>;
    repos: Partial<RepoMetrics>[];
    users: Partial<UserMetrics>[];
  } {
    const { userDeployments, orgDeployment, repoDeployments } = deploymentData;
    const { userLeadTime, orgLeadTime, repoLeadTime } = leadTimeData;
    const { userFailureRates, orgFailureRate, repoFailureRates } =
      failureRateData;
    const { userRestoreTime, orgRestoreTime, repoRestoreTime } =
      restoreTimeData;

    logger.debug(`Deployment data: ${JSON.stringify(deploymentData)}`);
    logger.debug(`Lead time data: ${JSON.stringify(leadTimeData)}`);
    logger.debug(`Failure rate data: ${JSON.stringify(failureRateData)}`);
    logger.debug(`Restore time data: ${JSON.stringify(restoreTimeData)}`);

    const users = new Set([
      ...Object.keys(userDeployments),
      ...Object.keys(userLeadTime),
      ...Object.keys(userFailureRates),
      ...Object.keys(userRestoreTime),
    ]);

    const userMetrics: Partial<UserMetrics>[] = Array.from(users).map(
      (user) => ({
        user,
        deploymentFrequency: userDeployments[user] || 0,
        leadTimeForChanges: userLeadTime[user] || 0,
        changeFailureRate: userFailureRates[user] || 0,
        timeToRestoreService: userRestoreTime[user] || 0,
      })
    );

    const repoMetrics: Partial<RepoMetrics>[] = Object.keys(
      repoDeployments
    ).map((repo) => ({
      repo,
      deploymentFrequency: repoDeployments[repo] || 0,
      leadTimeForChanges: repoLeadTime[repo] || 0,
      changeFailureRate: repoFailureRates[repo] || 0,
      timeToRestoreService: repoRestoreTime[repo] || 0,
    }));

    return {
      orgs: {
        org: owner,
        deploymentFrequency: orgDeployment,
        leadTimeForChanges: orgLeadTime,
        changeFailureRate: orgFailureRate,
        timeToRestoreService: orgRestoreTime,
      },
      repos: repoMetrics,
      users: userMetrics,
    };
  }

  private async saveMetricsToCache(
    owner: string,
    start: Date,
    end: Date,
    granularity: string,
    metrics: any
  ): Promise<void> {
    await this.db.score.create({
      data: {
        org: owner,
        start: start,
        end: end,
        granularity: granularity,
        score: {
          deploymentFrequency: metrics.orgs.deploymentFrequency,
          leadTime: metrics.orgs.leadTimeForChanges,
          changeFailureRate: metrics.orgs.changeFailureRate,
          meanTimeToRestore: metrics.orgs.timeToRestoreService,
        },
      },
    });
    logger.debug(`Saved metrics to cache: ${JSON.stringify(metrics)}`);
  }

  private formatMetrics(
    cachedMetrics: Record<string, any>
  ): Partial<DoraMetrics> {
    const formattedMetrics: Partial<DoraMetrics> = {
      users: {},
      orgs: {},
      repos: {},
    };
    Object.entries(cachedMetrics).forEach(([dateStr, metrics]) => {
      if (formattedMetrics.users) {
        formattedMetrics.users[dateStr] = metrics.users;
      }
      if (formattedMetrics.orgs) {
        formattedMetrics.orgs[dateStr] = metrics.orgs;
      }
      if (formattedMetrics.repos) {
        formattedMetrics.repos[dateStr] = metrics.repos;
      }
    });
    logger.debug(`Formatted metrics: ${JSON.stringify(formattedMetrics)}`);
    return formattedMetrics;
  }

  private getEndDate(start: Date, granularity: string): Date {
    const end = new Date(start);
    switch (granularity) {
      case "day":
        end.setDate(end.getDate() + 1);
        break;
      case "week":
        end.setDate(end.getDate() + 7);
        break;
      case "month":
        end.setMonth(end.getMonth() + 1);
        break;
      default:
        throw new Error(`Invalid granularity: ${granularity}`);
    }
    return end;
  }

  private async saveMetricsToDB(
    owner: string,
    metrics: DoraMetrics,
    granularity: string
  ): Promise<void> {
    const savePromises: Promise<any>[] = [];

    const upsertScore = async (data: any) => {
      const existingScore = await this.db.score.findFirst({
        where: {
          org: data.org,
          repo: data.repo,
          user: data.user,
          start: data.start,
          granularity: data.granularity,
        },
      });

      if (existingScore) {
        logger.debug(`Updating existing score: ${JSON.stringify(data)}`);
        return this.db.score.update({
          where: { id: existingScore.id },
          data: data,
        });
      } else {
        logger.debug(`Creating new score: ${JSON.stringify(data)}`);
        return this.db.score.create({ data: data });
      }
    };

    Object.entries(metrics.orgs).forEach(([dateStr, orgMetric]) => {
      const start = new Date(dateStr);
      const end = this.getEndDate(start, granularity);

      savePromises.push(
        upsertScore({
          org: owner,
          start: start,
          end: end,
          granularity: granularity,
          score: {
            deploymentFrequency: orgMetric.deploymentFrequency,
            leadTime: orgMetric.leadTimeForChanges,
            meanTimeToRestore: orgMetric.timeToRestoreService,
            changeFailureRate: orgMetric.changeFailureRate,
          },
        })
      );
    });

    // Save repo metrics
    Object.entries(metrics.repos).forEach(([dateStr, repoMetrics]) => {
      const start = new Date(dateStr);
      const end = this.getEndDate(start, granularity);

      repoMetrics.forEach((repoMetric) => {
        savePromises.push(
          upsertScore({
            org: owner,
            repo: repoMetric.repo,
            start: start,
            end: end,
            granularity: granularity,
            score: {
              deploymentFrequency: repoMetric.deploymentFrequency,
              leadTime: repoMetric.leadTimeForChanges,
              meanTimeToRestore: repoMetric.timeToRestoreService,
              changeFailureRate: repoMetric.changeFailureRate,
            },
          })
        );
      });
    });

    // Save user metrics
    Object.entries(metrics.users).forEach(([dateStr, userMetrics]) => {
      const start = new Date(dateStr);
      const end = this.getEndDate(start, granularity);

      userMetrics.forEach((userMetric) => {
        savePromises.push(
          upsertScore({
            org: owner,
            user: userMetric.user,
            start: start,
            end: end,
            granularity: granularity,
            score: {
              deploymentFrequency: userMetric.deploymentFrequency,
              leadTime: userMetric.leadTimeForChanges,
              meanTimeToRestore: userMetric.timeToRestoreService,
              changeFailureRate: userMetric.changeFailureRate,
            },
          })
        );
      });
    });

    await Promise.all(savePromises);
  }

  async calculateUserDoraMetrics(
    owner: string,
    startDate: string,
    endDate: string,
    granularity: string,
    repo?: string
  ): Promise<DoraMetrics> {
    const dates: [Date, Date][] = [];
    if (granularity === "week") {
      for (const [start, end] of dateRange(startDate, endDate, "week")) {
        dates.push([new Date(start), new Date(end)]);
      }
    } else if (granularity === "month") {
      for (const [start, end] of dateRange(startDate, endDate, "month")) {
        dates.push([new Date(start), new Date(end)]);
      }
    } else {
      for (const [start, end] of dateRange(startDate, endDate, "day")) {
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
      orgs: {},
      repos: {},
    };

    const cachedMetrics = await this.getCachedMetrics(
      owner,
      dates,
      granularity
    );

    const uncachedDates = dates.filter(
      ([start]) => !cachedMetrics[start.toISOString()]
    );

    await Promise.all(
      uncachedDates.map(async ([start, end]) => {
        const [deploymentData, leadTimeData, failureRateData, restoreTimeData] =
          await Promise.all([
            this.calculateDeploymentFrequency(owner, start, end),
            this.calculateLeadTimeForChanges(owner, repos, start, end),
            this.calculateChangeFailureRate(owner, repos, start, end),
            this.calculateTimeToRestoreService(owner, repos, start, end),
          ]);

        const dateMetrics = this.combineMetrics(
          owner,
          deploymentData,
          leadTimeData,
          failureRateData,
          restoreTimeData
        );
        logger.debug(`Metrics for ${start.toISOString()}: ${dateMetrics}`);
        await this.saveMetricsToCache(
          owner,
          start,
          end,
          granularity,
          dateMetrics
        );
        cachedMetrics[start.toISOString()] = dateMetrics;
      })
    );

    logger.debug(`Assigning metrics to DoraMetrics object`);
    logger.debug(`Cached metrics: ${JSON.stringify(cachedMetrics)}`);
    Object.assign(metrics, this.formatMetrics(cachedMetrics));
    logger.debug(`Metrics: ${JSON.stringify(metrics)}`);
    await this.saveMetricsToDB(owner, metrics, granularity);
    return metrics;
  }
}

export default MetricsCalculator;
