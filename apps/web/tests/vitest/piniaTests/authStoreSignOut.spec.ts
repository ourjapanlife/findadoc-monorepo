import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNuxtApp } from '#app'

const logout = vi.fn(() => Promise.resolve())
const fakeAuth0 = { logout, isLoading: { value: false }, isAuthenticated: { value: true }, user: { value: undefined } }

vi.mock('~/utils/auth0', () => ({ auth0: fakeAuth0, initializeAuth0: () => Promise.resolve({ install: () => {} }) }))
vi.mock('../../../utils/auth0.js', () => ({ auth0: fakeAuth0, initializeAuth0: () => Promise.resolve({ install: () => {} }) }))

const { useAuthStore } = await import('~/stores/authStore')
const { queryKeys } = await import('~/utils/queryKeys')

describe('signing out', () => {
    beforeEach(() => {
        setActivePinia(createPinia())
        logout.mockClear()
    })

    it('clears every cached read, so a signed-in user\'s data does not stay in memory (#242)', async () => {
        const { $queryClient } = useNuxtApp()
        $queryClient.setQueryData(queryKeys.searchDirectory(), { facilities: [], professionals: [] })
        $queryClient.setQueryData(['moderation', 'submissions'], [{ id: 'submission-1' }])

        await useAuthStore().logout()

        expect($queryClient.getQueryCache().getAll()).toHaveLength(0)
        expect(logout).toHaveBeenCalledTimes(1)
    })

    it('clears the cache before Auth0 leaves the page', async () => {
        const { $queryClient } = useNuxtApp()
        $queryClient.setQueryData(['moderation', 'submissions'], [{ id: 'submission-1' }])
        let entriesWhenAuth0Ran = -1
        logout.mockImplementationOnce(() => {
            entriesWhenAuth0Ran = $queryClient.getQueryCache().getAll().length
            return Promise.resolve()
        })

        await useAuthStore().logout()

        expect(entriesWhenAuth0Ran).toBe(0)
    })
})
