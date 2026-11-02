import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { JapaneseInsurance } from '@findadoc/graphql'

vi.mock('~/utils/graphql', () => ({
    gqlClient: { request: vi.fn() },
    graphQLClientRequestWithRetry: vi.fn()
}))

const { useFacilitiesStore } = await import('~/stores/facilitiesStore')

describe('facility create form Japanese insurance (#18)', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('starts unknown instead of assuming the clinic takes it', () => {
        const store = useFacilitiesStore()

        expect(store.createFacilityFields.japaneseInsurance).toBe('')
        expect(store.createFacilityFields.japaneseInsuranceSource).toBe('')
    })

    it('goes back to unknown when the form is reset', () => {
        const store = useFacilitiesStore()
        store.createFacilityFields.japaneseInsurance = JapaneseInsurance.NotAccepted
        store.createFacilityFields.japaneseInsuranceSource = 'https://clinic.test'

        store.resetCreateFacilityFields()

        expect(store.createFacilityFields.japaneseInsurance).toBe('')
        expect(store.createFacilityFields.japaneseInsuranceSource).toBe('')
    })
})
