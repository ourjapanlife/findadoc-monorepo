/**
 * Merge the shards of a split prerender into one site (#21).
 *
 * Usage: tsx scripts/mergePrerenderShards.ts <out> <shard 0> <shard 1> ...
 *
 * Shard files do not overlap except the app shell, the 404 page, and build assets, which every shard
 * writes the same; shard 0 is copied last, so its copy is kept. The build manifest is the one file
 * that needs a real merge: each shard lists only the routes it rendered.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mergeBuildMeta, type BuildMeta } from '../utils/prerenderShard'

const META_DIR = join('_nuxt', 'builds', 'meta')

function readMeta(shard: string): BuildMeta[] {
    const dir = join(shard, META_DIR)
    if (!existsSync(dir)) {
        throw new Error(`${shard} has no build manifest. Was it built by nuxi generate?`)
    }
    return readdirSync(dir)
        .filter(name => name.endsWith('.json'))
        .map(name => JSON.parse(readFileSync(join(dir, name), 'utf8')) as BuildMeta)
}

function main() {
    const [out, primary, ...others] = process.argv.slice(2)
    if (!out || !primary) {
        throw new Error('Pass the output folder, then shard 0, then the other shards.')
    }

    const metas = [primary, ...others].map(shard => {
        const found = readMeta(shard)
        if (found.length !== 1 || !found[0]) {
            throw new Error(`${shard} should have one build manifest, found ${found.length}.`)
        }
        return found[0]
    })
    const merged = mergeBuildMeta(metas)

    mkdirSync(out, { recursive: true })
    for (const shard of [...others, primary]) {
        cpSync(shard, out, { recursive: true, force: true })
    }
    writeFileSync(join(out, META_DIR, `${merged.id}.json`), JSON.stringify(merged))
    console.info(`[prerender merge] ${metas.length} shards, ${merged.prerendered.length} prerendered routes`)
}

try {
    main()
} catch (error) {
    console.error(`[prerender merge] ${error instanceof Error ? error.message : 'failed'}`)
    process.exitCode = 1
}
