import { Specialty, SpecialtyCategory } from '@findadoc/graphql'

/**
 * The specialty vocabulary the site, the API, and MCP share (#24).
 * The web keeps its own labels in `t()`; this module holds the order and the category map.
 */

/** Every Specialty in the order the site's pickers list them. A test checks each value appears once. */
export const SPECIALTY_DISPLAY_ORDER: readonly Specialty[] = [
    Specialty.AllergyAndImmunology,
    Specialty.Anesthesiology,
    Specialty.Cardiology,
    Specialty.CosmeticSurgery,
    Specialty.Dentistry,
    Specialty.Dermatology,
    Specialty.DiagnosticRadiology,
    Specialty.EmergencyMedicine,
    Specialty.EntSpecialist,
    Specialty.InfectiousDiseases,
    Specialty.GeneralMedicine,
    Specialty.MedicalGenetics,
    Specialty.Neurology,
    Specialty.NuclearMedicine,
    Specialty.ObstetricsAndGynecology,
    Specialty.Ophthalmology,
    Specialty.Optometry,
    Specialty.Orthodontics,
    Specialty.OrthopedicSurgery,
    Specialty.Otolaryngology,
    Specialty.Pathology,
    Specialty.Pediatrics,
    Specialty.Pharmacy,
    Specialty.Physiotherapy,
    Specialty.PlasticSurgery,
    Specialty.PreventiveMedicine,
    Specialty.Proctology,
    Specialty.Psychiatry,
    Specialty.PhysicalMedicineAndRehabilitation,
    Specialty.RadiationOncology,
    Specialty.SportsMedicine,
    Specialty.Traumatology,
    Specialty.Urology,
    Specialty.Surgery,
    Specialty.InternalMedicine,
    Specialty.FamilyMedicine
]

/** Every SpecialtyCategory in the order the site lists them. */
export const SPECIALTY_CATEGORY_DISPLAY_ORDER: readonly SpecialtyCategory[] = [
    SpecialtyCategory.Dental,
    SpecialtyCategory.Dermatology,
    SpecialtyCategory.ChildrensHealth,
    SpecialtyCategory.WomensHealth,
    SpecialtyCategory.PrimaryCare,
    SpecialtyCategory.MentalHealth,
    SpecialtyCategory.MensHealth,
    SpecialtyCategory.PhysicalTherapy,
    SpecialtyCategory.EyeAndVision,
    SpecialtyCategory.Ent,
    SpecialtyCategory.SportsAndRehab,
    SpecialtyCategory.CosmeticAndPlasticSurgery
]

/**
 * The specialties filed under each category. Search and the homepage tiles read it, so a change here
 * changes what a category returns and needs a product owner's sign-off.
 * The first specialty is the one a homepage tile links to, so order matters.
 * A specialty may sit in more than one category. Today none does, and some sit in none.
 */
export const SPECIALTY_CATEGORY_MEMBERS: Readonly<Record<SpecialtyCategory, readonly Specialty[]>> = {
    [SpecialtyCategory.Dental]: [Specialty.Dentistry],
    [SpecialtyCategory.Dermatology]: [Specialty.Dermatology],
    [SpecialtyCategory.ChildrensHealth]: [Specialty.Pediatrics],
    [SpecialtyCategory.WomensHealth]: [Specialty.ObstetricsAndGynecology],
    [SpecialtyCategory.PrimaryCare]: [
        Specialty.InternalMedicine,
        Specialty.AllergyAndImmunology,
        Specialty.Cardiology,
        Specialty.DiagnosticRadiology,
        Specialty.EmergencyMedicine,
        Specialty.InfectiousDiseases,
        Specialty.GeneralMedicine,
        Specialty.MedicalGenetics,
        Specialty.Neurology,
        Specialty.NuclearMedicine,
        Specialty.Pathology,
        Specialty.PreventiveMedicine,
        Specialty.Otolaryngology,
        Specialty.RadiationOncology
    ],
    [SpecialtyCategory.MentalHealth]: [Specialty.Psychiatry],
    [SpecialtyCategory.PhysicalTherapy]: [Specialty.Physiotherapy],
    [SpecialtyCategory.EyeAndVision]: [Specialty.Optometry, Specialty.Ophthalmology],
    [SpecialtyCategory.Ent]: [Specialty.EntSpecialist],
    [SpecialtyCategory.MensHealth]: [Specialty.Urology],
    [SpecialtyCategory.SportsAndRehab]: [
        Specialty.SportsMedicine,
        Specialty.OrthopedicSurgery,
        Specialty.PhysicalMedicineAndRehabilitation
    ],
    [SpecialtyCategory.CosmeticAndPlasticSurgery]: [Specialty.Surgery, Specialty.Anesthesiology]
}

/** The categories a specialty is filed under, in category display order. May be empty. */
export function categoriesOfSpecialty(code: Specialty): SpecialtyCategory[] {
    return SPECIALTY_CATEGORY_DISPLAY_ORDER.filter(category => SPECIALTY_CATEGORY_MEMBERS[category].includes(code))
}
