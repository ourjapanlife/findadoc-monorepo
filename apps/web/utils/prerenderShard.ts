/**
 * Split the directory prerender across parallel `nuxi generate` runs.
 *
 * `NUXT_PRERENDER_SHARD=2/4` renders the third of four shares of the clinic, doctor, hub, and facet
 * pages. Shard 0 also renders the pages every build has (home, about, sitemap) and writes the files
 * the publish step needs once. Every shard reads the same directory file, so the shares fit together
 * (see `prerenderDirectorySnapshot.ts`). Unset means one run renders everything.
 */
export const PRERENDER_SHARD_ENV = 'NUXT_PRERENDER_SHARD'

/** More shards than this would spend longer building the app than rendering pages. */
export const PRERENDER_SHARD_MAX = 16

export type PrerenderShard = { index: number, count: number }

/** `"2/4"` is shard 2 of 4. Anything else is an error, so a typo cannot render every page twice. */
export function parsePrerenderShard(value: string | undefined): PrerenderShard | null {
    const trimmed = value?.trim() ?? ''
    if (trimmed === '') {
        return null
    }

    const match = /^(\d+)\/(\d+)$/.exec(trimmed)
    const index = Number(match?.[1])
    const count = Number(match?.[2])
    if (!match || count < 1 || count > PRERENDER_SHARD_MAX || index >= count) {
        throw new Error(`${PRERENDER_SHARD_ENV} must be "index/count" with 0 <= index < count <= ${PRERENDER_SHARD_MAX}`)
    }
    return { index, count }
}

export function prerenderShardFromEnv(env: Record<string, string | undefined> = process.env): PrerenderShard | null {
    return parsePrerenderShard(env[PRERENDER_SHARD_ENV])
}

/** True for an unsharded build and for shard 0: the run that writes the pages and files every build has once. */
export function isPrimaryPrerenderShard(shard: PrerenderShard | null): boolean {
    return shard === null || shard.index === 0
}

/**
 * FNV-1a with murmur3's final mix, so a path lands on the same shard on every machine and in every
 * run. Without the final mix, paths that differ only near the end crowd into a few shards.
 */
function pathHash(path: string): number {
    let hash = 0x811c9dc5
    for (let i = 0; i < path.length; i++) {
        hash ^= path.charCodeAt(i)
        hash = Math.imul(hash, 0x01000193)
    }
    hash ^= hash >>> 16
    hash = Math.imul(hash, 0x85ebca6b)
    hash ^= hash >>> 13
    hash = Math.imul(hash, 0xc2b2ae35)
    hash ^= hash >>> 16
    return hash >>> 0
}

/**
 * The paths this shard renders. Every path is in exactly one shard. Pass paths without a locale
 * prefix, so the English and Japanese copies of a page are rendered by the same run.
 */
export function pathsForShard(paths: readonly string[], shard: PrerenderShard | null): string[] {
    if (shard === null) {
        return [...paths]
    }
    return paths.filter(path => pathHash(path) % shard.count === shard.index)
}
