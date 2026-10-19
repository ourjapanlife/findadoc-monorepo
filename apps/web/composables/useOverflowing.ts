import { ref } from 'vue'

export function useOverflowing() {
    const elementRef = ref<HTMLElement | null>(null)
    const isOverflowing = ref(false)

    const checkOverflow = () => {
        if (elementRef.value !== null) {
            isOverflowing.value = elementRef.value.scrollWidth > elementRef.value.clientWidth
        }
    }

    return { elementRef, isOverflowing, checkOverflow }
}
