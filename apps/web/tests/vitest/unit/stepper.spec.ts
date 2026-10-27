/// <reference types="vitest/globals" />
import { expect } from 'chai'
import { skipsUnreachedStep } from '@/utils/stepper'

describe('stepper jumps', () => {
    it('allows a move among steps that have already been opened', () => {
        expect(skipsUnreachedStep({ from: 0, to: 2, maxReached: 2 })).to.equal(false)
        expect(skipsUnreachedStep({ from: 2, to: 1, maxReached: 2 })).to.equal(false)
    })

    it('allows the next new step only from the furthest opened step', () => {
        expect(skipsUnreachedStep({ from: 1, to: 2, maxReached: 1 })).to.equal(false)
        expect(skipsUnreachedStep({ from: 0, to: 2, maxReached: 1 })).to.equal(true)
    })

    it('blocks a jump that skips a step nobody has opened', () => {
        expect(skipsUnreachedStep({ from: 0, to: 2, maxReached: 0 })).to.equal(true)
    })
})
