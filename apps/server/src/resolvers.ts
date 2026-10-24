import { GraphQLError, GraphQLResolveInfo } from 'graphql'
import { withAnyScope, withScope, UserContext, Scope, getEffectiveScopes } from './auth.js'
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
import { Result } from './result.js'
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
        : Promise<gqlType.ClinicSite | null> => {
            return clinicSiteService.getClinicSiteBySlug(args.slug)
        }),
        clinicSites: withScope(Scope['read:facilities'], async ()
        : Promise<gqlType.ClinicSiteSummary[]> => {
            return clinicSiteService.listPublicClinicSites()
        }),
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
        }, context: UserContext): Promise<gqlType.Facility> => {
            const newFacilityResult = await facilityService.createFacility(args.input, context.user.sub)

            convertErrorsToGqlErrors(newFacilityResult)
            return newFacilityResult.data
        }),

        updateFacility: withScope(Scope['write:facilities'], async (_parent: unknown, args: {
            id: string,
            input: gqlType.UpdateFacilityInput
        }, context: UserContext): Promise<gqlType.Facility> => {
            const updateFacilityResult = await facilityService.updateFacility(args.id, args.input, context.user.sub)

            convertErrorsToGqlErrors(updateFacilityResult)
            return updateFacilityResult.data
        }),
        confirmFacilityPlaceId: withScope(Scope['write:facilities'], async (
            _parent: unknown,
            args: { facilityId: string, placeId: string },
            context: UserContext
        ): Promise<gqlType.Facility> => {
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
        })
    }
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
