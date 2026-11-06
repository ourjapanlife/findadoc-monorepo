import { facilityPath, normaliseRoutePath } from './clinicPath'
import { professionalPath } from './doctorPath'
import type { Facility, HealthcareProfessional } from '@findadoc/graphql'

/** The English clinic and doctor pages. Japanese copies come from the same build, so one set is enough. */
const DIRECTORY_PAGE = /^\/(clinic|doctor)\//

export type DirectoryDrift = {
    /** In the API, not in the live sitemap: new, or renamed or moved so its URL changed. */
    missing: string[]
    /** In the live sitemap, not in the API: deleted, or the old URL of a renamed entry. */
    removed: string[]
}

/** Clinic and doctor paths the next build would write, from the same helpers generate uses. */
export function expectedDirectoryPaths(
    facilities: readonly Facility[],
    professionals: readonly HealthcareProfessional[]
): Set<string> {
    return new Set([
        ...facilities.map(facility => normaliseRoutePath(facilityPath(facility))),
        ...professionals.map(professional => normaliseRoutePath(professionalPath(professional)))
    ])
}

/** English clinic and doctor paths in a sitemap.xml body. Locale copies and other pages are ignored. */
export function sitemapDirectoryPaths(xml: string): Set<string> {
    const paths = new Set<string>()
    for (const match of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
        const loc = match[1] ?? ''
        if (!URL.canParse(loc)) {
            continue
        }
        const pathname = normaliseRoutePath(new URL(loc).pathname)
        if (DIRECTORY_PAGE.test(pathname)) {
            paths.add(pathname)
        }
    }
    return paths
}

/**
 * What the live site is missing compared with the API (#228). Any difference means the
 * prerendered pages and sitemap are out of date and the site should be rebuilt.
 */
export function directoryDrift(expected: ReadonlySet<string>, published: ReadonlySet<string>): DirectoryDrift {
    return {
        missing: [...expected].filter(path => !published.has(path)).sort(),
        removed: [...published].filter(path => !expected.has(path)).sort()
    }
}
