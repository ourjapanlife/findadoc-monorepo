import { describe, expect, it } from 'vitest'
import { arraysAreEqual } from './array.js'

describe('arraysAreEqual', () => {
    it('sorts and finds two arrays with the same primitive values equal', () => {
        expect(arraysAreEqual([1, 2, 3], [3, 1, 2])).toBe(true)
    })

    it('sorts and finds two arrays with different primitive values unequal', () => {
        expect(arraysAreEqual([1, 2, 3], [4, 5, 6])).toBe(false)
    })

    it('sorts and finds two arrays with the same object values equal', () => {
        const arr1 = [{ name: 'Tony', profession: 'tester' }, { name: 'Sara', profession: 'coder' }]
        const arr2 = [{ name: 'Sara', profession: 'coder' }, { name: 'Tony', profession: 'tester' }]

        expect(arraysAreEqual(arr1, arr2)).toBe(true)
    })

    it('sorts and finds two arrays with different object values unequal', () => {
        const arr1 = [{ name: 'Tony', profession: 'tester' }, { name: 'Sara', profession: 'coder' }]
        const arr2 = [{ name: 'Max', profession: 'Truck Driver' }, { name: 'Helen', profession: 'History Professor' }]

        expect(arraysAreEqual(arr1, arr2)).toBe(false)
    })

    it('sorts and finds two arrays with the same array values equal', () => {
        const arr1 = [[1, 2, 3], [4, 5, 6]]
        const arr2 = [[4, 5, 6], [1, 2, 3]]

        expect(arraysAreEqual(arr1, arr2)).toBe(true)
    })

    it('sorts and finds two arrays with different array values unequal', () => {
        const arr1 = [[1, 2, 3], [4, 5, 6]]
        const arr2 = [[7, 8, 9], [1, 2, 3]]

        expect(arraysAreEqual(arr1, arr2)).toBe(false)
    })
})
