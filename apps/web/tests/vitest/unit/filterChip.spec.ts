import { describe, expect, it } from 'vitest'
import { chipSelectionAfterToggle, isChipDefaultSelection } from '~/utils/filterChip'

const ALL = ['NEW', 'FOR_REVIEW', 'APPROVED'] as const
type Queue = typeof ALL[number]

function toggle(selected: Queue[], value: Queue, multiselect = true): Queue[] {
    return chipSelectionAfterToggle<Queue>(selected, value, ALL, multiselect)
}

describe('chipSelectionAfterToggle', () => {
    it('adds a ticked option to the selection', () => {
        expect(toggle(['NEW'], 'APPROVED')).toEqual(['NEW', 'APPROVED'])
    })

    it('removes an unticked option from the selection', () => {
        expect(toggle(['NEW', 'APPROVED'], 'NEW')).toEqual(['APPROVED'])
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

describe('isChipDefaultSelection', () => {
    it('matches the default in any order', () => {
        expect(isChipDefaultSelection<Queue>(['APPROVED', 'NEW'], ['NEW', 'APPROVED'])).toBe(true)
    })

    it('does not match once an option is added', () => {
        expect(isChipDefaultSelection<Queue>(['NEW', 'APPROVED'], ['NEW'])).toBe(false)
    })
})
