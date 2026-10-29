<template>
    <div
        class="flex flex-col gap-8"
        data-testid="clinic-settings-panel"
    >
        <p
            v-if="loadError"
            class="field-error"
            role="alert"
        >
            {{ t('clinicDashboard.loadError') }}
        </p>

        <form
            v-if="settings"
            class="flex flex-col gap-4"
            @submit.prevent="saveSettings"
        >
            <h2 class="text-lg font-semibold">
                {{ t('clinicDashboard.settings.heading') }}
            </h2>
            <fieldset class="flex flex-col gap-2">
                <legend class="mb-1 font-medium">
                    {{ t('bookingPage.durationLabel') }}
                </legend>
                <div class="flex flex-wrap gap-4">
                    <label
                        v-for="minutes in DURATIONS"
                        :key="minutes"
                        class="flex items-center gap-2"
                    >
                        <input
                            v-model="durations"
                            type="checkbox"
                            :value="minutes"
                        >
                        {{ t('bookingPage.durationMinutes', { n: minutes }) }}
                    </label>
                </div>
            </fieldset>
            <fieldset class="flex flex-col gap-2">
                <legend class="mb-1 font-medium">
                    {{ t('clinicDashboard.settings.forms') }}
                </legend>
                <p class="text-sm text-primary-text-muted">
                    {{ t('clinicDashboard.settings.formsHelp') }}
                </p>
                <div
                    v-for="formType in formTypes"
                    :key="formType.id"
                    class="flex flex-wrap items-center gap-4"
                >
                    <label class="flex items-center gap-2">
                        <input
                            v-model="formIds"
                            type="checkbox"
                            :value="formType.id"
                        >
                        {{ t(formType.labelKey) }}
                    </label>
                    <label
                        v-if="formIds.includes(formType.id)"
                        class="flex items-center gap-2 text-sm text-primary-text-muted"
                    >
                        <input
                            v-model="defaultFormId"
                            type="radio"
                            name="default-form"
                            :value="formType.id"
                        >
                        {{ t('clinicDashboard.settings.defaultForm') }}
                    </label>
                </div>
            </fieldset>
            <div class="flex items-center gap-3">
                <button
                    type="submit"
                    class="btn btn-primary"
                    :disabled="saving || durations.length === 0 || formIds.length === 0"
                >
                    {{ t('clinicDashboard.settings.save') }}
                </button>
                <span
                    v-if="settingsMessage"
                    class="text-sm"
                    role="status"
                >{{ settingsMessage }}</span>
            </div>
        </form>

        <section class="flex flex-col gap-4">
            <h2 class="text-lg font-semibold">
                {{ t('clinicDashboard.members.heading') }}
            </h2>
            <p class="text-sm text-primary-text-muted">
                {{ t('clinicDashboard.members.help') }}
            </p>
            <ul class="flex flex-col gap-2">
                <li
                    v-for="member in members"
                    :key="member.id"
                    class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent-bg
                    bg-secondary-bg p-3"
                >
                    <span class="break-all">{{ member.email }}</span>
                    <span class="text-sm text-primary-text-muted">
                        {{ roleLabel(member.role) }} ·
                        {{ member.claimed ? t('clinicDashboard.members.active') : t('clinicDashboard.members.pending') }}
                    </span>
                    <button
                        v-if="canRemove(member)"
                        type="button"
                        class="btn btn-secondary"
                        @click="remove(member)"
                    >
                        {{ t('clinicDashboard.members.remove') }}
                    </button>
                </li>
            </ul>
            <form
                class="flex flex-col gap-2 landscape:flex-row landscape:items-end"
                @submit.prevent="invite"
            >
                <label class="flex flex-1 flex-col gap-1 text-sm">
                    <span>{{ t('bookingPage.fields.email') }}</span>
                    <input
                        v-model="inviteEmail"
                        type="email"
                        class="field"
                        required
                        maxlength="254"
                        data-testid="clinic-invite-email"
                    >
                </label>
                <label
                    v-if="props.isModerator"
                    class="flex flex-col gap-1 text-sm"
                >
                    <span>{{ t('clinicDashboard.members.role') }}</span>
                    <select
                        v-model="inviteRole"
                        class="field"
                    >
                        <option :value="ClinicMemberRole.Staff">{{ t('clinicDashboard.roles.staff') }}</option>
                        <option :value="ClinicMemberRole.Owner">{{ t('clinicDashboard.roles.owner') }}</option>
                    </select>
                </label>
                <button
                    type="submit"
                    class="btn btn-primary"
                    :disabled="saving"
                >
                    {{ t('clinicDashboard.members.invite') }}
                </button>
            </form>
            <p
                v-if="memberMessage"
                class="text-sm"
                role="status"
            >
                {{ memberMessage }}
            </p>
        </section>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
    ClinicMemberRole,
    type BookingFormType,
    type BookingSettings,
    type ClinicMember
} from '@findadoc/graphql'
import {
    fetchClinicAdmin,
    inviteClinicMember,
    removeClinicMember,
    updateBookingSettings
} from '~/utils/booking/staffQuery'

/**
 * Owner settings: visit lengths, which intake forms the clinic offers, and who
 * may use the dashboard. An owner invites staff; a moderator may also invite owners.
 */
const props = defineProps<{
    facilityId: string
    isModerator: boolean
}>()

const DURATIONS = [15, 30, 45, 60]

const { t } = useI18n()
const settings = ref<BookingSettings | null>(null)
const members = ref<ClinicMember[]>([])
const formTypes = ref<BookingFormType[]>([])
const durations = ref<number[]>([])
const formIds = ref<string[]>([])
const defaultFormId = ref('')
const loadError = ref(false)
const saving = ref(false)
const settingsMessage = ref('')
const memberMessage = ref('')
const inviteEmail = ref('')
const inviteRole = ref<ClinicMemberRole>(ClinicMemberRole.Staff)

function roleLabel(role: ClinicMemberRole): string {
    return role === ClinicMemberRole.Owner ? t('clinicDashboard.roles.owner') : t('clinicDashboard.roles.staff')
}

function canRemove(member: ClinicMember): boolean {
    return props.isModerator || member.role === ClinicMemberRole.Staff
}

async function load(): Promise<void> {
    const loaded = await fetchClinicAdmin(props.facilityId)
    loadError.value = loaded === null
    if (loaded === null) {
        return
    }
    settings.value = loaded.settings
    members.value = loaded.members
    formTypes.value = loaded.formTypes
    durations.value = [...(loaded.settings?.allowedDurations ?? [])]
    formIds.value = [...(loaded.settings?.formDefinitionIds ?? [])]
    defaultFormId.value = formIds.value[0] ?? ''
}

// Unchecking the default form moves the default to the next offered form.
watch(formIds, ids => {
    if (!ids.includes(defaultFormId.value)) {
        defaultFormId.value = ids[0] ?? ''
    }
})

async function saveSettings(): Promise<void> {
    saving.value = true
    settingsMessage.value = ''
    const ordered = [defaultFormId.value, ...formIds.value.filter(id => id !== defaultFormId.value)]
    const saved = await updateBookingSettings({
        facilityId: props.facilityId,
        allowedDurations: [...durations.value].sort((a, b) => a - b),
        formDefinitionIds: ordered
    })
    saving.value = false
    settingsMessage.value = saved === null ? t('clinicDashboard.saveFailed') : t('clinicDashboard.saved')
    if (saved !== null) {
        settings.value = saved
    }
}

async function invite(): Promise<void> {
    saving.value = true
    memberMessage.value = ''
    const role = props.isModerator ? inviteRole.value : ClinicMemberRole.Staff
    const added = await inviteClinicMember(props.facilityId, inviteEmail.value, role)
    saving.value = false
    if (added === null) {
        memberMessage.value = t('clinicDashboard.saveFailed')
        return
    }
    memberMessage.value = t('clinicDashboard.members.invited', { email: added.email ?? '' })
    inviteEmail.value = ''
    await load()
}

async function remove(member: ClinicMember): Promise<void> {
    if (!window.confirm(t('clinicDashboard.members.removeConfirm', { email: member.email ?? '' }))) {
        return
    }
    const removed = await removeClinicMember(member.id)
    memberMessage.value = removed ? '' : t('clinicDashboard.saveFailed')
    await load()
}

onMounted(load)
</script>
