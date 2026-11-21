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

/**
 * Dotted paths of keys that appear twice in the same object of a JSON file. JSON.parse keeps
 * only the last one, so an earlier translation is silently dropped and no other check sees it.
 */
export function duplicateMessageKeys(text) {
    const duplicates = []
    const stack = []
    let index = 0

    function readString() {
        let value = ''
        index++
        while (index < text.length && text[index] !== '"') {
            if (text[index] === '\\') {
                value += text[index]
                index++
            }
            value += text[index]
            index++
        }
        index++
        return value
    }

    while (index < text.length) {
        const character = text[index]
        const frame = stack.at(-1)

        if (character === '"') {
            const value = readString()
            if (frame?.expectingKey) {
                const path = [...stack.map(entry => entry.key).filter(Boolean), value].join('.')
                if (frame.keys.has(value)) {
                    duplicates.push(path)
                }
                frame.keys.add(value)
                frame.pendingKey = value
                frame.expectingKey = false
            }
            continue
        }

        if (character === '{') {
            stack.push({ keys: new Set(), expectingKey: true, pendingKey: null, key: frame?.pendingKey ?? null })
        } else if (character === '}') {
            stack.pop()
        } else if (character === ',' && frame) {
            frame.expectingKey = true
        }
        index++
    }

    return duplicates
}
