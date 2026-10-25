import { onScopeDispose, type Ref } from 'vue'

const PICKER_SEARCH_DELAY_MS = 300

/**
 * The moderation menus used to filter the first page already loaded.
 * This asks the directory for the typed name, and a late reply cannot replace a newer one.
 */
export function useDirectoryPickerSearch<T>(
    search: (query: string) => Promise<T[]>,
    narrow?: (rows: T[]) => T[]
) {
    let request = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    onScopeDispose(() => {
        request += 1
        if (timer !== undefined) {
            clearTimeout(timer)
        }
    })

    return (filteredItems: Ref<T[]>, inputValue: string) => {
        const current = ++request
        if (timer !== undefined) {
            clearTimeout(timer)
        }
        timer = setTimeout(() => {
            void search(inputValue).then(rows => {
                if (current !== request) {
                    return
                }
                filteredItems.value = narrow ? narrow(rows) : rows
            }).catch((error: unknown) => {
                console.error(error)
            })
        }, PICKER_SEARCH_DELAY_MS)
    }
}
