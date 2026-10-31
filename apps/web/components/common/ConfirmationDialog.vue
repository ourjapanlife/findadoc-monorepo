<template>
    <!--
        Stays in the document while it is closed. Removing the overlay on close can leave
        the scrim behind, and that scrim keeps taking clicks.
    -->
    <div
        v-show="isOpen"
        data-testid="confirmation-modal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 p-4"
    >
        <div
            ref="modal"
            v-close-on-outside-click="{
                onOutside: cancelAction,
                when: () => isOpen,
            }"
            class="w-full max-w-md rounded-xl border border-accent-bg bg-secondary-bg p-6 shadow-sm"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="titleId"
            :aria-describedby="messageId"
        >
            <h2
                :id="titleId"
                class="text-lg font-semibold text-primary-text"
            >
                {{ title }}
            </h2>
            <p
                :id="messageId"
                class="mt-2 leading-relaxed whitespace-pre-line text-primary-text"
            >
                {{ message }}
            </p>
            <div class="mt-6 flex justify-end gap-3">
                <button
                    ref="cancelButton"
                    type="button"
                    class="btn btn-secondary btn-sm"
                    @click="cancelAction"
                >
                    {{ textCancel }}
                </button>
                <button
                    type="button"
                    class="btn btn-sm"
                    :class="destructive ? 'btn-danger' : 'btn-primary'"
                    :data-testid="isUnsaved ? 'submission-unsaved-confirmation-btn' : undefined"
                    @click="confirmAction"
                >
                    {{ textConfirm }}
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { vCloseOnOutsideClick } from '~/composables/closeOnOutsideClick'
import { useFocusTrap } from '~/composables/useFocusTrap'

const modal = ref<HTMLElement | null>(null)
const cancelButton = ref<HTMLElement | null>(null)
const titleId = useId()
const messageId = useId()

/*
 * Destructuring $confirmationDialog directly threw during SSR — it comes from a
 * .client plugin, so it is undefined on the server, and the crash took down every
 * prerendered route. The ClientOnly wrapper in app.vue is the real guard; this
 * fallback keeps the component from being able to break a build again if it is ever
 * rendered somewhere else.
 */
const confirmationDialog = useNuxtApp().$confirmationDialog

const confirmation = confirmationDialog?.confirmation ?? shallowRef(undefined)
const cancelAction = confirmationDialog?.cancelAction ?? (() => {})
const confirmAction = confirmationDialog?.confirmAction ?? (() => {})

const { t } = useI18n()

const isOpen = computed(() => Boolean(confirmation.value))
const mode = computed(() => confirmation.value?.mode)
const isUnsaved = computed(() => mode.value === 'create' || mode.value === 'update')
const destructive = computed(() => confirmation.value?.destructive === true)

const title = computed(() =>
    confirmation.value?.title ?? (isUnsaved.value && mode.value ? t(`unsavedChanges.${mode.value}.title`) : ''))

const message = computed(() =>
    confirmation.value?.message ?? (isUnsaved.value && mode.value ? t(`unsavedChanges.${mode.value}.message`) : ''))

const textConfirm = computed(() =>
    confirmation.value?.textConfirm ?? (isUnsaved.value && mode.value ? t(`unsavedChanges.${mode.value}.confirm`) : ''))

const textCancel = computed(() =>
    confirmation.value?.textCancel ?? (isUnsaved.value && mode.value ? t(`unsavedChanges.${mode.value}.cancel`) : ''))

useFocusTrap(modal, isOpen, {
    onEscape: () => cancelAction(),
    initialFocus: cancelButton
})
</script>
