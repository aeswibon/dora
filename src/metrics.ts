import gitHubClient from "./github";

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
  async calculateDeploymentFrequency(
    owner: string,
    repo: string
  ): Promise<Record<string, number>> {
    const releases = await gitHubClient.getReleases(owner, repo);
    const userDeployments: Record<string, number> = {};

    releases.forEach((release) => {
      const user = release.author?.login || "unknown";
      userDeployments[user] = (userDeployments[user] || 0) + 1;
    });

    return userDeployments;
  }

  async calculateLeadTimeForChanges(
    owner: string,
    repo: string
  ): Promise<Record<string, number>> {
    const prs = await gitHubClient.getPullRequests(owner, repo);
    const userLeadTime: Record<string, number> = {};
    const userPRCount: Record<string, number> = {};

    for (const pr of prs) {
      if (pr.merged_at) {
        const commits = await gitHubClient.getPRCommits(owner, repo, pr.number);

        const firstCommit = new Date(
          commits[0].commit.committer?.date || 0
        ).getTime();
        const leadTime = new Date(pr.merged_at).getTime() - firstCommit;
        const user = pr.user?.login || "unknown";

        userLeadTime[user] = (userLeadTime[user] || 0) + leadTime;
        userPRCount[user] = (userPRCount[user] || 0) + 1;
      }
    }

    for (const user in userLeadTime) {
      userLeadTime[user] = userLeadTime[user] / userPRCount[user];
    }

    return userLeadTime;
  }

  calculateChangeFailureRate(issues: any[]): Record<string, number> {
    const userFailures: Record<string, number> = {};
    const userTotal: Record<string, number> = {};

    issues.forEach((issue) => {
      const user = issue.user?.login || "unknown";
      userTotal[user] = (userTotal[user] || 0) + 1;

      if (issue.labels.some((label: any) => label.name === "failure")) {
        userFailures[user] = (userFailures[user] || 0) + 1;
      }
    });

    const userFailureRates: Record<string, number> = {};
    for (const user in userTotal) {
      userFailureRates[user] =
        ((userFailures[user] || 0) / userTotal[user]) * 100;
    }

    return userFailureRates;
  }

  calculateTimeToRestoreService(issues: any[]): Record<string, number> {
    const userRestoreTime: Record<string, number> = {};
    const userFailureCount: Record<string, number> = {};

    issues.forEach((issue) => {
      const user = issue.user?.login || "unknown";
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

    for (const user in userRestoreTime) {
      userRestoreTime[user] = userRestoreTime[user] / userFailureCount[user];
    }

    return userRestoreTime;
  }

  async calculateUserDoraMetrics(
    owner: string,
    repo: string
  ): Promise<DoraMetrics> {
    const issues = await gitHubClient.getIssues(owner, repo);

    const userDeployments = await this.calculateDeploymentFrequency(
      owner,
      repo
    );
    const userLeadTime = await this.calculateLeadTimeForChanges(owner, repo);
    const userFailureRates = this.calculateChangeFailureRate(issues);
    const userRestoreTime = this.calculateTimeToRestoreService(issues);

    const metrics: UserMetrics[] = [];
    const users = new Set<string>([
      ...Object.keys(userDeployments),
      ...Object.keys(userLeadTime),
      ...Object.keys(userFailureRates),
      ...Object.keys(userRestoreTime),
    ]);

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

export default new MetricsCalculator();
