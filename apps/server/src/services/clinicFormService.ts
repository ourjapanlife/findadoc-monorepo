import { randomUUID } from 'node:crypto'
import type { ClinicBookingForm, SaveClinicBookingFormInput } from '@findadoc/graphql'
import { sql } from 'kysely'
import { canManageFacility, canReadFacility, type BookingAccess } from '../booking/access.js'
import {
    CLINIC_FORM_ID_PREFIX,
    clinicFieldToFormField,
    parseClinicFormFields,
    parseClinicFormName,
    sameClinicFields,
    storedClinicFields
} from '../booking/clinicForms.js'
import { db } from '../kyselyClient.js'
import { ErrorCode, Result } from '../result.js'
import { asJsonb } from '../../utils/dbUtils.js'

/**
 * Intake forms a clinic writes in Dashboard → Settings (#166). Members read
 * them; owners and moderators save them. A save that changes the questions
 * adds a version, so requests keep the questions their patient saw.
 */

function invalid(field: string): Result<never> {
    return {
        data: undefined as never,
        hasErrors: true,
        errors: [{ field, errorCode: ErrorCode.INVALID_INPUT, httpStatus: 400 }]
    }
}

function forbidden(field: string): Result<never> {
    return {
        data: undefined as never,
        hasErrors: true,
        errors: [{ field, errorCode: ErrorCode.FORBIDDEN, httpStatus: 403 }]
    }
}

function toClinicBookingForm(row: {
    id: string
    facility_id: string
    name: string
    version: number
    fields: unknown
    updated_date: string
}): ClinicBookingForm {
    return {
        id: row.id,
        facilityId: row.facility_id,
        name: row.name,
        version: row.version,
        fields: storedClinicFields(row.fields).map(clinicFieldToFormField),
        updatedDate: new Date(row.updated_date).toISOString()
    }
}

export async function listClinicBookingForms(facilityId: string, access: BookingAccess): Promise<ClinicBookingForm[]> {
    if (!canReadFacility(access, facilityId)) {
        return []
    }
    const rows = await db.selectFrom('booking_form_definitions as form')
        .innerJoin('booking_form_versions as saved', join => join
            .onRef('saved.form_definition_id', '=', 'form.id')
            .onRef('saved.version', '=', 'form.current_version'))
        .select(['form.id', 'form.facility_id', 'form.name', 'form.updated_date', 'saved.version', 'saved.fields'])
        .where('form.facility_id', '=', facilityId)
        .orderBy('form.created_date')
        .execute()
    return rows.map(toClinicBookingForm)
}

export async function saveClinicBookingForm(
    input: SaveClinicBookingFormInput,
    access: BookingAccess,
    actorSub?: string
): Promise<Result<ClinicBookingForm>> {
    if (!canManageFacility(access, input.facilityId)) {
        return forbidden('facilityId')
    }
    const name = parseClinicFormName(input.name)
    if (name === undefined) {
        return invalid('name')
    }
    const parsed = parseClinicFormFields(input.fields)
    if (parsed.fields === undefined) {
        return invalid(parsed.invalidField)
    }
    const fields = parsed.fields

    const facility = await db.selectFrom('facilities')
        .select('id')
        .where('id', '=', input.facilityId)
        .executeTakeFirst()
    if (facility === undefined) {
        return invalid('facilityId')
    }

    const formId = input.id?.trim() || null
    const saved = await db.transaction().execute(async transaction => {
        if (formId === null) {
            const id = `${CLINIC_FORM_ID_PREFIX}${randomUUID()}`
            await transaction.insertInto('booking_form_definitions')
                .values({ id, facility_id: input.facilityId, name, created_by: actorSub ?? null })
                .execute()
            await transaction.insertInto('booking_form_versions')
                .values({ form_definition_id: id, version: 1, fields: asJsonb(fields), created_by: actorSub ?? null })
                .execute()
            return id
        }

        // Another clinic's form reads as missing.
        const current = await transaction.selectFrom('booking_form_definitions as form')
            .innerJoin('booking_form_versions as saved', join => join
                .onRef('saved.form_definition_id', '=', 'form.id')
                .onRef('saved.version', '=', 'form.current_version'))
            .select(['form.current_version', 'saved.fields'])
            .where('form.id', '=', formId)
            .where('form.facility_id', '=', input.facilityId)
            .forUpdate('form')
            .executeTakeFirst()
        if (current === undefined) {
            return undefined
        }

        let version = current.current_version
        if (!sameClinicFields(storedClinicFields(current.fields), fields)) {
            version += 1
            await transaction.insertInto('booking_form_versions')
                .values({ form_definition_id: formId, version, fields: asJsonb(fields), created_by: actorSub ?? null })
                .execute()
        }
        await transaction.updateTable('booking_form_definitions')
            .set({ name, current_version: version, updated_date: sql`now()` })
            .where('id', '=', formId)
            .execute()
        return formId
    })
    if (saved === undefined) {
        return invalid('id')
    }

    const row = await db.selectFrom('booking_form_definitions as form')
        .innerJoin('booking_form_versions as saved', join => join
            .onRef('saved.form_definition_id', '=', 'form.id')
            .onRef('saved.version', '=', 'form.current_version'))
        .select(['form.id', 'form.facility_id', 'form.name', 'form.updated_date', 'saved.version', 'saved.fields'])
        .where('form.id', '=', saved)
        .executeTakeFirstOrThrow()
    return { data: toClinicBookingForm(row), hasErrors: false }
}
