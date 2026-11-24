import { describe, expect, it } from 'vitest'
import { NAME_QUERY_MAX_WORDS, nameQueryWords, nameWordMaxEdits } from '../src/search/nameSearch.js'
import { applyHpFilters } from '../src/services/healthcareProfessionalService.js'
import { compileOnlyDb } from './fixtures/compileOnlyDb.js'

describe('nameQueryWords', () => {
    it('splits a name into lowercase words so any order matches', () => {
        expect(nameQueryWords('  Ada   LOVELACE ')).toEqual(['ada', 'lovelace'])
    })

    it('splits on a full-width space', () => {
        expect(nameQueryWords('山田　太郎')).toEqual(['山田', '太郎'])
    })

    it('counts a repeated word once and caps the number of words', () => {
        expect(nameQueryWords('ada ada')).toEqual(['ada'])
        expect(nameQueryWords('a b c d e f g h i j')).toHaveLength(NAME_QUERY_MAX_WORDS)
    })

    it('returns no words for a blank query', () => {
        expect(nameQueryWords('   ')).toEqual([])
    })
})

describe('nameWordMaxEdits', () => {
    it('matches short words exactly', () => {
        expect(nameWordMaxEdits('lee')).toBe(0)
    })

    it('forgives one typo in a name of four to seven letters and two in a longer one', () => {
        expect(nameWordMaxEdits('tanka')).toBe(1)
        expect(nameWordMaxEdits('lovelace')).toBe(2)
    })

    it('matches kana and kanji exactly', () => {
        expect(nameWordMaxEdits('山本太郎です')).toBe(0)
        expect(nameWordMaxEdits('やまもとたろう')).toBe(0)
    })
})

describe('professional name filter', () => {
    it('needs every word and binds each one as a parameter', () => {
        const query = applyHpFilters(compileOnlyDb.selectFrom('hps').selectAll(), { query: 'Lovelace Ada' }).compile()

        expect(query.sql).toContain('levenshtein_less_equal')
        expect(query.sql).toContain(' and ')
        expect(query.parameters).toContain('%lovelace%')
        expect(query.parameters).toContain('%ada%')
        expect(query.parameters).toContain('lovelace')
        expect(query.parameters).not.toContain('ada')
    })
})
