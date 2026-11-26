<template>
    <div
        v-if="open"
        data-testid="mod-archive-dialog"
        class="fixed inset-0 z-50 flex items-center justify-center bg-scrim/50 p-4"
    >
        <div
            ref="panel"
            class="w-full max-w-md rounded-xl border border-accent-bg bg-secondary-bg p-6 shadow-sm"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="titleId"
            :aria-describedby="messageId"
            :aria-busy="pending"
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
            <label
                :for="reasonId"
                class="field-label mt-4"
            >
                {{ t('modEditFacilityOrHPTopbar.archiveReasonLabel') }}
            </label>
            <textarea
                :id="reasonId"
                ref="reasonInput"
                v-model="reason"
                class="field field-textarea"
                data-testid="mod-archive-reason"
                :maxlength="ARCHIVE_REASON_MAX"
                :placeholder="t('modEditFacilityOrHPTopbar.archiveReasonPlaceholder')"
                :aria-invalid="showRequired"
                :aria-describedby="showRequired ? errorId : undefined"
                :disabled="pending"
                required
            />
            <p
                v-if="showRequired"
                :id="errorId"
                class="mt-1 text-sm text-error"
            >
                {{ t('modEditFacilityOrHPTopbar.archiveReasonRequired') }}
            </p>
            <div class="mt-6 flex justify-end gap-3">
                <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    :disabled="pending"
                    data-testid="mod-archive-cancel"
                    @click="emit('cancel')"
                >
                    {{ t('common.cancel') }}
                </button>
                <button
                    type="button"
                    class="btn btn-danger btn-sm"
                    :disabled="pending"
                    data-testid="mod-archive-confirm"
                    @click="confirm"
                >
                    <ButtonSpinner v-if="pending" />
                    {{ t('modEditFacilityOrHPTopbar.archiveButtonText') }}
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef, useId, watch } from 'vue'
import { useI18n } from '#imports'
import ButtonSpinner from '~/components/common/ButtonSpinner.vue'
import { useFocusTrap } from '~/composables/useFocusTrap'
import { ARCHIVE_REASON_MAX, archiveReasonForSubmit } from '~/utils/archive'

const props = defineProps<{
    open: boolean
    title: string
    message: string
    pending: boolean
}>()

const emit = defineEmits<{
    confirm: [reason: string]
    cancel: []
}>()

const { t } = useI18n()
const panel = ref<HTMLElement | null>(null)
const reasonInput = ref<HTMLElement | null>(null)
const titleId = useId()
const messageId = useId()
const reasonId = useId()
const errorId = useId()
const reason = ref('')
const triedEmpty = ref(false)

const showRequired = computed(() => triedEmpty.value && archiveReasonForSubmit(reason.value) === null)

watch(() => props.open, isOpen => {
    if (isOpen) {
        reason.value = ''
        triedEmpty.value = false
    }
})

function confirm() {
    const value = archiveReasonForSubmit(reason.value)
    if (value === null) {
        triedEmpty.value = true
        reasonInput.value?.focus()
        return
    }
    emit('confirm', value)
}

useFocusTrap(panel, toRef(props, 'open'), {
    onEscape: () => {
        if (!props.pending) emit('cancel')
    },
    initialFocus: reasonInput
})
</script>
