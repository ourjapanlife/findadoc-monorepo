/// <reference types="vitest/globals" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { expect } from 'chai'
import { fillEmptyFacilityFields, officialCityPatch, type FacilityMapsFillTarget } from '~/utils/mapsAutofill'
import type { CityOption } from '~/utils/cityOptions'
import {
    provideModerationFormEditing,
    useModerationFormEditing
} from '~/composables/useModerationFormMode'

function emptyFacility(overrides: Partial<FacilityMapsFillTarget> = {}): FacilityMapsFillTarget {
    return {
        nameEn: '',
        nameJa: '',
        postalCode: '',
        prefectureEn: '',
        prefectureJa: '',
        cityId: '',
        cityEn: '',
        cityJa: '',
        addressLine1En: '',
        addressLine1Ja: '',
        mapLatitude: '',
        mapLongitude: '',
        ...overrides
    }
}

const emptySource = {
    nameEn: null,
    nameJa: null,
    postalCode: null,
    prefectureEn: null,
    prefectureJa: null,
    cityEn: null,
    cityJa: null,
    streetEn: null,
    streetJa: null,
    latitude: null,
    longitude: null
}

describe('fillEmptyFacilityFields', () => {
    it('fills empty names, postal code, prefecture, city, street, and the pin', () => {
        const patch = fillEmptyFacilityFields(emptyFacility(), {
            ...emptySource,
            nameEn: 'A-ONE Dental Clinic',
            nameJa: 'A-ONE歯科クリニック',
            postalCode: '〒164-0002',
            prefectureEn: 'Tokyo',
            prefectureJa: '東京都',
            cityEn: 'Nakano City',
            cityJa: '中野区',
            streetEn: '1-2-3 Nakano',
            streetJa: '中野1-2-3',
            latitude: 35.7140477,
            longitude: 139.6668954
        })

        expect(patch).to.deep.equal({
            nameEn: 'A-ONE Dental Clinic',
            nameJa: 'A-ONE歯科クリニック',
            postalCode: '164-0002',
            prefectureEn: 'Tokyo',
            prefectureJa: '東京都',
            cityEn: 'Nakano City',
            cityJa: '中野区',
            addressLine1En: '1-2-3 Nakano',
            addressLine1Ja: '中野1-2-3',
            mapLatitude: '35.7140477',
            mapLongitude: '139.6668954'
        })
    })

    it('copies a Places pin when the Maps URL has no coordinates', () => {
        const patch = fillEmptyFacilityFields(emptyFacility(), {
            ...emptySource,
            latitude: 35.68,
            longitude: 139.76
        })

        expect(patch).to.deep.equal({
            mapLatitude: '35.68',
            mapLongitude: '139.76'
        })
    })

    it('puts a Japanese Maps name into the Japanese field when the English preview is the same string', () => {
        const patch = fillEmptyFacilityFields(emptyFacility(), {
            ...emptySource,
            nameEn: '中野クリニック'
        })

        expect(patch).to.deep.equal({ nameJa: '中野クリニック' })
    })

    it('leaves fields the moderator already filled', () => {
        const patch = fillEmptyFacilityFields(emptyFacility({
            nameEn: 'Kept Clinic',
            cityJa: '千代田区',
            mapLatitude: '35.1',
            mapLongitude: ''
        }), {
            ...emptySource,
            nameEn: 'Other Clinic',
            nameJa: '別のクリニック',
            postalCode: '100-0001',
            prefectureJa: '東京都',
            cityEn: 'Nakano',
            cityJa: '中野区',
            streetJa: '中野1-1',
            latitude: 35.7,
            longitude: 139.7
        })

        expect(patch.nameEn).to.equal(undefined)
        expect(patch.nameJa).to.equal('別のクリニック')
        expect(patch.cityEn).to.equal(undefined)
        expect(patch.cityJa).to.equal(undefined)
        expect(patch.postalCode).to.equal('100-0001')
        expect(patch.mapLatitude).to.equal(undefined)
        expect(patch.mapLongitude).to.equal(undefined)
    })

    it('ignores a 0,0 pin', () => {
        const patch = fillEmptyFacilityFields(emptyFacility(), {
            ...emptySource,
            latitude: 0,
            longitude: 0
        })

        expect(patch).to.deep.equal({})
    })
})

describe('officialCityPatch', () => {
    const nakano: CityOption = {
        id: 'city-nakano',
        nameEn: 'Nakano',
        nameJa: '中野区',
        slug: 'nakano',
        prefectureEn: 'Tokyo'
    }

    it('uses the official municipality when the Japanese name matches', () => {
        const current = emptyFacility({ prefectureEn: 'Tokyo' })
        const patch = officialCityPatch(current, {
            prefectureEn: 'Tokyo',
            cityEn: 'Nakano City',
            cityJa: '中野区'
        }, [nakano])

        expect(patch.cityId).to.equal('city-nakano')
        expect(patch.cityEn).to.equal('Nakano')
        expect(patch.cityJa).to.equal('中野区')
    })

    it('keeps the Places spelling when no official row matches', () => {
        const patch = officialCityPatch(emptyFacility({ prefectureEn: 'Tokyo' }), {
            cityEn: 'Somewhere City',
            cityJa: 'どこか'
        }, [nakano])

        expect(patch.cityId).to.equal(undefined)
        expect(patch.cityJa).to.equal('どこか')
    })
})

describe('moderation form editing', () => {
    it('starts saved forms in preview and leaves create forms editable', () => {
        const Child = defineComponent({
            setup() {
                return { editing: useModerationFormEditing() }
            },
            template: '<span>{{ editing }}</span>'
        })
        const SavedForm = defineComponent({
            components: { Child },
            setup() {
                provideModerationFormEditing(false)
            },
            template: '<Child />'
        })
        const CreateForm = defineComponent({
            components: { Child },
            template: '<Child />'
        })

        expect(mount(SavedForm).text()).to.equal('false')
        expect(mount(CreateForm).text()).to.equal('true')
    })
})

describe('facility list icon', () => {
    it('is a small currentColor mark', () => {
        const svg = readFileSync(resolve(process.cwd(), 'assets/icons/hospital-facility-icon.svg'), 'utf8')
        expect(svg).to.include('fill="currentColor"')
        expect(svg).to.include('viewBox="0 0 24 24"')
        expect(svg).to.not.include('469.333')
    })
})
