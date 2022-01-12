import { Octokit, ActionData } from './types';
import { OWNER, REPO } from './constants';
import { getResultMarkdownBody } from './utils/markdown';

async function removeIssueSummary(client: Octokit, data: ActionData) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((data.persist as any).action?.userId) {
    // legacy conversion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data.persist.workflow.userId = (data.persist as any).action?.userId;
  }
  if (data.issueNumber && data.persist.workflow.userId) {
    const comments = await client.rest.issues.listComments({
      owner: OWNER,
      repo: REPO,
      issue_number: data.issueNumber,
    });
    await Promise.all(
      comments.data.reduce((arr, comment) => {
        if (comment.user?.id === data.persist.workflow.userId) {
          arr.push(
            client.rest.issues.deleteComment({
              owner: OWNER,
              repo: REPO,
              comment_id: comment.id,
            }),
          );
        }
        return arr;
      }, [] as Array<Promise<unknown>>),
    );
  } else if (data.persist.issue.summaryId) {
    try {
      // delete previous and add new
      await client.rest.issues.deleteComment({
        owner: OWNER,
        repo: REPO,
        comment_id: data.persist.issue.summaryId,
      });
    } catch (error) {
      // if user deleted the comment manually it will no longer exist, we dont need to report further
    }
  }
  data.persist.issue.summaryId = undefined;
}

async function createIssueComment(
  client: Octokit,
  issueNumber: number,
  data: ActionData,
) {
  const commentResult = await client.rest.issues.createComment({
    owner: OWNER,
    repo: REPO,
    issue_number: issueNumber,
    body: getResultMarkdownBody(data),
  });
  // persist the comments id so we can edit or remove it in future
  data.persist.issue.summaryId = commentResult.data.id;
  data.persist.workflow.userId = commentResult.data.user?.id;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function handleIssueComment(client: Octokit, data: ActionData) {
  const { state } = data;
  if (data.issueNumber && data.issueSummary) {
    if (
      !data.issueSummaryOnlyOnEvent ||
      state.errorCount > 0 ||
      state.warningCount > 0 ||
      state.fixableErrorCount > 0 ||
      state.fixableWarningCount > 0
    ) {
      if (data.persist.issue.summaryId && data.issueSummaryMethod === 'edit') {
        // delete previous and add new
        try {
          const result = await client.rest.issues.updateComment({
            owner: OWNER,
            repo: REPO,
            comment_id: data.persist.issue.summaryId,
            body: getResultMarkdownBody(data),
          });
          if (!data.persist.workflow.userId) {
            data.persist.workflow.userId = result.data.user?.id;
          }
        } catch (error) {
          // if user deleted the comment manually it wont exist
          data.persist.issue.summaryId = undefined;
        }
      } else if (
        data.persist.issue.summaryId &&
        data.issueSummaryMethod === 'refresh'
      ) {
        await removeIssueSummary(client, data);
      }

      if (!data.persist.issue.summaryId) {
        await createIssueComment(client, data.issueNumber, data);
      }
    } else if (data.issueSummaryOnlyOnEvent && data.persist.issue.summaryId) {
      await removeIssueSummary(client, data);
    }
  }
  // redundancy check to make sure we dont have issue with cloned issue comments - this can occur
  // if multiple updates are done one after another
}
