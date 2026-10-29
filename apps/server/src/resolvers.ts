import { GraphQLError, GraphQLResolveInfo } from 'graphql'
import {
    withAnyScope,
    withAuthenticatedUser,
    withScope,
    UserContext,
    Scope,
    getEffectiveScopes
} from './auth.js'
import { bookingAccessFor } from './booking/access.js'
import { allowBookingCall, type BookingBudget } from './booking/rateLimits.js'
import { assertBookingRegion, isBookingAvailableIn } from './booking/region.js'
import * as facilityService from './services/facilityService.js'
import * as healthcareProfessionalService from './services/healthcareProfessionalService.js'
import * as gqlType from '@findadoc/graphql'
import * as submissionService from './services/submissionService.js'
import * as userService from './services/userService.js'
import * as reservationService from './services/reservationService.js'
import * as cityService from './services/cityService.js'
import * as citySuggestionService from './services/citySuggestionService.js'
import * as mapsPlacePreviewService from './services/mapsPlacePreviewService.js'
import * as facilityPlaceService from './services/facilityPlaceService.js'
import * as clinicSiteService from './services/clinicSiteService.js'
import * as bookingService from './services/bookingService.js'
import * as availabilityService from './services/availabilityService.js'
import * as staffBookingService from './services/staffBookingService.js'
import * as appointmentService from './services/appointmentService.js'
import * as clinicAccessService from './services/clinicAccessService.js'
import * as clinicFormService from './services/clinicFormService.js'
import { envVariables } from '../utils/environmentVariables.js'
import { ErrorCode, Result } from './result.js'
import { logger } from './logger.js'
import { PUBLISHED_LOCALES } from './languages/publishedLocales.js'
import { facilityListMaxLimit } from '../utils/requestedFields.js'
import type { ApiContext } from './loaders.js'
import type { FacilityParent, ProfessionalParent } from './typeDefs/resolverParents.js'

const resolvers = {
    Query: {
        currentUserAccess: (_parent: unknown, _args: unknown, context: UserContext): gqlType.CurrentUserAccess => {
            const user = context.user
            const jwtScopes = user.scope?.split(/\s+/).filter(Boolean) ?? []
            const roles = (user.roles ?? []).map(r => String(r))
            return {
                roles,
                jwtScopes,
                effectiveScopes: getEffectiveScopes(user)
            }
        },
        clinicSite: withScope(Scope['read:facilities'], async (_parent: unknown, args: { slug: string })
        : Promise<gqlType.ClinicSite | null> => clinicSiteService.getClinicSiteBySlug(args.slug)),
        clinicSites: withScope(Scope['read:facilities'], async ()
        : Promise<gqlType.ClinicSiteSummary[]> => clinicSiteService.listPublicClinicSites()),
        // Intake and open slots are public. Staff list and the calendar require a signed-in session.
        bookingForm: withScope(Scope['create:bookings'], async (
            _parent: unknown,
            args: { clinicSiteId: string, formId?: string | null }
        ): Promise<gqlType.BookingForm | null> => bookingService.getBookingForm(args.clinicSiteId, args.formId)),
        availableBookingStarts: withScope(Scope['create:bookings'], async (
            _parent: unknown,
            args: {
                clinicSiteId: string
                from: string
                to: string
                durationMinutes?: number | null
                practitionerId?: string | null
                spokenLanguages?: gqlType.Locale[] | null
            }
        ): Promise<string[]> => bookingService.getAvailableBookingStarts(
            args.clinicSiteId,
            args.from,
            args.to,
            args.durationMinutes,
            args.practitionerId,
            args.spokenLanguages
        )),
        // The Book page asks first, so the server decides whether to show the form (#173).
        bookingAvailable: withScope(Scope['create:bookings'], (
            _parent: unknown,
            _args: unknown,
            context: UserContext
        ): boolean => isBookingAvailableIn(context.viewerCountry)),
        bookingFormTypes: withScope(Scope['create:bookings'], async ()
        : Promise<gqlType.BookingFormType[]> => clinicAccessService.listBookingFormTypes()),
        patientBooking: withScope(Scope['create:bookings'], async (
            _parent: unknown,
            args: { token: string },
            context: UserContext
        ): Promise<gqlType.PatientBookingView | null> => {
            enforceBookingBudget('token', context.clientIp)
            return appointmentService.getPatientBooking(args.token)
        }),
        // Staff reads: any signed-in user. The service limits rows to that user's clinics (booking/access.ts).
        myBookingClinics: withAuthenticatedUser(async (
            _parent: unknown,
            _args: unknown,
            context: UserContext
        ): Promise<gqlType.BookingClinic[]> =>
            clinicAccessService.listMyBookingClinics(await bookingAccessFor(context.user))),
        bookingClinic: withAuthenticatedUser(async (
            _parent: unknown,
            args: { facilityId: string },
            context: UserContext
        ): Promise<gqlType.BookingClinic | null> =>
            clinicAccessService.getBookingClinic(args.facilityId, await bookingAccessFor(context.user))),
        clinicMembers: withAuthenticatedUser(async (
            _parent: unknown,
            args: { facilityId: string },
            context: UserContext
        ): Promise<gqlType.ClinicMember[]> =>
            clinicAccessService.listClinicMembers(args.facilityId, await bookingAccessFor(context.user))),
        bookingSettings: withAuthenticatedUser(async (
            _parent: unknown,
            args: { facilityId: string },
            context: UserContext
        ): Promise<gqlType.BookingSettings | null> =>
            clinicAccessService.getBookingSettings(args.facilityId, await bookingAccessFor(context.user))),
        clinicBookingForms: withAuthenticatedUser(async (
            _parent: unknown,
            args: { facilityId: string },
            context: UserContext
        ): Promise<gqlType.ClinicBookingForm[]> =>
            clinicFormService.listClinicBookingForms(args.facilityId, await bookingAccessFor(context.user))),
        clinicAppointments: withAuthenticatedUser(async (
            _parent: unknown,
            args: { clinicId: string, from: string, to: string },
            context: UserContext
        ): Promise<gqlType.BookingAppointment[]> => appointmentService.listClinicAppointments(
            args.clinicId,
            args.from,
            args.to,
            await bookingAccessFor(context.user)
        )),
        bookingSubmissions: withAuthenticatedUser(async (
            _parent: unknown,
            args: { filters: gqlType.BookingSubmissionSearchFilters },
            context: UserContext
        ): Promise<gqlType.BookingSubmissionListItem[]> =>
            staffBookingService.searchBookingSubmissions(args.filters, await bookingAccessFor(context.user))),
        bookingSubmissionsTotalCount: withAuthenticatedUser(async (
            _parent: unknown,
            args: { filters: gqlType.BookingSubmissionSearchFilters },
            context: UserContext
        ): Promise<number> =>
            staffBookingService.countBookingSubmissions(args.filters, await bookingAccessFor(context.user))),
        bookingSubmission: withAuthenticatedUser(async (
            _parent: unknown,
            args: { id: string },
            context: UserContext
        ): Promise<gqlType.BookingSubmissionDetail | null> =>
            staffBookingService.getBookingSubmissionDetail(args.id, await bookingAccessFor(context.user))),
        clinicAvailabilityWindows: withAuthenticatedUser(async (
            _parent: unknown,
            args: { clinicSiteId: string, from: string, to: string },
            context: UserContext
        ): Promise<gqlType.ClinicAvailabilityWindow[]> => availabilityService.listClinicAvailabilityWindows(
            args.clinicSiteId,
            args.from,
            args.to,
            await bookingAccessFor(context.user)
        )),
        clinicPractitioners: withAuthenticatedUser(async (
            _parent: unknown,
            args: { clinicId: string },
            context: UserContext
        ): Promise<gqlType.BookingPractitioner[]> => availabilityService.listClinicPractitioners(
            args.clinicId,
            await bookingAccessFor(context.user)
        )),
        clinicWeeklyHours: withAuthenticatedUser(async (
            _parent: unknown,
            args: { clinicId: string },
            context: UserContext
        ): Promise<gqlType.ClinicWeeklyHours[]> => availabilityService.listClinicWeeklyHours(
            args.clinicId,
            await bookingAccessFor(context.user)
        )),
        clinicAvailabilityClosures: withAuthenticatedUser(async (
            _parent: unknown,
            args: { clinicId: string, from: string, to: string },
            context: UserContext
        ): Promise<gqlType.ClinicAvailabilityClosure[]> => availabilityService.listClinicAvailabilityClosures(
            args.clinicId,
            args.from,
            args.to,
            await bookingAccessFor(context.user)
        )),
        facility: withScope(Scope['read:facilities'], async (_parent: unknown, args: { id: string; })
        : Promise<FacilityParent> => {
            const queryResults = await facilityService.getFacilityById(args.id)

            convertErrorsToGqlErrors(queryResults)
            return queryResults.data
        }),
        facilityByGooglePlaceId: withScope(Scope['read:facilities'], async (
            _parent: unknown,
            args: { placeId: string }
        ): Promise<FacilityParent | null> => {
            const queryResults = await facilityService.getFacilityByGooglePlaceId(args.placeId.trim())

            convertErrorsToGqlErrors(queryResults)
            return queryResults.data
        }),
        facilityMatchingMapsUrl: withScope(Scope['read:facilities'], async (
            _parent: unknown,
            args: { url: string }
        ): Promise<FacilityParent | null> => {
            const queryResults = await facilityService.getFacilityMatchingMapsUrl(args.url.trim())

            convertErrorsToGqlErrors(queryResults)
            return queryResults.data
        }),
        mapsPlacePreview: withScope(Scope['read:facilities'], async (
            _parent: unknown,
            args: { url: string, languageCode?: string | null },
            context: UserContext
        ): Promise<gqlType.MapsPlacePreview | null> => {
            const queryResults = await mapsPlacePreviewService.previewMapsPlace(
                args.url,
                args.languageCode,
                context.clientIp
            )
            convertErrorsToGqlErrors(queryResults)
            return queryResults.data
        }),
        suggestFacilityPlaces: withScope(Scope['write:facilities'], async (
            _parent: unknown,
            args: facilityPlaceService.SuggestFacilityPlacesInput,
            context: UserContext
        ): Promise<facilityPlaceService.FacilityPlaceCandidate[]> => {
            const queryResults = await facilityPlaceService.suggestFacilityPlaces(
                args,
                context.clientIp || 'unknown'
            )
            convertErrorsToGqlErrors(queryResults)
            return queryResults.data
        }),
        facilities: withScope(Scope['read:facilities'], async (_parent: unknown, args: { filters: gqlType.FacilitySearchFilters }, context: UserContext,
            info: GraphQLResolveInfo)
        : Promise<FacilityParent[]> => {
            const queryResults = await facilityService.searchFacilities(args.filters, facilityListMaxLimit(info))

            convertErrorsToGqlErrors(queryResults)
            return queryResults.data
        }),
        facilitiesTotalCount: withScope(Scope['read:facilities'], async (_parent: unknown, args: { filters: gqlType.FacilitySearchFilters })
        : Promise<number> => {
            const countResults = await facilityService.countFacilities(args.filters)

            convertErrorsToGqlErrors(countResults)
            return countResults.data
        }),

        healthcareProfessional: withScope(Scope['read:healthcareprofessionals'], async (_parent: unknown, args: { id: string; })
        : Promise<ProfessionalParent> => {
            const matchingHealthcareProfessionalResult =
                await healthcareProfessionalService.getHealthcareProfessionalById(args.id)

            convertErrorsToGqlErrors(matchingHealthcareProfessionalResult)
            return matchingHealthcareProfessionalResult.data
        }),
        healthcareProfessionals: withScope(Scope['read:healthcareprofessionals'], async (_parent: unknown, args: {
            filters: gqlType.HealthcareProfessionalSearchFilters
        })
        : Promise<ProfessionalParent[]> => {
            const queryResults = await healthcareProfessionalService.searchProfessionals(args.filters)

            convertErrorsToGqlErrors(queryResults)

            return queryResults.data
        }),

        healthcareProfessionalsTotalCount: withScope(Scope['read:healthcareprofessionals'], async (_parent: unknown, args: {
            filters: gqlType.HealthcareProfessionalSearchFilters
        })
        : Promise<number> => {
            const countResults =
                await healthcareProfessionalService.countProfessionals(args.filters)

            convertErrorsToGqlErrors(countResults)
            return countResults.data
        }),

        submission: withScope(Scope['read:submissions'], async (_parent: unknown, args: { id: string })
        : Promise<gqlType.Submission | undefined> => {
            const matchingSubmissionResult = await submissionService.getSubmissionById(args.id)

            convertErrorsToGqlErrors(matchingSubmissionResult)
            return matchingSubmissionResult.data
        }),

        submissions: withScope(Scope['read:submissions'], async (_parent: unknown, args: { filters: gqlType.SubmissionSearchFilters })
        : Promise<gqlType.Submission[]> => {
            const matchingSubmissionsResult = await submissionService.searchSubmissions(args.filters)

            convertErrorsToGqlErrors(matchingSubmissionsResult)

            return matchingSubmissionsResult.data
        }),

        submissionsTotalCount: withScope(Scope['read:submissions'], async (_parent: unknown, args: { filters: gqlType.SubmissionSearchFilters })
        : Promise<number> => {
            const countResults = await submissionService.countSubmissions(args.filters)

            convertErrorsToGqlErrors(countResults)
            return countResults.data
        }),
        user: withScope(Scope['read:users'], async (_parent: unknown, args: { id: string })
        : Promise<gqlType.User | undefined> => {
            const matchingUserResult = await userService.getUserById(args.id)

            return matchingUserResult.data
        }),
        reservation: withScope(Scope['read:reservations'], async (_parent: unknown, args: { id: string })
        : Promise<gqlType.Reservation | undefined> => {
            const matchingReservationResult = await reservationService.getReservationById(args.id)

            return matchingReservationResult.data
        }),
        publishedLanguages: withScope(Scope['read:facilities'], (): gqlType.Locale[] =>
            PUBLISHED_LOCALES.map(locale => locale as gqlType.Locale)),
        prefectures: withScope(Scope['read:facilities'], async ()
        : Promise<gqlType.Prefecture[]> => {
            const result = await cityService.listPrefectures()

            convertErrorsToGqlErrors(result)
            return result.data
        }),
        cities: withScope(Scope['read:facilities'], async (_parent: unknown, args: { prefecture?: string | null })
        : Promise<gqlType.City[]> => {
            const result = await cityService.listCities(args.prefecture)

            convertErrorsToGqlErrors(result)
            return result.data
        }),
        suggestCities: withScope(Scope['write:facilities'], async (_parent: unknown, args: { input: string })
        : Promise<gqlType.CitySuggestion[]> => {
            const result = await citySuggestionService.suggestCities(args.input)

            convertErrorsToGqlErrors(result)
            return result.data
        }),
        cityFacilities: withScope(Scope['read:facilities'], async (
            _parent: unknown,
            args: { prefecture: string, citySlug: string }
        ): Promise<FacilityParent[]> => {
            const result = await facilityService.listPublishedCityFacilities(args.prefecture, args.citySlug)

            convertErrorsToGqlErrors(result)
            return result.data
        })
    },

    Facility: {
        healthcareProfessionalIds: (parent: FacilityParent, _args: unknown, context: ApiContext)
        : string[] | Promise<string[]> =>
            parent.healthcareProfessionalIds ?? context.loaders.healthcareProfessionalIdsByFacility.load(parent.id),
        bookingEnabled: (parent: FacilityParent, _args: unknown, context: ApiContext): Promise<boolean> =>
            context.loaders.bookingEnabledByFacility.load(parent.id),
        city: (parent: FacilityParent, _args: unknown, context: ApiContext): Promise<gqlType.City | null> => {
            if (!parent.cityId) {
                return Promise.resolve(null)
            }

            return context.loaders.cityById.load(parent.cityId)
        }
    },

    HealthcareProfessional: {
        facilityIds: (parent: ProfessionalParent, _args: unknown, context: ApiContext)
        : string[] | Promise<string[]> =>
            parent.facilityIds ?? context.loaders.facilityIdsByProfessional.load(parent.id)
    },

    Mutation: {
        createFacility: withScope(Scope['write:facilities'], async (_parent: unknown, args: {
            input: gqlType.CreateFacilityInput
        }, context: UserContext): Promise<FacilityParent> => {
            const newFacilityResult = await facilityService.createFacility(args.input, context.user.sub)

            convertErrorsToGqlErrors(newFacilityResult)
            return newFacilityResult.data
        }),

        updateFacility: withScope(Scope['write:facilities'], async (_parent: unknown, args: {
            id: string,
            input: gqlType.UpdateFacilityInput
        }, context: UserContext): Promise<FacilityParent> => {
            const updateFacilityResult = await facilityService.updateFacility(args.id, args.input, context.user.sub)

            convertErrorsToGqlErrors(updateFacilityResult)
            return updateFacilityResult.data
        }),
        confirmFacilityPlaceId: withScope(Scope['write:facilities'], async (
            _parent: unknown,
            args: { facilityId: string, placeId: string },
            context: UserContext
        ): Promise<FacilityParent> => {
            const result = await facilityPlaceService.confirmFacilityPlaceId(
                args.facilityId,
                args.placeId,
                context.user.sub
            )
            convertErrorsToGqlErrors(result)
            return result.data as gqlType.Facility
        }),

        deleteFacility: withScope(Scope['delete:facilities'], async (_parent: unknown, args: {
            id: string
        }, context: UserContext): Promise<gqlType.DeleteResult> => {
            const deleteFacilityResult = await facilityService.deleteFacility(args.id, context.user.sub)

            convertErrorsToGqlErrors(deleteFacilityResult)
            return deleteFacilityResult.data
        }),

        createHealthcareProfessional: withScope(Scope['write:healthcareprofessionals'], async (_parent: unknown, args: {
            input: gqlType.CreateHealthcareProfessionalInput
        }, context: UserContext): Promise<gqlType.HealthcareProfessional> => {
            const newHealthcareProfessionalResult = await healthcareProfessionalService
                .createHealthcareProfessional(args.input, context.user.sub)

            convertErrorsToGqlErrors(newHealthcareProfessionalResult)
            return newHealthcareProfessionalResult.data
        }),

        updateHealthcareProfessional: withScope(Scope['write:healthcareprofessionals'], async (_parent: unknown, args: {
            id: string,
            input: gqlType.UpdateHealthcareProfessionalInput
        }, context: UserContext): Promise<gqlType.HealthcareProfessional> => {
            const updateHealthcareProfessionalResult = await healthcareProfessionalService
                .updateHealthcareProfessional(args.id, args.input, context.user.sub)

            convertErrorsToGqlErrors(updateHealthcareProfessionalResult)
            return updateHealthcareProfessionalResult.data
        }),

        deleteHealthcareProfessional: withScope(Scope['delete:healthcareprofessionals'], async (_parent: unknown, args: {
            id: string
        }, context: UserContext): Promise<gqlType.DeleteResult> => {
            const deleteHealthcareProfessionalResult = await healthcareProfessionalService
                .deleteHealthcareProfessional(args.id, context.user.sub)

            convertErrorsToGqlErrors(deleteHealthcareProfessionalResult)
            return deleteHealthcareProfessionalResult.data
        }),

        createSubmission: withAnyScope([Scope['write:submissions'], Scope['create:submissions']], async (_parent: unknown, args: {
            input: gqlType.CreateSubmissionInput
        }, context: UserContext): Promise<gqlType.Submission> => {
            const createSubmissionResult = await submissionService.createSubmission(args.input, context.user.sub)

            convertErrorsToGqlErrors(createSubmissionResult)
            return createSubmissionResult.data
        }),

        updateSubmission: withScope(Scope['write:submissions'], async (_parent: unknown, args: {
            id: string,
            input: gqlType.UpdateSubmissionInput
        }, context: UserContext): Promise<gqlType.Submission> => {
            const updatedSubmissionResult = await submissionService.updateSubmission(
                args.id,
                args.input,
                context.user.sub
            )

            convertErrorsToGqlErrors(updatedSubmissionResult)
            return updatedSubmissionResult.data
        }),

        deleteSubmission: withScope(Scope['delete:submissions'], async (_parent: unknown, args: {
            id: string
        }, context: UserContext): Promise<gqlType.DeleteResult> => {
            const deleteSubmissionResult = await submissionService.deleteSubmission(args.id, context.user.sub)

            convertErrorsToGqlErrors(deleteSubmissionResult)
            return deleteSubmissionResult.data
        }),
        createUser: withScope(Scope['write:users'], async (_parent: unknown, args: { input: gqlType.CreateUserInput })
        : Promise<gqlType.User> => {
            const createUserResult = await userService.createUser(args.input)

            return createUserResult.data
        }),
        updateUser: withScope(Scope['write:users'], async (_parent: unknown, args: { id: string, input: gqlType.UpdateUserInput })
        : Promise<gqlType.User> => {
            const updateUserResult = await userService.updateUser(args.id, args.input)

            return updateUserResult.data
        }),
        recordCityPlaceId: withScope(Scope['write:facilities'], async (
            _parent: unknown,
            args: { cityId: string, placeId: string }
        ): Promise<gqlType.City> => {
            const result = await citySuggestionService.recordCityPlaceId(args.cityId, args.placeId)

            convertErrorsToGqlErrors(result)
            if (!result.data) {
                throw new GraphQLError('City was not found', {
                    extensions: { code: 'NOT_FOUND', http: { status: 404 } }
                })
            }
            return result.data
        }),
        createReservation: withScope(Scope['write:reservations'], async (_parent: unknown, args: { input: gqlType.CreateReservationInput })
        : Promise<gqlType.Reservation> => {
            const createReservationResult = await reservationService.createReservation(args.input)

            return createReservationResult.data
        }),

        createBookingUploadUrl: withScope(Scope['create:bookings'], async (_parent: unknown, args: {
            input: gqlType.CreateBookingUploadUrlInput
        }, context: UserContext): Promise<gqlType.BookingUploadUrl> => {
            assertBookingRegion(context.viewerCountry)
            enforceBookingBudget('upload', context.clientIp)
            const result = await bookingService.createBookingUploadUrl(
                args.input,
                envVariables.apiURL() || 'http://127.0.0.1:4000'
            )
            convertErrorsToGqlErrors(result)
            return result.data
        }),

        submitBooking: withScope(Scope['create:bookings'], async (_parent: unknown, args: {
            input: gqlType.SubmitBookingInput
        }, context: UserContext): Promise<gqlType.BookingSubmissionResult> => {
            assertBookingRegion(context.viewerCountry)
            enforceBookingBudget('submit', context.clientIp)
            const result = await bookingService.submitBooking(args.input)
            convertErrorsToGqlErrors(result)
            return result.data
        }),

        bookingUploadDownloadUrl: withAuthenticatedUser(async (_parent: unknown, args: {
            uploadId: string
            disposition?: gqlType.BookingUploadDisposition | null
        }, context: UserContext): Promise<gqlType.BookingUploadDownloadUrl> => {
            const result = await staffBookingService.createStaffBookingDownloadUrl(
                args.uploadId,
                envVariables.apiURL() || 'http://127.0.0.1:4000',
                await bookingAccessFor(context.user),
                args.disposition ?? undefined,
                context.user?.sub
            )
            convertErrorsToGqlErrors(result)
            return result.data
        }),

        createClinicAvailabilityWindow: withAuthenticatedUser(async (
            _parent: unknown,
            args: { input: gqlType.CreateClinicAvailabilityWindowInput },
            context: UserContext
        ): Promise<gqlType.ClinicAvailabilityWindow> => {
            const result = await availabilityService.createClinicAvailabilityWindow(
                args.input,
                context.user?.sub,
                await bookingAccessFor(context.user)
            )
            convertErrorsToGqlErrors(result)
            return result.data
        }),

        deleteClinicAvailabilityWindow: withAuthenticatedUser(async (
            _parent: unknown,
            args: { id: string },
            context: UserContext
        ): Promise<gqlType.DeleteResult> => {
            const result = await availabilityService.deleteClinicAvailabilityWindow(
                args.id,
                await bookingAccessFor(context.user)
            )
            convertErrorsToGqlErrors(result)
            return result.data
        }),

        setClinicWeeklyHours: withAuthenticatedUser(async (
            _parent: unknown,
            args: { input: gqlType.SetClinicWeeklyHoursInput },
            context: UserContext
        ): Promise<gqlType.ClinicWeeklyHours[]> => {
            const result = await availabilityService.setClinicWeeklyHours(
                args.input,
                context.user?.sub,
                await bookingAccessFor(context.user)
            )
            convertErrorsToGqlErrors(result)
            return result.data
        }),

        createClinicAvailabilityClosure: withAuthenticatedUser(async (
            _parent: unknown,
            args: { input: gqlType.CreateClinicAvailabilityClosureInput },
            context: UserContext
        ): Promise<gqlType.ClinicAvailabilityClosure> => {
            const result = await availabilityService.createClinicAvailabilityClosure(
                args.input,
                context.user?.sub,
                await bookingAccessFor(context.user)
            )
            convertErrorsToGqlErrors(result)
            return result.data
        }),

        deleteClinicAvailabilityClosure: withAuthenticatedUser(async (
            _parent: unknown,
            args: { id: string },
            context: UserContext
        ): Promise<gqlType.DeleteResult> => {
            const result = await availabilityService.deleteClinicAvailabilityClosure(
                args.id,
                await bookingAccessFor(context.user)
            )
            convertErrorsToGqlErrors(result)
            return result.data
        }),

        updateBookingAppointmentStatus: withAuthenticatedUser(async (
            _parent: unknown,
            args: { input: gqlType.UpdateBookingAppointmentStatusInput },
            context: UserContext
        ): Promise<gqlType.BookingAppointment> => {
            const result = await appointmentService.updateAppointmentStatus(
                args.input,
                await bookingAccessFor(context.user),
                context.user?.sub
            )
            convertErrorsToGqlErrors(result)
            return result.data
        }),

        // The patient is signed out. The private token is the credential.
        cancelBookingByToken: withScope(Scope['create:bookings'], async (
            _parent: unknown,
            args: { input: gqlType.CancelBookingByTokenInput },
            context: UserContext
        ): Promise<gqlType.PatientBookingView> => {
            enforceBookingBudget('token', context.clientIp)
            const result = await appointmentService.cancelBookingByToken(args.input)
            convertErrorsToGqlErrors(result)
            return result.data
        }),

        inviteClinicMember: withAuthenticatedUser(async (
            _parent: unknown,
            args: { input: gqlType.InviteClinicMemberInput },
            context: UserContext
        ): Promise<gqlType.ClinicMember> => {
            const result = await clinicAccessService.inviteClinicMember(
                args.input,
                await bookingAccessFor(context.user),
                context.user?.sub
            )
            convertErrorsToGqlErrors(result)
            return result.data
        }),

        removeClinicMember: withAuthenticatedUser(async (
            _parent: unknown,
            args: { id: string },
            context: UserContext
        ): Promise<gqlType.DeleteResult> => {
            const result = await clinicAccessService.removeClinicMember(args.id, await bookingAccessFor(context.user))
            convertErrorsToGqlErrors(result)
            return result.data
        }),

        updateBookingSettings: withAuthenticatedUser(async (
            _parent: unknown,
            args: { input: gqlType.UpdateBookingSettingsInput },
            context: UserContext
        ): Promise<gqlType.BookingSettings> => {
            const result = await clinicAccessService.updateBookingSettings(
                args.input,
                await bookingAccessFor(context.user)
            )
            convertErrorsToGqlErrors(result)
            return result.data
        }),

        saveClinicBookingForm: withAuthenticatedUser(async (
            _parent: unknown,
            args: { input: gqlType.SaveClinicBookingFormInput },
            context: UserContext
        ): Promise<gqlType.ClinicBookingForm> => {
            const result = await clinicFormService.saveClinicBookingForm(
                args.input,
                await bookingAccessFor(context.user),
                context.user?.sub
            )
            convertErrorsToGqlErrors(result)
            return result.data
        })
    }
}

/** Refuses a signed-out booking call once this address has used its budget (booking/rateLimits.ts). */
function enforceBookingBudget(budget: BookingBudget, clientIp: string | undefined): void {
    if (allowBookingCall(budget, clientIp || 'unknown')) {
        return
    }
    logger.warn(`Booking ${budget} limit reached`)
    convertErrorsToGqlErrors({
        data: undefined,
        hasErrors: true,
        errors: [{ field: 'clientIp', errorCode: ErrorCode.TOO_MANY_REQUESTS, httpStatus: 429 }]
    })
}

function convertErrorsToGqlErrors(resultObject: Result<unknown>): void {
    if (resultObject.hasErrors) {
        logger.info(`Errors sent to user: ${JSON.stringify(resultObject.errors)}`)

        throw new GraphQLError('Validation Failed', {
            extensions: {
                code: 'BAD_USER_INPUT',
                errors: resultObject.errors
            }
        })
    }
}

export default resolvers
