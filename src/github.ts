import { Octokit } from "@octokit/rest";

class GitHubClient {
  private octokit: Octokit;

  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }

  async getPRCommits(owner: string, repo: string, prNumber: number) {
    const { data } = await this.octokit.pulls.listCommits({
      owner,
      repo,
      pull_number: prNumber,
    });
    return data;
  }

  async getReleases(owner: string, repo: string) {
    const { data } = await this.octokit.repos.listReleases({
      owner,
      repo,
    });
    return data;
  }

  async getPullRequests(owner: string, repo: string) {
    const { data } = await this.octokit.pulls.list({
      owner,
      repo,
      state: "closed",
    });
    return data;
  }

  async getIssues(owner: string, repo: string) {
    const { data } = await this.octokit.issues.listForRepo({
      owner,
      repo,
      state: "closed",
    });
    return data;
  }
}

export default new GitHubClient();
