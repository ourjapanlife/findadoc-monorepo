/**
 * Fetch the directory once for a split prerender (#21). Every shard of `nuxi generate` reads this
 * file through NUXT_PRERENDER_DIRECTORY_FILE, so the shards render from the same clinics and
 * doctors, and the pages they link to all exist.
 *
 * Usage: tsx scripts/fetchPrerenderDirectory.ts <out.json>
 *
 * Exits non-zero when the API could not be read in full: a build from part of the directory would
 * drop pages. Logs counts only. Paths carry clinic and doctor names, and Actions logs are public.
 */
import { buildClinicPrerenderDirectory } from '../utils/clinicPrerender'
import { writePrerenderDirectorySnapshot } from '../utils/prerenderDirectorySnapshot'

async function main() {
    const out = process.argv[2]
    if (!out) {
        throw new Error('Pass the file to write, for example .output/prerender-directory.json')
    }

    const built = await buildClinicPrerenderDirectory()
    if (!built) {
        throw new Error('The directory API did not answer.')
    }
    if (!built.rows.complete) {
        throw new Error('The directory API stopped part way. No file was written.')
    }

    writePrerenderDirectorySnapshot(out, built)
    console.info(`[prerender directory] ${built.paths.length} clinic, ${built.professionalPaths.length} doctor, ${built.hubPaths.length} hub, and ${built.facetPaths.length} facet pages`)
}

main().catch(error => {
    console.error(`[prerender directory] ${error instanceof Error ? error.message : 'failed'}`)
    process.exitCode = 1
})
