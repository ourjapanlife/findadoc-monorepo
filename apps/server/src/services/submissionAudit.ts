import type * as gqlTypes from '@findadoc/graphql'

/**
 * The submission as written to audit_logs (#236). Notes stay out for every submission: they
 * are free text that can hold personal data, the daily purge clears them from the row, and
 * audit_logs is not purged.
 */
export function submissionAuditValue(submission: gqlTypes.Submission): gqlTypes.Submission {
    return { ...submission, notes: undefined }
}
