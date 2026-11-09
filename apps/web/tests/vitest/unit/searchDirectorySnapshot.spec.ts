import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, effectScope } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import type { Facility, HealthcareProfessional } from '@findadoc/graphql'

const graphQLClientRequestWithRetry = vi.fn()

vi.mock('~/utils/graphql', () => ({
    gqlClient: { request: vi.fn() },
    publicReadRequest: () => vi.fn(),
    graphQLClientRequestWithRetry: (...args: unknown[]) => graphQLClientRequestWithRetry(...args)
}))

const {
    SEARCH_DIRECTORY_SNAPSHOT_PATH,
    SEARCH_DIRECTORY_SNAPSHOT_VERSION,
    parseSearchDirectorySnapshot,
    seedSearchDirectoryFromSnapshot
} = await import('~/utils/searchDirectorySnapshot')
const { writeSearchDirectorySnapshot } = await import('~/utils/nuxt/searchDirectorySnapshot')
const { createAppQueryClient } = await import('~/utils/queryClient')
const { queryKeys } = await import('~/utils/queryKeys')
const { useSearchDirectory } = await import('~/composables/useSearchDirectory')

const facility = {
    id: 'facility-1',
    nameEn: 'Snapshot Clinic',
    nameJa: 'スナップショット',
    healthcareProfessionalIds: ['professional-1'],
    contact: { address: { cityEn: 'Minato', cityJa: '港区', prefectureEn: 'Tokyo', prefectureJa: '東京都' } }
} as unknown as Facility
const professional = {
    id: 'professional-1',
    names: [{ firstName: 'Test', middleName: '', lastName: 'Doctor', locale: 'en_US' }],
    facilityIds: ['facility-1'],
    specialties: [],
    spokenLanguages: [],
    degrees: []
} as unknown as HealthcareProfessional

const GENERATED_AT = '2026-11-01T00:00:00.000Z'
const snapshotFile = {
    version: SEARCH_DIRECTORY_SNAPSHOT_VERSION,
    generatedAt: GENERATED_AT,
    facilities: [facility],
    professionals: [professional]
}

describe('parseSearchDirectorySnapshot (#242)', () => {
    it('reads the current file shape', () => {
        expect(parseSearchDirectorySnapshot(snapshotFile)).toEqual({
            directory: { facilities: [facility], professionals: [professional] },
            updatedAt: Date.parse(GENERATED_AT)
        })
    })

    it('ignores another version, missing lists, a bad date, or no file at all', () => {
        expect(parseSearchDirectorySnapshot({ ...snapshotFile, version: 0 })).toBeNull()
        expect(parseSearchDirectorySnapshot({ ...snapshotFile, facilities: undefined })).toBeNull()
        expect(parseSearchDirectorySnapshot({ ...snapshotFile, generatedAt: 'yesterday' })).toBeNull()
        expect(parseSearchDirectorySnapshot(null)).toBeNull()
        expect(parseSearchDirectorySnapshot('<html>')).toBeNull()
    })
})

describe('seedSearchDirectoryFromSnapshot (#242)', () => {
    const snapshot = { directory: { facilities: [facility], professionals: [professional] }, updatedAt: Date.parse(GENERATED_AT) }

    it('fills an empty directory with the snapshot, marked as old as the build', async () => {
        const queryClient = createAppQueryClient()

        await seedSearchDirectoryFromSnapshot(queryClient, () => Promise.resolve(snapshot))

        expect(queryClient.getQueryData(queryKeys.searchDirectory())).toEqual(snapshot.directory)
        expect(queryClient.getQueryState(queryKeys.searchDirectory())?.dataUpdatedAt).toBe(snapshot.updatedAt)
    })

    it('never replaces an answer the API already gave', async () => {
        const queryClient = createAppQueryClient()
        const fromApi = { facilities: [], professionals: [] }
        queryClient.setQueryData(queryKeys.searchDirectory(), fromApi)
        const fetchSnapshot = vi.fn(() => Promise.resolve(snapshot))

        await seedSearchDirectoryFromSnapshot(queryClient, fetchSnapshot)

        expect(queryClient.getQueryData(queryKeys.searchDirectory())).toBe(fromApi)
        expect(fetchSnapshot).not.toHaveBeenCalled()
    })

    it('keeps the API answer when it lands while the snapshot downloads', async () => {
        const queryClient = createAppQueryClient()
        const fromApi = { facilities: [], professionals: [] }

        await seedSearchDirectoryFromSnapshot(queryClient, () => {
            queryClient.setQueryData(queryKeys.searchDirectory(), fromApi)
            return Promise.resolve(snapshot)
        })

        expect(queryClient.getQueryData(queryKeys.searchDirectory())).toBe(fromApi)
    })

    it('downloads the snapshot once per app', async () => {
        const queryClient = createAppQueryClient()
        const fetchSnapshot = vi.fn(() => Promise.resolve(null))

        await seedSearchDirectoryFromSnapshot(queryClient, fetchSnapshot)
        await seedSearchDirectoryFromSnapshot(queryClient, fetchSnapshot)

        expect(fetchSnapshot).toHaveBeenCalledTimes(1)
    })
})

describe('the search page with a snapshot (#242)', () => {
    let unmount: (() => void) | undefined

    beforeEach(() => {
        setActivePinia(createPinia())
        graphQLClientRequestWithRetry.mockReset()
    })

    afterEach(() => {
        unmount?.()
        vi.unstubAllGlobals()
    })

    function mount() {
        const app = createApp({})
        app.use(VueQueryPlugin, { queryClient: createAppQueryClient() })
        const scope = effectScope()
        const directory = app.runWithContext(() => scope.run(() => useSearchDirectory()))
        unmount = () => scope.stop()
        if (!directory) throw new Error('useSearchDirectory did not run')
        return directory
    }

    it('shows the snapshot while the API has not answered, and still asks the API', async () => {
        vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(url === SEARCH_DIRECTORY_SNAPSHOT_PATH
            ? new Response(JSON.stringify(snapshotFile), { status: 200 })
            : new Response('', { status: 404 }))))
        graphQLClientRequestWithRetry.mockImplementation(() => new Promise(() => {}))

        const directory = mount()

        await vi.waitFor(() => expect(directory.totalResults.value).toBe(1))
        expect(directory.isLoading.value).toBe(false)
        expect(directory.searchResultsList.value[0]?.nameEn).toBe('Snapshot Clinic')
        expect(graphQLClientRequestWithRetry).toHaveBeenCalled()
    })

    it('shows the snapshot instead of the error when the API is down', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify(snapshotFile), { status: 200 }))))
        graphQLClientRequestWithRetry.mockResolvedValue({ data: {}, errors: [{ message: 'down', code: 'NETWORK' }], hasErrors: true })

        const directory = mount()

        await vi.waitFor(() => expect(directory.totalResults.value).toBe(1))
        await vi.waitFor(() => expect(graphQLClientRequestWithRetry).toHaveBeenCalled())
        expect(directory.hasLoadError.value).toBe(false)
    })

    it('falls back to the API alone when there is no snapshot', async () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('not found', { status: 404 }))))
        graphQLClientRequestWithRetry.mockImplementation(() => new Promise(() => {}))

        const directory = mount()
        await new Promise(resolve => setTimeout(resolve, 20))

        expect(directory.isLoading.value).toBe(true)
        expect(directory.totalResults.value).toBe(0)
    })
})

describe('writeSearchDirectorySnapshot (#242)', () => {
    let publicDir: string

    beforeEach(async () => {
        publicDir = await mkdtemp(join(tmpdir(), 'snapshot-'))
    })

    afterEach(async () => {
        await rm(publicDir, { recursive: true, force: true })
    })

    it('writes the complete directory with its build time', async () => {
        const written = await writeSearchDirectorySnapshot(
            publicDir,
            { facilities: [facility], professionals: [professional], complete: true },
            new Date(GENERATED_AT)
        )

        expect(written).toBe(true)
        const file = JSON.parse(await readFile(join(publicDir, SEARCH_DIRECTORY_SNAPSHOT_PATH), 'utf8'))
        expect(parseSearchDirectorySnapshot(file)?.directory.facilities).toHaveLength(1)
        expect(file.generatedAt).toBe(GENERATED_AT)
    })

    it('writes nothing for a partial directory, which would hide clinics', async () => {
        const written = await writeSearchDirectorySnapshot(
            publicDir,
            { facilities: [facility], professionals: [], complete: false }
        )

        expect(written).toBe(false)
        await expect(readFile(join(publicDir, SEARCH_DIRECTORY_SNAPSHOT_PATH), 'utf8')).rejects.toThrow()
    })

    it('writes nothing when the build had no directory', async () => {
        expect(await writeSearchDirectorySnapshot(publicDir, null)).toBe(false)
    })
})
