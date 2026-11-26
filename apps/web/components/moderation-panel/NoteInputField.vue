
<template>
    <div class="flex w-full flex-col">
        <label
            :for="textareaId"
            class="field-label"
        >
            {{ label }}
            <span
                v-if="!required"
                class="ml-1 font-normal text-primary-text-muted"
            >
                ({{ t('noteInputField.optional') }})
            </span>
        </label>
        <textarea
            :id="textareaId"
            v-model="model"
            class="field field-textarea"
            :placeholder="placeholder"
            :readonly="!isEditing"
            :tabindex="isEditing ? undefined : -1"
        />
    </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { useI18n } from '#imports'
import { useModerationFormEditing } from '~/composables/useModerationFormMode'

const { t } = useI18n()
const isEditing = useModerationFormEditing()
// Links the label to the textarea so the field has a name when tabbed to
const textareaId = useId()
const model = defineModel<string>()

defineProps<{
    label: string
    placeholder?: string
    required: boolean
}>()
</script>
