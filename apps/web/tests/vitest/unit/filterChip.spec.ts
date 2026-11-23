import { describe, expect, it } from 'vitest'
import { chipSelectionAfterToggle } from '~/utils/filterChip'

const ALL = ['NEW', 'FOR_REVIEW', 'APPROVED'] as const
type Queue = typeof ALL[number]

function toggle(selected: Queue[], value: Queue, multiselect = true): Queue[] {
    return chipSelectionAfterToggle<Queue>(selected, value, ALL, multiselect)
}

describe('chipSelectionAfterToggle', () => {
    it('unticks one option from the default, where every option shows ticked', () => {
        expect(toggle([], 'APPROVED')).toEqual(['NEW', 'FOR_REVIEW'])
    })

    it('goes back to the default when the last unticked option is ticked again', () => {
        expect(toggle(['NEW', 'FOR_REVIEW'], 'APPROVED')).toEqual([])
    })

    it('keeps the options in their listed order', () => {
        expect(toggle(['APPROVED'], 'NEW')).toEqual(['NEW', 'APPROVED'])
    })

    it('never unticks the last ticked option', () => {
        expect(toggle(['NEW'], 'NEW')).toEqual(['NEW'])
    })

    it('picks one option, and clears it on a second click, when not a multiselect', () => {
        expect(toggle([], 'NEW', false)).toEqual(['NEW'])
        expect(toggle(['NEW'], 'APPROVED', false)).toEqual(['APPROVED'])
        expect(toggle(['APPROVED'], 'APPROVED', false)).toEqual([])
    })
})
