/** A navigation that is still loading after this long gets the "Loading" pill, not only the bar (#228). */
export const SLOW_NAVIGATION_MS = 400

/**
 * Calls `onChange(true)` once a navigation has run for `delayMs`, and `onChange(false)` when it ends.
 * A navigation that ends first never shows the pill, so fast clicks do not flash it. Nuxt can fire
 * the start hook more than once for one navigation; a repeat start keeps the running clock.
 */
export function createSlowNavigationSignal(onChange: (slow: boolean) => void, delayMs = SLOW_NAVIGATION_MS) {
    let timer: ReturnType<typeof setTimeout> | undefined
    let running = false

    const stop = () => {
        clearTimeout(timer)
        timer = undefined
        running = false
        onChange(false)
    }

    const start = () => {
        if (running) {
            return
        }
        running = true
        timer = setTimeout(() => {
            timer = undefined
            onChange(true)
        }, delayMs)
    }

    return { start, stop }
}
