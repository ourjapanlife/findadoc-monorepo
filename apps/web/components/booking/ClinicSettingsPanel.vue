<template>
    <div
        class="flex flex-col gap-6"
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
            class="card flex flex-col gap-6 p-5 shadow-card landscape:p-6"
            @submit.prevent="saveSettings"
        >
            <h2 class="text-xl font-bold tracking-tight text-primary-text">
                {{ t('clinicDashboard.settings.heading') }}
            </h2>

            <fieldset class="flex flex-col gap-3">
                <legend class="field-label">
                    {{ t('bookingPage.durationLabel') }}
                </legend>
                <p class="-mt-1 text-sm text-primary-text-muted">
                    {{ t('clinicDashboard.settings.durationsHelp') }}
                </p>
                <div class="flex flex-wrap gap-2">
                    <label
                        v-for="minutes in ALLOWED_APPOINTMENT_DURATIONS"
                        :key="minutes"
                        class="relative inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border px-4
                        text-sm font-semibold transition-colors has-[:focus-visible]:outline-2
                        has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-text"
                        :class="durations.includes(minutes)
                            ? 'border-primary bg-primary text-primary-text-inverted hover:bg-primary-hover'
                            : 'border-border-strong bg-secondary-bg text-primary-text hover:border-primary'"
                    >
                        <input
                            v-model="durations"
                            type="checkbox"
                            class="sr-only"
                            :value="minutes"
                        >
                        <svg
                            v-if="durations.includes(minutes)"
                            class="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="3"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M20 6 9 17l-5-5" />
                        </svg>
                        {{ t('bookingPage.durationMinutes', { n: minutes }) }}
                        <span
                            v-if="minutes === defaultDuration"
                            class="rounded-full bg-primary-text-inverted/20 px-2 py-0.5 text-xs"
                        >
                            {{ t('clinicDashboard.settings.defaultForm') }}
                        </span>
                    </label>
                </div>
            </fieldset>

            <fieldset class="flex flex-col gap-3">
                <legend class="field-label">
                    {{ t('clinicDashboard.settings.forms') }}
                </legend>
                <p class="-mt-1 text-sm text-primary-text-muted">
                    {{ t('clinicDashboard.settings.formsHelp') }}
                </p>
                <div class="grid gap-3 landscape:grid-cols-2">
                    <div
                        v-for="formType in formTypes"
                        :key="formType.id"
                        class="flex flex-col gap-3 rounded-lg border p-4 transition-colors"
                        :class="formIds.includes(formType.id)
                            ? 'border-primary bg-primary/5'
                            : 'border-accent-bg bg-secondary-bg'"
                    >
                        <label class="flex cursor-pointer items-start gap-3">
                            <input
                                v-model="formIds"
                                type="checkbox"
                                class="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                                :value="formType.id"
                            >
                            <span class="font-semibold text-primary-text">{{ t(formType.labelKey) }}</span>
                        </label>
                        <label
                            v-if="formIds.includes(formType.id)"
                            class="ml-8 inline-flex w-fit cursor-pointer items-center gap-2 text-sm"
                            :class="defaultFormId === formType.id ? 'font-semibold text-primary' : 'text-primary-text-muted'"
                        >
                            <input
                                v-model="defaultFormId"
                                type="radio"
                                name="default-form"
                                class="h-4 w-4 accent-primary"
                                :value="formType.id"
                            >
                            {{ t('clinicDashboard.settings.defaultForm') }}
                        </label>
                    </div>
                </div>
            </fieldset>

            <div class="flex items-center gap-3 border-t border-accent-bg pt-5">
                <button
                    type="submit"
                    class="btn btn-primary min-w-40"
                    :disabled="savingSettings || durations.length === 0 || formIds.length === 0"
                    :aria-busy="savingSettings"
                    data-testid="clinic-settings-save"
                >
                    <ButtonSpinner v-if="savingSettings" />
                    {{ savingSettings ? t('clinicDashboard.saving') : t('clinicDashboard.settings.save') }}
                </button>
            </div>
        </form>

        <section class="card flex flex-col gap-5 p-5 shadow-card landscape:p-6">
            <div class="flex flex-col gap-1">
                <h2 class="text-xl font-bold tracking-tight text-primary-text">
                    {{ t('clinicDashboard.members.heading') }}
                </h2>
                <p class="text-sm text-primary-text-muted">
                    {{ t('clinicDashboard.members.help') }}
                </p>
            </div>
            <ul
                v-if="members.length > 0"
                class="flex flex-col divide-y divide-accent-bg rounded-lg border border-accent-bg"
            >
                <li
                    v-for="member in members"
                    :key="member.id"
                    class="flex flex-wrap items-center gap-3 p-3"
                >
                    <span
                        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10
                        font-semibold text-primary uppercase"
                        aria-hidden="true"
                    >
                        {{ (member.email ?? '?').charAt(0) }}
                    </span>
                    <span class="min-w-0 flex-1 break-all font-medium text-primary-text">{{ member.email }}</span>
                    <span class="chip h-7 text-xs">{{ roleLabel(member.role) }}</span>
                    <span
                        class="chip h-7 text-xs"
                        :class="member.claimed ? 'border-success/40 bg-success/10 text-success' : 'text-primary-text-muted'"
                    >
                        {{ member.claimed ? t('clinicDashboard.members.active') : t('clinicDashboard.members.pending') }}
                    </span>
                    <button
                        v-if="canRemove(member)"
                        type="button"
                        class="btn btn-ghost btn-sm text-error hover:bg-error/10"
                        @click="askRemove(member)"
                    >
                        {{ t('clinicDashboard.members.remove') }}
                    </button>
                </li>
            </ul>
            <form
                class="flex flex-col gap-3 landscape:flex-row landscape:items-end"
                @submit.prevent="invite"
            >
                <label class="flex flex-1 flex-col">
                    <span class="field-label">{{ t('bookingPage.fields.email') }}</span>
                    <input
                        v-model="inviteEmail"
                        type="email"
                        class="field"
                        required
                        maxlength="254"
                        :placeholder="t('bookingPage.placeholders.email')"
                        data-testid="clinic-invite-email"
                    >
                </label>
                <label
                    v-if="props.isModerator"
                    class="flex flex-col landscape:w-40"
                >
                    <span class="field-label">{{ t('clinicDashboard.members.role') }}</span>
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
                    class="btn btn-primary min-w-32"
                    :disabled="inviting"
                    :aria-busy="inviting"
                >
                    <ButtonSpinner v-if="inviting" />
                    {{ t('clinicDashboard.members.invite') }}
                </button>
            </form>
        </section>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
    ClinicMemberRole,
    type BookingFormType,
    type BookingSettings,
    type ClinicMember
} from '@findadoc/graphql'
import ButtonSpinner from '~/components/common/ButtonSpinner.vue'
import { useAppToast } from '~/composables/useAppToast'
import { ALLOWED_APPOINTMENT_DURATIONS, resolveDuration } from '~/utils/booking/durations'
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

const { t } = useI18n()
const toast = useAppToast()
const settings = ref<BookingSettings | null>(null)
const members = ref<ClinicMember[]>([])
const formTypes = ref<BookingFormType[]>([])
const durations = ref<number[]>([])
const formIds = ref<string[]>([])
const defaultFormId = ref('')
const loadError = ref(false)
const savingSettings = ref(false)
const inviting = ref(false)
const inviteEmail = ref('')
const inviteRole = ref<ClinicMemberRole>(ClinicMemberRole.Staff)

// The length the Book page preselects: 30 minutes when offered, else the shortest.
const defaultDuration = computed(() => durations.value.length === 0
    ? undefined
    : resolveDuration(null, [...durations.value].sort((a, b) => a - b)))

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
    savingSettings.value = true
    const ordered = [defaultFormId.value, ...formIds.value.filter(id => id !== defaultFormId.value)]
    const saved = await updateBookingSettings({
        facilityId: props.facilityId,
        allowedDurations: [...durations.value].sort((a, b) => a - b),
        formDefinitionIds: ordered
    })
    savingSettings.value = false
    if (saved === null) {
        toast.error(t('clinicDashboard.saveFailed'))
        return
    }
    settings.value = saved
    toast.success(t('clinicDashboard.saved'))
}

async function invite(): Promise<void> {
    inviting.value = true
    const role = props.isModerator ? inviteRole.value : ClinicMemberRole.Staff
    const added = await inviteClinicMember(props.facilityId, inviteEmail.value, role)
    inviting.value = false
    if (added === null) {
        toast.error(t('clinicDashboard.saveFailed'))
        return
    }
    toast.success(t('clinicDashboard.members.invited', { email: added.email ?? '' }))
    inviteEmail.value = ''
    await load()
}

// Removing someone asks in a toast, not a browser dialog. The toast's button does it.
function askRemove(member: ClinicMember): void {
    const label = t('clinicDashboard.members.remove')
    toast.warning(t('clinicDashboard.members.removeConfirm', { email: member.email ?? '' }), {
        action: {
            label,
            altText: label,
            onClick: () => {
                void remove(member)
            }
        }
    })
}

async function remove(member: ClinicMember): Promise<void> {
    const removed = await removeClinicMember(member.id)
    if (!removed) {
        toast.error(t('clinicDashboard.saveFailed'))
    }
    await load()
}

onMounted(load)
</script>
