<template>
    <div class="container mx-auto max-w-lg p-4">
        <h1 class="mb-6 text-2xl font-bold">
            {{ t('profile.edit') }}
        </h1>

        <form
            class="space-y-6"
            @submit.prevent="submitProfile"
        >
            <div>
                <label
                    for="username"
                    class="mb-1 block font-semibold"
                >{{ t('profile.username') }}</label>
                <input
                    id="username"
                    v-model="username"
                    type="text"
                    class="w-full rounded-sm border px-3 py-2"
                    required
                    autocomplete="username"
                >
            </div>

            <div>
                <label
                    for="email"
                    class="mb-1 block font-semibold"
                >{{ t('profile.email') }}</label>
                <input
                    id="email"
                    v-model="email"
                    type="email"
                    class="w-full rounded-sm border px-3 py-2"
                    required
                >
            </div>

            <div>
                <label class="mb-1 block font-semibold">{{ t('profile.profilePhoto') }}</label>
                <div class="flex items-center gap-4">
                    <img
                        :src="profilePhotoPreview || profilePhoto"
                        alt="Profile Photo"
                        class="size-16 rounded-full border object-cover"
                    >
                    <template v-if="props.isOwner ?? true">
                        <input
                            type="file"
                            accept="image/*"
                            @change="onPhotoChange"
                        >
                    </template>
                </div>
            </div>
            <template v-if="props.isOwner ?? true">
                <button
                    type="submit"
                    class="w-full rounded-sm px-4 py-2 text-primary transition hover:text-primary-hover"
                >
                    {{ t('profile.save') }}
                </button>
            </template>
        </form>

        <div
            v-if="successMessage"
            class="mt-4 text-success"
        >
            {{ t('profile.updatedSuccessfully') }}
        </div>
        <div
            v-if="errorMessage"
            class="mt-4 text-error"
        >
            {{ t('profile.updateFailed') }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '~/stores/authStore'

const props = defineProps<{ usernameProp?: string, isOwner?: boolean }>()

const authStore = useAuthStore()
const { t } = useI18n()

const username = ref('')
const email = ref('')
const profilePhoto = ref('')
const profilePhotoPreview = ref('')
const successMessage = ref('')
const errorMessage = ref('')

function populateFromStoreOrParam(usernameParam?: string) {
    // If usernameParam is provided, treat this as a public profile view for that username.
    // Replace the placeholder below with an actual API call to fetch public profile data by username when available.
    if (usernameParam) {
        username.value = usernameParam
        email.value = ''
        profilePhoto.value = ''
        return
    }

    // Otherwise populate fields from the authenticated user's store data
    const nameFromStore = authStore.userId?.value ?? ''
    const pictureFromStore = authStore.userProfileImage?.value ?? ''

    username.value = nameFromStore || ''
    email.value = ''
    profilePhoto.value = pictureFromStore || ''
}

onMounted(() => populateFromStoreOrParam(props.usernameProp))

watch(() => props.usernameProp, v => populateFromStoreOrParam(v))

function onPhotoChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (file) {
        const reader = new FileReader()
        reader.onload = ev => { profilePhotoPreview.value = ev.target?.result as string }
        reader.readAsDataURL(file)
    }
}

async function submitProfile() {
    successMessage.value = ''
    errorMessage.value = ''
    try {
    // Only a placeholder here — implement actual update logic restricted to the current authenticated user.
        successMessage.value = t('profile.updatedSuccessfully')
    } catch (e: unknown) {
        errorMessage.value = (e as Error).message || t('profile.updateFailed')
    }
}
</script>

