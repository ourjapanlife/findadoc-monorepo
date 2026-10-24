import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import request from 'supertest'
import { beforeAll, describe, expect, test } from 'vitest'
import { FacilityMembershipRole, FacilityMembershipStatus, ObjectType, type User } from '@findadoc/graphql'
import { generateRandomCreateFacilityInput } from '../src/fakeData/fakeFacilities.js'
import {
    generateRandomCreateHealthcareProfessionalInput
} from '../src/fakeData/fakeHealthcareProfessionals.js'
import { db } from '../src/kyselyClient.js'
import { ErrorCode, type Error } from '../src/result.js'
import {
    assignFacilityMember,
    revokeFacilityMember
} from '../src/services/facilityMembershipService.js'
import { gqlApiUrl } from './testSetup.test.js'

const assignMutation = `mutation test_assignFacilityMember($input: AssignFacilityMemberInput!) {
    assignFacilityMember(input: $input) {
        seatsUsed
        seatLimit
        user { id displayName createdDate updatedDate }
        membership { id facilityId userId hpId role status createdDate }
    }
}`

const revokeMutation = `mutation test_revokeFacilityMember($facilityId: ID!, $userId: ID!) {
    revokeFacilityMember(facilityId: $facilityId, userId: $userId) {
        id
        facilityId
        userId
        role
        status
    }
}`

type Actor = { sub: string, platformStaff: boolean }

const staffActor = (sub: string): Actor => ({ sub, platformStaff: true })
const ownerActor = (sub: string): Actor => ({ sub, platformStaff: false })

async function createFacility(): Promise<string> {
    const result = await request(gqlApiUrl).post('').send({
        query: 'mutation ($input: CreateFacilityInput!) { createFacility(input: $input) { id } }',
        variables: { input: generateRandomCreateFacilityInput() }
    })
    expect(result.body.errors, JSON.stringify(result.body.errors)).toBeUndefined()
    return result.body.data.createFacility.id as string
}

async function createProfessional(facilityId: string): Promise<string> {
    const result = await request(gqlApiUrl).post('').send({
        query: `mutation ($input: CreateHealthcareProfessionalInput!) {
            createHealthcareProfessional(input: $input) { id }
        }`,
        variables: {
            input: generateRandomCreateHealthcareProfessionalInput({ facilityIds: [facilityId] })
        }
    })
    expect(result.body.errors, JSON.stringify(result.body.errors)).toBeUndefined()
    return result.body.data.createHealthcareProfessional.id as string
}

async function authSubjectOf(userId: string): Promise<string | null> {
    const row = await db.selectFrom('user')
        .select('auth_subject')
        .where('id', '=', userId)
        .executeTakeFirstOrThrow()
    return row.auth_subject
}

function recorded(value: string | null): { user_id?: string, status?: string } {
    if (!value) {
        return {}
    }
    return typeof value === 'string' ? JSON.parse(value) : value
}

async function auditFor(actor: string, objectType: ObjectType) {
    return db.selectFrom('audit_logs')
        .select(['action_type', 'object_type', 'new_value', 'old_value', 'updated_by'])
        .where('updated_by', '=', actor)
        .where('object_type', '=', objectType)
        .orderBy('updated_date', 'asc')
        .execute()
}

describe('facility memberships', () => {
    let facilityId = ''
    let otherFacilityId = ''
    let professionalId = ''
    const platform = staffActor('auth0|platform-membership-test')
    const ownerSubject = 'auth0|hospital-owner-test'
    let ownerUserId = ''

    beforeAll(async () => {
        facilityId = await createFacility()
        otherFacilityId = await createFacility()
        professionalId = await createProfessional(facilityId)
    }, 30000)

    test('Find a Doc staff creates an owner, stores the login, and writes both audit rows', async () => {
        const result = await assignFacilityMember({
            facilityId,
            displayName: 'Hospital Owner',
            role: 'owner',
            authSubject: ownerSubject
        }, platform)

        expect(result.hasErrors, JSON.stringify(result.errors)).toBe(false)
        expect(result.data.seatLimit).toBe(3)
        expect(result.data.seatsUsed).toBe(1)
        expect(result.data.membership.role).toBe(FacilityMembershipRole.Owner)
        expect(result.data.membership.status).toBe(FacilityMembershipStatus.Active)
        expect(result.data.membership.hpId).toBeNull()
        ownerUserId = result.data.user.id

        expect(await authSubjectOf(ownerUserId)).toBe(ownerSubject)

        const plan = await db.selectFrom('facility_subscriptions')
            .select(['plan', 'seat_limit'])
            .where('facility_id', '=', facilityId)
            .executeTakeFirstOrThrow()
        expect(plan.plan).toBe('basic')
        expect(plan.seat_limit).toBe(3)

        const userLogs = await auditFor(platform.sub, ObjectType.User)
        const membershipLogs = await auditFor(platform.sub, ObjectType.FacilityMembership)
        expect(userLogs.some(row => row.action_type === 'CREATE')).toBe(true)
        expect(membershipLogs.some(row => row.action_type === 'CREATE')).toBe(true)
        const created = membershipLogs.find(row => row.action_type === 'CREATE')
        expect(recorded(created?.new_value ?? null).user_id).toBe(ownerUserId)
    }, 20000)

    test('the public user type does not expose the login id', async () => {
        const schemaPath = join(
            dirname(fileURLToPath(import.meta.url)),
            '../src/typeDefs/schema.graphql'
        )
        const schema = readFileSync(schemaPath, 'utf8')
        const userBlock = schema.slice(schema.indexOf('type User {'), schema.indexOf('enum FacilityMembershipRole'))
        expect(userBlock).not.toContain('authSubject')

        const queried = await request(gqlApiUrl).post('').send({
            query: 'query ($id: ID!) { user(id: $id) { id authSubject } }',
            variables: { id: ownerUserId }
        })
        expect(queried.body.errors?.[0].message).toContain('authSubject')

        const hidden: User = {
            id: ownerUserId,
            createdDate: '',
            updatedDate: '',
            displayName: 'Hospital Owner',
            profilePicUrl: null
        }
        expect(hidden).not.toHaveProperty('authSubject')
    })

    test('an anonymous request and a stranger cannot assign anyone', async () => {
        const anonymous = await assignFacilityMember({
            facilityId,
            displayName: 'Stranger',
            role: 'staff'
        }, ownerActor('Anonymous User'))
        expect(anonymous.hasErrors).toBe(true)
        expect(anonymous.errors?.[0].errorCode).toBe(ErrorCode.INVALID_INPUT)

        const stranger = await assignFacilityMember({
            facilityId,
            displayName: 'Stranger',
            role: 'staff',
            authSubject: 'auth0|stranger'
        }, ownerActor('auth0|stranger'))
        expect(stranger.hasErrors).toBe(true)
        expect(stranger.errors?.[0].field).toBe('facilityId')
    })

    test('a hospital owner adds the professional as staff and cannot add another owner', async () => {
        const staff = await assignFacilityMember({
            facilityId,
            displayName: 'Doctor Seat',
            role: 'staff',
            hpId: professionalId,
            authSubject: 'auth0|doctor-seat'
        }, ownerActor(ownerSubject))

        expect(staff.hasErrors, JSON.stringify(staff.errors)).toBe(false)
        expect(staff.data.seatsUsed).toBe(2)
        expect(staff.data.membership.role).toBe(FacilityMembershipRole.Staff)
        expect(staff.data.membership.hpId).toBe(professionalId)

        const secondOwner = await assignFacilityMember({
            facilityId,
            displayName: 'Second Owner',
            role: 'owner'
        }, ownerActor(ownerSubject))
        expect(secondOwner.hasErrors).toBe(true)
        expect(secondOwner.errors?.[0].field).toBe('role')

        const ownerRevoke = await revokeFacilityMember(facilityId, ownerUserId, ownerActor(ownerSubject))
        expect(ownerRevoke.hasErrors).toBe(true)
    })

    test('a professional who does not work at the hospital cannot take a seat', async () => {
        const elsewhere = await createProfessional(otherFacilityId)
        const result = await assignFacilityMember({
            facilityId,
            displayName: 'Wrong Hospital',
            role: 'staff',
            hpId: elsewhere
        }, platform)
        expect(result.hasErrors).toBe(true)
        expect(result.errors?.[0].field).toBe('hpId')
        expect(result.errors?.[0].errorCode).toBe(ErrorCode.INVALID_INPUT)
    })

    test('a new person needs a name, and unknown ids are rejected', async () => {
        const missingName = await assignFacilityMember({
            facilityId,
            role: 'staff'
        }, platform)
        expect(missingName.errors?.[0].errorCode).toBe(ErrorCode.REQUIRED)

        const missingFacility = await assignFacilityMember({
            facilityId: '00000000-0000-0000-0000-000000000000',
            displayName: 'Nobody',
            role: 'staff'
        }, platform)
        expect(missingFacility.errors?.[0].errorCode).toBe(ErrorCode.NOT_FOUND)

        const missingUser = await assignFacilityMember({
            facilityId,
            userId: '00000000-0000-0000-0000-000000000000',
            role: 'staff'
        }, platform)
        expect(missingUser.errors?.[0].field).toBe('userId')
        expect(missingUser.errors?.[0].errorCode).toBe(ErrorCode.NOT_FOUND)
    })

    test('a login id cannot be attached to a different account', async () => {
        const result = await assignFacilityMember({
            facilityId,
            userId: ownerUserId,
            authSubject: 'auth0|someone-else',
            role: 'staff'
        }, platform)
        expect(result.hasErrors).toBe(true)
        expect(result.errors?.[0].field).toBe('authSubject')
    })

    test('the basic plan stops at three active people and a repeat assign does not take a seat', async () => {
        const third = await assignFacilityMember({
            facilityId,
            displayName: 'Coordinator',
            role: 'staff',
            authSubject: 'auth0|coordinator'
        }, platform)
        expect(third.hasErrors, JSON.stringify(third.errors)).toBe(false)
        expect(third.data.seatsUsed).toBe(3)

        const fourth = await assignFacilityMember({
            facilityId,
            displayName: 'Fourth Person',
            role: 'staff',
            authSubject: 'auth0|fourth-person'
        }, platform)
        expect(fourth.hasErrors).toBe(true)
        expect(fourth.errors?.[0].errorCode).toBe(ErrorCode.MAX_LIMIT)
        const rejected = await db.selectFrom('user')
            .select('id')
            .where('auth_subject', '=', 'auth0|fourth-person')
            .executeTakeFirst()
        expect(rejected).toBeUndefined()

        const repeat = await assignFacilityMember({
            facilityId,
            userId: ownerUserId,
            role: 'owner'
        }, platform)
        expect(repeat.hasErrors, JSON.stringify(repeat.errors)).toBe(false)
        expect(repeat.data.seatsUsed).toBe(3)
    })

    test('the same active professional cannot hold two seats', async () => {
        const hospital = await createFacility()
        const doctor = await createProfessional(hospital)
        const first = await assignFacilityMember({
            facilityId: hospital,
            displayName: 'Doctor chart',
            role: 'staff',
            hpId: doctor
        }, platform)
        expect(first.hasErrors, JSON.stringify(first.errors)).toBe(false)

        const second = await assignFacilityMember({
            facilityId: hospital,
            displayName: 'Second chart for the same doctor',
            role: 'staff',
            hpId: doctor
        }, platform)
        expect(second.hasErrors).toBe(true)
        expect(second.errors?.[0].field).toBe('hpId')
        expect(second.errors?.[0].errorCode).toBe(ErrorCode.INVALID_INPUT)
    })

    test('revoking staff frees a seat, keeps the row, and audits the change', async () => {
        const coordinator = await db.selectFrom('user')
            .select('id')
            .where('auth_subject', '=', 'auth0|coordinator')
            .executeTakeFirstOrThrow()

        const revoked = await revokeFacilityMember(facilityId, coordinator.id, ownerActor(ownerSubject))
        expect(revoked.hasErrors, JSON.stringify(revoked.errors)).toBe(false)
        expect(revoked.data.status).toBe(FacilityMembershipStatus.Revoked)

        const row = await db.selectFrom('facility_memberships')
            .select(['status', 'revoked_date'])
            .where('facility_id', '=', facilityId)
            .where('user_id', '=', coordinator.id)
            .executeTakeFirstOrThrow()
        expect(row.status).toBe('revoked')
        expect(row.revoked_date).toBeTruthy()

        const logs = await auditFor(ownerSubject, ObjectType.FacilityMembership)
        const update = logs.at(-1)
        expect(update?.action_type).toBe('UPDATE')
        expect(recorded(update?.old_value ?? null).status).toBe('active')
        expect(recorded(update?.new_value ?? null).status).toBe('revoked')

        const again = await revokeFacilityMember(facilityId, coordinator.id, ownerActor(ownerSubject))
        expect(again.hasErrors).toBe(false)
        const logsAfter = await auditFor(ownerSubject, ObjectType.FacilityMembership)
        expect(logsAfter.length).toBe(logs.length)

        const reactivated = await assignFacilityMember({
            facilityId,
            userId: coordinator.id,
            role: 'staff'
        }, ownerActor(ownerSubject))
        expect(reactivated.hasErrors, JSON.stringify(reactivated.errors)).toBe(false)
        expect(reactivated.data.seatsUsed).toBe(3)
        expect(reactivated.data.membership.status).toBe(FacilityMembershipStatus.Active)
    })

    test('another hospital has its own three seats', async () => {
        const first = await assignFacilityMember({
            facilityId: otherFacilityId,
            displayName: 'Other hospital',
            role: 'staff'
        }, platform)
        expect(first.hasErrors, JSON.stringify(first.errors)).toBe(false)
        expect(first.data.seatsUsed).toBe(1)
        expect(first.data.seatLimit).toBe(3)
    })

    test('the database rejects a fourth active seat and any plan other than basic', async () => {
        const full = await createFacility()
        for (const name of ['One', 'Two', 'Three']) {
            const seated = await assignFacilityMember({
                facilityId: full,
                displayName: name,
                role: 'staff'
            }, platform)
            expect(seated.hasErrors, JSON.stringify(seated.errors)).toBe(false)
        }

        const extraUser = await assignFacilityMember({
            facilityId: otherFacilityId,
            displayName: 'Overflow',
            role: 'staff'
        }, platform)
        expect(extraUser.hasErrors).toBe(false)

        await expect(db.insertInto('facility_memberships').values({
            facility_id: full,
            user_id: extraUser.data.user.id,
            hp_id: null,
            role: 'staff',
            status: 'active',
            updated_date: new Date().toISOString(),
            revoked_date: null
        }).execute()).rejects.toThrow(/hospital seat limit reached/)

        await expect(db.insertInto('facility_subscriptions').values({
            facility_id: full,
            plan: 'pro',
            seat_limit: 10,
            updated_date: new Date().toISOString()
        }).execute()).rejects.toThrow(/facility_subscriptions_basic_check/)
    }, 20000)

    test('the GraphQL mutations assign and revoke through the API', async () => {
        const facility = await createFacility()
        const assigned = await request(gqlApiUrl).post('').send({
            query: assignMutation,
            variables: {
                input: {
                    facilityId: facility,
                    displayName: 'Graph Owner',
                    role: 'OWNER',
                    authSubject: 'auth0|graph-owner'
                }
            }
        })
        expect(assigned.body.errors, JSON.stringify(assigned.body.errors)).toBeUndefined()
        const payload = assigned.body.data.assignFacilityMember
        expect(payload.seatsUsed).toBe(1)
        expect(payload.seatLimit).toBe(3)
        expect(payload.membership.role).toBe('OWNER')
        expect(await authSubjectOf(payload.user.id)).toBe('auth0|graph-owner')

        const staff = await request(gqlApiUrl).post('').send({
            query: assignMutation,
            variables: {
                input: {
                    facilityId: facility,
                    displayName: 'Graph Staff',
                    role: 'STAFF'
                }
            }
        })
        expect(staff.body.errors).toBeUndefined()

        const revoked = await request(gqlApiUrl).post('').send({
            query: revokeMutation,
            variables: { facilityId: facility, userId: staff.body.data.assignFacilityMember.user.id }
        })
        expect(revoked.body.errors, JSON.stringify(revoked.body.errors)).toBeUndefined()
        expect(revoked.body.data.revokeFacilityMember.status).toBe('REVOKED')

        const blocked = await request(gqlApiUrl).post('').send({
            query: assignMutation,
            variables: {
                input: { facilityId: facility, role: 'STAFF' }
            }
        })
        const errors = blocked.body.errors[0].extensions.errors as Error[]
        expect(errors[0].errorCode).toBe(ErrorCode.REQUIRED)
    }, 20000)
})
