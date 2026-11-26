/** The longest archive reason. The API and the database refuse a longer one. */
export const ARCHIVE_REASON_MAX = 500

/**
 * The reason to send when a moderator archives a facility or a professional: trimmed,
 * at most ARCHIVE_REASON_MAX characters. null means the moderator has not written one yet.
 */
export function archiveReasonForSubmit(value: string): string | null {
    const trimmed = value.trim()
    if (trimmed === '') {
        return null
    }
    return trimmed.slice(0, ARCHIVE_REASON_MAX)
}

/** True when the record carries an archive time. Archived records are hidden from the public. */
export function isArchived(record: { archivedAt?: string | null } | null | undefined): boolean {
    return typeof record?.archivedAt === 'string' && record.archivedAt !== ''
}
