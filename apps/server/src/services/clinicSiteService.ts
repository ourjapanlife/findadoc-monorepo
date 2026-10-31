import { ClinicSiteStatus, type ClinicSite, type ClinicSiteLocale, type ClinicSiteSummary } from '@findadoc/graphql'
import { db } from '../kyselyClient.js'
import { logger } from '../logger.js'

/** The columns a redirect or sitemap needs. The full page adds the hero and theme. */
type SiteSummaryRow = {
    id: string
    facility_id: string | null
    slug: string
    status: string
    share_image_path: string
}

type SiteRow = SiteSummaryRow & {
    hero_path: string
    theme: unknown
}

type LanguageRow = {
    sort_order: number
    code: string
    native_name: string
    bcp47: string
}

type DoctorRow = {
    id: string
    sort_order: number
    name_ja: string
    name_en: string
    image_path: string
    object_position: string
    hp_id: string | null
}

type LocaleRow = {
    locale: string
    name: string
    description: string
    document: unknown
}

const STATUS_BY_ROW: Record<string, ClinicSiteStatus> = {
    draft: ClinicSiteStatus.Draft,
    preview: ClinicSiteStatus.Preview,
    published: ClinicSiteStatus.Published
}

/** Same shape as `clinic_sites_slug_check`. Anything else cannot be a row, so it is not queried. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** A status that is visible on the public queries. Drafts are not. */
function publicStatus(status: string): ClinicSiteStatus | undefined {
    const mapped = clinicSiteStatusFromRow(status)
    return mapped === undefined || mapped === ClinicSiteStatus.Draft ? undefined : mapped
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

/** A stored brand color the page can turn into the theme primary. Anything else is ignored. */
export function clinicThemeFromRow(theme: unknown): { primary: string | null } {
    const record = themeRecord(theme)
    if (record === undefined || typeof record.primary !== 'string' || !HEX_COLOR.test(record.primary)) {
        return { primary: null }
    }

    return { primary: record.primary.toUpperCase() }
}

function themeRecord(theme: unknown): Record<string, unknown> | undefined {
    if (typeof theme === 'string') {
        try {
            const parsed: unknown = JSON.parse(theme)
            return isRecord(parsed) ? parsed : undefined
        } catch {
            return undefined
        }
    }

    return isRecord(theme) ? theme : undefined
}

export function clinicSiteStatusFromRow(status: string): ClinicSiteStatus | undefined {
    return STATUS_BY_ROW[status]
}

const LOCALE_STRING_KEYS = [
    'book',
    'seeFees',
    'sectionNavLabel',
    'heroBadge',
    'heroTitleBefore',
    'heroTitleHighlight',
    'heroLead',
    'heroNote',
    'heroAlt',
    'badgeTitle',
    'badgeDetail',
    'aboutEyebrow',
    'aboutTitle',
    'navDoctors',
    'navCases',
    'navFees',
    'navFlow',
    'doctorsEyebrow',
    'doctorsTitle',
    'casesEyebrow',
    'casesTitle',
    'casesLead',
    'noticeEyebrow',
    'noticeTitle',
    'noticeLead',
    'feesLink',
    'feesEyebrow',
    'feesTitle',
    'feesLead',
    'rangeLabel',
    'includedLabel',
    'referralNote',
    'flowEyebrow',
    'flowTitle',
    'bookEyebrow',
    'bookTitle',
    'bookLead',
    'bookNote',
    'ctaTitle',
    'ctaLead',
    'ctaButton',
    'emergency'
] as const

const LOCALE_STRING_LIST_KEYS = ['highlights', 'about', 'fees'] as const

function isStringList(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(item => typeof item === 'string')
}

function hasStringFields(record: Record<string, unknown>, keys: readonly string[]): boolean {
    return keys.every(key => typeof record[key] === 'string')
}

function hasCopyList(
    value: unknown,
    keys: readonly string[],
    listKey?: string
): boolean {
    if (!Array.isArray(value)) {
        return false
    }
    return value.every(item => {
        if (!isRecord(item) || !hasStringFields(item, keys)) {
            return false
        }
        return listKey === undefined || isStringList(item[listKey])
    })
}

function localeDocument(value: unknown): Record<string, unknown> | undefined {
    if (!isRecord(value) || !hasStringFields(value, LOCALE_STRING_KEYS)) {
        return undefined
    }
    if (!LOCALE_STRING_LIST_KEYS.every(key => isStringList(value[key]))) {
        return undefined
    }
    if (!hasCopyList(value.doctorCopy, ['role', 'tag', 'alt'], 'paragraphs')) {
        return undefined
    }
    if (!hasCopyList(value.cases, ['title', 'detail'])) {
        return undefined
    }
    if (!Array.isArray(value.notices) || value.notices.some(item => {
        if (!isRecord(item) || typeof item.title !== 'string' || typeof item.detail !== 'string') {
            return true
        }
        return item.feesLink !== undefined && typeof item.feesLink !== 'boolean'
    })) {
        return undefined
    }
    if (!hasCopyList(value.plans, ['amount', 'note'])) {
        return undefined
    }
    if (!hasCopyList(value.steps, ['title', 'detail'])) {
        return undefined
    }
    return value
}

function localeFromRow(row: LocaleRow): ClinicSiteLocale | undefined {
    const document = localeDocument(row.document)
    if (document === undefined) {
        return undefined
    }

    return {
        ...(document as Omit<ClinicSiteLocale, 'locale' | 'name' | 'description'>),
        locale: row.locale,
        name: row.name,
        description: row.description
    }
}

/** Drafts stay off the public page. A locale whose document is not a page is dropped. */
export function assembleClinicSite(input: {
    site: SiteRow
    languages: readonly LanguageRow[]
    doctors: readonly DoctorRow[]
    locales: readonly LocaleRow[]
}): ClinicSite | undefined {
    const status = publicStatus(input.site.status)
    if (status === undefined) {
        return undefined
    }

    const locales = input.locales.flatMap(row => {
        const locale = localeFromRow(row)
        return locale === undefined ? [] : [locale]
    })

    return {
        id: input.site.id,
        slug: input.site.slug,
        facilityId: input.site.facility_id,
        status,
        shareImagePath: input.site.share_image_path,
        heroPath: input.site.hero_path,
        theme: clinicThemeFromRow(input.site.theme),
        languages: [...input.languages]
            .sort((left, right) => left.sort_order - right.sort_order)
            .map(language => ({
                code: language.code,
                native: language.native_name,
                bcp47: language.bcp47
            })),
        doctors: [...input.doctors]
            .sort((left, right) => left.sort_order - right.sort_order)
            .map(doctor => ({
                id: doctor.id,
                nameJa: doctor.name_ja,
                nameEn: doctor.name_en,
                imagePath: doctor.image_path,
                objectPosition: doctor.object_position,
                hpId: doctor.hp_id
            })),
        locales
    }
}

export function summarizeClinicSite(
    site: SiteSummaryRow,
    localeCodes: readonly string[] = []
): ClinicSiteSummary | undefined {
    const status = publicStatus(site.status)
    if (status === undefined) {
        return undefined
    }

    return {
        id: site.id,
        slug: site.slug,
        facilityId: site.facility_id,
        status,
        shareImagePath: site.share_image_path,
        localeCodes: [...localeCodes].sort()
    }
}

export async function getClinicSiteBySlug(slug: string): Promise<ClinicSite | null> {
    if (!SLUG_PATTERN.test(slug)) {
        return null
    }

    const site = await db.selectFrom('clinic_sites')
        .select(['id', 'facility_id', 'slug', 'status', 'share_image_path', 'hero_path', 'theme'])
        .where('slug', '=', slug)
        .where('status', '!=', 'draft')
        .executeTakeFirst()

    if (site === undefined) {
        return null
    }

    const [languages, doctors, locales] = await Promise.all([
        db.selectFrom('clinic_site_languages')
            .select(['sort_order', 'code', 'native_name', 'bcp47'])
            .where('clinic_site_id', '=', site.id)
            .orderBy('sort_order')
            .execute(),
        db.selectFrom('clinic_site_doctors')
            .select(['id', 'sort_order', 'name_ja', 'name_en', 'image_path', 'object_position', 'hp_id'])
            .where('clinic_site_id', '=', site.id)
            .orderBy('sort_order')
            .execute(),
        db.selectFrom('clinic_site_locales')
            .select(['locale', 'name', 'description', 'document'])
            .where('clinic_site_id', '=', site.id)
            .execute()
    ])

    const assembled = assembleClinicSite({ site, languages, doctors, locales })
    if (assembled === undefined) {
        logger.warn(`Clinic site ${site.id} is not a public page`)
        return null
    }

    return assembled
}

export async function listPublicClinicSites(): Promise<ClinicSiteSummary[]> {
    const rows = await db.selectFrom('clinic_sites')
        .select(['id', 'facility_id', 'slug', 'status', 'share_image_path'])
        .where('status', '!=', 'draft')
        .orderBy('slug')
        .execute()
    if (rows.length === 0) {
        return []
    }

    const localeRows = await db.selectFrom('clinic_site_locales')
        .select(['clinic_site_id', 'locale'])
        .where('clinic_site_id', 'in', rows.map(row => row.id))
        .execute()
    const localesBySite = new Map<string, string[]>()
    for (const localeRow of localeRows) {
        const codes = localesBySite.get(localeRow.clinic_site_id) ?? []
        codes.push(localeRow.locale)
        localesBySite.set(localeRow.clinic_site_id, codes)
    }

    return rows.flatMap(row => {
        const summary = summarizeClinicSite(row, localesBySite.get(row.id))
        return summary === undefined ? [] : [summary]
    })
}
