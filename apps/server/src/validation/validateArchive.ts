import { ErrorCode, type Result } from '../result.js'

/** The longest archive reason. The database CHECK `*_archive_reason` holds the same limit. */
export const ARCHIVE_REASON_MAX = 500

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function invalid(field: string, errorCode: ErrorCode): Result<unknown> {
    return { data: undefined, hasErrors: true, errors: [{ field, errorCode, httpStatus: 400 }] }
}

/** The id of the facility or professional to archive or unarchive must be a uuid. */
export function validateArchiveId(id: unknown): Result<unknown> {
    if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
        return invalid('id', ErrorCode.INVALID_ID)
    }

    return { data: undefined, hasErrors: false, errors: [] }
}

/**
 * Archiving needs a uuid and a reason. The reason is trimmed, must not be blank,
 * and is at most ARCHIVE_REASON_MAX characters.
 */
export function validateArchiveInput(id: unknown, reason: unknown): Result<unknown> {
    const idResult = validateArchiveId(id)

    if (idResult.hasErrors) {
        return idResult
    }

    if (typeof reason !== 'string' || reason.trim() === '') {
        return invalid('reason', ErrorCode.REQUIRED)
    }

    if (reason.trim().length > ARCHIVE_REASON_MAX) {
        return invalid('reason', ErrorCode.INVALID_LENGTH_TOO_LONG)
    }

    return { data: undefined, hasErrors: false, errors: [] }
}
