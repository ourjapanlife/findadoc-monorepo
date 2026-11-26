import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    FacilityVerificationStatus,
    Locale,
    type Facility,
    type HealthcareProfessional
} from '@findadoc/graphql'

const graphQLClientRequestWithRetry = vi.fn()

vi.mock('~/utils/graphql', () => ({
    gqlClient: { request: vi.fn() },
    graphQLClientRequestWithRetry: (...args: unknown[]) => graphQLClientRequestWithRetry(...args)
}))

const { useFacilitiesStore } = await import('~/stores/facilitiesStore')
const { useHealthcareProfessionalsStore } = await import('~/stores/healthcareProfessionalsStore')

// Fake rows only.
const FACILITY = {
    id: 'facility-off-first-page',
    nameEn: 'Example Clinic',
    nameJa: '例クリニック',
    bookingEnabled: false,
    contact: { googleMapsUrl: 'https://maps.google.com/?cid=1', phone: '03-0000-0000' },
    healthcareProfessionalIds: [],
    online: false,
    openingHours: [],
    supportedLanguages: [],
    verificationStatus: FacilityVerificationStatus.Unverified,
    createdDate: '2026-11-01T00:00:00.000Z',
    updatedDate: '2026-11-01T00:00:00.000Z'
} satisfies Facility
const PROFESSIONAL = {
    id: 'professional-off-first-page',
    names: [
        { firstName: 'Taro', lastName: 'Example', locale: Locale.EnUs },
        { firstName: '太郎', lastName: '例', locale: Locale.JaJp }
    ],
    additionalCredentials: [],
    degrees: [],
    facilityIds: [],
    specialties: [],
    spokenLanguages: [],
    createdDate: '2026-11-01T00:00:00.000Z',
    updatedDate: '2026-11-01T00:00:00.000Z'
} satisfies HealthcareProfessional

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
        expect(store.healthcareProfessionalSectionFields.createdDate).toBe(PROFESSIONAL.createdDate)
    })

    it('drops a professional answer that lands after the editor left', async () => {
        let answer: (value: unknown) => void = () => undefined
        graphQLClientRequestWithRetry.mockImplementationOnce(() => new Promise(resolve => {
            answer = resolve
        }))
        const store = useHealthcareProfessionalsStore()

        const pending = store.loadSelectedHealthcareProfessional(PROFESSIONAL.id)
        store.cancelSelectedHealthcareProfessionalLoad()
        answer({ data: { healthcareProfessional: PROFESSIONAL } })

        expect(await pending).toBeUndefined()
        expect(store.healthcareProfessionalSectionFields.id).toBe('')
    })

    it('returns nothing for an id that does not exist', async () => {
        graphQLClientRequestWithRetry.mockResolvedValue({ data: { healthcareProfessional: null } })
        const store = useHealthcareProfessionalsStore()

        expect(await store.loadSelectedHealthcareProfessional('missing')).toBeUndefined()
        expect(store.selectedHealthcareProfessionalData).toBeUndefined()
    })
})

describe('professional moderation list', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        graphQLClientRequestWithRetry.mockReset()
    })

    it('loads the names of the clinics each professional is linked to', async () => {
        graphQLClientRequestWithRetry.mockImplementation((_request: unknown, _query: unknown, variables: unknown) => {
            if (typeof variables === 'object' && variables !== null && 'listFilters' in variables) {
                return Promise.resolve({
                    data: {
                        healthcareProfessionals: [{ ...PROFESSIONAL, facilityIds: [FACILITY.id] }],
                        healthcareProfessionalsTotalCount: 1
                    }
                })
            }
            return Promise.resolve({
                hasErrors: false,
                data: { f0: { id: FACILITY.id, nameEn: FACILITY.nameEn, nameJa: FACILITY.nameJa } }
            })
        })
        const store = useHealthcareProfessionalsStore()

        await store.loadHealthcareProfessionalList()

        expect(store.linkedFacilityNames[FACILITY.id]?.nameEn).toBe(FACILITY.nameEn)
    })
})

describe('archiving from the edit form', () => {
    const ARCHIVED_AT = '2026-11-26T00:00:00.000Z'

    beforeEach(() => {
        setActivePinia(createPinia())
        graphQLClientRequestWithRetry.mockReset()
    })

    function answerArchive(field: string, saved: unknown) {
        graphQLClientRequestWithRetry.mockImplementation((_request: unknown, _query: unknown, variables: unknown) => {
            if (typeof variables === 'object' && variables !== null && 'reason' in variables) {
                return Promise.resolve({ data: { [field]: saved } })
            }
            return Promise.resolve({ data: {} })
        })
    }

    it('keeps a facility archived after selecting another one and coming back', async () => {
        answerArchive('archiveFacility', { ...FACILITY, archivedAt: ARCHIVED_AT })
        const store = useFacilitiesStore()
        store.facilityData = [FACILITY, { ...FACILITY, id: 'other-facility' }]
        await store.loadSelectedFacility(FACILITY.id)

        await store.setFacilityArchived(FACILITY.id, { reason: 'Closed' })
        await store.loadSelectedFacility('other-facility')
        const reselected = await store.loadSelectedFacility(FACILITY.id)

        expect(reselected?.archivedAt).toBe(ARCHIVED_AT)
    })

    it('keeps a professional archived after selecting another one and coming back', async () => {
        answerArchive('archiveHealthcareProfessional', { ...PROFESSIONAL, archivedAt: ARCHIVED_AT })
        const store = useHealthcareProfessionalsStore()
        store.healthcareProfessionalsData = [PROFESSIONAL, { ...PROFESSIONAL, id: 'other-professional' }]
        await store.loadSelectedHealthcareProfessional(PROFESSIONAL.id)

        await store.setHealthcareProfessionalArchived(PROFESSIONAL.id, { reason: 'Retired' })
        await store.loadSelectedHealthcareProfessional('other-professional')
        const reselected = await store.loadSelectedHealthcareProfessional(PROFESSIONAL.id)

        expect(reselected?.archivedAt).toBe(ARCHIVED_AT)
    })
})
