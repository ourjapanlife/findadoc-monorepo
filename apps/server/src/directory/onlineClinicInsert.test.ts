import { describe, expect, it } from 'vitest'
import {
    ONLINE_CLINIC_LANGUAGES,
    TANAKA_PATIENT_NOTE,
    isAyaYumino,
    isKanTanaka,
    planOnlineClinic,
    type NamedPerson
} from './onlineClinicInsert.js'

const aya: NamedPerson = {
    id: 'aya',
    names: [
        { locale: 'ja_JP', firstName: '綾', lastName: '弓野' },
        { locale: 'en_US', firstName: 'Aya', lastName: 'Yumino' }
    ]
}

const tanaka: NamedPerson = {
    id: 'tanaka',
    names: [
        { locale: 'ja_JP', firstName: '完', lastName: '田中' },
        { locale: 'en_US', firstName: 'Kan', lastName: 'Tanaka' }
    ]
}

describe('online clinic directory insert', () => {
    it('keeps Vietnamese off the published language list', () => {
        expect(ONLINE_CLINIC_LANGUAGES).not.toContain('vi_VN')
        expect(ONLINE_CLINIC_LANGUAGES).toContain('ja_JP')
        expect(ONLINE_CLINIC_LANGUAGES).toContain('ne_NP')
    })

    it('recognises Aya and Kan by both names', () => {
        expect(isAyaYumino(aya.names)).toBe(true)
        expect(isAyaYumino([{ locale: 'ja_JP', firstName: '綾', lastName: '弓野' }])).toBe(false)
        expect(isKanTanaka(tanaka.names)).toBe(true)
        expect(TANAKA_PATIENT_NOTE).toContain('院長')
        expect(TANAKA_PATIENT_NOTE).toContain('Clinic Director')
    })

    it('creates the clinic and Tanaka, and links the existing Aya', () => {
        const planned = planOnlineClinic({
            aya: [aya],
            tanaka: [],
            facilities: [],
            links: []
        })
        expect(planned.ok).toBe(true)
        if (!planned.ok) {
            return
        }
        expect(planned.plan).toEqual({
            ayaId: 'aya',
            facilityId: null,
            tanakaId: null,
            linkAya: true,
            linkTanaka: true
        })
    })

    it('does nothing when the clinic, Tanaka, and both links are already stored', () => {
        const planned = planOnlineClinic({
            aya: [aya],
            tanaka: [tanaka],
            facilities: [{ id: 'clinic', nameEn: 'Multilingual online clinic', nameJa: '多言語オンラインクリニック' }],
            links: [
                { hpsId: 'aya', facilityId: 'clinic' },
                { hpsId: 'tanaka', facilityId: 'clinic' }
            ]
        })
        expect(planned.ok).toBe(true)
        if (!planned.ok) {
            return
        }
        expect(planned.plan.linkAya).toBe(false)
        expect(planned.plan.linkTanaka).toBe(false)
        expect(planned.plan.facilityId).toBe('clinic')
        expect(planned.plan.tanakaId).toBe('tanaka')
    })

    it('stops when 田中 完 is stored under another English name', () => {
        const planned = planOnlineClinic({
            aya: [aya],
            tanaka: [{
                id: 'other',
                names: [
                    { locale: 'ja_JP', firstName: '完', lastName: '田中' },
                    { locale: 'en_US', firstName: 'Kan', lastName: 'Sato' }
                ]
            }],
            facilities: [],
            links: []
        })
        expect(planned).toEqual({
            ok: false,
            reason: '田中 完 is already stored under a different English name'
        })
    })

    it('stops when Aya is missing', () => {
        const planned = planOnlineClinic({
            aya: [],
            tanaka: [],
            facilities: [],
            links: []
        })
        expect(planned.ok).toBe(false)
    })
})
