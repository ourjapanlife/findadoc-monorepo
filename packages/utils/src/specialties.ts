import { Specialty, SpecialtyCategory } from '@findadoc/graphql'

/**
 * The specialty vocabulary the site, the API, and MCP share (#24, #277).
 *
 * Two levels, like prefecture and city: a group (`SpecialtyCategory`) and the specialties in it. A
 * professional stores specialties. A picker asks for the group first, then the specialty, so nobody
 * scans 58 options at once. The specialties follow the national list of department names
 * (医療法の標榜診療科) as the Ministry of Health's 医療情報ネット open data publishes them, and
 * `SPECIALTY_JA_ALIASES` maps those names back, so a moderator can type what a clinic's site says.
 * The web keeps its own labels in `t()`; this module holds the order, the groups, and the aliases.
 */

/**
 * The group each specialty sits under in a two-step picker: exactly one. A Record, so a new Specialty
 * fails typecheck until it has a group.
 */
export const SPECIALTY_GROUP: Readonly<Record<Specialty, SpecialtyCategory>> = {
    [Specialty.Dentistry]: SpecialtyCategory.Dental,
    [Specialty.PediatricDentistry]: SpecialtyCategory.Dental,
    [Specialty.Orthodontics]: SpecialtyCategory.Dental,
    [Specialty.OralSurgery]: SpecialtyCategory.Dental,
    [Specialty.InternalMedicine]: SpecialtyCategory.PrimaryCare,
    [Specialty.GeneralMedicine]: SpecialtyCategory.PrimaryCare,
    [Specialty.FamilyMedicine]: SpecialtyCategory.PrimaryCare,
    [Specialty.PreventiveMedicine]: SpecialtyCategory.PrimaryCare,
    [Specialty.Geriatrics]: SpecialtyCategory.PrimaryCare,
    [Specialty.KampoMedicine]: SpecialtyCategory.PrimaryCare,
    [Specialty.Pediatrics]: SpecialtyCategory.ChildrensHealth,
    [Specialty.PediatricSurgery]: SpecialtyCategory.ChildrensHealth,
    [Specialty.ObstetricsAndGynecology]: SpecialtyCategory.WomensHealth,
    [Specialty.ReproductiveMedicine]: SpecialtyCategory.WomensHealth,
    [Specialty.BreastSurgery]: SpecialtyCategory.WomensHealth,
    [Specialty.Psychiatry]: SpecialtyCategory.MentalHealth,
    [Specialty.PsychosomaticMedicine]: SpecialtyCategory.MentalHealth,
    [Specialty.ChildPsychiatry]: SpecialtyCategory.MentalHealth,
    [Specialty.Dermatology]: SpecialtyCategory.Dermatology,
    [Specialty.CosmeticDermatology]: SpecialtyCategory.Dermatology,
    [Specialty.Ophthalmology]: SpecialtyCategory.EyeAndVision,
    [Specialty.Optometry]: SpecialtyCategory.EyeAndVision,
    [Specialty.Otolaryngology]: SpecialtyCategory.Ent,
    [Specialty.EntSpecialist]: SpecialtyCategory.Ent,
    [Specialty.Gastroenterology]: SpecialtyCategory.DigestiveHealth,
    [Specialty.Hepatology]: SpecialtyCategory.DigestiveHealth,
    [Specialty.Proctology]: SpecialtyCategory.DigestiveHealth,
    [Specialty.Cardiology]: SpecialtyCategory.HeartAndCirculation,
    [Specialty.CardiovascularSurgery]: SpecialtyCategory.HeartAndCirculation,
    [Specialty.Pulmonology]: SpecialtyCategory.LungsAndBreathing,
    [Specialty.EndocrinologyAndDiabetes]: SpecialtyCategory.DiabetesHormonesAndKidneys,
    [Specialty.Nephrology]: SpecialtyCategory.DiabetesHormonesAndKidneys,
    [Specialty.AllergyAndImmunology]: SpecialtyCategory.AllergyImmunityAndInfection,
    [Specialty.Rheumatology]: SpecialtyCategory.AllergyImmunityAndInfection,
    [Specialty.InfectiousDiseases]: SpecialtyCategory.AllergyImmunityAndInfection,
    [Specialty.Neurology]: SpecialtyCategory.BrainAndNerves,
    [Specialty.Neurosurgery]: SpecialtyCategory.BrainAndNerves,
    [Specialty.OrthopedicSurgery]: SpecialtyCategory.SportsAndRehab,
    [Specialty.SportsMedicine]: SpecialtyCategory.SportsAndRehab,
    [Specialty.PhysicalMedicineAndRehabilitation]: SpecialtyCategory.SportsAndRehab,
    [Specialty.Physiotherapy]: SpecialtyCategory.SportsAndRehab,
    [Specialty.Traumatology]: SpecialtyCategory.SportsAndRehab,
    [Specialty.PainMedicine]: SpecialtyCategory.SportsAndRehab,
    [Specialty.Urology]: SpecialtyCategory.MensHealth,
    [Specialty.Surgery]: SpecialtyCategory.SurgeryAndAnesthesia,
    [Specialty.Anesthesiology]: SpecialtyCategory.SurgeryAndAnesthesia,
    [Specialty.CosmeticSurgery]: SpecialtyCategory.CosmeticAndPlasticSurgery,
    [Specialty.PlasticSurgery]: SpecialtyCategory.CosmeticAndPlasticSurgery,
    [Specialty.MedicalOncology]: SpecialtyCategory.CancerAndDiagnostics,
    [Specialty.Hematology]: SpecialtyCategory.CancerAndDiagnostics,
    [Specialty.PalliativeCare]: SpecialtyCategory.CancerAndDiagnostics,
    [Specialty.RadiationOncology]: SpecialtyCategory.CancerAndDiagnostics,
    [Specialty.DiagnosticRadiology]: SpecialtyCategory.CancerAndDiagnostics,
    [Specialty.NuclearMedicine]: SpecialtyCategory.CancerAndDiagnostics,
    [Specialty.Pathology]: SpecialtyCategory.CancerAndDiagnostics,
    [Specialty.EmergencyMedicine]: SpecialtyCategory.EmergencyCare,
    [Specialty.Pharmacy]: SpecialtyCategory.PharmacyAndGenetics,
    [Specialty.MedicalGenetics]: SpecialtyCategory.PharmacyAndGenetics
}

/**
 * Stored values a picker no longer offers. ENT_SPECIALIST and OTOLARYNGOLOGY were the same
 * department (耳鼻咽喉科); OTOLARYNGOLOGY stays, and `utils/backfillEntSpecialty.ts` moves the rest.
 */
export const HIDDEN_SPECIALTIES: ReadonlySet<Specialty> = new Set([Specialty.EntSpecialist])

/** Every SpecialtyCategory in the order pickers list them: the groups most clinics fall under first. */
export const SPECIALTY_CATEGORY_DISPLAY_ORDER: readonly SpecialtyCategory[] = [
    SpecialtyCategory.PrimaryCare,
    SpecialtyCategory.Dental,
    SpecialtyCategory.ChildrensHealth,
    SpecialtyCategory.WomensHealth,
    SpecialtyCategory.MentalHealth,
    SpecialtyCategory.Dermatology,
    SpecialtyCategory.EyeAndVision,
    SpecialtyCategory.Ent,
    SpecialtyCategory.DigestiveHealth,
    SpecialtyCategory.HeartAndCirculation,
    SpecialtyCategory.LungsAndBreathing,
    SpecialtyCategory.DiabetesHormonesAndKidneys,
    SpecialtyCategory.AllergyImmunityAndInfection,
    SpecialtyCategory.BrainAndNerves,
    SpecialtyCategory.SportsAndRehab,
    SpecialtyCategory.PhysicalTherapy,
    SpecialtyCategory.MensHealth,
    SpecialtyCategory.SurgeryAndAnesthesia,
    SpecialtyCategory.CosmeticAndPlasticSurgery,
    SpecialtyCategory.CancerAndDiagnostics,
    SpecialtyCategory.EmergencyCare,
    SpecialtyCategory.PharmacyAndGenetics
]

/**
 * Every Specialty in the order pickers list them: by group, then the most common first within it.
 * A test checks each value appears once.
 */
export const SPECIALTY_DISPLAY_ORDER: readonly Specialty[] = SPECIALTY_CATEGORY_DISPLAY_ORDER
    .flatMap(category => (Object.keys(SPECIALTY_GROUP) as Specialty[])
        .filter(code => SPECIALTY_GROUP[code] === category))

/**
 * Extra categories a specialty also counts toward in search and on the homepage tiles, beyond its
 * picker group. A child's dentist is still a dentist, and a homepage tile for children should find one.
 */
const ALSO_IN_CATEGORY: Readonly<Partial<Record<SpecialtyCategory, readonly Specialty[]>>> = {
    [SpecialtyCategory.ChildrensHealth]: [Specialty.PediatricDentistry, Specialty.ChildPsychiatry],
    [SpecialtyCategory.PhysicalTherapy]: [Specialty.Physiotherapy, Specialty.PhysicalMedicineAndRehabilitation],
    [SpecialtyCategory.CosmeticAndPlasticSurgery]: [Specialty.CosmeticDermatology]
}

/** A category's picker group first, then the extras that also count toward it. */
function membersOf(category: SpecialtyCategory): readonly Specialty[] {
    return [
        ...SPECIALTY_DISPLAY_ORDER.filter(code => SPECIALTY_GROUP[code] === category && !HIDDEN_SPECIALTIES.has(code)),
        ...(ALSO_IN_CATEGORY[category] ?? [])
    ]
}

/**
 * The specialties filed under each category: its picker group first, then the extras. Search and the
 * homepage tiles read it, so a change here changes what a category returns and needs a product owner's
 * sign-off (#277). The first specialty is the one a homepage tile links to, so order matters.
 */
export const SPECIALTY_CATEGORY_MEMBERS: Readonly<Record<SpecialtyCategory, readonly Specialty[]>> = {
    [SpecialtyCategory.PrimaryCare]: membersOf(SpecialtyCategory.PrimaryCare),
    [SpecialtyCategory.Dental]: membersOf(SpecialtyCategory.Dental),
    [SpecialtyCategory.ChildrensHealth]: membersOf(SpecialtyCategory.ChildrensHealth),
    [SpecialtyCategory.WomensHealth]: membersOf(SpecialtyCategory.WomensHealth),
    [SpecialtyCategory.MentalHealth]: membersOf(SpecialtyCategory.MentalHealth),
    [SpecialtyCategory.Dermatology]: membersOf(SpecialtyCategory.Dermatology),
    [SpecialtyCategory.EyeAndVision]: membersOf(SpecialtyCategory.EyeAndVision),
    [SpecialtyCategory.Ent]: membersOf(SpecialtyCategory.Ent),
    [SpecialtyCategory.DigestiveHealth]: membersOf(SpecialtyCategory.DigestiveHealth),
    [SpecialtyCategory.HeartAndCirculation]: membersOf(SpecialtyCategory.HeartAndCirculation),
    [SpecialtyCategory.LungsAndBreathing]: membersOf(SpecialtyCategory.LungsAndBreathing),
    [SpecialtyCategory.DiabetesHormonesAndKidneys]: membersOf(SpecialtyCategory.DiabetesHormonesAndKidneys),
    [SpecialtyCategory.AllergyImmunityAndInfection]: membersOf(SpecialtyCategory.AllergyImmunityAndInfection),
    [SpecialtyCategory.BrainAndNerves]: membersOf(SpecialtyCategory.BrainAndNerves),
    [SpecialtyCategory.SportsAndRehab]: membersOf(SpecialtyCategory.SportsAndRehab),
    [SpecialtyCategory.PhysicalTherapy]: membersOf(SpecialtyCategory.PhysicalTherapy),
    [SpecialtyCategory.MensHealth]: membersOf(SpecialtyCategory.MensHealth),
    [SpecialtyCategory.SurgeryAndAnesthesia]: membersOf(SpecialtyCategory.SurgeryAndAnesthesia),
    [SpecialtyCategory.CosmeticAndPlasticSurgery]: membersOf(SpecialtyCategory.CosmeticAndPlasticSurgery),
    [SpecialtyCategory.CancerAndDiagnostics]: membersOf(SpecialtyCategory.CancerAndDiagnostics),
    [SpecialtyCategory.EmergencyCare]: membersOf(SpecialtyCategory.EmergencyCare),
    [SpecialtyCategory.PharmacyAndGenetics]: membersOf(SpecialtyCategory.PharmacyAndGenetics)
}

/** The groups a two-step picker offers, in display order: each one holds at least one specialty. */
export const SPECIALTY_PICKER_GROUPS: readonly SpecialtyCategory[] = SPECIALTY_CATEGORY_DISPLAY_ORDER
    .filter(category => SPECIALTY_DISPLAY_ORDER
        .some(code => SPECIALTY_GROUP[code] === category && !HIDDEN_SPECIALTIES.has(code)))

/** The specialties a picker offers under one group, most common first. Hidden values are left out. */
export function specialtiesInGroup(category: SpecialtyCategory): Specialty[] {
    return SPECIALTY_DISPLAY_ORDER.filter(code => SPECIALTY_GROUP[code] === category && !HIDDEN_SPECIALTIES.has(code))
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
    [Specialty.BreastSurgery]: { nameEn: 'Breast Surgeon', nameJa: '乳腺外科' },
    [Specialty.Cardiology]: { nameEn: 'Cardiologist', nameJa: '循環器内科' },
    [Specialty.CardiovascularSurgery]: { nameEn: 'Cardiovascular Surgeon', nameJa: '心臓血管外科' },
    [Specialty.ChildPsychiatry]: { nameEn: 'Child Psychiatrist', nameJa: '児童精神科' },
    [Specialty.CosmeticDermatology]: { nameEn: 'Cosmetic Dermatologist', nameJa: '美容皮膚科' },
    [Specialty.CosmeticSurgery]: { nameEn: 'Cosmetic Surgeon', nameJa: '美容外科' },
    [Specialty.Dentistry]: { nameEn: 'Dentist', nameJa: '歯科' },
    [Specialty.Dermatology]: { nameEn: 'Dermatologist', nameJa: '皮膚科' },
    [Specialty.DiagnosticRadiology]: { nameEn: 'Radiologist', nameJa: '放射線科' },
    [Specialty.EmergencyMedicine]: { nameEn: 'Emergency Medicine', nameJa: '救急科' },
    [Specialty.EndocrinologyAndDiabetes]: { nameEn: 'Diabetes & Endocrinology', nameJa: '糖尿病・内分泌内科' },
    [Specialty.EntSpecialist]: { nameEn: 'ENT Specialist', nameJa: '耳鼻咽喉科' },
    [Specialty.FamilyMedicine]: { nameEn: 'Family Medicine', nameJa: '家庭医学' },
    [Specialty.Gastroenterology]: { nameEn: 'Gastroenterologist', nameJa: '消化器内科' },
    [Specialty.GeneralMedicine]: { nameEn: 'General Medicine', nameJa: '総合診療科・一般内科' },
    [Specialty.Geriatrics]: { nameEn: 'Geriatric Medicine', nameJa: '老年内科' },
    [Specialty.Hematology]: { nameEn: 'Hematologist', nameJa: '血液内科' },
    [Specialty.Hepatology]: { nameEn: 'Hepatologist (Liver)', nameJa: '肝臓内科' },
    [Specialty.InfectiousDiseases]: { nameEn: 'Infectious Diseases', nameJa: '感染症科' },
    [Specialty.InternalMedicine]: { nameEn: 'Internal Medicine', nameJa: '内科' },
    [Specialty.KampoMedicine]: { nameEn: 'Kampo Medicine', nameJa: '漢方内科' },
    [Specialty.MedicalGenetics]: { nameEn: 'Medical Genetics', nameJa: '遺伝子診療科' },
    [Specialty.MedicalOncology]: { nameEn: 'Medical Oncologist', nameJa: '腫瘍内科' },
    [Specialty.Nephrology]: { nameEn: 'Nephrologist (Kidneys)', nameJa: '腎臓内科' },
    [Specialty.Neurology]: { nameEn: 'Neurologist', nameJa: '脳神経内科' },
    [Specialty.Neurosurgery]: { nameEn: 'Neurosurgeon', nameJa: '脳神経外科' },
    [Specialty.NuclearMedicine]: { nameEn: 'Nuclear Medicine', nameJa: '核医学' },
    [Specialty.ObstetricsAndGynecology]: { nameEn: 'Gynecologist (Ob-Gyn)', nameJa: '産婦人科' },
    [Specialty.Ophthalmology]: { nameEn: 'Eye Surgeon (Ophthalmologist)', nameJa: '眼科・眼外科' },
    [Specialty.Optometry]: { nameEn: 'Eye Doctor (Optometrist)', nameJa: '眼科検診・眼鏡処方' },
    [Specialty.OralSurgery]: { nameEn: 'Oral Surgeon', nameJa: '歯科口腔外科' },
    [Specialty.Orthodontics]: { nameEn: 'Orthodontist', nameJa: '矯正歯科' },
    [Specialty.OrthopedicSurgery]: { nameEn: 'Orthopedic Surgeon', nameJa: '整形外科' },
    [Specialty.Otolaryngology]: { nameEn: 'ENT Specialist (Otolaryngology)', nameJa: '耳鼻咽喉科' },
    [Specialty.PainMedicine]: { nameEn: 'Pain Clinic', nameJa: 'ペインクリニック' },
    [Specialty.PalliativeCare]: { nameEn: 'Palliative Care', nameJa: '緩和ケア内科' },
    [Specialty.Pathology]: { nameEn: 'Pathologist', nameJa: '病理診断科' },
    [Specialty.PediatricDentistry]: { nameEn: 'Pediatric Dentist', nameJa: '小児歯科' },
    [Specialty.PediatricSurgery]: { nameEn: 'Pediatric Surgeon', nameJa: '小児外科' },
    [Specialty.Pediatrics]: { nameEn: 'Pediatrician', nameJa: '小児科' },
    [Specialty.Pharmacy]: { nameEn: 'Pharmacist', nameJa: '薬剤師' },
    [Specialty.PhysicalMedicineAndRehabilitation]: {
        nameEn: 'Physical Medicine & Rehabilitation',
        nameJa: 'リハビリテーション医学'
    },
    [Specialty.Physiotherapy]: { nameEn: 'Physical Therapist', nameJa: 'リハビリテーション科・理学療法' },
    [Specialty.PlasticSurgery]: { nameEn: 'Plastic Surgeon', nameJa: '形成外科' },
    [Specialty.PreventiveMedicine]: { nameEn: 'Preventive Medicine', nameJa: '予防医学' },
    [Specialty.Proctology]: { nameEn: 'Proctologist', nameJa: '肛門外科' },
    [Specialty.Psychiatry]: { nameEn: 'Psychiatrist', nameJa: '精神科' },
    [Specialty.PsychosomaticMedicine]: { nameEn: 'Psychosomatic Medicine', nameJa: '心療内科' },
    [Specialty.Pulmonology]: { nameEn: 'Pulmonologist (Lungs)', nameJa: '呼吸器内科' },
    [Specialty.RadiationOncology]: { nameEn: 'Radiation Oncologist', nameJa: '放射線治療科' },
    [Specialty.ReproductiveMedicine]: { nameEn: 'Fertility Specialist', nameJa: '生殖医療' },
    [Specialty.Rheumatology]: { nameEn: 'Rheumatologist', nameJa: 'リウマチ科' },
    [Specialty.SportsMedicine]: { nameEn: 'Sports Medicine', nameJa: 'スポーツ医学' },
    [Specialty.Surgery]: { nameEn: 'Surgery', nameJa: '外科' },
    [Specialty.Traumatology]: { nameEn: 'Traumatologist', nameJa: '外傷学' },
    [Specialty.Urology]: { nameEn: 'Urologist', nameJa: '泌尿器科' }
}

/**
 * Department names clinics and the ministry's open data use for each specialty, so a moderator who
 * types what a clinic's site says finds the right one. Names from 医療情報ネット's 診療科目名, with
 * the counts that justified each new specialty in the #277 pull request.
 */
export const SPECIALTY_JA_ALIASES: Readonly<Record<Specialty, readonly string[]>> = {
    [Specialty.AllergyAndImmunology]: ['アレルギー科', 'アレルギー疾患内科', '免疫内科'],
    [Specialty.Anesthesiology]: ['麻酔科'],
    [Specialty.BreastSurgery]: ['乳腺外科', '乳腺・内分泌外科'],
    [Specialty.Cardiology]: ['循環器内科', '循環器科', '心臓内科', '心臓血管内科'],
    [Specialty.CardiovascularSurgery]: ['心臓血管外科', '心臓外科', '血管外科'],
    [Specialty.ChildPsychiatry]: ['児童精神科', '小児精神科'],
    [Specialty.CosmeticDermatology]: ['美容皮膚科'],
    [Specialty.CosmeticSurgery]: ['美容外科'],
    [Specialty.Dentistry]: ['歯科', '一般歯科'],
    [Specialty.Dermatology]: ['皮膚科', '小児皮膚科'],
    [Specialty.DiagnosticRadiology]: ['放射線科', '放射線診断科'],
    [Specialty.EmergencyMedicine]: ['救急科', '救急外来'],
    [Specialty.EndocrinologyAndDiabetes]: [
        '糖尿病内科', '内分泌内科', '糖尿病・内分泌内科', '糖尿病・代謝内科', '代謝内科', '代謝・内分泌内科', '脂質代謝内科'
    ],
    [Specialty.EntSpecialist]: ['耳鼻咽喉科', '耳鼻いんこう科'],
    [Specialty.FamilyMedicine]: ['家庭医療', '家庭医'],
    [Specialty.Gastroenterology]: ['消化器内科', '胃腸内科', '内視鏡内科', '消化器科', '胃腸科'],
    [Specialty.GeneralMedicine]: ['総合診療科', '一般内科'],
    [Specialty.Geriatrics]: ['老年内科', '老年科'],
    [Specialty.Hematology]: ['血液内科'],
    [Specialty.Hepatology]: ['肝臓内科'],
    [Specialty.InfectiousDiseases]: ['感染症内科', '感染症科'],
    [Specialty.InternalMedicine]: ['内科'],
    [Specialty.KampoMedicine]: ['漢方内科', '漢方'],
    [Specialty.MedicalGenetics]: ['遺伝子診療科', '遺伝診療科', '臨床遺伝科'],
    [Specialty.MedicalOncology]: ['腫瘍内科'],
    [Specialty.Nephrology]: ['腎臓内科', '人工透析内科', '透析内科'],
    [Specialty.Neurology]: ['脳神経内科', '神経内科'],
    [Specialty.Neurosurgery]: ['脳神経外科'],
    [Specialty.NuclearMedicine]: ['核医学科'],
    [Specialty.ObstetricsAndGynecology]: ['産婦人科', '婦人科', '産科'],
    [Specialty.Ophthalmology]: ['眼科', '小児眼科'],
    [Specialty.Optometry]: ['眼鏡処方', '視能訓練'],
    [Specialty.OralSurgery]: ['歯科口腔外科', '口腔外科'],
    [Specialty.Orthodontics]: ['矯正歯科', '小児矯正歯科'],
    [Specialty.OrthopedicSurgery]: ['整形外科'],
    [Specialty.Otolaryngology]: ['耳鼻咽喉科', '耳鼻いんこう科', '小児耳鼻いんこう科', '頭頸部・耳鼻いんこう科'],
    [Specialty.PainMedicine]: ['ペインクリニック', 'ペインクリニック内科', 'ペインクリニック外科', '疼痛緩和内科'],
    [Specialty.PalliativeCare]: ['緩和ケア内科', '緩和ケア科'],
    [Specialty.Pathology]: ['病理診断科', '臨床検査科'],
    [Specialty.PediatricDentistry]: ['小児歯科'],
    [Specialty.PediatricSurgery]: ['小児外科'],
    [Specialty.Pediatrics]: ['小児科'],
    [Specialty.Pharmacy]: ['薬局', '薬剤科'],
    [Specialty.PhysicalMedicineAndRehabilitation]: ['リハビリテーション科'],
    [Specialty.Physiotherapy]: ['理学療法', 'リハビリテーション'],
    [Specialty.PlasticSurgery]: ['形成外科'],
    [Specialty.PreventiveMedicine]: ['予防医学', '健診', '人間ドック'],
    [Specialty.Proctology]: ['肛門外科', '肛門科', '大腸・肛門外科'],
    [Specialty.Psychiatry]: ['精神科', '神経科', '老年精神科'],
    [Specialty.PsychosomaticMedicine]: ['心療内科', '老年心療内科'],
    [Specialty.Pulmonology]: ['呼吸器内科', '呼吸器科'],
    [Specialty.RadiationOncology]: ['放射線治療科', '放射線腫瘍科'],
    [Specialty.ReproductiveMedicine]: ['生殖医療', '不妊治療', '産婦人科（生殖医療）'],
    [Specialty.Rheumatology]: ['リウマチ科', 'リウマチ内科', '膠原病内科'],
    [Specialty.SportsMedicine]: ['スポーツ医学', 'スポーツ整形外科'],
    [Specialty.Surgery]: ['外科', '消化器外科', '一般外科'],
    [Specialty.Traumatology]: ['外傷学', '外傷外科'],
    [Specialty.Urology]: ['泌尿器科', '男性泌尿器科']
}

/** Category labels, matching `specialtyCategories.*` in the web's en.json and ja.json. */
export const SPECIALTY_CATEGORY_LABELS: Readonly<Record<SpecialtyCategory, VocabularyLabels>> = {
    [SpecialtyCategory.AllergyImmunityAndInfection]: {
        nameEn: 'Allergy, Immunity, and Infection',
        nameJa: 'アレルギー・免疫・感染症'
    },
    [SpecialtyCategory.BrainAndNerves]: { nameEn: 'Brain and Nerves', nameJa: '脳・神経' },
    [SpecialtyCategory.CancerAndDiagnostics]: { nameEn: 'Cancer Care and Diagnostics', nameJa: 'がん・画像・検査' },
    [SpecialtyCategory.ChildrensHealth]: { nameEn: 'Children\'s Health', nameJa: '小児医療' },
    [SpecialtyCategory.CosmeticAndPlasticSurgery]: { nameEn: 'Cosmetic and Plastic Surgery', nameJa: '美容・形成外科' },
    [SpecialtyCategory.Dental]: { nameEn: 'Dental', nameJa: '歯科' },
    [SpecialtyCategory.Dermatology]: { nameEn: 'Dermatology', nameJa: '皮膚科' },
    [SpecialtyCategory.DiabetesHormonesAndKidneys]: {
        nameEn: 'Diabetes, Hormones, and Kidneys',
        nameJa: '糖尿病・内分泌・腎臓'
    },
    [SpecialtyCategory.DigestiveHealth]: { nameEn: 'Digestive Health', nameJa: '消化器' },
    [SpecialtyCategory.EmergencyCare]: { nameEn: 'Emergency Care', nameJa: '救急' },
    [SpecialtyCategory.Ent]: { nameEn: 'ENT (Ears, Nose, and Throat)', nameJa: '耳鼻咽喉科' },
    [SpecialtyCategory.EyeAndVision]: { nameEn: 'Eye and Vision', nameJa: '眼科・視力' },
    [SpecialtyCategory.HeartAndCirculation]: { nameEn: 'Heart and Circulation', nameJa: '心臓・循環器' },
    [SpecialtyCategory.LungsAndBreathing]: { nameEn: 'Lungs and Breathing', nameJa: '呼吸器' },
    [SpecialtyCategory.MensHealth]: { nameEn: 'Men\'s Health', nameJa: '男性医療' },
    [SpecialtyCategory.MentalHealth]: { nameEn: 'Mental Health', nameJa: 'メンタルヘルス' },
    [SpecialtyCategory.PharmacyAndGenetics]: { nameEn: 'Pharmacy and Genetics', nameJa: '薬局・遺伝' },
    [SpecialtyCategory.PhysicalTherapy]: { nameEn: 'Physical Therapy', nameJa: '理学療法' },
    [SpecialtyCategory.PrimaryCare]: { nameEn: 'Primary Care', nameJa: '一般診療' },
    [SpecialtyCategory.SportsAndRehab]: { nameEn: 'Sports and Rehab', nameJa: 'スポーツ・リハビリ' },
    [SpecialtyCategory.SurgeryAndAnesthesia]: { nameEn: 'Surgery and Anesthesia', nameJa: '外科・麻酔科' },
    [SpecialtyCategory.WomensHealth]: { nameEn: 'Women\'s Health', nameJa: '女性医療' }
}

/** The categories a specialty is filed under, in category display order. Every specialty has at least its group. */
export function categoriesOfSpecialty(code: Specialty): SpecialtyCategory[] {
    return SPECIALTY_CATEGORY_DISPLAY_ORDER.filter(category => SPECIALTY_CATEGORY_MEMBERS[category].includes(code))
}

/**
 * The specialty a Japanese department name names, or undefined when none does. Width, spaces, and
 * the full-width brackets in 産婦人科（生殖医療） are folded, so a name copied from a clinic's site matches.
 */
export function specialtyForJapaneseName(name: string): Specialty | undefined {
    const fold = (value: string) => value.normalize('NFKC').replace(/\s/g, '')
    const target = fold(name)
    if (!target) {
        return undefined
    }
    return SPECIALTY_DISPLAY_ORDER.find(code => !HIDDEN_SPECIALTIES.has(code)
        && SPECIALTY_JA_ALIASES[code].some(alias => fold(alias) === target))
}
