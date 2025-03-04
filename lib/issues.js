"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleIssueComment = void 0;
const tslib_1 = require("tslib");
const constants_1 = require("./constants");
const markdown_1 = require("./utils/markdown");
function removeIssueSummary(client, data) {
    var _a, _b;
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        if ((_a = data.persist.action) === null || _a === void 0 ? void 0 : _a.userId) {
            data.persist.workflow.userId = (_b = data.persist.action) === null || _b === void 0 ? void 0 : _b.userId;
        }
        if (data.issueNumber && data.persist.workflow.userId) {
            const comments = yield client.rest.issues.listComments({
                owner: constants_1.OWNER,
                repo: constants_1.REPO,
                issue_number: data.issueNumber,
            });
            yield Promise.all(comments.data.reduce((arr, comment) => {
                var _a;
                if (((_a = comment.user) === null || _a === void 0 ? void 0 : _a.id) === data.persist.workflow.userId) {
                    arr.push(client.rest.issues.deleteComment({
                        owner: constants_1.OWNER,
                        repo: constants_1.REPO,
                        comment_id: comment.id,
                    }));
                }
                return arr;
            }, []));
        }
        else if (data.persist.issue.summaryId) {
            try {
                yield client.rest.issues.deleteComment({
                    owner: constants_1.OWNER,
                    repo: constants_1.REPO,
                    comment_id: data.persist.issue.summaryId,
                });
            }
            catch (error) {
            }
        }
        data.persist.issue.summaryId = undefined;
    });
}
function createIssueComment(client, issueNumber, data) {
    var _a;
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        const commentResult = yield client.rest.issues.createComment({
            owner: constants_1.OWNER,
            repo: constants_1.REPO,
            issue_number: issueNumber,
            body: (0, markdown_1.getResultMarkdownBody)(data),
        });
        data.persist.issue.summaryId = commentResult.data.id;
        data.persist.workflow.userId = (_a = commentResult.data.user) === null || _a === void 0 ? void 0 : _a.id;
    });
}
function handleIssueComment(client, data) {
    var _a;
    return (0, tslib_1.__awaiter)(this, void 0, void 0, function* () {
        const { state } = data;
        if (data.issueNumber && data.issueSummary) {
            if (!data.issueSummaryOnlyOnEvent ||
                state.errorCount > 0 ||
                state.warningCount > 0 ||
                state.fixableErrorCount > 0 ||
                state.fixableWarningCount > 0) {
                if (data.persist.issue.summaryId && data.issueSummaryMethod === 'edit') {
                    try {
                        const result = yield client.rest.issues.updateComment({
                            owner: constants_1.OWNER,
                            repo: constants_1.REPO,
                            comment_id: data.persist.issue.summaryId,
                            body: (0, markdown_1.getResultMarkdownBody)(data),
                        });
                        if (!data.persist.workflow.userId) {
                            data.persist.workflow.userId = (_a = result.data.user) === null || _a === void 0 ? void 0 : _a.id;
                        }
                    }
                    catch (error) {
                        data.persist.issue.summaryId = undefined;
                    }
                }
                else if (data.persist.issue.summaryId &&
                    data.issueSummaryMethod === 'refresh') {
                    yield removeIssueSummary(client, data);
                }
                if (!data.persist.issue.summaryId) {
                    yield createIssueComment(client, data.issueNumber, data);
                }
            }
            else if (data.issueSummaryOnlyOnEvent && data.persist.issue.summaryId) {
                yield removeIssueSummary(client, data);
            }
        }
    });
}
exports.handleIssueComment = handleIssueComment;
