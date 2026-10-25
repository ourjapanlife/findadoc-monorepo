import { ActionType, FacilityMembershipRole, FacilityMembershipStatus, ObjectType, type FacilityMembership, type User } from '@findadoc/graphql'
import { sql, type Transaction } from 'kysely'
import { db } from '../kyselyClient.js'
import { ErrorCode, type Result } from '../result.js'
import type { Database } from '../typeDefs/kyselyTypes.js'
import { createAuditLog } from './auditLogServiceSupabase.js'
import {
    BASIC_PLAN,
    BASIC_SEAT_LIMIT,
    callerMayAssign,
    callerMayAttachLogin,
    callerMayRevoke,
    callerMayRewriteRole,
    isLoginSubject,
    roleAllowed,
    seatIsAvailable,
    type FacilitySeatRole
} from './facilityMembershipRules.js'

export type AssignFacilityMemberInput = {
    facilityId: string
    displayName?: string | null
    role: FacilitySeatRole
    hpId?: string | null
    userId?: string | null
    authSubject?: string | null
}

export type AssignFacilityMemberPayload = {
    membership: FacilityMembership
    user: User
    seatsUsed: number
    seatLimit: number
}

type Actor = {
    sub: string
    platformStaff: boolean
}

type MembershipRow = {
    id: string
    facility_id: string
    user_id: string
    hp_id: string | null
    role: string
    status: string
    created_date: string | Date
}

function failure<T>(field: string, errorCode: ErrorCode, httpStatus: number): Result<T> {
    return {
        data: undefined as T,
        hasErrors: true,
        errors: [{ field, errorCode, httpStatus }]
    }
}

function asRole(role: string): FacilitySeatRole | undefined {
    if (role === 'owner' || role === 'staff') {
        return role
    }
    return undefined
}

function iso(value: string | Date): string {
    return value instanceof Date ? value.toISOString() : value
}

function toMembership(row: MembershipRow): FacilityMembership {
    const role = asRole(row.role)
    return {
        id: row.id,
        facilityId: row.facility_id,
        userId: row.user_id,
        hpId: row.hp_id,
        role: role === 'owner' ? FacilityMembershipRole.Owner : FacilityMembershipRole.Staff,
        status: row.status === 'revoked' ? FacilityMembershipStatus.Revoked : FacilityMembershipStatus.Active,
        createdDate: iso(row.created_date)
    }
}

function toUser(row: {
    id: string
    display_name: string | null
    profile_pic_url: string | null
    created_date: string | Date
    updated_date: string | Date | null
}): User {
    return {
        id: row.id,
        displayName: row.display_name,
        profilePicUrl: row.profile_pic_url,
        createdDate: iso(row.created_date),
        updatedDate: row.updated_date ? iso(row.updated_date) : iso(row.created_date)
    }
}

async function lockSubscription(trx: Transaction<Database>, facilityId: string): Promise<number> {
    const existing = await trx.selectFrom('facility_subscriptions')
        .select(['seat_limit'])
        .where('facility_id', '=', facilityId)
        .forUpdate()
        .executeTakeFirst()
    if (existing) {
        return existing.seat_limit
    }

    await trx.insertInto('facility_subscriptions').values({
        facility_id: facilityId,
        plan: BASIC_PLAN,
        seat_limit: BASIC_SEAT_LIMIT,
        updated_date: new Date().toISOString()
    }).execute()

    const created = await trx.selectFrom('facility_subscriptions')
        .select(['seat_limit'])
        .where('facility_id', '=', facilityId)
        .forUpdate()
        .executeTakeFirstOrThrow()
    return created.seat_limit
}

async function activeSeatCount(trx: Transaction<Database>, facilityId: string): Promise<number> {
    const row = await trx.selectFrom('facility_memberships')
        .select(sql<number>`count(*)::int`.as('count'))
        .where('facility_id', '=', facilityId)
        .where('status', '=', 'active')
        .executeTakeFirstOrThrow()
    return Number(row.count)
}

export async function callerOwnsFacility(subject: string, facilityId: string): Promise<boolean> {
    if (!isLoginSubject(subject)) {
        return false
    }

    const row = await db.selectFrom('facility_memberships as membership')
        .innerJoin('user', 'user.id', 'membership.user_id')
        .select('membership.id')
        .where('user.auth_subject', '=', subject)
        .where('membership.facility_id', '=', facilityId)
        .where('membership.role', '=', 'owner')
        .where('membership.status', '=', 'active')
        .executeTakeFirst()
    return row !== undefined
}

export async function assignFacilityMember(
    input: AssignFacilityMemberInput,
    actor: Actor
): Promise<Result<AssignFacilityMemberPayload>> {
    const role = asRole(input.role)
    if (!role || !roleAllowed(actor.platformStaff, role)) {
        return failure('role', ErrorCode.INVALID_INPUT, 403)
    }

    const owner = actor.platformStaff
        ? false
        : await callerOwnsFacility(actor.sub, input.facilityId)
    if (!callerMayAssign(actor.platformStaff, owner)) {
        return failure('facilityId', ErrorCode.INVALID_INPUT, 403)
    }

    try {
        const payload = await db.transaction().execute(async trx => {
            const facility = await trx.selectFrom('facilities')
                .select('id')
                .where('id', '=', input.facilityId)
                .executeTakeFirst()
            if (!facility) {
                return failure<AssignFacilityMemberPayload>('facilityId', ErrorCode.NOT_FOUND, 404)
            }

            if (input.hpId) {
                const link = await trx.selectFrom('hps_facilities')
                    .select('hps_id')
                    .where('hps_id', '=', input.hpId)
                    .where('facilities_id', '=', input.facilityId)
                    .executeTakeFirst()
                if (!link) {
                    return failure<AssignFacilityMemberPayload>('hpId', ErrorCode.INVALID_INPUT, 400)
                }
            }

            const seatLimit = await lockSubscription(trx, input.facilityId)
            const existingUser = await lookupUser(trx, input, actor.platformStaff)
            if (input.userId && !existingUser) {
                return failure<AssignFacilityMemberPayload>('userId', ErrorCode.NOT_FOUND, 404)
            }

            const current = existingUser
                ? await trx.selectFrom('facility_memberships')
                    .selectAll()
                    .where('facility_id', '=', input.facilityId)
                    .where('user_id', '=', existingUser.id)
                    .executeTakeFirst()
                : undefined
            const currentRole = current ? asRole(current.role) : undefined
            if (!callerMayRewriteRole(actor.platformStaff, currentRole)) {
                return failure<AssignFacilityMemberPayload>('role', ErrorCode.INVALID_INPUT, 403)
            }
            const alreadyActive = current?.status === 'active'
            const activeSeats = await activeSeatCount(trx, input.facilityId)
            if (!seatIsAvailable(activeSeats, alreadyActive, seatLimit)) {
                return failure<AssignFacilityMemberPayload>('facilityId', ErrorCode.MAX_LIMIT, 409)
            }

            const user = existingUser ?? await createUser(trx, input, actor.sub)
            if (!user) {
                return failure<AssignFacilityMemberPayload>('displayName', ErrorCode.REQUIRED, 400)
            }

            const now = new Date().toISOString()
            const saved = current
                ? await trx.updateTable('facility_memberships')
                    .set({
                        role,
                        hp_id: input.hpId === undefined ? current.hp_id : input.hpId,
                        status: 'active',
                        revoked_date: null,
                        updated_date: now
                    })
                    .where('id', '=', current.id)
                    .returningAll()
                    .executeTakeFirstOrThrow()
                : await trx.insertInto('facility_memberships')
                    .values({
                        facility_id: input.facilityId,
                        user_id: user.id,
                        hp_id: input.hpId ?? null,
                        role,
                        status: 'active',
                        updated_date: now,
                        revoked_date: null
                    })
                    .returningAll()
                    .executeTakeFirstOrThrow()

            await createAuditLog(trx, {
                actionType: current ? ActionType.Update : ActionType.Create,
                objectType: ObjectType.FacilityMembership,
                updatedBy: actor.sub,
                oldValue: current ?? undefined,
                newValue: saved
            })

            const seatsUsed = await activeSeatCount(trx, input.facilityId)
            return {
                data: {
                    membership: toMembership(saved),
                    user: toUser(user),
                    seatsUsed,
                    seatLimit
                },
                hasErrors: false as const
            }
        })
        return payload
    } catch (error) {
        const message = error instanceof Error ? error.message : ''
        if (message.includes('hospital seat limit reached') || message.includes('hospital has no plan')) {
            return failure('facilityId', ErrorCode.MAX_LIMIT, 409)
        }
        if (message.includes('healthcare professional is not at this hospital')
            || message.includes('facility_memberships_active_hp_key')) {
            return failure('hpId', ErrorCode.INVALID_INPUT, 400)
        }
        if (message.includes('auth subject does not match this user')) {
            return failure('authSubject', ErrorCode.INVALID_INPUT, 400)
        }
        return failure('assignFacilityMember', ErrorCode.INTERNAL_SERVER_ERROR, 500)
    }
}

export async function revokeFacilityMember(
    facilityId: string,
    userId: string,
    actor: Actor
): Promise<Result<FacilityMembership>> {
    const owner = actor.platformStaff ? false : await callerOwnsFacility(actor.sub, facilityId)
    const current = await db.selectFrom('facility_memberships')
        .selectAll()
        .where('facility_id', '=', facilityId)
        .where('user_id', '=', userId)
        .executeTakeFirst()
    if (!current) {
        return failure('userId', ErrorCode.NOT_FOUND, 404)
    }

    const targetRole = asRole(current.role) ?? 'staff'
    if (!callerMayRevoke(actor.platformStaff, owner, targetRole)) {
        return failure('userId', ErrorCode.INVALID_INPUT, 403)
    }
    if (current.status === 'revoked') {
        return { data: toMembership(current), hasErrors: false }
    }

    try {
        const saved = await db.transaction().execute(async trx => {
            const now = new Date().toISOString()
            const next = await trx.updateTable('facility_memberships')
                .set({ status: 'revoked', revoked_date: now, updated_date: now })
                .where('id', '=', current.id)
                .returningAll()
                .executeTakeFirstOrThrow()
            await createAuditLog(trx, {
                actionType: ActionType.Update,
                objectType: ObjectType.FacilityMembership,
                updatedBy: actor.sub,
                oldValue: current,
                newValue: next
            })
            return next
        })
        return { data: toMembership(saved), hasErrors: false }
    } catch {
        return failure('revokeFacilityMember', ErrorCode.INTERNAL_SERVER_ERROR, 500)
    }
}

async function lookupUser(
    trx: Transaction<Database>,
    input: AssignFacilityMemberInput,
    platformStaff: boolean
): Promise<{
    id: string
    display_name: string | null
    profile_pic_url: string | null
    created_date: string | Date
    updated_date: string | Date | null
} | undefined> {
    const subject = isLoginSubject(input.authSubject) ? input.authSubject : null
    if (input.userId && subject) {
        const named = await trx.selectFrom('user')
            .selectAll()
            .where('id', '=', input.userId)
            .executeTakeFirst()
        if (!named) {
            return undefined
        }
        if (named.auth_subject && named.auth_subject !== subject) {
            throw new Error('auth subject does not match this user')
        }
        if (!named.auth_subject) {
            if (!callerMayAttachLogin(platformStaff)) {
                throw new Error('auth subject does not match this user')
            }
            const now = new Date().toISOString()
            return trx.updateTable('user')
                .set({ auth_subject: subject, updated_date: now })
                .where('id', '=', named.id)
                .returningAll()
                .executeTakeFirst()
        }
        return named
    }

    if (input.userId) {
        return trx.selectFrom('user').selectAll().where('id', '=', input.userId).executeTakeFirst()
    }

    if (subject) {
        return trx.selectFrom('user')
            .selectAll()
            .where('auth_subject', '=', subject)
            .executeTakeFirst()
    }

    return undefined
}

async function createUser(
    trx: Transaction<Database>,
    input: AssignFacilityMemberInput,
    actorSub: string
): Promise<{
    id: string
    display_name: string | null
    profile_pic_url: string | null
    created_date: string | Date
    updated_date: string | Date | null
} | undefined> {
    const displayName = input.displayName?.trim()
    if (!displayName) {
        return undefined
    }

    const now = new Date().toISOString()
    const created = await trx.insertInto('user')
        .values({
            display_name: displayName,
            profile_pic_url: null,
            auth_subject: isLoginSubject(input.authSubject) ? input.authSubject : null,
            updated_date: now
        })
        .returningAll()
        .executeTakeFirstOrThrow()

    await createAuditLog(trx, {
        actionType: ActionType.Create,
        objectType: ObjectType.User,
        updatedBy: actorSub,
        newValue: { id: created.id, displayName }
    })
    return created
}
