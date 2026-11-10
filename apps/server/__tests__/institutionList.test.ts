import { describe, expect, it } from 'vitest'
import {
    indexFacilities,
    languagesFromDepartments,
    matchFacility,
    matchableNameJa,
    namesMatch,
    parseInstitutionRow,
    placeQuery,
    planFill,
    planRow,
    postalCodeForStorage,
    spacedEnglishName,
    verificationStatusFor,
    websiteForStorage,
    type ExistingFacility,
    type RowColour,
    type SheetRow
} from '../src/vocabulary/institutionList.js'
import { parsePlaceIds, searchPlaceIds } from '../src/places/placesClient.js'

// Fake institutions only. Names, numbers, and addresses are made up for the tests.
function sheetRow(overrides: Record<string, string> = {}, colour: RowColour = 'none'): SheetRow {
    return {
        sheet: '3.岩手県',
        rowNumber: 7,
        colour,
        raw: {
            都道府県: '03岩手県',
            医療機関: '医療法人テスト会　テスト内科クリニック',
            '医療機関(英語)': 'TestNaikaClinic',
            郵便番号: '0200000',
            住所: '岩手県盛岡市テスト町1丁目2-3',
            '住所(英語)': '1-2-3 Tesuto-cho, Morioka-shi, Iwate, 020-0000',
            電話番号: '019-000-0000',
            WEBサイト: 'http://clinic.example.jp/ (日本語)、\nhttp://clinic.example.jp/en/ (英語)',
            対応診療科と対応外国語: '内科：EN、ZH、\n小児科：EN、PT',
            ...overrides
        }
    }
}

function facility(overrides: Partial<ExistingFacility> = {}): ExistingFacility {
    return {
        id: 'facility-1',
        nameJa: 'テスト内科クリニック',
        postalCode: '020-0000',
        phone: '+81190000000',
        website: '',
        googlePlaceId: 'ChIJFakeExisting1',
        googleMapsUrl: '',
        verificationStatus: 'UNVERIFIED',
        supportedLanguages: [],
        ...overrides
    }
}

describe('parseInstitutionRow', () => {
    it('stores the city, the address without prefecture and city, and +81 phone', () => {
        const record = parseInstitutionRow(sheetRow())

        expect(record.prefectureEn).toBe('Iwate')
        expect(record.city).toEqual({ prefectureEn: 'Iwate', nameEn: 'Morioka', nameJa: '盛岡市' })
        expect(record.addressLine1Ja).toBe('テスト町1丁目2-3')
        expect(record.addressLine1En).toBe('1-2-3 Tesuto-cho')
        expect(record.postalCode).toBe('020-0000')
        expect(record.phone).toBe('+81190000000')
        expect(verificationStatusFor(record)).toBe('UNVERIFIED')
    })

    it('does not read the prefecture at the end of the English address as a town', () => {
        // 岩手町 is "Iwate" in English, the same word as the prefecture.
        const record = parseInstitutionRow(sheetRow({ '住所(英語)': '1-2-3,Tesuto,Moriokashi ,Iwate prefecture,020-0000' }))

        expect(record.city?.nameJa).toBe('盛岡市')
        expect(record.addressLine1En).toBe('1-2-3, Tesuto')
    })

    it('rolls a designated-city ward up to the city', () => {
        const record = parseInstitutionRow(sheetRow({
            都道府県: '01北海道',
            住所: '北海道札幌市東区テスト1条2丁目',
            '住所(英語)': ''
        }))

        expect(record.city?.nameJa).toBe('札幌市')
        expect(record.addressLine1Ja).toBe('東区テスト1条2丁目')
    })

    it('reads the town of a district address', () => {
        const record = parseInstitutionRow(sheetRow({ 住所: '岩手県和賀郡西和賀町テスト40-1', '住所(英語)': '' }))

        expect(record.city?.nameJa).toBe('西和賀町')
    })

    it('leaves a row unresolved when the English address names another city', () => {
        const record = parseInstitutionRow(sheetRow({ '住所(英語)': '1-2-3 Tesuto, Hanamaki-shi, Iwate' }))

        expect(record.city).toBeNull()
        expect(record.warnings).toContain('city_language_disagreement')
    })

    it('keeps a row with no municipality unverified, without a guessed city', () => {
        const record = parseInstitutionRow(sheetRow({ 住所: 'テスト町1丁目2-3', '住所(英語)': '' }))

        expect(record.city).toBeNull()
        expect(verificationStatusFor(record)).toBe('UNVERIFIED_LOCATION')
        expect(record.warnings.some(warning => warning.startsWith('city_'))).toBe(true)
    })

    it('upgrades the first website to https and notes it', () => {
        const record = parseInstitutionRow(sheetRow())

        expect(record.website).toBe('https://clinic.example.jp/')
        expect(record.warnings).toContain('website_upgraded_to_https')
    })

    it('notes a phone or postal code that does not parse instead of guessing', () => {
        const record = parseInstitutionRow(sheetRow({ 電話番号: '代表：内線のみ', 郵便番号: '020-00000' }))

        expect(record.phone).toBe('')
        expect(record.postalCode).toBe('')
        expect(record.warnings).toEqual(expect.arrayContaining(['invalid_phone', 'invalid_postal_code']))
    })

    it('builds the Places query from the Japanese name and full address', () => {
        expect(placeQuery(parseInstitutionRow(sheetRow())))
            .toBe('医療法人テスト会 テスト内科クリニック 岩手県盛岡市テスト町1丁目2-3')
    })
})

describe('languagesFromDepartments', () => {
    it('maps codes and Japanese names onto published locales in directory order', () => {
        expect(languagesFromDepartments('内科：ZH、EN\n歯科：韓国語').languages)
            .toEqual(['en_US', 'ja_JP', 'zh_CN', 'ko_KR'])
    })

    it('splits run-together codes and full-width codes', () => {
        expect(languagesFromDepartments('内科：ENZHKO、ＶＩ').languages).toEqual(['en_US', 'ja_JP', 'zh_CN', 'ko_KR', 'vi_VN'])
    })

    it('drops languages we do not publish and reports them', () => {
        const result = languagesFromDepartments('内科：EN、PT、TH、ポルトガル語')

        expect(result.languages).toEqual(['en_US', 'ja_JP'])
        expect(result.dropped).toEqual(['PT', 'TH', 'ポルトガル語'])
    })

    it('does not read lowercase English words as codes', () => {
        expect(languagesFromDepartments('Internal medicine de es').languages).toEqual(['ja_JP'])
    })
})

describe('small normalisers', () => {
    it('splits a run-together English name and leaves a spaced one alone', () => {
        expect(spacedEnglishName('IdeEyeHospital')).toBe('Ide Eye Hospital')
        expect(spacedEnglishName('SEIWADO Clinic')).toBe('SEIWADO Clinic')
    })

    it('stores only a seven-digit postal code', () => {
        expect(postalCodeForStorage('０２０-００００')).toBe('020-0000')
        expect(postalCodeForStorage('020-00000')).toBe('')
    })

    it('refuses a non-web link', () => {
        expect(websiteForStorage('javascript:alert(1)').website).toBe('')
        expect(websiteForStorage('なし').website).toBe('')
    })

    it('drops the corporation name for matching', () => {
        expect(matchableNameJa('医療法人テスト会　テスト内科クリニック')).toBe('テスト内科クリニック')
        expect(namesMatch('会テスト内科クリニック', '医療法人テスト会テスト内科クリニック')).toBe(true)
        expect(namesMatch('歯科', '山田歯科医院')).toBe(false)
    })
})

describe('matchFacility', () => {
    const record = parseInstitutionRow(sheetRow())

    it('matches on place id first', () => {
        const index = indexFacilities([facility({ nameJa: '別の名前', postalCode: '', phone: '' })])

        expect(matchFacility(record, 'ChIJFakeExisting1', index)?.method).toBe('place_id')
    })

    it('matches on the place id in a stored Maps URL', () => {
        const index = indexFacilities([facility({
            googlePlaceId: null,
            nameJa: '別の名前',
            phone: '',
            googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=x&query_place_id=ChIJFakeMaps1'
        })])

        expect(matchFacility(record, 'ChIJFakeMaps1', index)?.method).toBe('maps_url')
    })

    it('matches on Japanese name and postal code', () => {
        const index = indexFacilities([facility({ googlePlaceId: null, phone: '' })])

        expect(matchFacility(record, null, index)?.method).toBe('name_postal_code')
    })

    it('matches on a phone only one facility has', () => {
        const index = indexFacilities([facility({ nameJa: '別の名前', postalCode: '' })])

        expect(matchFacility(record, null, index)?.method).toBe('phone')
    })

    it('does not match when two facilities share the key', () => {
        const index = indexFacilities([
            facility({ id: 'a', nameJa: '別A', postalCode: '' }),
            facility({ id: 'b', nameJa: '別B', postalCode: '', googlePlaceId: 'ChIJFakeOther' })
        ])

        expect(matchFacility(record, null, index)).toBeNull()
    })
})

describe('planFill', () => {
    const record = parseInstitutionRow(sheetRow())

    it('fills only empty fields', () => {
        const { fill } = planFill(record, facility({ website: 'https://kept.example.jp/' }))

        expect(fill).toEqual({ supportedLanguages: ['en_US', 'ja_JP', 'zh_CN'] })
    })

    it('turns a different value on a confirmed facility into a conflict', () => {
        const { conflicts } = planFill(record, facility({
            verificationStatus: 'CONFIRMED',
            website: 'https://other.example.jp/'
        }))

        expect(conflicts).toEqual(['website'])
    })

    it('keeps an unverified facility value without a conflict', () => {
        expect(planFill(record, facility({ website: 'https://other.example.jp/' })).conflicts).toEqual([])
    })
})

describe('planRow', () => {
    const empty = indexFacilities([])

    it('skips red rows even when they match', () => {
        const row = sheetRow({}, 'red')
        const plan = planRow(row, parseInstitutionRow(row), null, indexFacilities([facility()]), new Set())

        expect(plan.outcome).toBe('skipped')
        expect(plan.reason).toBe('red_reviewed_not_added')
        expect(plan.fill).toEqual({})
    })

    it('fills a matched green row', () => {
        const row = sheetRow({}, 'green')
        const plan = planRow(row, parseInstitutionRow(row), null, indexFacilities([facility()]), new Set())

        expect(plan.outcome).toBe('matched')
        expect(plan.fill.supportedLanguages).toEqual(['en_US', 'ja_JP', 'zh_CN'])
    })

    it('sends a conflict with a confirmed facility to review', () => {
        const row = sheetRow({}, 'green')
        const confirmed = facility({ verificationStatus: 'CONFIRMED', phone: '+81190000001', postalCode: '020-0000' })
        const plan = planRow(row, parseInstitutionRow(row), null, indexFacilities([confirmed]), new Set())

        expect(plan.outcome).toBe('needs_review')
        expect(plan.reason).toBe('conflicts_with_confirmed:phone')
    })

    it('sends a green row that is not in the directory to review', () => {
        const row = sheetRow({}, 'green')

        expect(planRow(row, parseInstitutionRow(row), null, empty, new Set()).reason).toBe('green_row_not_in_directory')
    })

    it('creates an unmarked row with exactly one place id', () => {
        const row = sheetRow()
        const plan = planRow(row, parseInstitutionRow(row), { placeIds: ['ChIJFakeNew1'] }, empty, new Set())

        expect(plan.outcome).toBe('created')
        expect(plan.placeId).toBe('ChIJFakeNew1')
    })

    it('creates a yellow row too', () => {
        const row = sheetRow({}, 'yellow')

        expect(planRow(row, parseInstitutionRow(row), { placeIds: ['ChIJFakeNew1'] }, empty, new Set()).outcome)
            .toBe('created')
    })

    it('does not create without a single place id', () => {
        const row = sheetRow()
        const record = parseInstitutionRow(row)

        expect(planRow(row, record, null, empty, new Set()).reason).toBe('place_lookup_not_run')
        expect(planRow(row, record, { placeIds: [] }, empty, new Set()).reason).toBe('no_place_found')
        expect(planRow(row, record, { placeIds: ['ChIJFakeA', 'ChIJFakeB'] }, empty, new Set()).reason)
            .toBe('several_places_found')
    })

    it('does not create two facilities for one place', () => {
        const row = sheetRow()
        const plan = planRow(row, parseInstitutionRow(row), { placeIds: ['ChIJFakeNew1'] }, empty, new Set(['ChIJFakeNew1']))

        expect(plan.reason).toBe('duplicate_place_in_sheet')
    })

    it('matches an existing facility through the looked-up place id instead of creating one', () => {
        const row = sheetRow({ 医療機関: '別の名前', 電話番号: '' })
        const index = indexFacilities([facility()])
        const plan = planRow(row, parseInstitutionRow(row), { placeIds: ['ChIJFakeExisting1'] }, index, new Set())

        expect(plan.outcome).toBe('matched')
        expect(plan.match?.method).toBe('place_id')
    })
})

describe('searchPlaceIds', () => {
    it('asks Places for the id field only and returns the ids', async () => {
        const calls: { url: string, init: Parameters<typeof fetch>[1] }[] = []
        const fakeFetch = (async (url: string, init?: Parameters<typeof fetch>[1]) => {
            calls.push({ url, init })
            return new Response(JSON.stringify({ places: [{ id: 'ChIJFakeNew1' }] }), { status: 200 })
        }) as typeof fetch

        expect(await searchPlaceIds('テスト内科クリニック', 'fake-key', 2, fakeFetch)).toEqual(['ChIJFakeNew1'])
        const headers = calls[0]?.init?.headers as Record<string, string>
        expect(headers['X-Goog-FieldMask']).toBe('places.id')
        expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({ pageSize: 2, regionCode: 'JP' })
    })

    it('ignores anything that is not a place id', () => {
        expect(parsePlaceIds({ places: [{ id: 'short' }, { displayName: 'x' }, { id: 'ChIJFakeNew1' }] }))
            .toEqual(['ChIJFakeNew1'])
        expect(parsePlaceIds(null)).toEqual([])
    })
})
