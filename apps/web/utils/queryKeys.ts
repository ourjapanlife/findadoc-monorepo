/**
 * Every vue-query key the web app uses (#242). Build keys here, never as string arrays in a
 * component, so a write can invalidate exactly the reads it changes.
 *
 * Keys are hierarchical. Invalidating a prefix invalidates every key under it, so a facility
 * or professional write invalidates `queryKeys.directory()` and that covers the search directory.
 */
export const queryKeys = {
    /** Root of every public directory read: facilities, professionals, and what is built from them. */
    directory: () => ['directory'] as const,
    /** Every published facility and professional, loaded whole for /search and filtered in the browser. */
    searchDirectory: () => [...queryKeys.directory(), 'search'] as const
}
