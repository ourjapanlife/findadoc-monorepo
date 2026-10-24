/** The only plan. Three active people at one hospital. */
export const BASIC_PLAN = 'basic'

export const BASIC_SEAT_LIMIT = 3

export type FacilitySeatRole = 'owner' | 'staff'

const ANONYMOUS_SUBJECT = 'Anonymous User'

export function seatIsAvailable(
    activeSeats: number,
    alreadyActive: boolean,
    seatLimit: number
): boolean {
    if (alreadyActive) {
        return true
    }
    return activeSeats < seatLimit
}

/** Find a Doc staff may name an owner. A hospital owner may add staff. */
export function roleAllowed(platformStaff: boolean, role: FacilitySeatRole): boolean {
    if (role === 'staff') {
        return true
    }
    return platformStaff
}

export function callerMayAssign(platformStaff: boolean, ownerOfFacility: boolean): boolean {
    return platformStaff || ownerOfFacility
}

/** A hospital owner may free a staff seat. Staff, and another owner, stay put. */
export function callerMayRevoke(
    platformStaff: boolean,
    ownerOfFacility: boolean,
    targetRole: FacilitySeatRole
): boolean {
    if (platformStaff) {
        return true
    }
    return ownerOfFacility && targetRole === 'staff'
}

export function isLoginSubject(subject: string | null | undefined): boolean {
    return typeof subject === 'string' && subject.length > 0 && subject !== ANONYMOUS_SUBJECT
}
