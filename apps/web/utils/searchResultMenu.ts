const MENU_MAX_HEIGHT = 256
const MENU_GAP = 4
const VIEWPORT_GUTTER = 8

export type SearchMenuAnchor = {
    top: number
    bottom: number
    left: number
    width: number
}

export type SearchResultMenuBox = {
    left: number
    width: number
    maxHeight: number
    top: number | null
    bottom: number | null
}

/**
 * Place the search menu on the viewport, not inside the field.
 * An accordion clips an absolutely positioned list, so the menu is fixed to the field instead.
 * It opens upward once the field is in the lower third and there is more room above than below.
 */
export function searchResultMenuBox(
    anchor: SearchMenuAnchor,
    viewportWidth: number,
    viewportHeight: number
): SearchResultMenuBox {
    const width = Math.max(0, Math.min(anchor.width, viewportWidth - VIEWPORT_GUTTER * 2))
    const maxLeft = Math.max(VIEWPORT_GUTTER, viewportWidth - VIEWPORT_GUTTER - width)
    const left = Math.min(Math.max(anchor.left, VIEWPORT_GUTTER), maxLeft)
    const spaceBelow = viewportHeight - anchor.bottom - MENU_GAP - VIEWPORT_GUTTER
    const spaceAbove = anchor.top - MENU_GAP - VIEWPORT_GUTTER
    const placeAbove = anchor.bottom >= viewportHeight / 1.5 && spaceAbove > spaceBelow

    if (placeAbove) {
        return {
            left,
            width,
            maxHeight: Math.max(0, Math.min(MENU_MAX_HEIGHT, spaceAbove)),
            top: null,
            bottom: viewportHeight - anchor.top + MENU_GAP
        }
    }

    return {
        left,
        width,
        maxHeight: Math.max(0, Math.min(MENU_MAX_HEIGHT, spaceBelow)),
        top: anchor.bottom + MENU_GAP,
        bottom: null
    }
}
