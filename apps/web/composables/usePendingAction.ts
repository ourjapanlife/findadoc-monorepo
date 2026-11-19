import { computed, ref } from 'vue'

/**
 * Tracks the one request a set of buttons has in flight. While it runs, `pending` is true so
 * every button can be disabled and the one that was pressed can show a spinner (`isPending`).
 * A second press while a request runs is ignored, so a slow save cannot be sent twice.
 */
export function usePendingAction() {
    const pendingKey = ref<string | null>(null)
    const pending = computed(() => pendingKey.value !== null)

    function isPending(key: string): boolean {
        return pendingKey.value === key
    }

    async function run<T>(key: string, action: () => Promise<T>): Promise<T | undefined> {
        if (pendingKey.value !== null) {
            return undefined
        }
        pendingKey.value = key
        try {
            return await action()
        } finally {
            pendingKey.value = null
        }
    }

    return { pending, isPending, run }
}
