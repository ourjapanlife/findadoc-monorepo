/// <reference types="vitest/globals" />
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect } from 'chai'
import type { NitroConfig } from 'nitropack'

// Fake directory rows only.
const built = {
    directory: { 'facility-1': { id: 'facility-1', nameEn: 'Test Clinic' } },
    professionalDirectory: { 'doctor-1': { id: 'doctor-1' } },
    paths: Array.from({ length: 40 }, (_, i) => `/clinic/tokyo/minato/test-clinic-${i}--facility-${i}`),
    professionalPaths: ['/doctor/test-doctor--doctor-1'],
    hubPaths: ['/tokyo', '/tokyo/minato'],
    facetPaths: [],
    officialCities: [{ id: 'city-1', nameEn: 'Minato', nameJa: '港区', slug: 'minato', prefectureEn: 'Tokyo' }],
    rows: { facilities: [], professionals: [], complete: true }
}

const fetchDirectory = vi.fn(async () => built)

vi.mock('@/utils/clinicPrerender', async importOriginal => ({
    ...await importOriginal<typeof import('@/utils/clinicPrerender')>(),
    buildClinicPrerenderDirectory: () => fetchDirectory()
}))

const STATIC_ROUTES = ['/', '/about', '/sitemap.xml']
const DIRECTORY_PAGES = built.paths.length + built.professionalPaths.length + built.hubPaths.length

async function generateConfig(): Promise<NitroConfig> {
    const { applyEntityDirectoryToNitro } = await import('@/utils/nuxt/entityDirectoryGenerate')
    const nitroConfig: NitroConfig = { runtimeConfig: { app: {} }, prerender: { routes: [...STATIC_ROUTES] } }
    await applyEntityDirectoryToNitro(nitroConfig)
    return nitroConfig
}

describe('generate-time directory', () => {
    const argv = process.argv

    beforeEach(() => {
        vi.resetModules()
        fetchDirectory.mockClear()
        process.argv = ['node', 'nuxi', 'generate']
        vi.stubEnv('NUXT_SKIP_DIRECTORY_PRERENDER', 'false')
        vi.stubEnv('NUXT_PRERENDER_SHARD', '')
        vi.stubEnv('NUXT_PRERENDER_DIRECTORY_FILE', '')
    })

    afterEach(() => {
        process.argv = argv
        vi.unstubAllEnvs()
    })

    it('is bundled as modules, not runtime config, so a prerendered route does not copy it (#21)', async () => {
        const nitroConfig = await generateConfig()

        expect(Object.keys(nitroConfig.runtimeConfig ?? {})).to.deep.equal(['app'])
        expect(nitroConfig.virtual?.['#clinic-directory']).to.include('facility-1')
        expect(nitroConfig.virtual?.['#doctor-directory']).to.include('doctor-1')
        expect(nitroConfig.virtual?.['#prerender-cities']).to.include('"baked":true').and.include('港区')
    })

    it('gives Nitro an unbaked city list outside generate, so the sitemap route still resolves it', async () => {
        const { applyEntityDirectoryToNitro } = await import('@/utils/nuxt/entityDirectoryGenerate')
        const devConfig: NitroConfig = { dev: true }
        process.argv = ['node', 'nuxi', 'dev']
        const buildConfig: NitroConfig = {}

        await applyEntityDirectoryToNitro(devConfig)
        await applyEntityDirectoryToNitro(buildConfig)

        for (const config of [devConfig, buildConfig]) {
            expect(config.virtual?.['#prerender-cities']).to.include('baked: false')
            expect(config.prerender?.routes).to.equal(undefined)
        }
        expect(fetchDirectory.mock.calls).to.have.length(0)
    })

    it('lists every directory page in both locales when the build is not split', async () => {
        const routes = (await generateConfig()).prerender?.routes ?? []

        expect(routes).to.include.members([...STATIC_ROUTES, ...built.paths, '/ja-JP/tokyo/minato'])
        expect(routes).to.have.length(STATIC_ROUTES.length + 2 * DIRECTORY_PAGES)
    })

    it('renders from the saved directory without calling the API', async () => {
        const { writePrerenderDirectorySnapshot } = await import('@/utils/prerenderDirectorySnapshot')
        const file = join(mkdtempSync(join(tmpdir(), 'prerender-')), 'directory.json')
        writePrerenderDirectorySnapshot(file, built as never)
        vi.stubEnv('NUXT_PRERENDER_DIRECTORY_FILE', file)

        const routes = (await generateConfig()).prerender?.routes ?? []

        expect(fetchDirectory.mock.calls).to.have.length(0)
        expect(routes).to.include(built.paths[0])
    })

    it('refuses a saved directory it cannot read instead of fetching a different one', async () => {
        const file = join(mkdtempSync(join(tmpdir(), 'prerender-')), 'directory.json')
        writeFileSync(file, JSON.stringify({ version: 0, directory: {} }))
        vi.stubEnv('NUXT_PRERENDER_DIRECTORY_FILE', file)

        let failed = false
        try {
            await generateConfig()
        } catch {
            failed = true
        }

        expect(failed).to.equal(true)
        expect(fetchDirectory.mock.calls).to.have.length(0)
    })

    it('splits the directory pages so the shards render each page exactly once', async () => {
        const perShard: string[][] = []
        for (const shard of ['0/3', '1/3', '2/3']) {
            vi.resetModules()
            vi.stubEnv('NUXT_PRERENDER_SHARD', shard)
            const routes = (await generateConfig()).prerender?.routes ?? []
            perShard.push(routes.filter((route): route is string => typeof route === 'string'))
        }

        const all = perShard.flat()
        expect(new Set(all).size).to.equal(all.length)
        expect(all).to.have.length(STATIC_ROUTES.length + 2 * DIRECTORY_PAGES)
        expect(perShard[0]).to.include.members(STATIC_ROUTES)
        expect(perShard[1]).to.not.include('/')
        expect(perShard[2]).to.not.include('/sitemap.xml')
        for (const routes of perShard) {
            for (const route of routes.filter(path => path.startsWith('/ja-JP/'))) {
                expect(routes).to.include(route.replace('/ja-JP', ''))
            }
        }
    })
})
