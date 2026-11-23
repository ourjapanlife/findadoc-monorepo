import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import { OpeningDay, type OpeningHours } from '@findadoc/graphql'
import ModOpeningHoursField from '~/components/moderation-panel/ModOpeningHoursField.vue'
import { validateCreateFacility, validateUpdateFacility } from '~/utils/facilitiesUtils'
import type { FacilitySectionFields } from '~/stores/facilitiesStore'
import {
    changedOpeningHours,
    openingHoursInput,
    openingHoursRows,
    visitorInfoProblems,
    visitorNote
} from '~/utils/openingHours'

const i18n = createI18n({ legacy: false, locale: 'en-US', missingWarn: false, fallbackWarn: false })

// Echo the key so the test reads which label each row asked for.
const t = (key: string) => key

const SPLIT_MONDAY: OpeningHours[] = [
    { day: OpeningDay.Monday, opens: '15:00', closes: '18:00' },
    { day: OpeningDay.Monday, opens: '09:00', closes: '12:30' }
]

describe('openingHoursRows', () => {
    it('shows nothing when the hours are unknown', () => {
        expect(openingHoursRows([], t)).toEqual([])
        expect(openingHoursRows(null, t)).toEqual([])
    })

    it('lists every day once hours are known, with a day without hours closed', () => {
        const rows = openingHoursRows(SPLIT_MONDAY, t)

        expect(rows.map(row => row.day)).toEqual([
            OpeningDay.Monday,
            OpeningDay.Tuesday,
            OpeningDay.Wednesday,
            OpeningDay.Thursday,
            OpeningDay.Friday,
            OpeningDay.Saturday,
            OpeningDay.Sunday,
            OpeningDay.PublicHoliday
        ])
        expect(rows[0]).toEqual({
            day: OpeningDay.Monday,
            label: 'openingHours.days.monday',
            times: '09:00–12:30, 15:00–18:00',
            closed: false
        })
        expect(rows.at(-1)).toMatchObject({
            label: 'openingHours.days.publicHoliday',
            times: 'openingHours.closed',
            closed: true
        })
    })
})

describe('changedOpeningHours', () => {
    it('sends nothing when only the order differs from the saved hours', () => {
        expect(changedOpeningHours([...SPLIT_MONDAY].reverse(), SPLIT_MONDAY)).toBeUndefined()
    })

    it('sends the whole list when a block changed, and [] when cleared', () => {
        expect(changedOpeningHours([{ day: OpeningDay.Monday, opens: '10:00', closes: '12:30' }], SPLIT_MONDAY))
            .toEqual([{ day: OpeningDay.Monday, opens: '10:00', closes: '12:30' }])
        expect(changedOpeningHours([], SPLIT_MONDAY)).toEqual([])
    })
})

describe('saving hours a moderator entered wrong', () => {
    const TUESDAY_BACKWARDS = { day: OpeningDay.Tuesday, opens: '18:00', closes: '09:00' }
    const draft = [{ day: OpeningDay.Monday, opens: '09:00', closes: '12:30' }, TUESDAY_BACKWARDS]

    it('keeps an invalid block in the input instead of dropping it', () => {
        expect(openingHoursInput(draft)).toEqual(draft)
        expect(changedOpeningHours([{ day: OpeningDay.Monday, opens: '09:00', closes: '' }], SPLIT_MONDAY))
            .toEqual([{ day: OpeningDay.Monday, opens: '09:00', closes: '' }])
    })

    it('stops the create before anything is sent', () => {
        const result = validateCreateFacility({
            nameEn: 'Fake Clinic',
            nameJa: 'フェイククリニック',
            online: true,
            contact: { phone: '03-0000-0000', email: '', website: '' },
            healthcareProfessionalIds: [],
            openingHours: openingHoursInput(draft)
        })
        expect(result.valid).toBe(false)
        expect(result.errors).toContain('serverErrorMessages.invalidOpeningHours')
    })

    it('stops the update on the raw draft, so saved hours are not replaced by unknown', () => {
        const fields = {
            nameEn: 'Fake Clinic',
            nameJa: 'フェイククリニック',
            phone: '03-0000-0000',
            online: true,
            openingHours: [{ day: OpeningDay.Monday, opens: '09:00', closes: '' }],
            additionalInfoEn: '',
            additionalInfoJa: ''
        } as unknown as FacilitySectionFields
        const result = validateUpdateFacility(fields, { openingHours: [] })
        expect(result.errors).toContain('serverErrorMessages.invalidOpeningHours')
    })

    it('names a note written in one language', () => {
        expect(visitorInfoProblems({ additionalInfoEn: 'Walk-ins welcome.', additionalInfoJa: ' ' }))
            .toEqual(['serverErrorMessages.additionalInfoBothLanguages'])
        expect(visitorInfoProblems({ openingHours: SPLIT_MONDAY })).toEqual([])
    })
})

describe('visitorNote', () => {
    const facility = { additionalInfoEn: 'Walk-ins welcome.', additionalInfoJa: '予約不要です。' }

    it('gives Japanese readers the Japanese note and everyone else the English one', () => {
        expect(visitorNote(facility, true)).toEqual({ text: '予約不要です。', lang: 'ja' })
        expect(visitorNote(facility, false)).toEqual({ text: 'Walk-ins welcome.', lang: 'en' })
    })

    it('shows nothing without a note', () => {
        expect(visitorNote({ additionalInfoEn: null, additionalInfoJa: null }, false)).toBeNull()
    })
})

describe('ModOpeningHoursField', () => {
    function mountField(modelValue: OpeningHours[]) {
        const wrapper = mount(ModOpeningHoursField, {
            props: {
                modelValue,
                'onUpdate:modelValue': (value: OpeningHours[]) => wrapper.setProps({ modelValue: value })
            },
            global: { plugins: [i18n] }
        })
        return wrapper
    }

    it('opens a day at 09:00–18:00, and a break splits it into morning and afternoon', async () => {
        const wrapper = mountField([])
        await wrapper.get('[data-testid="mod-facility-section-opening-hours-MONDAY-open"]').setValue(true)
        expect(wrapper.props('modelValue')).toEqual([{ day: OpeningDay.Monday, opens: '09:00', closes: '18:00' }])

        await wrapper.get('[data-testid="mod-facility-section-opening-hours-MONDAY-add-break"]').trigger('click')
        expect(wrapper.props('modelValue')).toEqual([
            { day: OpeningDay.Monday, opens: '09:00', closes: '12:00' },
            { day: OpeningDay.Monday, opens: '13:00', closes: '18:00' }
        ])
        expect(wrapper.find('[data-testid="mod-facility-section-opening-hours-MONDAY-break-0"]').exists()).toBe(true)
    })

    it('picks times from the lists, with 24:00 as the end of the day', async () => {
        const wrapper = mountField([{ day: OpeningDay.Friday, opens: '09:00', closes: '18:00' }])
        await wrapper.get('[data-testid="mod-facility-section-opening-hours-FRIDAY-opens-0"]').setValue('16:30')
        await wrapper.get('[data-testid="mod-facility-section-opening-hours-FRIDAY-closes-0"]').setValue('24:00')
        expect(wrapper.props('modelValue')).toEqual([{ day: OpeningDay.Friday, opens: '16:30', closes: '24:00' }])
    })

    it('copies Monday to Tuesday through Friday', async () => {
        const wrapper = mountField([
            { day: OpeningDay.Monday, opens: '09:00', closes: '12:00' },
            { day: OpeningDay.Monday, opens: '16:30', closes: '18:30' },
            { day: OpeningDay.Saturday, opens: '09:00', closes: '12:00' }
        ])
        await wrapper.get('[data-testid="mod-facility-section-opening-hours-copy-weekdays"]').trigger('click')
        const days = wrapper.props('modelValue').map(block => block.day)
        expect(days.filter(day => day === OpeningDay.Thursday)).toHaveLength(2)
        expect(days.filter(day => day === OpeningDay.Saturday)).toHaveLength(1)
    })

    it('closes a day by unticking it', async () => {
        const wrapper = mountField([
            { day: OpeningDay.Friday, opens: '09:00', closes: '17:00' },
            { day: OpeningDay.Saturday, opens: '09:00', closes: '12:00' }
        ])
        await wrapper.get('[data-testid="mod-facility-section-opening-hours-FRIDAY-open"]').setValue(false)
        expect(wrapper.props('modelValue')).toEqual([{ day: OpeningDay.Saturday, opens: '09:00', closes: '12:00' }])
        expect(wrapper.get('[data-testid="mod-facility-section-opening-hours-FRIDAY"]').text()).toContain('openingHours.closed')
    })

    it('says when a block closes before it opens', async () => {
        const wrapper = mountField([{ day: OpeningDay.Friday, opens: '18:00', closes: '09:00' }])
        expect(wrapper.find('[data-testid="mod-facility-section-opening-hours-error"]').exists()).toBe(true)
    })

    it('removes a block', async () => {
        const wrapper = mountField([{ day: OpeningDay.Friday, opens: '09:00', closes: '17:00' }])
        await wrapper.get('[data-testid="mod-facility-section-opening-hours-FRIDAY-remove-0"]').trigger('click')
        expect(wrapper.props('modelValue')).toEqual([])
    })
})
