import { describe, expect, it } from 'vitest'
import {
    databaseOrderColumn,
    FACILITY_ORDER_COLUMNS,
    PROFESSIONAL_ORDER_COLUMNS,
    SUBMISSION_ORDER_COLUMNS
} from '../src/search/orderColumn.js'

describe('databaseOrderColumn', () => {
    it('maps a GraphQL field onto the column the list is stored in', () => {
        expect(databaseOrderColumn('createdDate', SUBMISSION_ORDER_COLUMNS)).toBe('created_date')
        expect(databaseOrderColumn('healthcareProfessionalName', SUBMISSION_ORDER_COLUMNS))
            .toBe('healthcare_professional_name')
        expect(databaseOrderColumn('nameEn', FACILITY_ORDER_COLUMNS)).toBe('name_en')
        expect(databaseOrderColumn('updatedDate', PROFESSIONAL_ORDER_COLUMNS)).toBe('updated_date')
    })

    it('keeps the default order when the field is not a column', () => {
        expect(databaseOrderColumn('isUnderReview', SUBMISSION_ORDER_COLUMNS)).toBeNull()
        expect(databaseOrderColumn(undefined, FACILITY_ORDER_COLUMNS)).toBeNull()
        expect(databaseOrderColumn('', PROFESSIONAL_ORDER_COLUMNS)).toBeNull()
    })
})
