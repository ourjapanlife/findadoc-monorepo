import { describe, expect, it } from 'vitest'
import { ClinicMemberRole } from '@findadoc/graphql'
import { clinicDashboardTabs, selectedClinicDashboardTab } from '~/utils/booking/clinicDashboardTabs'

const owner = { role: ClinicMemberRole.Owner, isAdmin: false }
const staff = { role: ClinicMemberRole.Staff, isAdmin: false }
const adminNotMember = { role: null, isAdmin: true }
const adminWhoIsStaff = { role: ClinicMemberRole.Staff, isAdmin: true }

describe('clinicDashboardTabs', () => {
    it('gives the owner requests, calendar, settings, and team', () => {
        expect(clinicDashboardTabs(owner)).to.deep.equal(['requests', 'calendar', 'settings', 'team'])
    })

    it('gives staff requests and calendar only', () => {
        expect(clinicDashboardTabs(staff)).to.deep.equal(['requests', 'calendar'])
    })

    it('gives an admin who is not a member the team tab alone, never a booking tab', () => {
        expect(clinicDashboardTabs(adminNotMember)).to.deep.equal(['team'])
    })

    it('gives an admin who is clinic staff the staff tabs plus team, never settings', () => {
        expect(clinicDashboardTabs(adminWhoIsStaff)).to.deep.equal(['requests', 'calendar', 'team'])
    })

    it('gives nothing before the clinic loads', () => {
        expect(clinicDashboardTabs(null)).to.deep.equal([])
    })
})

describe('selectedClinicDashboardTab', () => {
    it('opens the requested tab when the user has it', () => {
        expect(selectedClinicDashboardTab('calendar', clinicDashboardTabs(staff))).to.equal('calendar')
    })

    it('opens the team tab for an admin who asks for requests', () => {
        expect(selectedClinicDashboardTab('requests', clinicDashboardTabs(adminNotMember))).to.equal('team')
    })

    it('falls back to the first tab for a tab the user lacks or an unknown value', () => {
        expect(selectedClinicDashboardTab('settings', clinicDashboardTabs(staff))).to.equal('requests')
        expect(selectedClinicDashboardTab(['team'], clinicDashboardTabs(owner))).to.equal('requests')
    })
})
