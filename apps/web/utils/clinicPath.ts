import type { Facility } from '@findadoc/graphql'
import { unlocalizedPath } from './localePath'
import { SITE_TITLE } from './site'

/**
 * IDs are UUIDs (they already contain `-`). A single hyphen between slug and id
 * cannot be parsed, so the route is `/clinic/{prefecture}/{city}/{slug}--{id}`.
 * Issue #1789 wrote `[slug]-[id]`; `--` is the unambiguous form of that suffix.
 */
export const FACILITY_ID_SEPARATOR = '--'

/**
 * Online facilities have no street address. Their directory URL uses this city
 * segment instead of `unknown`, so they stay SEO-visible without pretending
 * to be a place called unknown. Prefetchure stays `japan` (country bucket).
 * Shape stays `/clinic/{prefecture}/{city}/{slug}--{id}` so the existing
 * route and sitemap regex still match.
 */
export const ONLINE_FACILITY_PREFECTURE_SLUG = 'japan'
export const ONLINE_FACILITY_CITY_SLUG = 'online'

const FALLBACK_SLUG = 'clinic'

export function slugifySegment(value: string | null | undefined): string {
    const slug = (value ?? '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/--+/g, '-')
        .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
        .replace(/^-+|-+$/g, '')

    return slug
}

export function locationPrefectureSlug(value: string | null | undefined): string {
    return slugifySegment(value) || 'japan'
}

export function locationCitySlug(value: string | null | undefined): string {
    return slugifySegment(value) || 'unknown'
}

export function facilityIdFromSlugParam(slugParam: string | null | undefined): string | undefined {
    const value = slugParam ?? ''
    const separatorIndex = value.lastIndexOf(FACILITY_ID_SEPARATOR)
    if (separatorIndex < 0) {
        return undefined
    }

    const id = value.slice(separatorIndex + FACILITY_ID_SEPARATOR.length).trim()
    return id || undefined
}

/**
 * English/romanised slug in every locale. The locale is the URL prefix
 * (`/ja-JP/clinic/...`), not the slug, so hreflang is a prefix swap and a
 * copied link stays readable. Japanese names stay in the page title.
 *
 * An online facility (no street address) uses `/clinic/japan/online/...`
 * so it is prerendered and sitemapped without a fake city slug.
 */
export function facilityPath(facility: Pick<Facility, 'id' | 'nameEn'> & {
    online?: boolean | null
    contact?: {
        address?: {
            cityEn?: string | null
            prefectureEn?: string | null
        } | null
    } | null
}): string {
    const slug = slugifySegment(facility.nameEn) || FALLBACK_SLUG

    if (facility.online === true) {
        return `/clinic/${ONLINE_FACILITY_PREFECTURE_SLUG}/${ONLINE_FACILITY_CITY_SLUG}/${slug}${FACILITY_ID_SEPARATOR}${facility.id}`
    }

    const prefecture = locationPrefectureSlug(facility.contact?.address?.prefectureEn)
    const city = locationCitySlug(facility.contact?.address?.cityEn)

    return `/clinic/${prefecture}/${city}/${slug}${FACILITY_ID_SEPARATOR}${facility.id}`
}

/**
 * Vue Router / browsers may percent-encode Unicode path segments. Decode and
 * NFC-normalise so `/doctor/輝-山口--id` matches the encoded form and we do
 * not 301-loop on Japanese (or other non-ASCII) slugs.
 */
export function normaliseRoutePath(path: string): string {
    const trimmed = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
    let decoded = trimmed
    try {
        decoded = decodeURI(trimmed)
    } catch {
        // Malformed percent-encoding — compare the trimmed path as-is.
    }
    return decoded.normalize('NFC')
}

export function canonicalPathMatches(currentPath: string, canonicalPath: string): boolean {
    return unlocalizedPath(normaliseRoutePath(currentPath)) === unlocalizedPath(normaliseRoutePath(canonicalPath))
}

/**
 * Document title *before* `formatPageTitle` adds the brand suffix, so the
 * branded result stays within 60 characters.
 */
export function facilityDocumentTitle(name: string): string {
    const maxName = 60 - ` · ${SITE_TITLE}`.length
    const trimmed = name.trim()

    if (trimmed.length <= maxName) {
        return trimmed
    }

    if (maxName <= 1) {
        return '…'
    }

    return `${trimmed.slice(0, maxName - 1).trimEnd()}…`
}
