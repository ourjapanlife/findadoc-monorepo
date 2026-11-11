import { Locale, Specialty, type Facility, type HealthcareProfessional } from '@findadoc/graphql'
import { formatJapanPhone, PHONE_DISPLAY, toJapanE164 } from '@findadoc/utils'

/**
 * Client-side search over the whole directory.
 *
 * The API cannot filter facilities by location and exposes professionals only as ID lists, so
 * every search used to re-download the entire database and join it in memory. Loading it once
 * and filtering here makes every subsequent filter change instant and request-free. When the
 * server grows a location filter (findadoc-server: `cityEn`/`prefectureEn` on
 * `FacilitySearchFilters`), the store can swap this for a server query without touching the UI.
 */

export type FacilitySearchResult = Facility & {
    healthcareProfessionals: HealthcareProfessional[]
}

export interface SearchFilters {
    city?: string
    prefecture?: string
    specialties?: Specialty[]
    languages?: Locale[]
}

export interface SearchQueryState extends SearchFilters {
    facilityId?: string
    /** 1-based load-more page. Omitted from the URL when it is 1. */
    page?: number
}

/** Route query bag. Kept structural so this module does not import vue-router. */
export type SearchLocationQuery = Record<string, unknown>

function firstString(value: unknown): string | undefined {
    const single = Array.isArray(value) ? value[0] : value
    return typeof single === 'string' && single.length ? single : undefined
}

function slugify(value: string | null | undefined): string {
    return (value ?? '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/--+/g, '-')
        .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
}

/**
 * Location filters in the URL are slugs (`setagaya`, `tokyo`). The directory still stores
 * display names, so a selected value matches the English name, the Japanese name, or either
 * side's slug.
 */
function placeMatches(selected: string | undefined, en: string | undefined, ja: string | undefined): boolean {
    if (!selected) return true
    if (en === selected || ja === selected) return true

    const selectedSlug = slugify(selected)
    if (!selectedSlug) return false

    return slugify(en) === selectedSlug || slugify(ja) === selectedSlug
}

function matchesLocation(facility: Facility, filters: SearchFilters): boolean {
    const address = facility.contact?.address

    return placeMatches(filters.city, address?.cityEn, address?.cityJa)
      && placeMatches(filters.prefecture, address?.prefectureEn, address?.prefectureJa)
}

function intersects<T>(selected: T[] | undefined, actual: T[] | undefined): boolean {
    if (!selected?.length) return true
    return (actual ?? []).some(value => selected.includes(value))
}

function matchesProfessional(professional: HealthcareProfessional, filters: SearchFilters): boolean {
    return intersects(filters.specialties, professional.specialties)
      && intersects(filters.languages, professional.spokenLanguages)
}

/** True when the facility itself lists every requested language (#19). Facility languages name no doctor. */
function facilitySpeaksAll(facility: Facility, languages: readonly Locale[]): boolean {
    const supported = facility.supportedLanguages ?? []
    return languages.every(language => supported.includes(language))
}

/**
 * Facilities matching the location filters, each carrying the professionals who match the
 * specialty and language filters.
 *
 * A facility with no listed doctor is still a result (#21): many come from the ministry's list
 * of institutions that accept foreign patients, and feedback fills in the doctors later.
 * - No specialty or language: every facility in the location, with whatever doctors it has.
 * - Language only: a facility that lists every requested language itself, or one with a
 *   matching doctor.
 * - A specialty: only facilities with a matching doctor, since a facility has no specialty.
 *   Facility languages do not count there.
 * Facilities with a matching doctor come first, in directory order.
 */
export function filterDirectory(
    facilities: readonly Facility[],
    professionals: readonly HealthcareProfessional[],
    filters: SearchFilters
): FacilitySearchResult[] {
    const matchingProfessionals = new Map<string, HealthcareProfessional>()
    for (const professional of professionals) {
        if (matchesProfessional(professional, filters)) {
            matchingProfessionals.set(professional.id, professional)
        }
    }

    const languages = filters.languages ?? []
    const needsDoctor = (filters.specialties?.length ?? 0) > 0
    const withDoctors: FacilitySearchResult[] = []
    const withoutDoctors: FacilitySearchResult[] = []
    for (const facility of facilities) {
        if (!matchesLocation(facility, filters)) continue

        const healthcareProfessionals = (facility.healthcareProfessionalIds ?? [])
            .map(id => matchingProfessionals.get(id))
            .filter((professional): professional is HealthcareProfessional => !!professional)

        if (healthcareProfessionals.length) {
            withDoctors.push({ ...facility, healthcareProfessionals })
        } else if (!needsDoctor && facilitySpeaksAll(facility, languages)) {
            withoutDoctors.push({ ...facility, healthcareProfessionals })
        }
    }

    return [...withDoctors, ...withoutDoctors]
}

const SPECIALTY_VALUES = Object.values(Specialty) as Specialty[]
const SPECIALTY_SET = new Set<string>(SPECIALTY_VALUES)
const LOCALE_VALUES = Object.values(Locale) as Locale[]
const LOCALE_SET = new Set<string>(LOCALE_VALUES)

const specialtyToParam = new Map<Specialty, string>()
const paramToSpecialty = new Map<string, Specialty>()
for (const specialty of SPECIALTY_VALUES) {
    const param = slugify(specialty.replaceAll('_', ' '))
    if (!param) continue
    specialtyToParam.set(specialty, param)
    paramToSpecialty.set(param, specialty)
}

const localeToLanguageParam = new Map<Locale, string>()
const languageParamToLocale = new Map<string, Locale>()
const localesByLanguage = new Map<string, Locale[]>()
for (const locale of LOCALE_VALUES) {
    const language = (locale.split('_')[0] ?? locale).toLowerCase()
    const group = localesByLanguage.get(language) ?? []
    group.push(locale)
    localesByLanguage.set(language, group)
}
for (const locale of LOCALE_VALUES) {
    const [languageTag, region] = locale.split('_')
    const language = (languageTag ?? locale).toLowerCase()
    const group = localesByLanguage.get(language) ?? []
    const param = group.length > 1 && region
        ? `${language}-${region.toLowerCase()}`
        : language
    localeToLanguageParam.set(locale, param)
    languageParamToLocale.set(param, locale)
    languageParamToLocale.set(locale, locale)
    languageParamToLocale.set(locale.toLowerCase(), locale)
}

export function specialtySearchParam(specialty: Specialty): string {
    return specialtyToParam.get(specialty) ?? specialty
}

export function languageSearchParam(locale: string): string {
    return localeToLanguageParam.get(locale as Locale) ?? locale
}

export function prefectureSearchParam(name: string): string {
    return slugify(name) || name
}

function parseSpecialty(raw: string | undefined): Specialty | undefined {
    if (!raw) return undefined
    if (SPECIALTY_SET.has(raw)) return raw as Specialty
    return paramToSpecialty.get(raw.toLowerCase())
}

function parseLanguage(raw: string | undefined): Locale | undefined {
    if (!raw) return undefined
    if (LOCALE_SET.has(raw)) return raw as Locale
    return languageParamToLocale.get(raw.toLowerCase())
}

function parsePlace(raw: string | undefined): string | undefined {
    if (!raw) return undefined
    return slugify(raw) || raw
}

function parsePage(raw: string | undefined): number | undefined {
    if (!raw || !/^\d+$/.test(raw)) return undefined
    const page = Number(raw)
    return Number.isInteger(page) && page > 1 ? page : undefined
}

/**
 * Reads the search state out of the URL, dropping anything that is not a real specialty or
 * language so a mistyped or stale link degrades to a broader search rather than an empty one.
 *
 * Human-readable params (`specialty=pediatrics&language=en&city=setagaya`) are the stored
 * form. GraphQL enum values (`DENTISTRY`, `en_US`) are still accepted so older links keep
 * working.
 */
export function parseSearchQuery(query: SearchLocationQuery): SearchQueryState {
    const specialty = parseSpecialty(firstString(query.specialty))
    const language = parseLanguage(firstString(query.language))

    return {
        city: parsePlace(firstString(query.city)),
        prefecture: parsePlace(firstString(query.prefecture)),
        specialties: specialty ? [specialty] : undefined,
        languages: language ? [language] : undefined,
        facilityId: firstString(query.facility),
        page: parsePage(firstString(query.page))
    }
}

/** The inverse of parseSearchQuery: only set keys are emitted, so clean URLs stay clean. */
export function buildSearchQuery(state: SearchQueryState): Record<string, string> {
    const query: Record<string, string> = {}

    if (state.specialties?.[0]) query.specialty = specialtySearchParam(state.specialties[0])
    if (state.languages?.[0]) query.language = languageSearchParam(state.languages[0])
    if (state.prefecture) query.prefecture = prefectureSearchParam(state.prefecture)
    if (state.city) query.city = parsePlace(state.city) ?? state.city
    if ((state.page ?? 1) > 1) query.page = String(state.page)
    if (state.facilityId) query.facility = state.facilityId

    return query
}

export function sameSearchQueryState(left: SearchLocationQuery, right: SearchLocationQuery): boolean {
    const a = parseSearchQuery(left)
    const b = parseSearchQuery(right)

    return a.city === b.city
      && a.prefecture === b.prefecture
      && (a.specialties?.[0] ?? '') === (b.specialties?.[0] ?? '')
      && (a.languages?.[0] ?? '') === (b.languages?.[0] ?? '')
      && a.facilityId === b.facilityId
      && (a.page ?? 1) === (b.page ?? 1)
}

export function hasActiveFilters(filters: SearchFilters): boolean {
    return !!(filters.city || filters.prefecture || filters.specialties?.length || filters.languages?.length)
}

/**
 * A Google Maps link that actually lands on the facility.
 *
 * Most rows carry a proper `/place/` URL and that is the best link there is — it opens the
 * business card. But some are a bare `google.com/maps?sca_esv=…` with tracking parameters and
 * no place at all (4 of 100 sampled against production), so the button opened Maps showing
 * nothing. Every facility does have exact coordinates, so those fall back to a name search
 * anchored at the clinic's own position: Google resolves the business, and the map is centred
 * on the right spot even when the name is ambiguous.
 */
const MAPS_PLACE_ID = /^[A-Za-z0-9_-]{8,}$/

/** A Places id from the facility row, else from query_place_id or place_id in the stored Maps URL. */
function facilityPlaceId(googlePlaceId: string | null | undefined, stored: string): string | null {
    const direct = (googlePlaceId ?? '').trim()
    if (MAPS_PLACE_ID.test(direct)) {
        return direct
    }
    let params: URLSearchParams
    try {
        params = new URL(stored).searchParams
    } catch {
        return null
    }
    const fromUrl = (params.get('query_place_id') ?? params.get('place_id') ?? '').trim()
    return MAPS_PLACE_ID.test(fromUrl) ? fromUrl : null
}

/**
 * The "Open in Maps" link. A stored place id opens that one place; a name search would also
 * list nearby clinics with similar names (#228).
 */
export function facilityMapsUrl(facility: {
    nameEn?: string | null
    nameJa?: string | null
    mapLatitude?: number | null
    mapLongitude?: number | null
    googlePlaceId?: string | null
    contact?: { googleMapsUrl?: string | null } | null
}, preferJapanese = false): string {
    const stored = (facility.contact?.googleMapsUrl ?? '').trim()
    const name = (preferJapanese ? facility.nameJa : facility.nameEn) || facility.nameEn || facility.nameJa
    const { mapLatitude: lat, mapLongitude: lng } = facility
    const placeId = facilityPlaceId(facility.googlePlaceId, stored)

    if (placeId) {
        // Maps requires query; query_place_id decides which place opens.
        const query = name || (lat && lng ? `${lat},${lng}` : placeId)
        const params = new URLSearchParams([['api', '1'], ['query', query], ['query_place_id', placeId]])
        return `https://www.google.com/maps/search/?${params.toString()}`
    }

    // A place page is the best link there is, and a Google short link resolves to one.
    if (stored.includes('/place/') || /^https:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)\//.test(stored)) {
        return stored
    }

    /*
     * Never fall back to the stored value here. What is left at this point is a tracking-param
     * search URL or, in one row, the literal string "google.maps" — which as an href is a
     * relative path into our own site, the same trap the website field had.
     */
    if (!lat || !lng) {
        return ''
    }

    return name
        ? `https://www.google.com/maps/search/${encodeURIComponent(name)}/@${lat},${lng},17z`
        : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}

/*
 * Contact values are volunteer-entered free text, so they arrive in shapes an <a href> cannot
 * use. These helpers decide both whether to show a control at all and what to link it to.
 */

/** Values that mean "we don't have one", entered instead of leaving the field blank. */
const PLACEHOLDER_CONTACT_VALUES = new Set(['none', 'n/a', 'na', '-', '--', 'tbd', 'unknown', 'email@email.com'])

function isPlaceholder(value: string): boolean {
    return !value || PLACEHOLDER_CONTACT_VALUES.has(value.trim().toLowerCase())
}

/**
 * A usable website URL, or an empty string when there is nothing worth linking.
 *
 * Many rows store a bare host such as `www.megurokhome.com`. Without a scheme the browser reads
 * that as a *relative* path, so the button navigated to `/search/www.megurokhome.com` instead of
 * leaving the site — which is the "website button sometimes does nothing" report.
 */
export function facilityWebsiteUrl(facility: Facility): string {
    const raw = (facility.contact?.website ?? '').trim()

    if (isPlaceholder(raw)) {
        return ''
    }

    /*
     * `http://` rather than `https://` for a bare host. Of the five scheme-less domains in
     * production, four serve both and redirect themselves to https, but www.suwa-pediatrics.com
     * has no working certificate — prefixing https there produced a browser security
     * interstitial instead of the clinic. http reaches 5 of 5, and modern browsers attempt the
     * upgrade themselves, so nothing that can be secure is left insecure.
     */
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`

    try {
        const url = new URL(withScheme)
        // A host with no dot is not a public site; it is someone's note to themselves.
        return url.hostname.includes('.') ? url.toString() : ''
    } catch {
        return ''
    }
}

/** The website as a human reads it: no scheme, no trailing slash. */
export function facilityWebsiteLabel(facility: Facility): string {
    const url = facilityWebsiteUrl(facility)
    if (!url) return ''

    return url.replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

/**
 * The phone number as people read it, or an empty string.
 *
 * Phones are stored in E.164. Japanese pages show the national form a local caller dials
 * (`03-1234-5678`); every other locale shows `+81 3-1234-5678`, because visitors on an overseas
 * SIM cannot dial a domestic number. Hyphen placement comes from libphonenumber metadata.
 * A legacy row that does not parse is shown as stored until the backfill list is fixed.
 */
export function facilityPhone(facility: Facility, japanese = false): string {
    const raw = (facility.contact?.phone ?? '').trim()
    if (isPlaceholder(raw)) return ''

    const display = japanese ? PHONE_DISPLAY.NATIONAL : PHONE_DISPLAY.INTERNATIONAL
    const formatted = formatJapanPhone(raw, display)
    if (formatted !== null) return formatted

    // Needs enough digits to be a real number; Japanese numbers are 10 or 11.
    return (raw.match(/\d/g) ?? []).length >= 9 ? raw : ''
}

/**
 * The E.164 number for a `tel:` link (`+81312345678`), or an empty string.
 *
 * Always international so it connects from any SIM. A stored value that does not parse as a
 * Japanese number gets no link rather than one that may not connect.
 */
export function facilityPhoneHref(facility: Facility): string {
    const raw = (facility.contact?.phone ?? '').trim()
    if (isPlaceholder(raw)) return ''

    return toJapanE164(raw) ?? ''
}

/** A contactable email address, or an empty string. */
export function facilityEmail(facility: Facility): string {
    const raw = (facility.contact?.email ?? '').trim()
    return !isPlaceholder(raw) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw) ? raw : ''
}
