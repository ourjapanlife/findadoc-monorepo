import { ClinicSiteStatus } from '@findadoc/graphql'
import { describe, expect, it } from 'vitest'
import { clinicSiteSeeds } from '../scripts/seed/clinicSiteContent.js'
import {
    assembleClinicSite,
    clinicSiteStatusFromRow,
    clinicThemeFromRow,
    summarizeClinicSite
} from '../src/services/clinicSiteService.js'

const seed = clinicSiteSeeds[0]
if (seed === undefined) {
    throw new Error('clinicSiteSeeds is empty')
}
const showcase = seed
const languageCodes = showcase.languages.map(language => language.code)
const doctorNames = showcase.doctors.map(doctor => doctor.nameEn)

/** The rows the seed writes, in the shape the service reads them back. */
function showcaseRows(status: string = showcase.status) {
    return {
        site: {
            id: showcase.id,
            facility_id: showcase.facility_id,
            slug: showcase.slug,
            status,
            share_image_path: showcase.share_image_path,
            hero_path: showcase.hero_path,
            theme: showcase.theme
        },
        languages: showcase.languages.map((language, index) => ({
            sort_order: index,
            code: language.code,
            native_name: language.native,
            bcp47: language.bcp47
        })),
        doctors: showcase.doctors.map((doctor, index) => ({
            id: `doctor-${index}`,
            sort_order: index,
            name_ja: doctor.nameJa,
            name_en: doctor.nameEn,
            image_path: doctor.image,
            object_position: doctor.position,
            hp_id: null
        })),
        locales: Object.entries(showcase.copy).map(([locale, copy]) => ({
            locale,
            name: copy.name,
            description: copy.description,
            document: JSON.parse(JSON.stringify(copy)) as unknown
        }))
    }
}

describe('assembleClinicSite', () => {
    it('turns the seeded rows into the page', () => {
        const site = assembleClinicSite(showcaseRows())

        expect(site).toBeDefined()
        expect(site?.status).toBe(ClinicSiteStatus.Preview)
        expect(site?.facilityId).toBe(showcase.facility_id)
        expect(site?.theme).toEqual({ primary: '#177A80' })
        expect(site?.languages.map(language => language.code)).toEqual(languageCodes)
        expect(site?.doctors.map(doctor => doctor.nameEn)).toEqual(doctorNames)
        expect(site?.locales.map(locale => locale.locale).sort()).toEqual(Object.keys(showcase.copy).sort())
        expect(site?.locales.find(locale => locale.locale === 'ja-JP')?.name).toBe(showcase.copy['ja-JP']?.name)
    })

    it('hides a draft and an unknown status', () => {
        expect(assembleClinicSite(showcaseRows('draft'))).toBeUndefined()
        expect(assembleClinicSite(showcaseRows('archived'))).toBeUndefined()
        expect(summarizeClinicSite(showcaseRows('draft').site)).toBeUndefined()
        expect(clinicSiteStatusFromRow('published')).toBe(ClinicSiteStatus.Published)
        expect(clinicSiteStatusFromRow('PUBLISHED')).toBeUndefined()
    })

    it('orders languages and doctors by sort_order, not by row order', () => {
        const rows = showcaseRows()
        const site = assembleClinicSite({
            ...rows,
            languages: [...rows.languages].reverse(),
            doctors: [...rows.doctors].reverse()
        })

        expect(site?.languages.map(language => language.code)).toEqual(languageCodes)
        expect(site?.doctors.map(doctor => doctor.nameEn)).toEqual(doctorNames)
    })

    it('drops a locale whose document is not a page', () => {
        const rows = showcaseRows()
        const broken = rows.locales.map(row => row.locale === 'fr-FR'
            ? { ...row, document: { ...(row.document as Record<string, unknown>), plans: 'not a list' } }
            : row)
        const site = assembleClinicSite({ ...rows, locales: broken })

        expect(site?.locales.some(locale => locale.locale === 'fr-FR')).toBe(false)
        expect(site?.locales.some(locale => locale.locale === 'en-US')).toBe(true)
    })

    it('keeps a stored notice without feesLink and rejects a non-boolean one', () => {
        const rows = showcaseRows()
        const english = rows.locales.find(row => row.locale === 'en-US')
        if (english === undefined) {
            throw new Error('the showcase seed has no en-US copy')
        }
        const document = english.document as Record<string, unknown>
        const notices = document.notices as Array<Record<string, unknown>>
        const withBadFlag = { ...document, notices: [{ ...notices[0], feesLink: 'yes' }] }
        const site = assembleClinicSite({
            ...rows,
            locales: [{ ...english, document: withBadFlag }]
        })

        expect(site?.locales).toEqual([])
    })
})

describe('clinicThemeFromRow', () => {
    it('accepts a six-digit hex as an object or a JSON string and ignores the rest', () => {
        expect(clinicThemeFromRow({ primary: '#177a80' })).toEqual({ primary: '#177A80' })
        expect(clinicThemeFromRow('{"primary":"#177A80"}')).toEqual({ primary: '#177A80' })
        expect(clinicThemeFromRow({})).toEqual({ primary: null })
        expect(clinicThemeFromRow({ primary: 'teal' })).toEqual({ primary: null })
        expect(clinicThemeFromRow({ primary: '#fff' })).toEqual({ primary: null })
        expect(clinicThemeFromRow('not json')).toEqual({ primary: null })
        expect(clinicThemeFromRow(null)).toEqual({ primary: null })
    })
})
