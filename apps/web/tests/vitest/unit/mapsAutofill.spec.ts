/// <reference types="vitest/globals" />
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import { expect } from 'chai'
import { fillEmptyFacilityFields, type FacilityMapsFillTarget } from '~/utils/mapsAutofill'
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
        addressLine1En: '',
        addressLine1Ja: '',
        mapLatitude: '',
        mapLongitude: '',
        ...overrides
    }
}

describe('fillEmptyFacilityFields', () => {
    it('fills empty names, postal code, the longer prefecture, the street, and the pin', () => {
        const patch = fillEmptyFacilityFields(emptyFacility(), {
            nameEn: 'A-ONE Dental Clinic',
            nameJa: 'A-ONE歯科クリニック',
            addressEn: '1-2-3 Nakano, Nakano City, Tokyo 164-0002',
            addressJa: '〒164-0002 東京都中野区中野1-2-3',
            latitude: 35.7140477,
            longitude: 139.6668954
        })

        expect(patch).to.deep.equal({
            nameEn: 'A-ONE Dental Clinic',
            nameJa: 'A-ONE歯科クリニック',
            postalCode: '164-0002',
            prefectureEn: 'Tokyo',
            prefectureJa: '東京都',
            addressLine1En: '1-2-3 Nakano Nakano City',
            addressLine1Ja: '中野区中野1-2-3',
            mapLatitude: '35.7140477',
            mapLongitude: '139.6668954'
        })
    })

    it('puts a Japanese Maps name into the Japanese field when the English preview is the same string', () => {
        const patch = fillEmptyFacilityFields(emptyFacility(), {
            nameEn: '中野クリニック',
            nameJa: null,
            addressEn: null,
            addressJa: null,
            latitude: null,
            longitude: null
        })

        expect(patch).to.deep.equal({ nameJa: '中野クリニック' })
    })

    it('leaves fields the moderator already filled', () => {
        const patch = fillEmptyFacilityFields(emptyFacility({
            nameEn: 'Kept Clinic',
            mapLatitude: '35.1',
            mapLongitude: ''
        }), {
            nameEn: 'Other Clinic',
            nameJa: '別のクリニック',
            addressEn: null,
            addressJa: '〒100-0001 東京都千代田区',
            latitude: 35.7,
            longitude: 139.7
        })

        expect(patch.nameEn).to.equal(undefined)
        expect(patch.nameJa).to.equal('別のクリニック')
        expect(patch.mapLatitude).to.equal(undefined)
        expect(patch.mapLongitude).to.equal(undefined)
    })

    it('ignores a 0,0 pin', () => {
        const patch = fillEmptyFacilityFields(emptyFacility(), {
            nameEn: null,
            nameJa: null,
            addressEn: null,
            addressJa: null,
            latitude: 0,
            longitude: 0
        })

        expect(patch).to.deep.equal({})
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
