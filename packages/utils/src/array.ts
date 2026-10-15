export function removeDuplicates<T>(inputArray: T[]): T[] {
    return inputArray.reduce((dedupedArray: T[], currentItem: T) => {
        if (!dedupedArray.includes(currentItem)) {
            dedupedArray.push(currentItem)
        }

        return dedupedArray
    }, [])
}

export function arraysAreEqual<T>(array1: T[], array2: T[]): boolean {
    if (array1.length !== array2.length) {
        return false
    }

    const sortedArray1 = [...array1].sort(compareElements)
    const sortedArray2 = [...array2].sort(compareElements)

    for (let i = 0; i < sortedArray1.length; i++) {
        if (canonicalize(sortedArray1[i]) !== canonicalize(sortedArray2[i])) {
            return false
        }
    }

    return true
}

export function shuffleArray<T>(inputArray: T[]): T[] {
    const copiedArray = [...inputArray]

    for (let i = copiedArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const left = copiedArray[i]
        const right = copiedArray[j]
        if (left === undefined || right === undefined) {
            continue
        }
        copiedArray[i] = right
        copiedArray[j] = left
    }
    return copiedArray
}

function compareElements<T>(ele1: T, ele2: T): number {
    const ele1Str = canonicalize(ele1)
    const ele2Str = canonicalize(ele2)
    if (ele1Str < ele2Str) return -1
    if (ele1Str > ele2Str) return 1
    return 0
}

function canonicalize<T>(value: T): string {
    if (value === null) return 'null'
    if (value === undefined) return 'undefined'

    if (typeof value !== 'object') {
        return JSON.stringify(value)
    }

    if (Array.isArray(value)) {
        return `[${value.map(canonicalize).join(',')}]`
    }

    const obj = value as { [key: string]: unknown }
    const keys = Object.keys(obj).sort()
    const keyValuePairs = keys.map(
        key => `${JSON.stringify(key)}:${canonicalize(obj[key])}`
    )
    return `{${keyValuePairs.join(',')}}`
}
