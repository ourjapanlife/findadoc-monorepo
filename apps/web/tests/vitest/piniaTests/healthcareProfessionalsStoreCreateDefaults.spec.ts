import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Locale } from '@findadoc/graphql'

vi.mock('~/utils/graphql', () => ({
    gqlClient: { request: vi.fn() },
    graphQLClientRequestWithRetry: vi.fn()
}))

const { useHealthcareProfessionalsStore } = await import('~/stores/healthcareProfessionalsStore')

describe('professional create form spoken languages', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
    })

    it('starts with Japanese selected', () => {
        const store = useHealthcareProfessionalsStore()

        expect(store.createHealthcareProfessionalSectionFields.spokenLanguages).toEqual([Locale.JaJp])
    })

    it('goes back to Japanese only when the form is reset', () => {
        const store = useHealthcareProfessionalsStore()
        store.createHealthcareProfessionalSectionFields.spokenLanguages = [Locale.EnUs]

        store.resetCreateHealthcareProfessionalFields()

        expect(store.createHealthcareProfessionalSectionFields.spokenLanguages).toEqual([Locale.JaJp])
    })

    it('lets the moderator remove Japanese', () => {
        const store = useHealthcareProfessionalsStore()
        store.createHealthcareProfessionalSectionFields.spokenLanguages = []

        expect(store.createHealthcareProfessionalSectionFields.spokenLanguages).toEqual([])
    })
})
