"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const core = (0, tslib_1.__importStar)(require("@actions/core"));
const github_1 = require("@actions/github");
const eslint_1 = require("./eslint");
const utils_1 = require("./utils");
const constants_1 = require("./constants");
const octokit_1 = require("./utils/octokit");
const artifacts_1 = require("./artifacts");
const issues_1 = require("./issues");
const lodash_clonedeep_1 = (0, tslib_1.__importDefault)(require("lodash.clonedeep"));
function run() {
    var _a, _b, _c;
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        try {
            const isReadOnly = constants_1.BASE_FULL_NAME !== constants_1.HEAD_FULL_NAME;
            const data = {
                isReadOnly,
                sha: ((_a = github_1.context.payload.pull_request) === null || _a === void 0 ? void 0 : _a.head.sha) || github_1.context.sha,
                eventName: github_1.context.eventName,
                name: github_1.context.workflow,
                runId: github_1.context.runId,
                runNumber: github_1.context.runNumber,
                ref: github_1.context.ref,
                issueNumber: constants_1.ISSUE_NUMBER,
                issueSummary: (0, utils_1.processBooleanInput)('issueSummary', true),
                issueSummaryMethod: (0, utils_1.processEnumInput)('issueSummaryMethod', ['edit', 'refresh'], 'edit'),
                issueSummaryType: (0, utils_1.processEnumInput)('issueSummaryType', ['full', 'compact'], 'compact'),
                issueSummaryOnlyOnEvent: (0, utils_1.processBooleanInput)('issueSummaryOnlyOnEvent', false),
                repoHtmlUrl: (_b = github_1.context.payload.repository) === null || _b === void 0 ? void 0 : _b.html_url,
                prHtmlUrl: (_c = github_1.context.payload.pull_request) === null || _c === void 0 ? void 0 : _c.html_url,
                includeGlob: (0, utils_1.processArrayInput)('includeGlob', []),
                ignoreGlob: (0, utils_1.processArrayInput)('ignoreGlob', []),
                reportWarningsAsErrors: (0, utils_1.processBooleanInput)('reportWarningsAsErrors', false),
                reportIgnoredFiles: (0, utils_1.processBooleanInput)('reportIgnoredFiles', false),
                reportSuggestions: (0, utils_1.processBooleanInput)('reportSuggestions', true),
                reportWarnings: (0, utils_1.processBooleanInput)('reportWarnings', true),
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
                persist: {},
                eslint: {
                    errorOnUnmatchedPattern: (0, utils_1.processBooleanInput)('errorOnUnmatchedPattern', false),
                    extensions: (0, utils_1.processArrayInput)('extensions', [
                        '.js',
                        '.jsx',
                        '.ts',
                        '.tsx',
                    ]),
                    rulePaths: (0, utils_1.processArrayInput)('rulePaths', []),
                    followSymbolicLinks: (0, utils_1.processBooleanInput)('followSymbolicLinks', true),
                    useEslintIgnore: (0, utils_1.processBooleanInput)('useEslintIgnore', true),
                    ignorePath: (0, utils_1.processInput)('ignorePath', null) || undefined,
                    useEslintrc: (0, utils_1.processBooleanInput)('useEslintrc', true),
                    configFile: (0, utils_1.processInput)('configFile', null) || undefined,
                    fix: (0, utils_1.processBooleanInput)('useEslintrc', false),
                },
            };
            const client = (0, octokit_1.getOctokitClient)(data);
            switch (data.eventName) {
                case 'schedule': {
                    const workflowState = yield (0, artifacts_1.getWorkflowState)(client, data);
                    const artifacts = yield (0, artifacts_1.downloadArtifacts)(client, (artifacts) => artifacts.filter((artifact) => artifact.name.startsWith(constants_1.ARTIFACT_KEY_LINT_RESULTS)));
                    yield client.deserializeArtifacts(artifacts);
                    workflowState.scheduler.lastRunAt = new Date().toISOString();
                    yield (0, artifacts_1.updateWorkflowState)(client, data, workflowState);
                    break;
                }
                case 'closed': {
                    yield (0, artifacts_1.cleanupArtifactsForIssue)(client, data);
                    break;
                }
                case 'opened':
                case 'synchronize':
                default: {
                    data.persist = yield (0, artifacts_1.getIssueState)(client, data);
                    const startState = (0, lodash_clonedeep_1.default)(data.persist);
                    if (data.isReadOnly && !(0, utils_1.isSchedulerActive)(data)) {
                        console.warn(`[WARN] | Read Only & schedule not found, we will not run on this PR.`);
                        return;
                    }
                    yield (0, eslint_1.lintChangedFiles)(client, data);
                    if (data.isReadOnly) {
                        const artifacts = yield client.getSerializedArtifacts();
                        yield (0, artifacts_1.saveArtifact)((0, utils_1.getIssueLintResultsName)(data), artifacts);
                    }
                    else {
                        yield (0, issues_1.handleIssueComment)(client, data);
                        yield (0, utils_1.updateIssueStateIfNeeded)(client, startState, data);
                    }
                    yield (0, utils_1.updateWorkflowStateIfNeeded)(client, startState, data);
                    break;
                }
            }
        }
        catch (err) {
            core.error(err);
            core.setFailed(err.message);
        }
    });
}
run();
exports.default = run;
