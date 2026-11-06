import { SubmissionKind, type Submission } from '@findadoc/graphql'

/**
 * Where a submission sits in moderation (#22). The database keeps `pending`, `under_review`,
 * `approved`, and `rejected`. Moderators read the last one as Declined.
 */
export const MODERATION_STATUS = {
    New: 'NEW',
    UnderReview: 'UNDER_REVIEW',
    Approved: 'APPROVED',
    Declined: 'DECLINED'
} as const

export type ModerationStatus = typeof MODERATION_STATUS[keyof typeof MODERATION_STATUS]

/** The pill a list row or the review screen shows. Feedback marks a visitor correction. */
export type ModerationPill = ModerationStatus | 'FEEDBACK'

type StatusFlags = Pick<Submission, 'isApproved' | 'isRejected' | 'isUnderReview'>

export function moderationStatus(submission: StatusFlags): ModerationStatus {
    if (submission.isApproved) {
        return MODERATION_STATUS.Approved
    }
    if (submission.isRejected) {
        return MODERATION_STATUS.Declined
    }
    if (submission.isUnderReview) {
        return MODERATION_STATUS.UnderReview
    }
    return MODERATION_STATUS.New
}

export const MODERATION_PILL_LABEL_KEYS: Readonly<Record<ModerationPill, string>> = {
    NEW: 'modListContainerItem.newSubmission',
    UNDER_REVIEW: 'modListContainerItem.underReviewSubmission',
    APPROVED: 'modListContainerItem.approvedSubmission',
    DECLINED: 'modListContainerItem.rejectedSubmission',
    FEEDBACK: 'modListContainerItem.feedbackSubmission'
}

export function isCorrection(submission: Pick<Submission, 'kind'>): boolean {
    return submission.kind === SubmissionKind.Correction
}

/** The User feedback queue: corrections nobody has approved or declined yet. */
export function isOpenCorrection(submission: Pick<Submission, 'kind'> & StatusFlags): boolean {
    return isCorrection(submission) && !submission.isApproved && !submission.isRejected
}

/** The status pill first, then the Feedback tag on a correction. Color is never the only signal. */
export function moderationPills(submission: Pick<Submission, 'kind'> & StatusFlags): ModerationPill[] {
    const status = moderationStatus(submission)
    return isCorrection(submission) ? [status, 'FEEDBACK'] : [status]
}
