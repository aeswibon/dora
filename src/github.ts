import { createAppAuth } from "@octokit/auth-app";
import { App, Octokit } from "octokit";
import logger from "./logger";

class GitHubClient {
  private app: App;
  private octokit: Octokit | null = null;

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

    if (installationId) {
      this.initializeInstallationAuth(parseInt(installationId));
    }
  }

  private async initializeInstallationAuth(installationId: number) {
    try {
      this.octokit = await this.app.getInstallationOctokit(installationId);
      logger.info(
        `Initialized installation authentication for installation ID: ${installationId}`
      );
    } catch (error) {
      logger.error(
        `Failed to initialize installation authentication: ${error}`
      );
    }
  }

  private getOctokit(): Octokit {
    if (!this.octokit) {
      throw new Error(
        "GitHub client is not authenticated. Call initializeAppAuth() or provide an installation ID."
      );
    }
    return this.octokit;
  }

  isAuthenticated(): boolean {
    return this.octokit !== null;
  }

  async initializeAppAuth(clientId?: string, clientSecret?: string) {
    try {
      const auth = createAppAuth({
        appId: process.env.GITHUB_APP_ID!,
        privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
        clientId: clientId || process.env.GITHUB_APP_CLIENT_ID,
        clientSecret: clientSecret || process.env.GITHUB_APP_CLIENT_SECRET,
      });

      const appAuthentication = await auth({ type: "app" });
      this.octokit = new Octokit({ auth: appAuthentication.token });
      logger.info("Initialized GitHub App authentication");
    } catch (error) {
      logger.error(`Failed to initialize GitHub App authentication: ${error}`);
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
      const query = `
        query($owner: String!, $repo: String!, $perPage: Int!, $cursor: String) {
          repository(owner: $owner, name: $repo) {
            releases(first: $perPage, after: $cursor, orderBy: {field: CREATED_AT, direction: DESC}) {
              nodes {
                name
                description
                tagName
                createdAt
                publishedAt
                author {
                  login
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      `;
      const releases = [];
      let cursor = null;
      do {
        const response: any = await this.getOctokit().graphql(query, {
          owner,
          repo,
          perPage,
          cursor,
        });
        const data = response.repository.releases;
        releases.push(...data.nodes);
        cursor = data.pageInfo.hasNextPage ? data.pageInfo.endCursor : null;
      } while (cursor);
      const releaseData = releases.filter(
        (release) =>
          new Date(release.createdAt) >= startDate &&
          new Date(release.createdAt) <= endDate
      );
      logger.debug(`Found ${releaseData.length} releases for ${owner}/${repo}`);
      return releaseData;
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
      const query = `
        query($owner: String!, $repo: String!, $perPage: Int!, $cursor: String) {
          repository(owner: $owner, name: $repo) {
            pullRequests(first: $perPage, after: $cursor, states: MERGED, orderBy: {field: CREATED_AT, direction: DESC}) {
              nodes {
                number
                state
                title
                body
                author {
                  login
                }
                createdAt
                updatedAt
                closedAt
                mergedAt
                commits(first: 1, after: null) {
                  nodes {
                    commit {
                      oid
                      message
                      author {
                        user {
                          login
                        }
                      }
                      authoredDate
                    }
                  }
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      `;
      const prs = [];
      let cursor = null;
      do {
        const response: any = await this.getOctokit().graphql(query, {
          owner,
          repo,
          perPage,
          cursor,
        });
        const data = response.repository.pullRequests;
        prs.push(...data.nodes);
        cursor = data.pageInfo.hasNextPage ? data.pageInfo.endCursor : null;
      } while (cursor);
      const prData = prs.filter(
        (pr) =>
          new Date(pr.createdAt) >= startDate &&
          new Date(pr.createdAt) <= endDate
      );
      logger.debug(`Found ${prData.length} PRs for ${owner}/${repo}`);
      return prData;
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
      const query = `
        query($owner: String!, $repo: String!, $perPage: Int!, $cursor: String) {
          repository(owner: $owner, name: $repo) {
            issues(first: $perPage, after: $cursor, orderBy: {field: CREATED_AT, direction: DESC}) {
              nodes {
                number
                title
                body
                state
                author {
                  login
                }
                createdAt
                closedAt
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      `;
      const issues = [];
      let cursor = null;
      do {
        const response: any = await this.getOctokit().graphql(query, {
          owner,
          repo,
          perPage,
          cursor,
        });
        const data = response.repository.issues;
        issues.push(...data.nodes);
        cursor = data.pageInfo.hasNextPage ? data.pageInfo.endCursor : null;
      } while (cursor);
      const issueData = issues.filter(
        (issue) =>
          new Date(issue.createdAt) >= startDate &&
          new Date(issue.createdAt) <= endDate
      );
      logger.debug(`Found ${issueData.length} issues for ${owner}/${repo}`);
      return issueData;
    } catch (error) {
      logger.error(`Error getting issues for ${owner}/${repo}: ${error}`);
      return [];
    }
  }

  async getRepos(
    owner: string,
    startDate: Date,
    endDate: Date,
    noFilter = false,
    perPage = 100
  ) {
    try {
      const query = `
        query($owner: String!, $perPage: Int!, $cursor: String) {
          organization(login: $owner) {
            repositories(first: $perPage, after: $cursor, orderBy: {field: CREATED_AT, direction: DESC}) {
              nodes {
                name
                description
                createdAt
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
      `;
      const repos = [];
      let cursor = null;
      do {
        const response: any = await this.getOctokit().graphql(query, {
          owner,
          perPage,
          cursor,
        });
        const data = response.organization.repositories;
        repos.push(...data.nodes);
        cursor = data.pageInfo.hasNextPage ? data.pageInfo.endCursor : null;
      } while (cursor);
      if (noFilter) return repos;
      const repoData = repos.filter(
        (repo) =>
          new Date(repo.createdAt) >= startDate &&
          new Date(repo.createdAt) <= endDate
      );
      logger.debug(`Found ${repoData.length} repos for ${owner}`);
      return repoData;
    } catch (error) {
      logger.error(`Error getting repos for ${owner}: ${error}`);
      return [];
    }
  }
}

export default new GitHubClient();
