/**
 * The selection after a click in a FilterChip (#313). An empty selection is the default: no
 * filter, which a multiselect shows as every option ticked.
 *
 * Multiselect: the click unticks or ticks one option. Ticking the last unticked one is every
 * option again, so it returns []. The last ticked option cannot be unticked.
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
    const shown = selected.length === 0 ? [...all] : [...selected]
    if (shown.includes(value)) {
        return shown.length === 1 ? shown : shown.filter(item => item !== value)
    }
    const next = all.filter(item => item === value || shown.includes(item))
    return next.length === all.length ? [] : next
}
