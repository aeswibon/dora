import { App } from "octokit";
import logger from "./logger.js";

class GitHubClient {
  private app: App;

  constructor() {
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
    const installationId = process.env.GITHUB_APP_INSTALLATION_ID;

    if (!appId) {
      throw new Error("Missing required environment variable: GITHUB_APP_ID");
    }

    if (!privateKey) {
      throw new Error(
        "Missing required environment variable: GITHUB_APP_PRIVATE_KEY"
      );
    }

    if (!installationId) {
      throw new Error(
        "Missing required environment variable: GITHUB_APP_INSTALLATION_ID"
      );
    }

    this.app = new App({
      appId: appId,
      privateKey: privateKey,
    });

    this.app
      .getInstallationOctokit(parseInt(installationId))
      .then((octokit) => {
        this.app.octokit = octokit;
      });
  }

  async getPRCommits(
    owner: string,
    repo: string,
    prNumber: number,
    startDate: Date,
    endDate: Date,
    perPage = 1
  ) {
    try {
      const iterator = this.app.octokit.paginate.iterator(
        this.app.octokit.rest.pulls.listCommits,
        {
          owner,
          repo,
          pull_number: prNumber,
          per_page: perPage,
        }
      );
      const data = [];
      for await (const { data: commits } of iterator) {
        data.push(...commits);
      }
      logger.debug(`Found ${data.length} commits for PR ${prNumber}`);
      return data.filter((commit) => {
        const commitDate = commit.commit.committer?.date;
        if (!commitDate) {
          logger.warn(
            `Commit date is undefined for commit ${commit.sha} in PR ${prNumber}`
          );
          return false;
        }
        return (
          new Date(commitDate) >= startDate && new Date(commitDate) <= endDate
        );
      });
    } catch (error) {
      logger.error(
        `Error getting commits for PR ${prNumber} in ${owner}/${repo}: ${error}`
      );
      return [];
    }
  }

  async getReleases(
    owner: string,
    repo: string,
    startDate: Date,
    endDate: Date,
    perPage = 100
  ) {
    try {
      const iterator = this.app.octokit.paginate.iterator(
        this.app.octokit.rest.repos.listReleases,
        {
          owner,
          repo,
          per_page: perPage,
          sort: "created",
          direction: "desc",
        }
      );
      const data = [];
      for await (const { data: releases } of iterator) {
        data.push(...releases);
      }
      logger.debug(`Found ${data.length} releases for ${owner}/${repo}`);
      return data.filter(
        (release) =>
          new Date(release.created_at) >= startDate &&
          new Date(release.created_at) <= endDate
      );
    } catch (error) {
      logger.error(`Error getting releases for ${owner}/${repo}: ${error}`);
      return [];
    }
  }

  async getPullRequests(
    owner: string,
    repo: string,
    startDate: Date,
    endDate: Date,
    perPage = 100
  ) {
    try {
      const iterator = this.app.octokit.paginate.iterator(
        this.app.octokit.rest.pulls.list,
        {
          owner,
          repo,
          state: "closed",
          per_page: perPage,
          sort: "created",
          direction: "desc",
        }
      );
      const data = [];
      for await (const { data: prs } of iterator) {
        data.push(...prs);
      }
      logger.debug(`Found ${data.length} PRs for ${owner}/${repo}`);
      return data.filter(
        (pr) =>
          new Date(pr.created_at) >= startDate &&
          new Date(pr.created_at) <= endDate
      );
    } catch (error) {
      logger.error(`Error getting PRs for ${owner}/${repo}: ${error}`);
      return [];
    }
  }

  async getIssues(
    owner: string,
    repo: string,
    startDate: Date,
    endDate: Date,
    perPage = 100
  ) {
    try {
      const iterator = this.app.octokit.paginate.iterator(
        this.app.octokit.rest.issues.listForRepo,
        {
          owner,
          repo,
          state: "closed",
          per_page: perPage,
          sort: "created",
          direction: "desc",
        }
      );
      const data = [];
      for await (const { data: issues } of iterator) {
        data.push(...issues);
      }
      logger.debug(`Found ${data.length} issues for ${owner}/${repo}`);
      return data.filter(
        (issue) =>
          new Date(issue.created_at) >= startDate &&
          new Date(issue.created_at) <= endDate
      );
    } catch (error) {
      logger.error(`Error getting issues for ${owner}/${repo}: ${error}`);
      return [];
    }
  }

  async getRepos(owner: string, startDate: Date, endDate: Date, perPage = 100) {
    try {
      const iterator = this.app.octokit.paginate.iterator(
        this.app.octokit.rest.repos.listForOrg,
        {
          org: owner,
          per_page: perPage,
          sort: "created",
          direction: "desc",
        }
      );
      const data = [];
      for await (const { data: repos } of iterator) {
        data.push(...repos);
      }
      logger.debug(`Found ${data.length} repos for ${owner}`);
      return data.filter((repo) => {
        const repoDate = repo.created_at;
        if (!repoDate) {
          logger.warn(`Repo date is undefined for ${repo.name}`);
          return false;
        }
        return new Date(repoDate) >= startDate && new Date(repoDate) <= endDate;
      });
    } catch (error) {
      logger.error(`Error getting repos for ${owner}: ${error}`);
      return [];
    }
  }
}

export default new GitHubClient();
