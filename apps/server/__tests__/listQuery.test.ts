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

    it('does not filter a facility or professional list when the query is blank', () => {
        expect(facilityFilterQuery('   ').sql).not.toContain('where')
        expect(professionalFilterQuery('   ').sql).not.toContain('where')

        const facilities = facilityFilterQuery('Tokyo')
        const professionals = professionalFilterQuery('Ada')

        expect(facilities.sql).toContain('"facilities"."search_text" ilike $1')
        expect(facilities.parameters).toEqual(['%Tokyo%'])
        expect(professionals.sql).toContain('"hps"."search_text" ilike $1')
        expect(professionals.parameters).toEqual(['%Ada%'])
    })
})
