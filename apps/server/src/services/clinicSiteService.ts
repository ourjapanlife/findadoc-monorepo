import { ClinicSiteStatus, type ClinicSite, type ClinicSiteLocale, type ClinicSiteSummary } from '@findadoc/graphql'
import { db } from '../kyselyClient.js'
import { logger } from '../logger.js'

type SiteRow = {
    id: string
    facility_id: string | null
    slug: string
    status: string
    share_image_path: string
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

function localeFromRow(row: LocaleRow): ClinicSiteLocale | undefined {
    if (!isRecord(row.document) || typeof row.document.book !== 'string' || !Array.isArray(row.document.doctorCopy)) {
        return undefined
    }

    return {
        ...(row.document as Omit<ClinicSiteLocale, 'locale' | 'name' | 'description'>),
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
    const status = clinicSiteStatusFromRow(input.site.status)
    if (status === undefined || status === ClinicSiteStatus.Draft) {
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

export function summarizeClinicSite(site: Omit<SiteRow, 'theme'>): ClinicSiteSummary | undefined {
    const status = clinicSiteStatusFromRow(site.status)
    if (status === undefined || status === ClinicSiteStatus.Draft) {
        return undefined
    }

    return {
        id: site.id,
        slug: site.slug,
        facilityId: site.facility_id,
        status,
        shareImagePath: site.share_image_path
    }
}

export async function getClinicSiteBySlug(slug: string): Promise<ClinicSite | null> {
    const site = await db.selectFrom('clinic_sites')
        .select(['id', 'facility_id', 'slug', 'status', 'share_image_path', 'hero_path', 'theme'])
        .where('slug', '=', slug)
        .where('status', '!=', 'draft')
        .executeTakeFirst()

    if (!site) {
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
    if (!assembled) {
        logger.warn(`Clinic site ${site.id} is not a public page`)
        return null
    }

    return assembled
}

export async function listPublicClinicSites(): Promise<ClinicSiteSummary[]> {
    const rows = await db.selectFrom('clinic_sites')
        .select(['id', 'facility_id', 'slug', 'status', 'share_image_path', 'hero_path'])
        .where('status', '!=', 'draft')
        .orderBy('slug')
        .execute()

    return rows.flatMap(row => {
        const summary = summarizeClinicSite(row)
        return summary === undefined ? [] : [summary]
    })
}
