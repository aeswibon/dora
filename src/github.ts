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

  async getPRCommits(owner: string, repo: string, prNumber: number) {
    try {
      const { data } = await this.app.octokit.request(
        "GET /repos/{owner}/{repo}/pulls/{pull_number}/commits",
        {
          owner,
          repo,
          pull_number: prNumber,
        }
      );
      return data;
    } catch (error) {
      logger.error(
        `Error getting commits for PR ${prNumber} in ${owner}/${repo}: ${error}`
      );
      return [];
    }
  }

  async getReleases(owner: string, repo: string) {
    try {
      const { data } = await this.app.octokit.request(
        "GET /repos/{owner}/{repo}/releases",
        {
          owner,
          repo,
        }
      );
      return data;
    } catch (error) {
      logger.error(`Error getting releases for ${owner}/${repo}: ${error}`);
      return [];
    }
  }

  async getPullRequests(owner: string, repo: string) {
    try {
      logger.debug(`Getting PRs for ${owner}/${repo}`);
      const { data } = await this.app.octokit.request(
        "GET /repos/{owner}/{repo}/pulls",
        {
          owner,
          repo,
          state: "closed",
        }
      );
      return data;
    } catch (error) {
      logger.error(`Error getting PRs for ${owner}/${repo}: ${error}`);
      return [];
    }
  }

  async getIssues(owner: string, repo: string) {
    try {
      logger.debug(`Getting issues for ${owner}/${repo}`);
      const { data } = await this.app.octokit.request(
        "GET /repos/{owner}/{repo}/issues",
        {
          owner,
          repo,
          state: "closed",
        }
      );
      logger.debug(`Found ${data.length} issues for ${owner}/${repo}`);
      return data;
    } catch (error) {
      logger.error(`Error getting issues for ${owner}/${repo}: ${error}`);
      return [];
    }
  }

  async getRepos(owner: string) {
    try {
      const { data } = await this.app.octokit.request(
        "GET /users/{username}/repos",
        {
          username: owner,
        }
      );
      return data.map((repo) => repo.name);
    } catch (error) {
      logger.error(`Error getting repos for ${owner}: ${error}`);
      return [];
    }
  }
}

export default new GitHubClient();
