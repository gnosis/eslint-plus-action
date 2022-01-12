import * as core from '@actions/core';
import { context } from '@actions/github';

import { lintChangedFiles } from './eslint';
import {
  processArrayInput,
  processBooleanInput,
  processInput,
  processEnumInput,
  getIssueLintResultsName,
  isSchedulerActive,
  updateWorkflowStateIfNeeded,
  updateIssueStateIfNeeded,
} from './utils';
import { ActionData, IssuePersistentState } from './types';
import {
  BASE_FULL_NAME,
  HEAD_FULL_NAME,
  ISSUE_NUMBER,
  ARTIFACT_KEY_LINT_RESULTS,
} from './constants';
import { getOctokitClient } from './utils/octokit';
import {
  saveArtifact,
  downloadArtifacts,
  getWorkflowState,
  cleanupArtifactsForIssue,
  updateWorkflowState,
  getIssueState,
} from './artifacts';
import { handleIssueComment } from './issues';
import cloneDeep from 'lodash.clonedeep';

async function run(): Promise<void> {
  try {
    // console.log(JSON.stringify(context, null, 2));
    // console.log(context.issue);
    // console.log(context.repo);

    const isReadOnly = BASE_FULL_NAME !== HEAD_FULL_NAME;

    const data: ActionData = {
      isReadOnly,
      sha: context.payload.pull_request?.head.sha || context.sha,
      eventName: context.eventName,
      name: context.workflow,

      runId: context.runId,
      runNumber: context.runNumber,
      ref: context.ref,

      issueNumber: ISSUE_NUMBER,
      issueSummary: processBooleanInput('issueSummary', true),
      issueSummaryMethod: processEnumInput(
        'issueSummaryMethod',
        ['edit', 'refresh'],
        'edit',
      ),
      issueSummaryType: processEnumInput(
        'issueSummaryType',
        ['full', 'compact'],
        'compact',
      ),
      issueSummaryOnlyOnEvent: processBooleanInput(
        'issueSummaryOnlyOnEvent',
        false,
      ),

      repoHtmlUrl: context.payload.repository?.html_url,
      prHtmlUrl: context.payload.pull_request?.html_url,
      includeGlob: processArrayInput('includeGlob', []),
      ignoreGlob: processArrayInput('ignoreGlob', []),

      reportWarningsAsErrors: processBooleanInput(
        'reportWarningsAsErrors',
        false,
      ),
      reportIgnoredFiles: processBooleanInput('reportIgnoredFiles', false),
      reportSuggestions: processBooleanInput('reportSuggestions', true),
      reportWarnings: processBooleanInput('reportWarnings', true),

      state: {
        userId: 0,
        lintCount: 0,
        errorCount: 0,
        warningCount: 0,
        fixableErrorCount: 0,
        fixableWarningCount: 0,
        ignoredCount: 0,
        ignoredFiles: [],
        summary: '',
        rulesSummaries: new Map(),
        annotationCount: 0,
        conclusion: 'pending',
        checkId: 0,
      },

      // we will add this in after we create the client
      persist: {} as IssuePersistentState,

      eslint: {
        errorOnUnmatchedPattern: processBooleanInput(
          'errorOnUnmatchedPattern',
          false,
        ),
        extensions: processArrayInput('extensions', [
          '.js',
          '.jsx',
          '.ts',
          '.tsx',
        ]),
        rulePaths: processArrayInput('rulePaths', []),
        followSymbolicLinks: processBooleanInput('followSymbolicLinks', true),
        useEslintIgnore: processBooleanInput('useEslintIgnore', true),
        ignorePath: processInput('ignorePath', null) || undefined,
        useEslintrc: processBooleanInput('useEslintrc', true),
        configFile: processInput('configFile', null) || undefined,
        fix: processBooleanInput('useEslintrc', false),
      },
    };

    const client = getOctokitClient(data);
    switch (data.eventName) {
      /*
        When the task runs on a schedule, it is assumed that it is to parse and lint any forked PR's 
        that have been saved to artifacts.  This will run on master and will update multiple on the
        same run.
      */
      case 'schedule': {
        const workflowState = await getWorkflowState(client, data);

        // console.log('Workflow State: ', workflowState);

        const artifacts = await downloadArtifacts(client, (artifacts) =>
          artifacts.filter((artifact) =>
            artifact.name.startsWith(ARTIFACT_KEY_LINT_RESULTS),
          ),
        );
        // @ts-expect-error deserializeArtifacts is added by a custom plugin
        await client.deserializeArtifacts(artifacts);

        workflowState.scheduler.lastRunAt = new Date().toISOString();
        await updateWorkflowState(client, data, workflowState);

        break;
      }
      /*
        When the closed event is setup for a pr we will run cleanup tasks on the artifacts that may exist
        for this issue.
      */
      case 'closed': {
        await cleanupArtifactsForIssue(client, data);
        break;
      }

      case 'opened':
      case 'synchronize':
      default: {
        data.persist = await getIssueState(client, data);

        const startState = cloneDeep(data.persist);

        // core.info(`Data:\n ${JSON.stringify(data, null, 2)}`);
        // core.info(`Context:\n ${JSON.stringify(context, null, 2)}`);
        // core.info(`ENV: \n${JSON.stringify(process.env, null, 2)}`);
        /*
          When an action is triggered by a pull request from a forked repo we will only have
          read permissions available to us.  Our solution to this is to run this action on a schedule
          which will check for artifacts, assuming it is running properly.

          This process will only run if it has detected a scheduled task has run within the previous
          24 hours.
        */
        if (data.isReadOnly && !isSchedulerActive(data)) {
          console.warn(
            `[WARN] | Read Only & schedule not found, we will not run on this PR.`,
          );
          return;
        }

        await lintChangedFiles(client, data);

        if (data.isReadOnly) {
          // @ts-expect-error deserializeArtifacts is added by a custom plugin
          const artifacts: string = await client.getSerializedArtifacts();
          await saveArtifact(getIssueLintResultsName(data), artifacts);
        } else {
          await handleIssueComment(client, data);
          await updateIssueStateIfNeeded(client, startState, data);
        }

        // update workflow state if changed
        await updateWorkflowStateIfNeeded(client, startState, data);
        break;
      }
    }
  } catch (err) {
    core.error(new Error(String(err)));
    core.setFailed(String(err));
  }
}

run();

export default run;
