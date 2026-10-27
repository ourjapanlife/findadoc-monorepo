import { defineStore } from 'pinia'
import { computed, ref, type Ref, reactive } from 'vue'
import { gql } from 'graphql-request'
import { fetchFacilitiesWithCount } from '../utils/graphqlHelpers'
import { DIRECTORY_PICKER_LIMIT } from '../utils/moderationSearchUtils'
import { facilitySelection } from '../utils/graphqlSelection'
import type {
    Facility,
    Mutation,
    MutationDeleteFacilityArgs,
    MutationUpdateFacilityArgs,
    Relationship,
    FacilitySearchFilters,
    Contact,
    ContactInput,
    PhysicalAddress,
    PhysicalAddressInput,
    UpdateFacilityInput,
    MutationCreateFacilityArgs
} from '@findadoc/graphql'
import { gqlClient, graphQLClientRequestWithRetry } from '~/utils/graphql'
import type { ServerResponse } from '~/typedefs/serverResponse'
import { arraysAreEqual } from '~/utils/arrayUtils'
import { FacilityFieldError, validateCreateFacility, validateUpdateFacility } from '~/utils/facilitiesUtils'
import { hasServerErrors } from '~/utils/moderationUtils'
import { toastModerationLoadError } from '~/utils/moderationListToast'
import { usePersistentFilters } from '~/composables/usePersistentFilters'
import {
    DEFAULT_MODERATION_PAGE_SIZE,
    loadPageInRange,
    MODERATION_PAGE_SIZES,
    nextListOrder,
    orderByInput,
    type ListOrder
} from '~/utils/moderationTable'

export type FacilitySectionFields = {
    // contactFields
    nameEn: string
    nameJa: string
    phone: string
    website?: string
    email?: string

    // addressFields
    postalCode: string
    prefectureEn: string
    cityEn: string
    addressLine1En: string
    addressLine2En: string
    prefectureJa: string
    cityJa: string
    cityId: string
    addressLine1Ja: string
    addressLine2Ja: string

    // googleMapsFields
    googlemapsURL: string
    mapLatitude: string
    mapLongitude: string
    online: boolean

    healthcareProfessionalIds: string[]
    healthProfessionalsRelations: Relationship[]
}

function mapFacilityAddressToInput(address: PhysicalAddress): PhysicalAddressInput {
    return {
        postalCode: address.postalCode ?? '',
        prefectureEn: address.prefectureEn ?? '',
        cityEn: address.cityEn ?? '',
        addressLine1En: address.addressLine1En ?? '',
        addressLine2En: address.addressLine2En ?? '',
        prefectureJa: address.prefectureJa ?? '',
        cityJa: address.cityJa ?? '',
        addressLine1Ja: address.addressLine1Ja ?? '',
        addressLine2Ja: address.addressLine2Ja ?? ''
    }
}

function mapFacilityContactToInput(contact: Contact): ContactInput {
    return {
        phone: contact.phone ?? '',
        email: contact.email ?? '',
        website: contact.website ?? '',
        googleMapsUrl: contact.googleMapsUrl ?? '',
        ...(contact.address
            ? { address: mapFacilityAddressToInput(contact.address) }
            : { address: null })
    }
}

function coordinateOrZero(value: string): number {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

export function getChangedFacilityFieldsForUpdate(
    current: FacilitySectionFields,
    original: Facility
): MutationUpdateFacilityArgs['input'] {
    const updatedFields: MutationUpdateFacilityArgs['input'] = {}
    const becomingOnline = current.online === true && original.online !== true

    if (current.nameEn !== original.nameEn) updatedFields.nameEn = current.nameEn
    if (current.nameJa !== original.nameJa) updatedFields.nameJa = current.nameJa
    // Online is opt-in: only include when the moderator changed the checkbox.
    if (current.online !== original.online) updatedFields.online = current.online === true

    if (current.healthProfessionalsRelations?.length) {
        updatedFields.healthcareProfessionalIds = current.healthProfessionalsRelations
    }

    const originalContactInput = mapFacilityContactToInput(original.contact as Contact)

    const requiredAddressKeys: (keyof PhysicalAddressInput)[] = [
        'postalCode', 'prefectureEn', 'cityEn', 'addressLine1En',
        'prefectureJa', 'cityJa', 'addressLine1Ja',
        'addressLine2En', 'addressLine2Ja'
    ]

    const updatedAddress: Partial<PhysicalAddressInput> = {}
    for (const key of requiredAddressKeys) {
        updatedAddress[key] = current[key] ?? ''
    }

    const phoneOrEmailChanged
        = current.phone !== originalContactInput.phone
          || current.email !== originalContactInput.email
          || current.website !== originalContactInput.website

    // When becoming online, the server clears city, map, and address. Still send
    // phone/email/website changes. Skip location fields entirely.
    if (becomingOnline) {
        if (phoneOrEmailChanged || current.phone.trim()) {
            updatedFields.contact = {
                phone: current.phone,
                ...(current.email !== originalContactInput.email ? { email: current.email } : {}),
                ...(current.website !== originalContactInput.website ? { website: current.website } : {})
            }
        }
        return updatedFields
    }

    const currentLatitude = parseFloat(current.mapLatitude)
    if (!isNaN(currentLatitude) && currentLatitude !== original.mapLatitude) {
        updatedFields.mapLatitude = currentLatitude
    }

    const currentLongitude = parseFloat(current.mapLongitude)
    if (!isNaN(currentLongitude) && currentLongitude !== original.mapLongitude) {
        updatedFields.mapLongitude = currentLongitude
    }

    const nextCityId = current.cityId.trim()
    const previousCityId = original.cityId ?? ''
    if (nextCityId !== previousCityId) {
        updatedFields.cityId = nextCityId || null
    }

    function isContactInfoPresent(contact: FacilitySectionFields): boolean {
        return (contact.phone ?? '') !== ''
          || (contact.email ?? '') !== ''
          || (contact.website ?? '') !== ''
          || (contact.googlemapsURL ?? '') !== ''
          || requiredAddressKeys.some(key => (contact[key] ?? '') !== '')
    }

    const contactChanged
        = phoneOrEmailChanged
          || current.googlemapsURL !== (originalContactInput.googleMapsUrl ?? '')
          || requiredAddressKeys.some(
              key => updatedAddress[key] !== (originalContactInput.address?.[key] ?? '')
          )

    if (contactChanged && isContactInfoPresent(current)) {
        const updatedContact: ContactInput = {
            phone: current.phone,
            googleMapsUrl: current.googlemapsURL || undefined,
            ...(current.online === true
                ? {}
                : { address: updatedAddress as PhysicalAddressInput })
        }

        if (current.email !== originalContactInput.email) {
            updatedContact.email = current.email
        }

        if (current.website !== originalContactInput.website) {
            updatedContact.website = current.website
        }

        updatedFields.contact = updatedContact
    }

    return updatedFields
}

export const useFacilitiesStore = defineStore('facilitiesStore', () => {
    const facilityData: Ref<Facility[]> = ref([])
    const selectedFacilityId: Ref<string> = ref('')
    const selectedFacilityData: Ref<Facility | undefined> = ref()
    // Used for store the total number of facility found by the current search query.
    const totalFacilitiesCount: Ref<number> = ref(0)
    // Used for store the starting index (offset) for the current page of results.
    const currentOffset = usePersistentFilters('facilities', 'offset', 0)
    const itemsPerPage = usePersistentFilters(
        'facilities',
        'pageSize',
        DEFAULT_MODERATION_PAGE_SIZE,
        MODERATION_PAGE_SIZES
    )
    const listSearchQuery = usePersistentFilters('facilities', 'search', '')
    const listOrder: Ref<ListOrder | null> = ref(null)
    const facilityList: Ref<Facility[]> = ref([])
    const filteredFacilityData = computed(() => facilityList.value)
    let facilitySearchTimer: ReturnType<typeof setTimeout> | undefined
    let facilityListRequest = 0
    const hasNextPage = computed(() => currentOffset.value + itemsPerPage.value < totalFacilitiesCount.value)
    const hasPrevPage = computed(() => currentOffset.value > 0)
    // This reactive object is used to share data changes of the updated facility or submission across the components
    const facilitySectionFields = ref<FacilitySectionFields>({
        // contactFields
        nameEn: '',
        nameJa: '',
        phone: '',
        website: '' as string | undefined,
        email: '' as string | undefined,
        // addressesFields
        postalCode: '',
        prefectureEn: '',
        cityEn: '',
        addressLine1En: '',
        addressLine2En: '',
        prefectureJa: '',
        cityJa: '',
        cityId: '',
        addressLine1Ja: '',
        addressLine2Ja: '',
        // googleMapsFields
        googlemapsURL: '',
        mapLatitude: '',
        mapLongitude: '',
        online: false,
        healthcareProfessionalIds: [] as string[],
        healthProfessionalsRelations: [] as Relationship[]
    })

    const createFacilityFields = reactive({
        nameEn: '',
        nameJa: '',
        contact: {
            address: {
                postalCode: '',
                prefectureEn: '',
                cityEn: '',
                addressLine1En: '',
                addressLine2En: '',
                prefectureJa: '',
                cityJa: '',
                addressLine1Ja: '',
                addressLine2Ja: ''
            },
            email: '' as string | undefined,
            googleMapsUrl: '',
            phone: '',
            website: '' as string | undefined
        },
        mapLatitude: '',
        mapLongitude: '',
        healthcareProfessionalIds: [] as string[],
        cityId: '',
        online: false
    })

    /** Bumped after a successful moderation edit save so useUnsavedChanges can call makeNonDirty before router navigation. */
    const unsavedChangesResetTick: Ref<number> = ref(0)

    function setSelectedFacilityData(facilityId: string) {
        selectedFacilityId.value = facilityId
        selectedFacilityData.value = facilityList.value.find(
            (facility: Facility) => facility.id === facilityId
        ) ?? facilityData.value.find(
            (facility: Facility) => facility.id === facilityId
        )
    }

    // eslint-disable-next-line complexity
    function initializeFacilitySectionValues(data: Facility | undefined) {
        if (!data) return

        facilitySectionFields.value.nameEn = data.nameEn
        facilitySectionFields.value.nameJa = data.nameJa
        facilitySectionFields.value.phone = data?.contact?.phone ?? ''
        facilitySectionFields.value.email = data?.contact?.email || undefined
        facilitySectionFields.value.website = data?.contact?.website || undefined

        facilitySectionFields.value.postalCode = data.contact?.address?.postalCode ?? ''
        facilitySectionFields.value.prefectureEn = data.contact?.address?.prefectureEn ?? ''
        facilitySectionFields.value.cityEn = data.contact?.address?.cityEn ?? ''
        facilitySectionFields.value.addressLine1En = data.contact?.address?.addressLine1En ?? ''
        facilitySectionFields.value.addressLine2En = data.contact?.address?.addressLine2En ?? ''
        facilitySectionFields.value.prefectureJa = data.contact?.address?.prefectureJa ?? ''
        facilitySectionFields.value.cityJa = data.contact?.address?.cityJa ?? ''
        facilitySectionFields.value.cityId = data.cityId ?? ''
        facilitySectionFields.value.addressLine1Ja = data.contact?.address?.addressLine1Ja ?? ''
        facilitySectionFields.value.addressLine2Ja = data.contact?.address?.addressLine2Ja ?? ''
        facilitySectionFields.value.googlemapsURL = data.contact?.googleMapsUrl ?? ''

        facilitySectionFields.value.healthcareProfessionalIds = data.healthcareProfessionalIds ?? []
        facilitySectionFields.value.mapLatitude = data.mapLatitude?.toString() ?? ''
        facilitySectionFields.value.mapLongitude = data.mapLongitude?.toString() ?? ''
        facilitySectionFields.value.online = data.online === true
    }

    function resetFacilitySectionFields() {
        facilitySectionFields.value = {
            nameEn: '',
            nameJa: '',
            phone: '',
            website: '' as string | undefined,
            email: '' as string | undefined,
            postalCode: '',
            prefectureEn: '',
            cityEn: '',
            addressLine1En: '',
            addressLine2En: '',
            prefectureJa: '',
            cityJa: '',
            cityId: '',
            addressLine1Ja: '',
            addressLine2Ja: '',
            googlemapsURL: '',
            mapLatitude: '',
            mapLongitude: '',
            online: false,
            healthcareProfessionalIds: [] as string[],
            healthProfessionalsRelations: [] as Relationship[]
        }
    }

    async function searchFacilities(query: string): Promise<Facility[]> {
        const trimmed = query.trim()
        const filters: FacilitySearchFilters = {
            offset: 0,
            limit: DIRECTORY_PICKER_LIMIT,
            ...(trimmed ? { query: trimmed } : {})
        }
        const { filteredSearchResults } = await fetchFacilitiesWithCount(filters)
        return filteredSearchResults
    }

    async function getFacilities() {
        try {
            facilityData.value = await searchFacilities('')
        } catch (error) {
            console.error(`Error fetching facilities: ${JSON.stringify(error)}`)
            toastModerationLoadError('moderationListErrors.facilities')
            facilityData.value = []
        }
    }

    function applyFacilityPage(offset: number, rows: Facility[], totalCount: number) {
        currentOffset.value = offset
        facilityList.value = rows
        totalFacilitiesCount.value = totalCount
    }

    async function loadFacilityList() {
        const request = ++facilityListRequest
        const query = listSearchQuery.value.trim()
        const orderBy = orderByInput(listOrder.value)
        try {
            const page = await loadPageInRange(
                currentOffset.value,
                itemsPerPage.value,
                async offset => {
                    const filters: FacilitySearchFilters = {
                        offset,
                        limit: itemsPerPage.value,
                        ...(query ? { query } : {}),
                        ...(orderBy === null ? {} : { orderBy })
                    }
                    const { filteredSearchResults, totalCount } = await fetchFacilitiesWithCount(filters)
                    return { rows: filteredSearchResults, totalCount }
                }
            )
            if (request !== facilityListRequest) return
            applyFacilityPage(page.offset, page.rows, page.totalCount)
        } catch (error) {
            if (request !== facilityListRequest) return
            console.error(`Error fetching facilities: ${JSON.stringify(error)}`)
            toastModerationLoadError('moderationListErrors.facilities')
            facilityList.value = []
            totalFacilitiesCount.value = 0
        }
    }

    function setOffset(newOffset: number) {
        currentOffset.value = newOffset
        return loadFacilityList()
    }

    async function createFacility(): Promise<ServerResponse<Facility>> {
        const isOnline = createFacilityFields.online === true
        const { prefectureEn, prefectureJa } = createFacilityFields.contact.address

        const CreateFacilityInput: MutationCreateFacilityArgs = {
            input: {
                nameEn: createFacilityFields.nameEn,
                nameJa: createFacilityFields.nameJa,
                contact: {
                    email: createFacilityFields.contact.email,
                    phone: createFacilityFields.contact.phone,
                    website: createFacilityFields.contact.website,
                    ...(isOnline
                        ? {}
                        : {
                            googleMapsUrl: createFacilityFields.contact.googleMapsUrl,
                            address: {
                                addressLine1En: createFacilityFields.contact.address.addressLine1En,
                                addressLine1Ja: createFacilityFields.contact.address.addressLine1Ja,
                                addressLine2En: createFacilityFields.contact.address.addressLine2En,
                                addressLine2Ja: createFacilityFields.contact.address.addressLine2Ja,
                                cityEn: createFacilityFields.contact.address.cityEn,
                                cityJa: createFacilityFields.contact.address.cityJa,
                                postalCode: createFacilityFields.contact.address.postalCode,
                                prefectureEn,
                                prefectureJa
                            }
                        })
                },
                healthcareProfessionalIds: createFacilityFields.healthcareProfessionalIds,
                // Online is opt-in: only send when the moderator checked it.
                ...(isOnline ? { online: true } : {}),
                ...(isOnline
                    ? {}
                    : {
                        mapLatitude: coordinateOrZero(createFacilityFields.mapLatitude),
                        mapLongitude: coordinateOrZero(createFacilityFields.mapLongitude),
                        ...(createFacilityFields.cityId ? { cityId: createFacilityFields.cityId } : {})
                    })
            }
        }

        /**
         * Validation on the client-side
         * (to prevent sending the data to the backend even though the prefecture names are mismatched)
         */
        const validation = validateCreateFacility(CreateFacilityInput.input)
        if (!validation.valid) {
            throw new FacilityFieldError(validation.errors)
        }

        const serverResponse = await graphQLClientRequestWithRetry<Mutation>(
            gqlClient.request.bind(gqlClient),
            createFacilityGqlMutation,
            CreateFacilityInput
        )

        const responseData = serverResponse.data?.createFacility

        if (!hasServerErrors(serverResponse) && responseData) {
            await Promise.all([getFacilities(), loadFacilityList()])
            selectedFacilityData.value = responseData
            initializeFacilitySectionValues(responseData)
        }
        const mappedResponse: ServerResponse<Facility> = {
            ...serverResponse,
            data: responseData
        }

        return mappedResponse
    }

    async function updateFacility(): Promise<ServerResponse<Facility>> {
        const updatedFields = getChangedFacilityFieldsForUpdate(
            facilitySectionFields.value,
            selectedFacilityData.value!
        )

        /**
         * Validation on the client-side
         */
        const validation = validateUpdateFacility(
            facilitySectionFields.value,
            updatedFields as UpdateFacilityInput
        )

        if (!validation.valid) {
            throw new FacilityFieldError(validation.errors)
        }

        const updateFacilityInput: MutationUpdateFacilityArgs = {
            id: selectedFacilityId.value,
            input: updatedFields
        }

        const serverResponse = await graphQLClientRequestWithRetry<Mutation>(
            gqlClient.request.bind(gqlClient),
            updateExistingFacilityGqlMutation,
            updateFacilityInput
        )

        const responseData = serverResponse.data?.updateFacility

        if (!hasServerErrors(serverResponse) && responseData) {
            await Promise.all([getFacilities(), loadFacilityList()])

            selectedFacilityData.value = {
                ...selectedFacilityData.value,
                ...responseData
            }
            initializeFacilitySectionValues(responseData)
            // This block prevents a race condition: clear the array only if relations haven't changed while awaiting response
            if (
                arraysAreEqual(
                    facilitySectionFields.value.healthProfessionalsRelations,
                    updatedFields.contact?.address ? facilitySectionFields.value.healthProfessionalsRelations : []
                )
            ) {
                facilitySectionFields.value.healthProfessionalsRelations = []
            }
        }
        // Clear moderation unsaved-changes guard whenever the mutation did not return GraphQL errors (even if data is null).
        if (!hasServerErrors(serverResponse)) {
            unsavedChangesResetTick.value++
        }

        const mappedResponse: ServerResponse<Facility> = {
            ...serverResponse,
            data: responseData
        }

        return mappedResponse
    }

    function resetCreateFacilityFields() {
        createFacilityFields.nameEn = ''
        createFacilityFields.nameJa = ''
        createFacilityFields.contact = {
            address: {
                addressLine1En: '',
                addressLine1Ja: '',
                addressLine2En: '',
                addressLine2Ja: '',
                postalCode: '',
                prefectureEn: '',
                prefectureJa: '',
                cityEn: '',
                cityJa: ''
            },
            email: '',
            googleMapsUrl: '',
            phone: '',
            website: ''
        }
        createFacilityFields.mapLatitude = ''
        createFacilityFields.mapLongitude = ''
        createFacilityFields.healthcareProfessionalIds = []
        createFacilityFields.cityId = ''
        createFacilityFields.online = false
    }

    async function deleteFacility(
  facilityId: MutationDeleteFacilityArgs
    ): Promise<ServerResponse<Mutation>> {
        const serverResponse = await graphQLClientRequestWithRetry<Mutation>(
            gqlClient.request.bind(gqlClient),
            deleteExistingFacilityGqlMutation,
            facilityId
        )

        if (
            !hasServerErrors(serverResponse)
            && serverResponse.data?.deleteFacility?.isSuccessful
        ) {
            await Promise.all([getFacilities(), loadFacilityList()])
            if (selectedFacilityId.value === facilityId.id) {
                selectedFacilityId.value = ''
                selectedFacilityData.value = undefined
            }
        }

        return serverResponse
    }

    function setItemsPerPage(newLimit: number) {
        itemsPerPage.value = newLimit
    }

    function setListOrder(field: string) {
        listOrder.value = nextListOrder(listOrder.value, field)
        currentOffset.value = 0
        return loadFacilityList()
    }

    function setListSearchQuery(newQuery: string) {
        listSearchQuery.value = newQuery
        currentOffset.value = 0
        if (facilitySearchTimer) clearTimeout(facilitySearchTimer)
        facilitySearchTimer = setTimeout(() => {
            loadFacilityList()
        }, 300)
    }

    return {
        getFacilities,
        searchFacilities,
        loadFacilityList,
        createFacility,
        createFacilityFields,
        facilityData,
        filteredFacilityData,
        listSearchQuery,
        listOrder,
        setListOrder,
        setListSearchQuery,
        totalFacilitiesCount,
        updateFacility,
        facilitySectionFields,
        unsavedChangesResetTick,
        selectedFacilityId,
        deleteFacility,
        selectedFacilityData,
        setSelectedFacilityData,
        initializeFacilitySectionValues,
        resetFacilitySectionFields,
        resetCreateFacilityFields,
        currentOffset,
        itemsPerPage,
        setOffset,
        hasNextPage,
        hasPrevPage,
        setItemsPerPage
    }
})

const updateExistingFacilityGqlMutation = gql`
    mutation Mutation($id: ID!, $input: UpdateFacilityInput!) {
        updateFacility(id: $id, input: $input) {
            ${facilitySelection}
        }
    }
`

const deleteExistingFacilityGqlMutation = gql`
    mutation Mutation($id: ID!) {
        deleteFacility(id: $id) {
            isSuccessful
        }
    }
`
const createFacilityGqlMutation = gql`
    mutation Mutation($input: CreateFacilityInput!) {
        createFacility(input: $input) {
            ${facilitySelection}
        }
    }
`
