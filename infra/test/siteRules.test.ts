import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { siteRules } from '../lib/webStack.js'

const rules = siteRules()
const indexOf = (source: string) => rules.findIndex(rule => rule.source === source)

describe('siteRules', () => {
    it('serves a slashed page URL from its slashless .html file', () => {
        const rule = rules[indexOf('/<*>/')]
        assert.equal(rule?.target, '/<*>.html')
        assert.equal(rule?.status, '200')
    })

    it('does not redirect slashed URLs, because Amplify already 301s missing paths to them', () => {
        assert.ok(rules.every(rule => !(rule.source.endsWith('/') && rule.status === '301')))
    })

    it('keeps the homepage on index.html before the slash rule', () => {
        assert.ok(indexOf('/') > -1)
        assert.equal(rules[indexOf('/')]?.target, '/index.html')
        assert.ok(indexOf('/') < indexOf('/<*>/'))
    })

    it('puts the client-route rewrites before the slash rule and the .html catch-all last', () => {
        assert.ok(indexOf('/search') < indexOf('/<*>/'))
        assert.ok(indexOf('/<*>/') < indexOf('/<*>'))
        assert.equal(rules.at(-1)?.source, '/<*>')
    })
})
