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

/** An English and a Japanese label, like `Prefecture`. The web keeps its own `t()` keys for its other locales. */
export type VocabularyLabels = {
    readonly nameEn: string
    readonly nameJa: string
}

/**
 * The labels the API serves. They match `specialties.*` in the web's en.json and ja.json, and a web test
 * checks that. A Record, so a new Specialty fails typecheck until it has labels.
 */
export const SPECIALTY_LABELS: Readonly<Record<Specialty, VocabularyLabels>> = {
    [Specialty.AllergyAndImmunology]: { nameEn: 'Allergist', nameJa: 'アレルギー科・免疫科' },
    [Specialty.Anesthesiology]: { nameEn: 'Anesthesiologist', nameJa: '麻酔科' },
    [Specialty.Cardiology]: { nameEn: 'Cardiologist', nameJa: '循環器内科' },
    [Specialty.CosmeticSurgery]: { nameEn: 'Cosmetic Surgeon', nameJa: '美容外科' },
    [Specialty.Dentistry]: { nameEn: 'Dentist', nameJa: '歯科' },
    [Specialty.Dermatology]: { nameEn: 'Dermatologist', nameJa: '皮膚科' },
    [Specialty.DiagnosticRadiology]: { nameEn: 'Radiologist', nameJa: '放射線科' },
    [Specialty.EmergencyMedicine]: { nameEn: 'Emergency Medicine', nameJa: '救急科' },
    [Specialty.EntSpecialist]: { nameEn: 'ENT Specialist', nameJa: '耳鼻咽喉科' },
    [Specialty.FamilyMedicine]: { nameEn: 'Family Medicine', nameJa: '家庭医学' },
    [Specialty.GeneralMedicine]: { nameEn: 'General Medicine', nameJa: '総合診療科・一般内科' },
    [Specialty.InfectiousDiseases]: { nameEn: 'Infectious Diseases', nameJa: '感染症科' },
    [Specialty.InternalMedicine]: { nameEn: 'Internal Medicine', nameJa: '内科' },
    [Specialty.MedicalGenetics]: { nameEn: 'Medical Genetics', nameJa: '遺伝子診療科' },
    [Specialty.Neurology]: { nameEn: 'Neurologist', nameJa: '神経内科' },
    [Specialty.NuclearMedicine]: { nameEn: 'Nuclear Medicine', nameJa: '核医学' },
    [Specialty.ObstetricsAndGynecology]: { nameEn: 'Gynecologist (Ob-Gyn)', nameJa: '産婦人科' },
    [Specialty.Ophthalmology]: { nameEn: 'Eye Surgeon (Ophthalmologist)', nameJa: '眼科・眼外科' },
    [Specialty.Optometry]: { nameEn: 'Eye Doctor (Optometrist)', nameJa: '眼科検診・眼鏡処方' },
    [Specialty.Orthodontics]: { nameEn: 'Orthodontist', nameJa: '矯正歯科' },
    [Specialty.OrthopedicSurgery]: { nameEn: 'Orthopedic Surgeon', nameJa: '整形外科' },
    [Specialty.Otolaryngology]: { nameEn: 'Otolaryngology', nameJa: '耳鼻咽喉科' },
    [Specialty.Pathology]: { nameEn: 'Pathologist', nameJa: '病理診断科' },
    [Specialty.Pediatrics]: { nameEn: 'Pediatrician', nameJa: '小児科' },
    [Specialty.Pharmacy]: { nameEn: 'Pharmacist', nameJa: '薬剤師' },
    [Specialty.PhysicalMedicineAndRehabilitation]: {
        nameEn: 'Physical Medicine & Rehabilitation',
        nameJa: 'リハビリテーション医学'
    },
    [Specialty.Physiotherapy]: { nameEn: 'Physical Therapist', nameJa: 'リハビリテーション科・理学療法' },
    [Specialty.PlasticSurgery]: { nameEn: 'Plastic Surgeon', nameJa: '形成外科' },
    [Specialty.PreventiveMedicine]: { nameEn: 'Preventive Medicine', nameJa: '予防医学' },
    [Specialty.Proctology]: { nameEn: 'Proctologist', nameJa: '肛門科医' },
    [Specialty.Psychiatry]: { nameEn: 'Psychiatrist', nameJa: '精神科・心療内科' },
    [Specialty.RadiationOncology]: { nameEn: 'Radiation Oncologist', nameJa: '放射線腫瘍科' },
    [Specialty.SportsMedicine]: { nameEn: 'Sports Medicine', nameJa: 'スポーツ医学' },
    [Specialty.Surgery]: { nameEn: 'Surgery', nameJa: '外科' },
    [Specialty.Traumatology]: { nameEn: 'Traumatologist', nameJa: '外傷学' },
    [Specialty.Urology]: { nameEn: 'Urologist', nameJa: '泌尿器科' }
}

/** Category labels, matching `specialtyCategories.*` in the web's en.json and ja.json. */
export const SPECIALTY_CATEGORY_LABELS: Readonly<Record<SpecialtyCategory, VocabularyLabels>> = {
    [SpecialtyCategory.ChildrensHealth]: { nameEn: 'Children\'s Health', nameJa: '小児医療' },
    [SpecialtyCategory.CosmeticAndPlasticSurgery]: { nameEn: 'Cosmetic and Plastic Surgery', nameJa: '美容・形成外科' },
    [SpecialtyCategory.Dental]: { nameEn: 'Dental', nameJa: '歯科' },
    [SpecialtyCategory.Dermatology]: { nameEn: 'Dermatology', nameJa: '皮膚科' },
    [SpecialtyCategory.Ent]: { nameEn: 'ENT (Ears, Nose, and Throat)', nameJa: '耳鼻咽喉科' },
    [SpecialtyCategory.EyeAndVision]: { nameEn: 'Eye and Vision', nameJa: '眼科・視力' },
    [SpecialtyCategory.MensHealth]: { nameEn: 'Men\'s Health', nameJa: '男性医療' },
    [SpecialtyCategory.MentalHealth]: { nameEn: 'Mental Health', nameJa: 'メンタルヘルス' },
    [SpecialtyCategory.PhysicalTherapy]: { nameEn: 'Physical Therapy', nameJa: '理学療法' },
    [SpecialtyCategory.PrimaryCare]: { nameEn: 'Primary Care', nameJa: '一般診療' },
    [SpecialtyCategory.SportsAndRehab]: { nameEn: 'Sports and Rehab', nameJa: 'スポーツ・リハビリ' },
    [SpecialtyCategory.WomensHealth]: { nameEn: 'Women\'s Health', nameJa: '女性医療' }
}

/** The categories a specialty is filed under, in category display order. May be empty. */
export function categoriesOfSpecialty(code: Specialty): SpecialtyCategory[] {
    return SPECIALTY_CATEGORY_DISPLAY_ORDER.filter(category => SPECIALTY_CATEGORY_MEMBERS[category].includes(code))
}
