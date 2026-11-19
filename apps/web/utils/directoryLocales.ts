import { isGeographyHubRoute } from './hubPath'
import {
    DIRECTORY_PRERENDER_LOCALE_CODES,
    HUB_PRERENDER_LOCALE_CODES,
    localeCodeFromPath,
    unlocalizedPath,
    withLocales
} from './localePath'

/** First segments that are never a hub, even though `RESERVED_HUB_SEGMENTS` does not name all of them. */
const NON_HUB_DIRECTORY_SEGMENTS = new Set(['clinic', 'doctor', 'book'])

function isHubOrFacetPath(path: string): boolean {
    const bare = unlocalizedPath(path)
    const first = bare.split('/')[1] ?? ''
    return !NON_HUB_DIRECTORY_SEGMENTS.has(first) && isGeographyHubRoute(bare)
}

/**
 * Locales a directory path is generated, indexed, and listed in. Hub and facet pages
 * (`/tokyo`, `/tokyo/dentistry`) are translated template text and get the wider list.
 * Clinic and doctor pages are mostly English and Japanese data and get only those two.
 * Lives apart from `localePath.ts` because `hubPath.ts` imports that file.
 */
export function directoryLocaleCodesForPath(path: string): readonly string[] {
    return isHubOrFacetPath(path) ? HUB_PRERENDER_LOCALE_CODES : DIRECTORY_PRERENDER_LOCALE_CODES
}

/** True when `nuxi generate` writes this directory URL in the locale its prefix names. */
export function isPrerenderedDirectoryPath(path: string): boolean {
    return directoryLocaleCodesForPath(path).includes(localeCodeFromPath(path))
}

/** Each directory path in every locale `nuxi generate` writes for it, default locale first. */
export function withDirectoryLocaleVariants(paths: readonly string[]): string[] {
    return paths.flatMap(path => withLocales([path], directoryLocaleCodesForPath(path)))
}
