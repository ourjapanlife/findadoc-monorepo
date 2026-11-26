import { describe, expect, it } from 'vitest'
import { ARCHIVE_REASON_MAX, archiveReasonForSubmit, isArchived } from '~/utils/archive'
import { sentenceKeyForServerCode } from '~/utils/formErrorMessage'

describe('archiveReasonForSubmit', () => {
    it('refuses an empty or blank reason', () => {
        expect(archiveReasonForSubmit('')).toBeNull()
        expect(archiveReasonForSubmit('   \n ')).toBeNull()
    })

    it('trims the reason and keeps it within the API limit', () => {
        expect(archiveReasonForSubmit('  Clinic closed  ')).toBe('Clinic closed')
        expect(archiveReasonForSubmit('x'.repeat(ARCHIVE_REASON_MAX + 20))).toHaveLength(ARCHIVE_REASON_MAX)
    })
})

describe('isArchived', () => {
    it('is true only for a record with an archive time', () => {
        expect(isArchived({ archivedAt: '2026-11-26T09:00:00.000+09:00' })).toBe(true)
        expect(isArchived({ archivedAt: null })).toBe(false)
        expect(isArchived({})).toBe(false)
        expect(isArchived(undefined)).toBe(false)
    })
})

describe('archive error sentences', () => {
    it('tells the moderator to reload when someone else changed the archive first', () => {
        expect(sentenceKeyForServerCode('ALREADY_ARCHIVED')).toBe('serverErrorMessages.alreadyArchived')
        expect(sentenceKeyForServerCode('NOT_ARCHIVED')).toBe('serverErrorMessages.notArchived')
    })
})
