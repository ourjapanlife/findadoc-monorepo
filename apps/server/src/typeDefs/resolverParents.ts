import type * as gqlTypes from '@findadoc/graphql'

/**
 * What a query resolver returns for a Facility before the field resolvers run.
 * `healthcareProfessionalIds` is filled by its field resolver unless a mutation already returned it.
 * `bookingEnabled` always comes from its field resolver.
 */
export type FacilityParent = Omit<gqlTypes.Facility, 'healthcareProfessionalIds' | 'bookingEnabled'>
    & Partial<Pick<gqlTypes.Facility, 'healthcareProfessionalIds'>>

/**
 * What a query resolver returns for a HealthcareProfessional before the field resolvers run.
 * `facilityIds` is filled by its field resolver unless a mutation already returned it.
 */
export type ProfessionalParent = Omit<gqlTypes.HealthcareProfessional, 'facilityIds'>
    & Partial<Pick<gqlTypes.HealthcareProfessional, 'facilityIds'>>
