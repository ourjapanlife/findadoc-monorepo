import { onScopeDispose, type Ref } from 'vue'

const PICKER_SEARCH_DELAY_MS = 300

type PickerSearch<T> = ((filteredItems: Ref<T[]>, inputValue: string) => void) & {
    cancel: () => void
}

/**
 * The moderation menus used to filter the first page already loaded.
 * This asks the directory for the typed name, and a late reply cannot replace a newer one.
 * Clearing or blurring the picker cancels a search that has not been applied yet.
 */
export function useDirectoryPickerSearch<T>(
    search: (query: string) => Promise<T[]>,
    narrow?: (rows: T[]) => T[]
): PickerSearch<T> {
    let request = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    function cancel() {
        request += 1
        if (timer !== undefined) {
            clearTimeout(timer)
            timer = undefined
        }
    }

    function apply(filteredItems: Ref<T[]>, inputValue: string) {
        cancel()
        if (inputValue.trim() === '') {
            return
        }
        const current = request
        timer = setTimeout(() => {
            void search(inputValue).then(rows => {
                if (current !== request) {
                    return
                }
                filteredItems.value = narrow ? narrow(rows) : rows
            }).catch((error: unknown) => {
                if (current !== request) {
                    return
                }
                console.error(error)
            })
        }, PICKER_SEARCH_DELAY_MS)
    }

    const pickerSearch = Object.assign(apply, { cancel })
    onScopeDispose(cancel)
    return pickerSearch
}
