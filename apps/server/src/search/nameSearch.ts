import { sql, type Expression, type ExpressionBuilder, type SqlBool } from 'kysely'
import type { Database } from '../typeDefs/kyselyTypes.js'
import { likeContainsPattern } from './listQuery.js'

/** More words than a name has is noise, and each word adds a scan of the row's words. */
export const NAME_QUERY_MAX_WORDS = 8

/** Romaji and other Latin-script words. Kana and kanji are matched exactly (see nameWordMaxEdits). */
const LATIN_WORD = /^[\p{Script=Latin}'-]+$/u

/**
 * The words of a name query, lowercased, in the order typed. A full-width space splits too, so
 * 山田 and 太郎 typed with one between them are two words. Repeated words count once.
 */
export function nameQueryWords(query: string): string[] {
    const words = query.normalize('NFKC').toLowerCase().split(/\s+/u).filter(word => word !== '')

    return [...new Set(words)].slice(0, NAME_QUERY_MAX_WORDS)
}

/**
 * How many letters a word may be off and still match a name word. Short words match exactly,
 * so "lee" does not find "leo". A kana or kanji word also matches exactly: one character off
 * is a different name (山本 is not 山田).
 */
export function nameWordMaxEdits(word: string): number {
    if (!LATIN_WORD.test(word)) {
        return 0
    }
    if (word.length >= 8) {
        return 2
    }
    return word.length >= 4 ? 1 : 0
}

/** A query word appears in the professional's search text, as typed. */
function containsWord(eb: ExpressionBuilder<Database, 'hps'>, word: string): Expression<SqlBool> {
    return eb('hps.search_text', 'ilike', likeContainsPattern(word))
}

/**
 * One query word matches a professional: it is part of the search text, or it is a typo
 * away from one of the name's words.
 */
function nameWordMatches(eb: ExpressionBuilder<Database, 'hps'>, word: string): Expression<SqlBool> {
    const maxEdits = nameWordMaxEdits(word)
    if (maxEdits === 0) {
        return containsWord(eb, word)
    }

    const nearWord = sql<SqlBool>`exists (
        select 1 from regexp_split_to_table(lower(${sql.ref('hps.search_text')}), ${'\\s+'}) as name_word(value)
        where public.levenshtein_less_equal(name_word.value, ${word}, ${maxEdits}) <= ${maxEdits}
    )`

    return eb.or([containsWord(eb, word), nearWord])
}

/**
 * Every word of the query matches the professional, in any order (Ada Lovelace, Lovelace Ada).
 * search_text also holds each name run together, so 山田太郎 and yamadataro match too.
 */
export function professionalNameMatches(
    eb: ExpressionBuilder<Database, 'hps'>,
    words: readonly string[]
): Expression<SqlBool> {
    return eb.and(words.map(word => nameWordMatches(eb, word)))
}

/** True when every word appears as typed, so exact matches can sort ahead of near ones. */
export function professionalNameExact(
    eb: ExpressionBuilder<Database, 'hps'>,
    words: readonly string[]
): Expression<SqlBool> {
    return eb.and(words.map(word => containsWord(eb, word)))
}
