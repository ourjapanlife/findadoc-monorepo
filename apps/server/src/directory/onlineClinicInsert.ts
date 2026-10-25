/**
 * Directory row for the multilingual online clinic.
 * The landing page has no street, phone, or map point, so the facility stays unresolved.
 * Vietnamese is on that page and is not a published search facet, so it stays off this list.
 */

export const ONLINE_CLINIC_NAME_EN = 'Multilingual online clinic'
export const ONLINE_CLINIC_NAME_JA = '多言語オンラインクリニック'

export const ONLINE_CLINIC_LANGUAGES = [
    'ja_JP',
    'en_US',
    'zh_CN',
    'tl_PH',
    'fr_FR',
    'ne_NP',
    'id_ID'
] as const

export const TANAKA_PATIENT_NOTE = [
    '院長',
    '「ことばの不安」を、受診のハードルにしない。',
    '日本で体調を崩したとき、症状をうまく伝えられるか不安に感じる方は少なくありません。',
    '当院では、母語で安心して話せる環境を整え、一人ひとりの状況や背景に合わせた診療を心がけています。',
    '',
    'Clinic Director',
    'Language should never stand between you and medical care.',
    'Falling ill in Japan can be worrying, especially if you are unsure whether you can explain your symptoms clearly.',
    'That is why we offer consultations in your own language, and take the time to understand each patient’s circumstances and background.'
].join('\n')

export const TANAKA_NAMES = [
    { locale: 'ja_JP', firstName: '完', lastName: '田中' },
    { locale: 'en_US', firstName: 'Kan', lastName: 'Tanaka' }
] as const

export type PersonName = {
    locale: string
    firstName: string | null
    lastName: string | null
}

export type NamedPerson = {
    id: string
    names: readonly PersonName[]
}

export type NamedFacility = {
    id: string
    nameEn: string
    nameJa: string
}

export type FacilityLink = {
    hpsId: string
    facilityId: string
}

export type OnlineClinicPlan = {
    ayaId: string
    facilityId: string | null
    tanakaId: string | null
    linkAya: boolean
    linkTanaka: boolean
}

export function namesOf(value: unknown): PersonName[] {
    const rows = typeof value === 'string' ? JSON.parse(value) as unknown : value
    if (!Array.isArray(rows)) {
        return []
    }
    return rows.flatMap(row => {
        if (typeof row !== 'object' || row === null) {
            return []
        }
        const record = row as Record<string, unknown>
        return [{
            locale: typeof record.locale === 'string' ? record.locale : '',
            firstName: typeof record.firstName === 'string' ? record.firstName : null,
            lastName: typeof record.lastName === 'string' ? record.lastName : null
        }]
    })
}

export function hasName(
    names: readonly PersonName[],
    locale: string,
    firstName: string,
    lastName: string
): boolean {
    return names.some(name =>
        name.locale === locale
        && name.firstName === firstName
        && name.lastName === lastName)
}

export function isAyaYumino(names: readonly PersonName[]): boolean {
    return hasName(names, 'ja_JP', '綾', '弓野') && hasName(names, 'en_US', 'Aya', 'Yumino')
}

export function isKanTanaka(names: readonly PersonName[]): boolean {
    return hasName(names, 'ja_JP', '完', '田中') && hasName(names, 'en_US', 'Kan', 'Tanaka')
}

function onePerson(
    rows: readonly NamedPerson[],
    matches: (names: readonly PersonName[]) => boolean,
    missing: string,
    several: string
): { id: string } | { error: string } {
    const found = rows.filter(row => matches(row.names))
    const only = found[0]
    if (found.length === 1 && only) {
        return { id: only.id }
    }
    if (found.length === 0) {
        return { error: missing }
    }
    return { error: several }
}

export function planOnlineClinic(input: {
    aya: readonly NamedPerson[]
    tanaka: readonly NamedPerson[]
    facilities: readonly NamedFacility[]
    links: readonly FacilityLink[]
}): { ok: true, plan: OnlineClinicPlan } | { ok: false, reason: string } {
    const aya = onePerson(
        input.aya,
        isAyaYumino,
        'Aya Yumino was not found',
        'More than one Aya Yumino matched'
    )
    if ('error' in aya) {
        return { ok: false, reason: aya.error }
    }

    const japaneseTanaka = input.tanaka.filter(row => hasName(row.names, 'ja_JP', '完', '田中'))
    const tanaka = japaneseTanaka.filter(row => isKanTanaka(row.names))
    if (japaneseTanaka.length !== tanaka.length) {
        return { ok: false, reason: '田中 完 is already stored under a different English name' }
    }
    if (tanaka.length > 1) {
        return { ok: false, reason: 'More than one Kan Tanaka matched' }
    }

    if (input.facilities.length > 1) {
        return { ok: false, reason: 'More than one multilingual online clinic matched' }
    }

    const facilityId = input.facilities[0]?.id ?? null
    const tanakaId = tanaka[0]?.id ?? null
    const linked = (hpsId: string) => facilityId !== null && input.links.some(link =>
        link.facilityId === facilityId && link.hpsId === hpsId)

    return {
        ok: true,
        plan: {
            ayaId: aya.id,
            facilityId,
            tanakaId,
            linkAya: !linked(aya.id),
            linkTanaka: tanakaId === null || !linked(tanakaId)
        }
    }
}
