import * as core from '@actions/core';

import {
  PrResponse,
  Octokit,
  ActionData,
  OctokitCreateCheckResponse,
  OctokitCreateChecksParams,
  OctokitUpdateChecksParams,
  CheckUpdaterFn,
  GitHubWorkflow,
} from './types';
import { NAME, OWNER, REPO } from './constants';

export async function fetchFilesBatchPR(
  client: Octokit,
  prNumber: number,
  startCursor?: string,
  owner: string = OWNER,
  repo: string = REPO,
): Promise<PrResponse> {
  const { repository } = await client.graphql(
    `
      query ChangedFilesBatch(
        $owner: String!
        $repo: String!
        $prNumber: Int!
        $startCursor: String
      ) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $prNumber) {
            files(first: 50, after: $startCursor) {
              pageInfo {
                hasNextPage
                endCursor
              }
              totalCount
              edges {
                cursor
                node {
                  path
                }
              }
            }
          }
        }
      }
    `,
    { owner, repo, prNumber, startCursor },
  );

  const pr = repository.pullRequest;

  if (!pr || !pr.files) {
    core.info(`No PR or PR files detected`);
    return { files: [] };
  }

  core.info(
    `PR with files detected: ${pr.files.edges.map(
      (e: { node: { path: string } }) => e.node.path,
    )}`,
  );

  return {
    ...pr.files.pageInfo,
    files: pr.files.edges.map((e: { node: { path: string } }) => e.node.path),
  };
}

/**
 * Gets a list of all the files modified in this commit
 *
 * @param client The Octokit instance
 * @param sha The SHA for the Commit
 * @param owner The Owner of the Repository
 * @param repo The Repository name (slug)
 *
 * @returns string[] An Array of the file paths modified in this commit, relative to the repository root
 */
export async function fetchFilesBatchCommit(
  client: Octokit,
  data: ActionData,
  owner: string = OWNER,
  repo: string = REPO,
): Promise<string[]> {
  try {
    const resp = await client.repos.getCommit({
      owner,
      repo,
      ref: data.sha,
    });

    const filesChanged = resp.data.files
      ?.filter((f) => f.filename)
      .map((f) => f.filename as string);

    core.info(`Files changed: ${filesChanged}`);

    if (typeof filesChanged === 'undefined') {
      return [];
    }

    return filesChanged;
  } catch (err) {
    core.error(err);
    return [];
  }
}

export async function createCheck(
  client: Octokit,
  data: ActionData,
  owner: string = OWNER,
  repo: string = REPO,
): Promise<CheckUpdaterFn> {
  const params: OctokitCreateChecksParams = {
    name: NAME,
    head_sha: data.sha,
    status: 'in_progress',
    started_at: new Date().toISOString(),
    owner,
    repo,
  };

  const createCheckResult = await client.checks.create(params);
  data.state.checkId = createCheckResult.data.id;

  return (nextParams: Partial<OctokitUpdateChecksParams>) =>
    updateCheck(createCheckResult, data, client, owner, repo, nextParams);
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function updateCheck(
  createCheckResult: OctokitCreateCheckResponse,
  data: ActionData,
  client: Octokit,
  owner: string,
  repo: string,
  nextParams: Partial<OctokitUpdateChecksParams>,
) {
  const params: OctokitUpdateChecksParams = {
    name: NAME,
    check_run_id: createCheckResult.data.id,
    status: 'in_progress',
    owner,
    repo,
    ...nextParams,
  };

  const result = await client.checks.update(params);

  return result;
}

/**
 * Since the github action context does not provide the necessary information
 * to know what our workflow id is, we will capture it and save to our workflow level
 * state.
 */
export async function getCurrentWorkflow(
  client: Octokit,
  data: ActionData,
  owner: string = OWNER,
  repo: string = REPO,
): Promise<GitHubWorkflow | undefined> {
  const workflows = await client.actions.listRepoWorkflows({
    owner,
    repo,
  });

  const currentWorkflow = workflows.data.workflows.find(
    (workflow) => workflow.name === data.name,
  );

  return currentWorkflow;
}
