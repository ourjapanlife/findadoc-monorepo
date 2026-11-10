import type { NitroConfig } from 'nitropack'
import {
    buildClinicPrerenderDirectory,
    isNuxtGenerateCommand,
    skipDirectoryPrerender,
    writeClinicPrerenderCache
} from '../clinicPrerender'
import { prefectureHubPaths } from '../hubIndex'
import { DIRECTORY_PRERENDER_LOCALE_CODES, withDirectoryLocaleVariants } from '../localePath'
import { PRERENDER_DIRECTORY_FILE_ENV, readPrerenderDirectorySnapshot } from '../prerenderDirectorySnapshot'
import { isPrimaryPrerenderShard, pathsForShard, prerenderShardFromEnv } from '../prerenderShard'

type EntityDirectoryBuild = Awaited<ReturnType<typeof buildClinicPrerenderDirectory>>

let entityDirectoryBuild: EntityDirectoryBuild | undefined
let entityDirectoryBuildPromise: Promise<EntityDirectoryBuild> | undefined

/** The saved directory when `NUXT_PRERENDER_DIRECTORY_FILE` names one, otherwise a fresh fetch. */
async function loadEntityDirectory(): Promise<EntityDirectoryBuild> {
    const file = process.env[PRERENDER_DIRECTORY_FILE_ENV]?.trim()
    if (!file) {
        return buildClinicPrerenderDirectory()
    }

    const built = readPrerenderDirectorySnapshot(file)
    writeClinicPrerenderCache(built.directory)
    console.warn(`[clinic prerender] directory read from ${PRERENDER_DIRECTORY_FILE_ENV}`)
    return built
}

/**
 * One directory for `nuxi generate`. Vite plugins and Nitro hooks share this
 * so clinic and doctor HTML is filled from memory instead of `facility(id)` /
 * `healthcareProfessional(id)` per page. A sharded build reads it from a file,
 * so every shard renders from the same directory.
 */
export async function entityDirectoryForGenerate(): Promise<EntityDirectoryBuild> {
    if (!isNuxtGenerateCommand() || skipDirectoryPrerender()) {
        return null
    }

    entityDirectoryBuildPromise ??= loadEntityDirectory().then(built => {
        entityDirectoryBuild = built
        return built
    })

    return entityDirectoryBuildPromise
}

function directoryVitePlugin(
    moduleId: '#clinic-directory' | '#doctor-directory',
    directoryOf: (built: NonNullable<EntityDirectoryBuild>) => unknown
) {
    const resolvedId = `\0${moduleId.slice(1)}`

    return {
        name: moduleId.slice(1),
        resolveId(id: string) {
            if (id === moduleId) {
                return resolvedId
            }
        },
        load(this: { environment?: { name?: string } }, id: string) {
            if (id !== resolvedId) {
                return
            }

            if (this.environment?.name === 'client') {
                return 'export default {}'
            }

            const directory = entityDirectoryBuild ? directoryOf(entityDirectoryBuild) : {}
            return `export default ${JSON.stringify(directory)}`
        }
    }
}

/**
 * Prefecture hubs that exist in this generate (`["/tokyo","/hokkaido"]`), or
 * `null` outside generate. Baked into the client and SSR bundles so homepage
 * chips and hydration stay in sync — public runtimeConfig cannot hold an array
 * and JSON strings were unreliable across Nitro workers.
 */
function generatedPrefectureHubsModuleSource(): string {
    if (!isNuxtGenerateCommand()) {
        return 'export default null'
    }

    const hubs = entityDirectoryBuild
        ? prefectureHubPaths(entityDirectoryBuild.hubPaths)
        : []
    return `export default ${JSON.stringify(hubs)}`
}

/**
 * The official city list for hub names. A module, not runtime config: Nitro deep-copies runtime
 * config for every prerendered route (#21). The browser gets `baked: false` and fetches cities.
 */
function prerenderCitiesModuleSource(): string {
    const cities = entityDirectoryBuild?.officialCities
    return `export default ${JSON.stringify(cities ? { baked: true, cities } : { baked: false, cities: [] })}`
}

function generatedFacetPathsModuleSource(): string {
    if (!isNuxtGenerateCommand()) {
        return 'export default null'
    }

    return `export default ${JSON.stringify(entityDirectoryBuild?.facetPaths ?? [])}`
}

function generatedDirectoryLinksVitePlugin(
    moduleId: '#generated-prefecture-hubs' | '#generated-facet-paths',
    sourceOf: () => string
) {
    const resolvedId = `\0${moduleId.slice(1)}`

    return {
        name: moduleId.slice(1),
        resolveId(id: string) {
            if (id === moduleId) {
                return resolvedId
            }
        },
        async load(id: string) {
            if (id !== resolvedId) {
                return
            }

            if (isNuxtGenerateCommand()) {
                await entityDirectoryForGenerate()
            }

            return sourceOf()
        }
    }
}

function prerenderCitiesVitePlugin() {
    const resolvedId = '\0prerender-cities'

    return {
        name: 'prerender-cities',
        resolveId(id: string) {
            if (id === '#prerender-cities') {
                return resolvedId
            }
        },
        async load(this: { environment?: { name?: string } }, id: string) {
            if (id !== resolvedId) {
                return
            }
            if (this.environment?.name === 'client' || !isNuxtGenerateCommand()) {
                return 'export default { baked: false, cities: [] }'
            }
            await entityDirectoryForGenerate()
            return prerenderCitiesModuleSource()
        }
    }
}

export function entityDirectoryVitePlugins() {
    return [
        directoryVitePlugin('#clinic-directory', built => built.directory),
        directoryVitePlugin('#doctor-directory', built => built.professionalDirectory),
        prerenderCitiesVitePlugin(),
        generatedDirectoryLinksVitePlugin('#generated-prefecture-hubs', generatedPrefectureHubsModuleSource),
        generatedDirectoryLinksVitePlugin('#generated-facet-paths', generatedFacetPathsModuleSource)
    ]
}

/**
 * Fetch the directory before the bundles build, so the virtual modules can inline it.
 * Nothing goes into runtime config: Nitro deep-copies runtime config for every prerendered route,
 * so a directory there made each page slower as the directory grew (#21).
 */
export async function applyEntityDirectoryToNuxt() {
    if (!isNuxtGenerateCommand()) {
        return
    }

    await entityDirectoryForGenerate()
}

export async function applyEntityDirectoryToNitro(nitroConfig: NitroConfig) {
    if (nitroConfig.dev || !isNuxtGenerateCommand()) {
        // Nitro bundles server routes without the Vite plugins, and the sitemap route imports the
        // city list. Outside generate it is the unbaked module, so the route fetches cities live.
        nitroConfig.virtual = {
            ...nitroConfig.virtual,
            '#prerender-cities': 'export default { baked: false, cities: [] }'
        }
        return
    }

    const built = await entityDirectoryForGenerate()
    if (!built) {
        if (skipDirectoryPrerender()) {
            console.warn('[clinic prerender] directory routes skipped')
        }
        nitroConfig.virtual = {
            ...nitroConfig.virtual,
            '#prerender-cities': prerenderCitiesModuleSource(),
            '#generated-prefecture-hubs': generatedPrefectureHubsModuleSource(),
            '#generated-facet-paths': generatedFacetPathsModuleSource()
        }
        return
    }

    nitroConfig.virtual = {
        ...nitroConfig.virtual,
        '#clinic-directory': `export default ${JSON.stringify(built.directory)}`,
        '#doctor-directory': `export default ${JSON.stringify(built.professionalDirectory)}`,
        '#prerender-cities': prerenderCitiesModuleSource(),
        '#generated-prefecture-hubs': generatedPrefectureHubsModuleSource(),
        '#generated-facet-paths': generatedFacetPathsModuleSource()
    }
    nitroConfig.prerender ??= {}
    const shard = prerenderShardFromEnv()
    // Shard 0 renders the pages every build has (home, about, sitemap). The others render only
    // their share of the directory.
    const existing = isPrimaryPrerenderShard(shard) ? nitroConfig.prerender.routes ?? [] : []
    // Slugs stay romanised (#1796). Only DIRECTORY_PRERENDER_LOCALE_CODES are
    // written to disk. Every locale would multiply the directory pages. The shard is picked
    // before the locale prefix, so a page's English and Japanese copies render in one run.
    const entityPaths = withDirectoryLocaleVariants(pathsForShard([
        ...built.paths,
        ...built.professionalPaths,
        ...built.hubPaths,
        ...built.facetPaths
    ], shard))
    const shardLabel = shard ? ` in shard ${shard.index}/${shard.count}` : ''
    console.warn(`[clinic prerender] ${built.paths.length} clinic pages, ${built.professionalPaths.length} doctor pages, ${built.hubPaths.length} hub pages, ${built.facetPaths.length} facet pages for ${DIRECTORY_PRERENDER_LOCALE_CODES.join(', ')}; ${entityPaths.length} routes${shardLabel}`)
    nitroConfig.prerender.routes = [...existing, ...entityPaths]
}
