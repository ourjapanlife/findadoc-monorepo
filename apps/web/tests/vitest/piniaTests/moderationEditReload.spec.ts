import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Facility, HealthcareProfessional } from '@findadoc/graphql'

const graphQLClientRequestWithRetry = vi.fn()

vi.mock('~/utils/graphql', () => ({
    gqlClient: { request: vi.fn() },
    graphQLClientRequestWithRetry: (...args: unknown[]) => graphQLClientRequestWithRetry(...args)
}))

const { useFacilitiesStore } = await import('~/stores/facilitiesStore')
const { useHealthcareProfessionalsStore } = await import('~/stores/healthcareProfessionalsStore')

// Fake rows only.
const FACILITY = { id: 'facility-off-first-page', nameEn: 'Example Clinic', nameJa: '例クリニック' } as Facility
const PROFESSIONAL = {
    id: 'professional-off-first-page',
    names: [],
    facilityIds: [],
    degrees: [],
    specialties: [],
    spokenLanguages: []
} as unknown as HealthcareProfessional

function variablesOf(call: unknown[]): Record<string, unknown> {
    return call[2] as Record<string, unknown>
}

describe('moderation edit forms after a reload', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        graphQLClientRequestWithRetry.mockReset()
    })

    it('fetches a facility by id when the first page does not hold it', async () => {
        graphQLClientRequestWithRetry.mockResolvedValue({ data: { facility: FACILITY } })
        const store = useFacilitiesStore()

        const loaded = await store.loadSelectedFacility(FACILITY.id)

        expect(loaded?.id).toBe(FACILITY.id)
        expect(store.selectedFacilityData?.id).toBe(FACILITY.id)
        expect(variablesOf(graphQLClientRequestWithRetry.mock.calls[0] ?? [])).toEqual({ id: FACILITY.id })
    })

    it('uses the facility already in memory without a request', async () => {
        const store = useFacilitiesStore()
        store.facilityData = [FACILITY]

        const loaded = await store.loadSelectedFacility(FACILITY.id)

        expect(loaded?.id).toBe(FACILITY.id)
        expect(graphQLClientRequestWithRetry).not.toHaveBeenCalled()
    })

    it('drops a slow facility answer once a newer one was asked for', async () => {
        let answerFirst: (value: unknown) => void = () => undefined
        graphQLClientRequestWithRetry
            .mockImplementationOnce(() => new Promise(resolve => {
                answerFirst = resolve
            }))
            .mockResolvedValueOnce({ data: { facility: { ...FACILITY, id: 'newer' } } })
        const store = useFacilitiesStore()

        const older = store.loadSelectedFacility(FACILITY.id)
        await store.loadSelectedFacility('newer')
        answerFirst({ data: { facility: FACILITY } })

        expect(await older).toBeUndefined()
        expect(store.selectedFacilityData?.id).toBe('newer')
    })

    it('fetches a professional by id and fills the edit fields', async () => {
        graphQLClientRequestWithRetry.mockResolvedValue({ data: { healthcareProfessional: PROFESSIONAL } })
        const store = useHealthcareProfessionalsStore()

        const loaded = await store.loadSelectedHealthcareProfessional(PROFESSIONAL.id)

        expect(loaded?.id).toBe(PROFESSIONAL.id)
        expect(store.healthcareProfessionalSectionFields.id).toBe(PROFESSIONAL.id)
    })

    it('returns nothing for an id that does not exist', async () => {
        graphQLClientRequestWithRetry.mockResolvedValue({ data: { healthcareProfessional: null } })
        const store = useHealthcareProfessionalsStore()

        expect(await store.loadSelectedHealthcareProfessional('missing')).toBeUndefined()
        expect(store.selectedHealthcareProfessionalData).toBeUndefined()
    })
})
