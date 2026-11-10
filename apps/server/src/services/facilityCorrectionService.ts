import * as gqlTypes from '@findadoc/graphql'
import type { Selectable, Transaction } from 'kysely'
import { db } from '../kyselyClient.js'
import { errorLogFields, logger } from '../logger.js'
import { ErrorCode, type Error as ValidationError, type Result } from '../result.js'
import {
    SUBMISSION_KIND,
    SUBMISSION_STATUS,
    type Database,
    type SubmissionsTable
} from '../typeDefs/kyselyTypes.js'
import { asJsonb } from '../../utils/dbUtils.js'
import { validateFacilityCorrectionInput } from '../validation/validateFacilityCorrection.js'
import { validateUpdateFacilityInput } from '../validation/validateFacility.js'
import {
    correctionChangesFromInput,
    facilityUpdateFromCorrection,
    storedContactText
} from '../corrections/facilityCorrection.js'
import { FacilityUpdateRejected, updateFacilityInTransaction } from './facilityService.js'
import { createAuditLog } from './auditLogServiceSupabase.js'
import { submissionAuditValue } from './submissionAudit.js'
import { submissionFromRow } from './mappersEntityService.js'
import { submissionRetainUntil } from '../submissions/notesRetention.js'

/** An expected refusal while approving a correction. The errors go back to the moderator. */
export class CorrectionApprovalRejected extends Error {
    constructor(readonly validationErrors: ValidationError[]) {
        super('CORRECTION_APPROVAL_REJECTED')
    }
}

const FAILED: Result<gqlTypes.FacilityCorrectionResult> = {
    data: { isSuccessful: false },
    hasErrors: true,
    errors: [{ field: 'submitFacilityCorrection', errorCode: ErrorCode.SERVER_ERROR, httpStatus: 500 }]
}

function refused(field: string, errorCode: ErrorCode, httpStatus: number): Result<gqlTypes.FacilityCorrectionResult> {
    return { data: { isSuccessful: false }, hasErrors: true, errors: [{ field, errorCode, httpStatus }] }
}

type Publication = 'missing' | 'unpublished' | 'published'

/** Published means the clinic page exists: a city, and not UNVERIFIED_LOCATION. */
function publicationOf(facility: { city_id: string | null, verification_status: string } | undefined): Publication {
    if (facility === undefined) {
        return 'missing'
    }
    if (facility.city_id === null
        || facility.verification_status === gqlTypes.FacilityVerificationStatus.UnverifiedLocation) {
        return 'unpublished'
    }
    return 'published'
}

/**
 * Reads publication inside the caller's transaction. FOR SHARE holds the row, so a moderator
 * cannot unpublish the facility between this check and the caller's write.
 */
async function lockedPublication(transaction: Transaction<Database>, facilityId: string): Promise<Publication> {
    const facility = await transaction.selectFrom('facilities')
        .select(['city_id', 'verification_status'])
        .where('id', '=', facilityId)
        .forShare()
        .executeTakeFirst()

    return publicationOf(facility)
}

/**
 * Stores a visitor's report on a published clinic as a pending CORRECTION submission (#22).
 * The visitor gets no id back. Nothing from the input is logged: notes are free text.
 */
export async function submitFacilityCorrection(
    input: gqlTypes.FacilityCorrectionInput,
    updatedBy: string
): Promise<Result<gqlTypes.FacilityCorrectionResult>> {
    const validation = validateFacilityCorrectionInput(input)

    if (validation.hasErrors) {
        return { data: { isSuccessful: false }, hasErrors: true, errors: validation.errors }
    }

    try {
        const now = new Date().toISOString()
        const outcome = await db.transaction().execute(async transaction => {
            const publication = await lockedPublication(transaction, input.facilityId)
            if (publication !== 'published') {
                return { publication, submissionId: null }
            }

            const inserted = await transaction
                .insertInto('submissions')
                .values({
                    kind: SUBMISSION_KIND.CORRECTION,
                    status: SUBMISSION_STATUS.PENDING,
                    facilities_id: input.facilityId,
                    hps_id: null,
                    google_maps_url: null,
                    healthcare_professional_name: null,
                    spoken_languages: null,
                    facility_partial: null,
                    healthcare_professionals_partial: null,
                    firestore_id: null,
                    correction_reasons: input.reasons,
                    correction_changes: asJsonb(correctionChangesFromInput(input)),
                    reporter_relation: input.reporterRelation ?? null,
                    duplicate_listing_url: input.duplicateListingUrl?.trim() ?? null,
                    notes: input.notes?.trim() ? input.notes.trim() : null,
                    retain_until: submissionRetainUntil(SUBMISSION_STATUS.PENDING, now),
                    created_date: now,
                    updated_date: now
                })
                .returningAll()
                .executeTakeFirstOrThrow()

            await createAuditLog(transaction, {
                actionType: gqlTypes.ActionType.Create,
                objectType: gqlTypes.ObjectType.Submission,
                updatedBy,
                newValue: submissionAuditValue(submissionFromRow(inserted))
            })

            return { publication, submissionId: inserted.id }
        })

        if (outcome.publication === 'missing') {
            return refused('facilityId', ErrorCode.NOT_FOUND, 404)
        }
        if (outcome.submissionId === null) {
            return refused('facilityId', ErrorCode.FACILITY_NOT_PUBLISHED, 400)
        }

        const submissionId = outcome.submissionId
        logger.info(`DB-CREATE: correction ${submissionId} created`)
        return { data: { isSuccessful: true }, hasErrors: false }
    } catch (error) {
        logger.error('submitFacilityCorrection failed', errorLogFields(error))
        return FAILED
    }
}

/**
 * Approves a correction inside approveSubmission's transaction. Only the fields the visitor
 * changed are written to the facility, through updateFacilityInTransaction, so the city rules
 * and the facility audit trail apply. CLOSED, DUPLICATE, and OTHER change nothing on their own:
 * unpublishing or merging stays a separate moderator action.
 * The status change is a compare-and-set on the status read under the row lock.
 */
export async function approveCorrectionInTransaction(
    transaction: Transaction<Database>,
    submission: Selectable<SubmissionsTable>,
    updatedBy: string
): Promise<Selectable<SubmissionsTable>> {
    const facilityId = submission.facilities_id
    if (facilityId === null) {
        throw new CorrectionApprovalRejected([{ field: 'facilityId', errorCode: ErrorCode.REQUIRED, httpStatus: 400 }])
    }

    const changes = submission.correction_changes ?? {}
    const reasons = submission.correction_reasons ?? []

    if (reasons.includes(gqlTypes.FacilityCorrectionReason.WrongCity) && changes.cityId === undefined) {
        throw new CorrectionApprovalRejected([
            { field: 'correctionCityId', errorCode: ErrorCode.CORRECTION_CITY_REQUIRED, httpStatus: 400 }
        ])
    }

    // Locked for the rest of the approval, so publication cannot change before the write.
    const stored = await transaction.selectFrom('facilities')
        .select(['contact', 'city_id', 'verification_status'])
        .where('id', '=', facilityId)
        .forUpdate()
        .executeTakeFirst()
    if (stored === undefined) {
        throw new CorrectionApprovalRejected([{ field: 'facilityId', errorCode: ErrorCode.NOT_FOUND, httpStatus: 404 }])
    }

    const update = facilityUpdateFromCorrection(changes, storedContactText(stored.contact))

    if (Object.keys(update).length > 0) {
        // The visitor reported on a published page. A moderator may unpublish a CLOSED clinic
        // and then approve the report, so only a correction that changes fields is refused.
        if (publicationOf(stored) !== 'published') {
            throw new CorrectionApprovalRejected([
                { field: 'facilityId', errorCode: ErrorCode.FACILITY_NOT_PUBLISHED, httpStatus: 409 }
            ])
        }
        const validation = validateUpdateFacilityInput(update)
        if (validation.hasErrors) {
            throw new CorrectionApprovalRejected(validation.errors ?? [])
        }
        try {
            await updateFacilityInTransaction(transaction, facilityId, update, updatedBy)
        } catch (error) {
            if (error instanceof FacilityUpdateRejected) {
                throw new CorrectionApprovalRejected(error.result.errors ?? [])
            }
            throw error
        }
    }

    const now = new Date()
    const updated = await transaction
        .updateTable('submissions')
        .set({
            status: SUBMISSION_STATUS.APPROVED,
            retain_until: submissionRetainUntil(SUBMISSION_STATUS.APPROVED, submission.created_date, now),
            updated_date: now.toISOString()
        })
        .where('id', '=', submission.id)
        .where('status', '=', submission.status)
        .returningAll()
        .executeTakeFirst()

    if (updated === undefined) {
        throw new CorrectionApprovalRejected([
            { field: 'status', errorCode: ErrorCode.SUBMISSION_STATUS_CHANGED, httpStatus: 409 }
        ])
    }
    return updated
}
