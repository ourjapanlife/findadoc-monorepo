import { ClinicMemberRole, type BookingClinic } from '@findadoc/graphql'

export type ClinicDashboardTab = 'requests' | 'calendar' | 'settings' | 'team'

/** Who is looking at the clinic: their clinic membership (role) and whether they are an admin. */
type ClinicViewer = Pick<BookingClinic, 'role' | 'isAdmin'>

/** Clinic member: owner or staff of this clinic. Only members see its bookings (#192). */
export function isClinicMember(clinic: ClinicViewer): boolean {
    return clinic.role === ClinicMemberRole.Owner || clinic.role === ClinicMemberRole.Staff
}

/** Clinic owner: changes settings, payment, interpreters, staff, and exports. */
export function isClinicOwner(clinic: ClinicViewer): boolean {
    return clinic.role === ClinicMemberRole.Owner
}

/**
 * Tabs this user sees on one clinic's dashboard. Clinic members get requests and the
 * calendar; the clinic owner also gets Settings. Team is for the clinic owner and for an
 * admin. Being an admin grants no booking tab, so an admin who is not a member sees Team alone.
 */
export function clinicDashboardTabs(clinic: ClinicViewer | null): ClinicDashboardTab[] {
    if (clinic === null) {
        return []
    }
    const tabs: ClinicDashboardTab[] = []
    if (isClinicMember(clinic)) {
        tabs.push('requests', 'calendar')
        if (isClinicOwner(clinic)) {
            tabs.push('settings')
        }
    }
    if (isClinicOwner(clinic) || clinic.isAdmin) {
        tabs.push('team')
    }
    return tabs
}

function isClinicDashboardTab(value: unknown): value is ClinicDashboardTab {
    return value === 'requests' || value === 'calendar' || value === 'settings' || value === 'team'
}

/** The `?tab=` value when this user has that tab, else their first tab. */
export function selectedClinicDashboardTab(
    requested: unknown,
    tabs: readonly ClinicDashboardTab[]
): ClinicDashboardTab {
    if (isClinicDashboardTab(requested) && tabs.includes(requested)) {
        return requested
    }
    return tabs[0] ?? 'requests'
}
