/**
 * The selection after a click in a FilterChip (#313). The selection is what is ticked.
 *
 * Multiselect: the click ticks or unticks one option, and the list keeps the options' order.
 * The last ticked option cannot be unticked: showing nothing is not a filter.
 * Single select: the click picks that option, and a click on the picked one clears it.
 */
export function chipSelectionAfterToggle<T extends string>(
    selected: readonly T[],
    value: T,
    all: readonly T[],
    multiselect: boolean
): T[] {
    if (!multiselect) {
        return selected.includes(value) ? [] : [value]
    }
    if (selected.includes(value)) {
        return selected.length === 1 ? [...selected] : selected.filter(item => item !== value)
    }
    return all.filter(item => item === value || selected.includes(item))
}

/** True when the selection holds the same options as the chip's default, in any order. */
export function isChipDefaultSelection<T extends string>(selected: readonly T[], defaults: readonly T[]): boolean {
    return selected.length === defaults.length && defaults.every(item => selected.includes(item))
}
