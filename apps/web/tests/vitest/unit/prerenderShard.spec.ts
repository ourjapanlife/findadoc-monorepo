/// <reference types="vitest/globals" />
import { expect } from 'chai'
import { isPrimaryPrerenderShard, parsePrerenderShard, pathsForShard } from '@/utils/prerenderShard'

function throws(run: () => unknown): boolean {
    try {
        run()
        return false
    } catch {
        return true
    }
}

describe('parsePrerenderShard', () => {
    it('reads index/count, and unset as one unsplit build', () => {
        expect(parsePrerenderShard('2/4')).to.deep.equal({ index: 2, count: 4 })
        expect(parsePrerenderShard(' 0/1 ')).to.deep.equal({ index: 0, count: 1 })
        expect(parsePrerenderShard(undefined)).to.equal(null)
        expect(parsePrerenderShard('')).to.equal(null)
    })

    it('refuses a value that would skip or repeat pages', () => {
        for (const value of ['4/4', '1/0', '-1/2', '1', 'a/b', '1/17']) {
            expect(throws(() => parsePrerenderShard(value)), value).to.equal(true)
        }
    })
})

describe('pathsForShard', () => {
    const paths = Array.from({ length: 1000 }, (_, i) => `/clinic/tokyo/minato/clinic-${i}--${i}`)

    it('puts every path in exactly one shard', () => {
        const shards = [0, 1, 2, 3].map(index => pathsForShard(paths, { index, count: 4 }))

        expect(shards.flat().sort()).to.deep.equal([...paths].sort())
    })

    it('splits about evenly, and the same way on every run', () => {
        const sizes = [0, 1, 2, 3].map(index => pathsForShard(paths, { index, count: 4 }).length)

        for (const size of sizes) {
            expect(size).to.be.within(200, 300)
        }
        expect(pathsForShard(paths, { index: 1, count: 4 })).to.deep.equal(pathsForShard(paths, { index: 1, count: 4 }))
    })

    it('keeps every path without a shard', () => {
        expect(pathsForShard(paths, null)).to.deep.equal(paths)
        expect(isPrimaryPrerenderShard(null)).to.equal(true)
        expect(isPrimaryPrerenderShard({ index: 0, count: 4 })).to.equal(true)
        expect(isPrimaryPrerenderShard({ index: 1, count: 4 })).to.equal(false)
    })
})
