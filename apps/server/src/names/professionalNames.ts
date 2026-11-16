import * as gqlTypes from '@findadoc/graphql'

/**
 * Two names per professional: romaji (en_US) and Japanese script (ja_JP) (#282).
 *
 * The backfill fills a missing name from the other one where that can be done without a
 * dictionary, and puts the row in the moderator queue (name_review = NEEDS_REVIEW):
 * - kana to romaji uses passport-style Hepburn (no long-vowel marks: Satō is Sato);
 * - romaji or English to katakana is a best guess from a syllable table;
 * - a name with kanji has no reading without a dictionary, so it is not guessed.
 */

type KanaPair = readonly [romaji: string, kana: string]

// Hepburn spellings first, so the kana-to-romaji lookup picks shi over si and tsu over tu.
const BASE_ROWS: readonly (readonly [consonant: string, kana: string])[] = [
    ['', 'アイウエオ'],
    ['k', 'カキクケコ'],
    ['s', 'サシスセソ'],
    ['t', 'タチツテト'],
    ['n', 'ナニヌネノ'],
    ['h', 'ハヒフヘホ'],
    ['m', 'マミムメモ'],
    ['r', 'ラリルレロ'],
    ['g', 'ガギグゲゴ'],
    ['z', 'ザジズゼゾ'],
    ['d', 'ダヂヅデド'],
    ['b', 'バビブベボ'],
    ['p', 'パピプペポ']
]

const VOWELS = ['a', 'i', 'u', 'e', 'o'] as const

const HEPBURN_EXCEPTIONS: Readonly<Record<string, string>> = {
    si: 'shi',
    ti: 'chi',
    tu: 'tsu',
    hu: 'fu',
    zi: 'ji',
    di: 'ji',
    du: 'zu'
}

const YOON_ROWS: readonly (readonly [romajiStem: string, kana: string])[] = [
    ['ky', 'キ'], ['sh', 'シ'], ['ch', 'チ'], ['ny', 'ニ'], ['hy', 'ヒ'], ['my', 'ミ'],
    ['ry', 'リ'], ['gy', 'ギ'], ['j', 'ジ'], ['by', 'ビ'], ['py', 'ピ']
]

const EXTRA_PAIRS: readonly KanaPair[] = [
    ['ya', 'ヤ'], ['yu', 'ユ'], ['yo', 'ヨ'], ['wa', 'ワ'], ['o', 'ヲ'], ['vu', 'ヴ'],
    ['she', 'シェ'], ['che', 'チェ'], ['je', 'ジェ'], ['ye', 'イェ'],
    ['fa', 'ファ'], ['fi', 'フィ'], ['fe', 'フェ'], ['fo', 'フォ'],
    ['ti', 'ティ'], ['di', 'ディ'], ['tu', 'トゥ'], ['du', 'ドゥ'],
    ['wi', 'ウィ'], ['we', 'ウェ'], ['wo', 'ウォ']
]

function buildPairs(): KanaPair[] {
    const pairs: KanaPair[] = []

    for (const [consonant, row] of BASE_ROWS) {
        VOWELS.forEach((vowel, index) => {
            const romaji = `${consonant}${vowel}`
            pairs.push([HEPBURN_EXCEPTIONS[romaji] ?? romaji, row.charAt(index)])
        })
    }
    for (const [stem, kana] of YOON_ROWS) {
        pairs.push([`${stem}a`, `${kana}ャ`], [`${stem}u`, `${kana}ュ`], [`${stem}o`, `${kana}ョ`])
    }
    pairs.push(...EXTRA_PAIRS)
    return pairs
}

const PAIRS = buildPairs()

/** Kana to romaji. The first pair for a kana wins, so the Hepburn spelling is used. */
const ROMAJI_BY_KANA = new Map<string, string>()
/** Romaji to katakana. Hepburn and the aliases (si, ti, hu, zi) all parse. */
const KANA_BY_ROMAJI = new Map<string, string>()

for (const [romaji, kana] of PAIRS) {
    if (!ROMAJI_BY_KANA.has(kana)) {
        ROMAJI_BY_KANA.set(kana, romaji)
    }
    if (!KANA_BY_ROMAJI.has(romaji)) {
        KANA_BY_ROMAJI.set(romaji, kana)
    }
}
for (const [alias, hepburn] of Object.entries(HEPBURN_EXCEPTIONS)) {
    const kana = KANA_BY_ROMAJI.get(hepburn)
    if (kana && !KANA_BY_ROMAJI.has(alias)) {
        KANA_BY_ROMAJI.set(alias, kana)
    }
}

const HIRAGANA_START = 0x3041
const HIRAGANA_END = 0x3096
const KATAKANA_OFFSET = 0x60
const KANA_ONLY = /^[ァ-ヺー・ ]+$/u
const SEPARATOR = /[\s・]+/u

function toKatakana(text: string): string {
    return Array.from(text, char => {
        const code = char.codePointAt(0) ?? 0
        return code >= HIRAGANA_START && code <= HIRAGANA_END
            ? String.fromCodePoint(code + KATAKANA_OFFSET)
            : char
    }).join('')
}

function capitalize(word: string): string {
    return word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word
}

// Passport style drops long vowels: Satou and Satoo are Sato, Yuuko is Yuko.
function passportVowels(romaji: string): string {
    return romaji.replace(/ou/g, 'o').replace(/oo/g, 'o').replace(/uu/g, 'u')
}

function kanaWordToRomaji(word: string): string | null {
    let romaji = ''
    let doubleNext = false

    for (let index = 0; index < word.length; index += 1) {
        const pair = word.slice(index, index + 2)
        const char = word.charAt(index)
        let syllable: string | undefined

        if (pair.length === 2 && ROMAJI_BY_KANA.has(pair)) {
            syllable = ROMAJI_BY_KANA.get(pair)
            index += 1
        } else if (char === 'ッ') {
            doubleNext = true
            continue
        } else if (char === 'ー') {
            continue
        } else if (char === 'ン') {
            syllable = 'n'
        } else {
            syllable = ROMAJI_BY_KANA.get(char)
        }

        if (syllable === undefined) {
            return null
        }
        if (doubleNext) {
            romaji += syllable.startsWith('ch') ? 't' : syllable.charAt(0)
            doubleNext = false
        }
        romaji += syllable
    }

    return capitalize(passportVowels(romaji))
}

/**
 * Hiragana or katakana to passport-style Hepburn romaji, one capitalized word per part.
 * Returns null when the text has kanji or anything else that is not kana.
 */
export function kanaToRomaji(text: string): string | null {
    const katakana = toKatakana(text.normalize('NFKC').trim())

    if (!katakana || !KANA_ONLY.test(katakana)) {
        return null
    }

    const words = katakana.split(SEPARATOR).filter(Boolean).map(kanaWordToRomaji)

    return words.every(word => word !== null) && words.length ? words.join(' ') : null
}

// English spellings that the syllable table does not have, rewritten to romaji first.
function englishToRomajiSpelling(word: string): string {
    return word
        .replace(/ph/g, 'f')
        .replace(/th/g, 's')
        .replace(/ck/g, 'k')
        .replace(/c(?=[eiy])/g, 's')
        .replace(/c(?!h)/g, 'k')
        .replace(/q/g, 'k')
        .replace(/x/g, 'ks')
        .replace(/l/g, 'r')
        .replace(/v/g, 'b')
        .replace(/([^aeiou])y$/, '$1i')
}

const SOKUON_CONSONANTS = new Set(['k', 's', 't', 'p'])
const ROMAJI_VOWELS = new Set<string>(VOWELS)

function matchSyllable(word: string, index: number): { kana: string, length: number } | null {
    for (const length of [3, 2, 1]) {
        const kana = KANA_BY_ROMAJI.get(word.slice(index, index + length))
        if (kana) {
            return { kana, length }
        }
    }
    return null
}

// A consonant with no vowel after it: n is ン, t and d take o, h is silent, the rest take u.
function loneConsonant(char: string, next: string): string {
    if (char === 'n' && next !== 'y' && !ROMAJI_VOWELS.has(next)) { return 'ン' }
    if (char === 't') { return 'ト' }
    if (char === 'd') { return 'ド' }
    if (char === 'h') { return '' }
    if (char === 'y') { return 'イ' }
    return KANA_BY_ROMAJI.get(`${char}u`) ?? ''
}

function romajiWordToKatakana(word: string): string {
    let katakana = ''
    let index = 0

    while (index < word.length) {
        const char = word.charAt(index)
        const next = word.charAt(index + 1)

        if (char === next && !ROMAJI_VOWELS.has(char) && char !== 'n') {
            katakana += SOKUON_CONSONANTS.has(char) ? 'ッ' : ''
            index += 1
            continue
        }

        const syllable = char === 'n' && !ROMAJI_VOWELS.has(next) && next !== 'y'
            ? null
            : matchSyllable(word, index)

        if (syllable) {
            katakana += syllable.kana
            index += syllable.length
        } else {
            katakana += loneConsonant(char, next)
            index += 1
        }
    }

    return katakana
}

/**
 * A best-guess katakana spelling for a romaji or English name. A moderator checks it.
 * Returns null when the name has anything other than Latin letters, spaces, hyphens, or apostrophes.
 */
export function romajiToKatakana(text: string): string | null {
    // Drop accents (José is Jose) before checking the letters.
    const plain = text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

    if (!plain || !/^[a-z' -]+$/.test(plain)) {
        return null
    }

    const words = plain.replace(/'/g, '').split(/[\s-]+/).filter(Boolean)
        .map(word => romajiWordToKatakana(englishToRomajiSpelling(word)))

    return words.every(Boolean) && words.length ? words.join('・') : null
}

export const NAME_PLAN_OUTCOME = {
    UNCHANGED: 'UNCHANGED',
    CLEANED: 'CLEANED',
    GENERATED_ROMAJI: 'GENERATED_ROMAJI',
    GENERATED_JAPANESE: 'GENERATED_JAPANESE',
    MISSING_ROMAJI: 'MISSING_ROMAJI',
    MISSING_JAPANESE: 'MISSING_JAPANESE',
    NO_USABLE_NAME: 'NO_USABLE_NAME',
    CONFIRMED: 'CONFIRMED'
} as const

export type NamePlanOutcome = typeof NAME_PLAN_OUTCOME[keyof typeof NAME_PLAN_OUTCOME]

export type NamePlan = {
    names: gqlTypes.LocalizedName[]
    nameReview: gqlTypes.NameReviewStatus | null
    outcome: NamePlanOutcome
    /** Names in a locale other than en_US and ja_JP that were removed. */
    droppedLocales: number
    /** A Japanese middle name moved into the Japanese first name. */
    mergedJapaneseMiddleName: boolean
}

function cleanName(name: gqlTypes.LocalizedName): gqlTypes.LocalizedName {
    const middleName = name.middleName?.trim()
    return {
        firstName: name.firstName.trim(),
        lastName: name.lastName.trim(),
        ...(middleName ? { middleName } : {}),
        locale: name.locale
    }
}

// The Japanese name has no middle name (#282). Keep it in the first name, joined with a middle dot.
function japaneseWithoutMiddle(name: gqlTypes.LocalizedName): gqlTypes.LocalizedName {
    const cleaned = cleanName(name)
    if (!cleaned.middleName) {
        return cleaned
    }
    return {
        firstName: `${cleaned.firstName}・${cleaned.middleName}`,
        lastName: cleaned.lastName,
        locale: gqlTypes.Locale.JaJp
    }
}

function romajiFromJapanese(japanese: gqlTypes.LocalizedName): gqlTypes.LocalizedName | null {
    const firstName = kanaToRomaji(japanese.firstName)
    const lastName = kanaToRomaji(japanese.lastName)
    return firstName && lastName ? { firstName, lastName, locale: gqlTypes.Locale.EnUs } : null
}

// The romaji middle name is left out of the katakana guess; Japanese has no middle name.
function japaneseFromRomaji(romaji: gqlTypes.LocalizedName): gqlTypes.LocalizedName | null {
    const firstName = romajiToKatakana(romaji.firstName)
    const lastName = romajiToKatakana(romaji.lastName)
    return firstName && lastName ? { firstName, lastName, locale: gqlTypes.Locale.JaJp } : null
}

function fillMissing(
    romaji: gqlTypes.LocalizedName | undefined,
    japanese: gqlTypes.LocalizedName | undefined
): Pick<NamePlan, 'names' | 'outcome'> {
    if (romaji && japanese) {
        return { names: [romaji, japanese], outcome: NAME_PLAN_OUTCOME.CLEANED }
    }
    if (japanese) {
        const generated = romajiFromJapanese(japanese)
        return generated
            ? { names: [generated, japanese], outcome: NAME_PLAN_OUTCOME.GENERATED_ROMAJI }
            : { names: [japanese], outcome: NAME_PLAN_OUTCOME.MISSING_ROMAJI }
    }
    if (romaji) {
        const generated = japaneseFromRomaji(romaji)
        return generated
            ? { names: [romaji, generated], outcome: NAME_PLAN_OUTCOME.GENERATED_JAPANESE }
            : { names: [romaji], outcome: NAME_PLAN_OUTCOME.MISSING_JAPANESE }
    }
    return { names: [], outcome: NAME_PLAN_OUTCOME.NO_USABLE_NAME }
}

function sameNames(left: readonly gqlTypes.LocalizedName[], right: readonly gqlTypes.LocalizedName[]): boolean {
    return JSON.stringify(left) === JSON.stringify(right)
}

/**
 * Plans one professional's names for the two-name rule (#282).
 *
 * Names in other locales are removed. A missing romaji or Japanese name is generated where the
 * other name allows it. Anything generated, missing, or merged goes to the moderator queue. A row a
 * moderator already confirmed is not touched. A row with neither name keeps what it has and is
 * queued, so no professional is left with no name at all.
 */
export function planProfessionalNames(
    names: readonly gqlTypes.LocalizedName[],
    nameReview: string | null
): NamePlan {
    const storedReview = nameReview === gqlTypes.NameReviewStatus.NeedsReview
        ? gqlTypes.NameReviewStatus.NeedsReview
        : null
    const unchanged = {
        names: [...names],
        nameReview: storedReview,
        droppedLocales: 0,
        mergedJapaneseMiddleName: false
    }

    if (nameReview === gqlTypes.NameReviewStatus.Confirmed) {
        return { ...unchanged, outcome: NAME_PLAN_OUTCOME.CONFIRMED }
    }

    const romajiSource = names.find(name => name.locale === gqlTypes.Locale.EnUs)
    const japaneseSource = names.find(name => name.locale === gqlTypes.Locale.JaJp)
    const romaji = romajiSource ? cleanName(romajiSource) : undefined
    const japanese = japaneseSource ? japaneseWithoutMiddle(japaneseSource) : undefined
    const mergedJapaneseMiddleName = Boolean(japaneseSource?.middleName?.trim())
    const filled = fillMissing(romaji, japanese)

    if (filled.outcome === NAME_PLAN_OUTCOME.NO_USABLE_NAME) {
        return { ...unchanged, nameReview: gqlTypes.NameReviewStatus.NeedsReview, outcome: filled.outcome }
    }

    const droppedLocales = names.length - (romajiSource ? 1 : 0) - (japaneseSource ? 1 : 0)
    const needsReview = filled.outcome !== NAME_PLAN_OUTCOME.CLEANED || mergedJapaneseMiddleName
    const outcome = filled.outcome === NAME_PLAN_OUTCOME.CLEANED && sameNames(filled.names, names)
        ? NAME_PLAN_OUTCOME.UNCHANGED
        : filled.outcome

    return {
        names: filled.names,
        nameReview: needsReview ? gqlTypes.NameReviewStatus.NeedsReview : unchanged.nameReview,
        outcome,
        droppedLocales,
        mergedJapaneseMiddleName
    }
}
