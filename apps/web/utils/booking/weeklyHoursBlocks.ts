/**
 * Editable weekly blocks for the dashboard: a clinic's or doctor's week (#162), or
 * an interpreter's (#205). Each block has a key so Vue can track it while edited.
 */

export type EditableBlock = { key: number, weekday: number, startMinute: number, endMinute: number }

export const HOURS_STEP_MINUTES = 30
export const DAY_MINUTES = 24 * 60
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const

let nextKey = 0

export function newBlock(weekday: number, startMinute: number, endMinute: number): EditableBlock {
    nextKey += 1
    return { key: nextKey, weekday, startMinute, endMinute }
}

/** Saved hours as editable blocks. */
export function editableBlocks(
    hours: readonly { weekday: number, startMinute: number, endMinute: number }[]
): EditableBlock[] {
    return hours.map(block => newBlock(block.weekday, block.startMinute, block.endMinute))
}

/** Editable blocks as the API input. */
export function hoursInput(blocks: readonly EditableBlock[]): { weekday: number, startMinute: number, endMinute: number }[] {
    return blocks.map(block => ({ weekday: block.weekday, startMinute: block.startMinute, endMinute: block.endMinute }))
}

export function blocksForDay(blocks: readonly EditableBlock[], weekday: number): EditableBlock[] {
    return blocks.filter(block => block.weekday === weekday).sort((a, b) => a.startMinute - b.startMinute)
}

/** True when two blocks on one day overlap. */
export function blocksOverlap(blocks: readonly EditableBlock[]): boolean {
    return WEEKDAYS.some(weekday => {
        const sorted = blocksForDay(blocks, weekday)
        return sorted.some((block, index) => index > 0 && block.startMinute < sorted[index - 1]!.endMinute)
    })
}
