import * as gqlTypes from '@findadoc/graphql'

/**
 * The submission as written to audit_logs. A correction's notes stay out: they are a
 * visitor's free text, the purge clears them after the decision, and audit_logs is not
 * purged. A listing is written as it was before.
 */
export function submissionAuditValue(submission: gqlTypes.Submission): gqlTypes.Submission {
    if (submission.kind !== gqlTypes.SubmissionKind.Correction) {
        return submission
    }
    return { ...submission, notes: undefined }
}
