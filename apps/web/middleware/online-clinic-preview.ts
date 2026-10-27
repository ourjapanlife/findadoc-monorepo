import { clinicLandingGate, useClinicLandingMode } from '~/composables/useClinicLanding'

/** `/clinic/{slug}` on the main site. A missing preview cookie is a 404. */
export default defineNuxtRouteMiddleware(to => clinicLandingGate(to, useClinicLandingMode()))
