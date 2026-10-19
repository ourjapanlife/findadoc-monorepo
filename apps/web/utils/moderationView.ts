/** Query value for `/my-page`. An empty view is the signed-in account page. */
export function moderationViewQuery(view: unknown): string {
    return typeof view === 'string' ? view : ''
}

/** Settings is the account page. A bare `/my-page` and `?view=settings` are the same place. */
export function isModerationSettingsView(view: unknown): boolean {
    const query = moderationViewQuery(view)
    return query === '' || query === 'settings'
}

/** The list search and status tabs stay off the account page. */
export function hidesModerationListTopbar(view: unknown): boolean {
    return isModerationSettingsView(view)
}
