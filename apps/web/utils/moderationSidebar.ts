/** Remembers whether the my-page sidebar is collapsed. Default is expanded. */
export const MODERATION_SIDEBAR_COLLAPSED_KEY = 'moderation-sidebar-collapsed'

type SidebarStorage = Pick<Storage, 'getItem' | 'setItem'>

function storageOr(storage: SidebarStorage | undefined): SidebarStorage | undefined {
    return storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage)
}

export function readModerationSidebarCollapsed(storage?: SidebarStorage): boolean {
    try {
        return storageOr(storage)?.getItem(MODERATION_SIDEBAR_COLLAPSED_KEY) === 'true'
    } catch {
        return false
    }
}

export function writeModerationSidebarCollapsed(collapsed: boolean, storage?: SidebarStorage): void {
    try {
        storageOr(storage)?.setItem(MODERATION_SIDEBAR_COLLAPSED_KEY, collapsed ? 'true' : 'false')
    } catch {
        // Private mode can reject storage. The sidebar still collapses for this visit.
    }
}
