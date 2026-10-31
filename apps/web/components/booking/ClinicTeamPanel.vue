<template>
    <div
        class="flex flex-col gap-6"
        data-testid="clinic-team-panel"
    >
        <p
            v-if="loadError"
            class="field-error"
            role="alert"
        >
            {{ t('clinicDashboard.loadError') }}
        </p>

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
                        class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10
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
                    v-if="props.isAdmin"
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
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ClinicMemberRole, type ClinicMember } from '@findadoc/graphql'
import ButtonSpinner from '~/components/common/ButtonSpinner.vue'
import { useAppToast } from '~/composables/useAppToast'
import { fetchClinicAdmin, inviteClinicMember, removeClinicMember } from '~/utils/booking/staffQuery'

/**
 * Who may use the clinic's dashboard. An owner invites staff; an admin may
 * also invite owners. Booking settings are a separate tab (ClinicSettingsPanel).
 */
const props = defineProps<{
    facilityId: string
    isAdmin: boolean
}>()

const { t } = useI18n()
const toast = useAppToast()
const members = ref<ClinicMember[]>([])
const loadError = ref(false)
const inviting = ref(false)
const inviteEmail = ref('')
const inviteRole = ref<ClinicMemberRole>(ClinicMemberRole.Staff)

function roleLabel(role: ClinicMemberRole): string {
    return role === ClinicMemberRole.Owner ? t('clinicDashboard.roles.owner') : t('clinicDashboard.roles.staff')
}

function canRemove(member: ClinicMember): boolean {
    return props.isAdmin || member.role === ClinicMemberRole.Staff
}

async function load(): Promise<void> {
    const loaded = await fetchClinicAdmin(props.facilityId)
    loadError.value = loaded === null
    members.value = loaded?.members ?? []
}

async function invite(): Promise<void> {
    inviting.value = true
    const role = props.isAdmin ? inviteRole.value : ClinicMemberRole.Staff
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

// Removing someone asks in a toast, not a browser dialog. The toast's button does it, and
// the toast stays until it is used or dismissed, so there is no deadline to confirm.
function askRemove(member: ClinicMember): void {
    const label = t('clinicDashboard.members.remove')
    toast.warning(t('clinicDashboard.members.removeConfirm', { email: member.email ?? '' }), {
        duration: Number.POSITIVE_INFINITY,
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
