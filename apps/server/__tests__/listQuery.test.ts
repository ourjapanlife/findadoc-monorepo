import { describe, expect, it } from 'vitest'
import { likeContainsPattern, listQueryValue } from '../src/search/listQuery.js'
import { applyFacilityFilters } from '../src/services/facilityService.js'
import { applyHpFilters } from '../src/services/healthcareProfessionalService.js'
import { compileOnlyDb } from './fixtures/compileOnlyDb.js'

function facilityFilterQuery(query: string) {
    return applyFacilityFilters(compileOnlyDb.selectFrom('facilities').selectAll(), { query }).compile()
}

function professionalFilterQuery(query: string) {
    return applyHpFilters(compileOnlyDb.selectFrom('hps').selectAll(), { query }).compile()
}

describe('listQueryValue', () => {
    it('treats a blank query as the unfiltered list', () => {
        expect(listQueryValue(undefined)).toBeNull()
        expect(listQueryValue(null)).toBeNull()
        expect(listQueryValue('   ')).toBeNull()
    })

    it('keeps a real query, including the surrounding letters a moderator typed', () => {
        expect(listQueryValue('  Tokyo  ')).toBe('Tokyo')
        expect(likeContainsPattern('100%_clinic')).toBe('%100\\%\\_clinic%')
    })

    it('does not filter a facility or professional list by text when the query is blank', () => {
        // The only condition left is the archive filter: the public never lists archived rows.
        expect(facilityFilterQuery('   ').sql).not.toContain('search_text')
        expect(facilityFilterQuery('   ').sql).toContain('where "facilities"."archived_at" is null')
        expect(professionalFilterQuery('   ').sql).not.toContain('search_text')
        expect(professionalFilterQuery('   ').sql).toContain('where "hps"."archived_at" is null')

        const facilities = facilityFilterQuery('Tokyo')
        const professionals = professionalFilterQuery('Ada')

        expect(facilities.sql).toContain('"facilities"."search_text" ilike $1')
        expect(facilities.parameters).toEqual(['%Tokyo%'])
        expect(professionals.sql).toContain('"hps"."search_text" ilike $1')
        expect(professionals.parameters).toEqual(['%ada%'])
    })
})
