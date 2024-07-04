declare global {
  namespace PrismaJson {
    type User = {
      id: string;
      login: string;
      node_id: string;
      url: string;
    };

    type ReleaseType = {
      url: string;
      id: number;
      name: string;
      description: string;
      node_id: string;
      tag_name: string;
      created_at: string;
      published_at: string;
      author: User;
    };

    type CommitType = {
      url: string;
      sha: string;
      node_id: string;
      author: User;
      committer: User;
      commit: {
        message: string;
        committer: {
          date: string;
        };
      };
    };

    type PullRequestType = {
      id: number;
      node_id: string;
      url: string;
      issue_url: string;
      number: number;
      state: string;
      locked: boolean;
      title: string;
      body: string;
      author: User;
      created_at: string;
      updated_at: string;
      closed_at: string;
      merged_at: string;
    };

    type IssueType = {
      url: string;
      repository_url: string;
      id: number;
      node_id: string;
      number: number;
      title: string;
      body: string;
      user: User;
      state: string;
      locked: boolean;
      assignee: User;
      assignees: User[];
      created_at: string;
      updated_at: string;
      closed_at: string;
      labels: {
        id: number;
        node_id: string;
        url: string;
        name: string;
        color: string;
        default: boolean;
      }[];
    };
  }

  type ScoreType = {
    deploymentFrequency: number;
    leadTime: number;
    meanTimeToRestore: number;
    changeFailureRate: number;
  };
}
