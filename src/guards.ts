import { PullRequestEvent, IssueCommentEvent } from '@octokit/webhooks-types';
import type { context as Context } from '@actions/github';
import { GithubActionSchedulePayload } from './types';

export function isPullRequestPayload(
  payload: typeof Context['payload'],
  // @ts-expect-error looks like there is a bug in @octokit/webhooks-types
): payload is PullRequestEvent {
  if (payload.pull_request) {
    return true;
  }
  return false;
}

export function isIssueCommentPayload(
  payload: typeof Context['payload'],
  // @ts-expect-error looks like there is a bug in @octokit/webhooks-types
): payload is IssueCommentEvent {
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
