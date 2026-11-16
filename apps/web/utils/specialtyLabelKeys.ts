import { Specialty, SpecialtyCategory } from '@findadoc/graphql'

/** i18n keys for each Specialty. A Record, so a new Specialty fails typecheck until it has a label key (#24). */
export const SPECIALTY_LABEL_KEYS: Readonly<Record<Specialty, string>> = {
    [Specialty.AllergyAndImmunology]: 'specialties.allergyAndImmunology',
    [Specialty.Anesthesiology]: 'specialties.anesthesiology',
    [Specialty.Cardiology]: 'specialties.cardiology',
    [Specialty.CosmeticSurgery]: 'specialties.cosmeticSurgery',
    [Specialty.Dentistry]: 'specialties.dentistry',
    [Specialty.Dermatology]: 'specialties.dermatology',
    [Specialty.DiagnosticRadiology]: 'specialties.diagnosticRadiology',
    [Specialty.EmergencyMedicine]: 'specialties.emergencyMedicine',
    [Specialty.EntSpecialist]: 'specialties.entSpecialist',
    [Specialty.FamilyMedicine]: 'specialties.familyMedicine',
    [Specialty.GeneralMedicine]: 'specialties.generalMedicine',
    [Specialty.InfectiousDiseases]: 'specialties.infectiousDiseases',
    [Specialty.InternalMedicine]: 'specialties.internalMedicine',
    [Specialty.MedicalGenetics]: 'specialties.medicalGenetics',
    [Specialty.Neurology]: 'specialties.neurology',
    [Specialty.NuclearMedicine]: 'specialties.nuclearMedicine',
    [Specialty.ObstetricsAndGynecology]: 'specialties.obstetricsAndGynecology',
    [Specialty.Ophthalmology]: 'specialties.ophthalmology',
    [Specialty.Optometry]: 'specialties.optometry',
    [Specialty.Orthodontics]: 'specialties.orthodontics',
    [Specialty.OrthopedicSurgery]: 'specialties.orthopedicSurgery',
    [Specialty.Otolaryngology]: 'specialties.otolaryngology',
    [Specialty.Pathology]: 'specialties.pathology',
    [Specialty.Pediatrics]: 'specialties.pediatrics',
    [Specialty.Pharmacy]: 'specialties.pharmacy',
    [Specialty.PhysicalMedicineAndRehabilitation]: 'specialties.physicalMedicineAndRehabilitation',
    [Specialty.Physiotherapy]: 'specialties.physiotherapy',
    [Specialty.PlasticSurgery]: 'specialties.plasticSurgery',
    [Specialty.PreventiveMedicine]: 'specialties.preventiveMedicine',
    [Specialty.Proctology]: 'specialties.proctology',
    [Specialty.Psychiatry]: 'specialties.psychiatry',
    [Specialty.RadiationOncology]: 'specialties.radiationOncology',
    [Specialty.SportsMedicine]: 'specialties.sportsMedicine',
    [Specialty.Surgery]: 'specialties.surgery',
    [Specialty.Traumatology]: 'specialties.traumatology',
    [Specialty.Urology]: 'specialties.urology'
}

/** i18n keys for each SpecialtyCategory, a Record for the same reason. */
export const CATEGORY_LABEL_KEYS: Readonly<Record<SpecialtyCategory, string>> = {
    [SpecialtyCategory.ChildrensHealth]: 'specialtyCategories.childrensHealth',
    [SpecialtyCategory.CosmeticAndPlasticSurgery]: 'specialtyCategories.cosmeticAndPlasticSurgery',
    [SpecialtyCategory.Dental]: 'specialtyCategories.dental',
    [SpecialtyCategory.Dermatology]: 'specialtyCategories.dermatology',
    [SpecialtyCategory.Ent]: 'specialtyCategories.ent',
    [SpecialtyCategory.EyeAndVision]: 'specialtyCategories.eyeAndVision',
    [SpecialtyCategory.MensHealth]: 'specialtyCategories.mensHealth',
    [SpecialtyCategory.MentalHealth]: 'specialtyCategories.mentalHealth',
    [SpecialtyCategory.PhysicalTherapy]: 'specialtyCategories.physicalTherapy',
    [SpecialtyCategory.PrimaryCare]: 'specialtyCategories.primaryCare',
    [SpecialtyCategory.SportsAndRehab]: 'specialtyCategories.sportsAndRehab',
    [SpecialtyCategory.WomensHealth]: 'specialtyCategories.womensHealth'
}
