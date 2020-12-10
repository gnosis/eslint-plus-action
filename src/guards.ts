import { EventPayloads } from '@octokit/webhooks';
import type { context as Context } from '@actions/github';
import { GithubActionSchedulePayload } from './types';

export function isPullRequestPayload(
  payload: typeof Context['payload'],
): payload is EventPayloads.WebhookPayloadPullRequest {
  if (payload.pull_request) {
    return true;
  }
  return false;
}

export function isIssueCommentPayload(
  payload: typeof Context['payload'],
): payload is EventPayloads.WebhookPayloadIssueComment {
  if (payload.comment) {
    return true;
  }
  return false;
}

export function isSchedulePayload(
  payload: typeof Context['payload'],
): payload is GithubActionSchedulePayload {
  if (payload.schedule) {
    return true;
  }
  return false;
}
