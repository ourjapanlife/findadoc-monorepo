const NAMED_PLACEHOLDER = /\{[A-Za-z_][A-Za-z0-9_]*\}/g
const HAS_LETTER = /\p{L}/u

export function flattenMessages(value, prefix = '') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return prefix ? [[prefix, value]] : []
    }

    return Object.entries(value).flatMap(([key, nested]) => {
        const path = prefix ? `${prefix}.${key}` : key
        if (typeof nested === 'object' && nested !== null && !Array.isArray(nested)) {
            return flattenMessages(nested, path)
        }
        return [[path, nested]]
    })
}

export function messageMap(value) {
    return Object.fromEntries(flattenMessages(value))
}

export function interpolationTokens(value) {
    return [...String(value).matchAll(NAMED_PLACEHOLDER)].map(match => match[0]).sort()
}

function sameTokens(english, translated) {
    const expected = interpolationTokens(english)
    const actual = interpolationTokens(translated)
    return expected.length === actual.length && expected.every((token, index) => token === actual[index])
}

/**
 * @param {unknown} english
 * @param {unknown} translated
 * @param {ReadonlySet<string>} allowSameAsEnglish keys whose text is the same in this locale on purpose
 * @returns {string[]}
 */
export function localeMessageProblems(english, translated, allowSameAsEnglish) {
    const englishMessages = messageMap(english)
    const translatedMessages = messageMap(translated)
    const problems = []

    for (const key of Object.keys(englishMessages)) {
        if (!Object.prototype.hasOwnProperty.call(translatedMessages, key)) {
            problems.push(`${key}: missing`)
            continue
        }

        const source = englishMessages[key]
        const value = translatedMessages[key]
        if (!sameTokens(source, value)) {
            problems.push(`${key}: placeholders must match English (${interpolationTokens(source).join(', ')})`)
        }

        if (value === source && HAS_LETTER.test(String(source)) && !allowSameAsEnglish.has(key)) {
            problems.push(`${key}: still the English sentence`)
        }
    }

    for (const key of Object.keys(translatedMessages)) {
        if (!Object.prototype.hasOwnProperty.call(englishMessages, key)) {
            problems.push(`${key}: not in en.json`)
        }
    }

    return problems
}
