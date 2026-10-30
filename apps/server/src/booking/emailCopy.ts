/**
 * Booking email copy (#164).
 *
 * Patient emails use the locale the patient booked in. Clinic notices are
 * always Japanese first, then English, so every doctor can read them.
 * Times are Japan time in the reader's language, with the visit length.
 * Patient answers never go into a patient email.
 */

export const SITE_LOCALES = [
    'en-US', 'ja-JP', 'zh-CN', 'vi-VN', 'ko-KR', 'tl-PH',
    'ne-NP', 'id-ID', 'pt-BR', 'fr-FR', 'ru-RU', 'de-DE', 'it-IT'
] as const

export type SiteLocale = typeof SITE_LOCALES[number]

const DEFAULT_LOCALE: SiteLocale = 'en-US'
const JAPAN_TIME_ZONE = 'Asia/Tokyo'

export function isSiteLocale(value: string): value is SiteLocale {
    return SITE_LOCALES.some(locale => locale === value)
}

function readerLocale(value: string | null | undefined): SiteLocale {
    return typeof value === 'string' && isSiteLocale(value) ? value : DEFAULT_LOCALE
}

export type BookingEmail = {
    subject: string
    textBody: string
    htmlBody: string
}

type EmailBlock =
    | { kind: 'paragraph', text: string }
    | { kind: 'details', rows: DetailRow[] }
    | { kind: 'link', text: string, href: string }

/**
 * `fixed` marks a value the reader's Translate button must leave alone: a name,
 * an id, an address. Links are always fixed.
 */
type DetailRow = { label: string, value: string, fixed?: boolean }

type EmailSection = {
    lang: SiteLocale
    blocks: EmailBlock[]
}

type PatientCopy = {
    sentThrough: string
    clinic: string
    time: string
    length: string
    reference: string
    clinicNote: string
    japanTime: string
    receivedSubject: string
    receivedIntro: string
    manageLink: string
    confirmedSubject: string
    confirmedIntro: string
    declinedSubject: string
    declinedIntro: string
    cancelledSubject: string
    cancelledIntro: string
}

const PATIENT_COPY: Record<SiteLocale, PatientCopy> = {
    'en-US': {
        sentThrough: 'Sent through Find a Doc, Japan.',
        clinic: 'Clinic',
        time: 'Time',
        length: 'Visit length',
        reference: 'Reference',
        clinicNote: 'Note from the clinic',
        japanTime: 'Japan time',
        receivedSubject: 'We received your request',
        receivedIntro: 'Your appointment request was received. The clinic will confirm it.',
        manageLink: 'To see or cancel this request, open your private link:',
        confirmedSubject: 'Your appointment is confirmed',
        confirmedIntro: 'The clinic confirmed your appointment.',
        declinedSubject: 'Your appointment request was declined',
        declinedIntro: 'The clinic could not take this request. The time is free again; you may request another.',
        cancelledSubject: 'Your appointment was cancelled',
        cancelledIntro: 'The clinic cancelled this appointment.'
    },
    'ja-JP': {
        sentThrough: 'Find a Doc, Japanからお送りしています。',
        clinic: 'クリニック',
        time: '日時',
        length: '診察時間',
        reference: '受付番号',
        clinicNote: 'クリニックからのメッセージ',
        japanTime: '日本時間',
        receivedSubject: '予約リクエストを受け付けました',
        receivedIntro: '予約リクエストを受け付けました。確定はクリニックからの返信後です。',
        manageLink: 'このリクエストの確認・キャンセルは、こちらの非公開リンクから行えます:',
        confirmedSubject: '予約が確定しました',
        confirmedIntro: 'クリニックが予約を確定しました。',
        declinedSubject: '予約リクエストはお断りとなりました',
        declinedIntro: 'クリニックはこのリクエストをお受けできませんでした。この時間は再び空いています。別の日時をリクエストできます。',
        cancelledSubject: '予約がキャンセルされました',
        cancelledIntro: 'クリニックがこの予約をキャンセルしました。'
    },
    'zh-CN': {
        sentThrough: '本邮件由 Find a Doc, Japan 发送。',
        clinic: '诊所',
        time: '时间',
        length: '就诊时长',
        reference: '参考编号',
        clinicNote: '诊所留言',
        japanTime: '日本时间',
        receivedSubject: '我们已收到您的申请',
        receivedIntro: '您的预约申请已收到，诊所确认后才算预约成功。',
        manageLink: '如需查看或取消此申请，请打开您的专属链接：',
        confirmedSubject: '您的预约已确认',
        confirmedIntro: '诊所已确认您的预约。',
        declinedSubject: '您的预约申请已被拒绝',
        declinedIntro: '诊所无法接受此申请。该时间已重新开放，您可以申请其他时间。',
        cancelledSubject: '您的预约已取消',
        cancelledIntro: '诊所已取消此预约。'
    },
    'vi-VN': {
        sentThrough: 'Được gửi qua Find a Doc, Japan.',
        clinic: 'Phòng khám',
        time: 'Thời gian',
        length: 'Thời lượng khám',
        reference: 'Mã tham chiếu',
        clinicNote: 'Lời nhắn từ phòng khám',
        japanTime: 'giờ Nhật Bản',
        receivedSubject: 'Chúng tôi đã nhận được yêu cầu của bạn',
        receivedIntro: 'Yêu cầu đặt lịch hẹn của bạn đã được nhận. Phòng khám sẽ xác nhận.',
        manageLink: 'Để xem hoặc hủy yêu cầu này, hãy mở liên kết riêng của bạn:',
        confirmedSubject: 'Lịch hẹn của bạn đã được xác nhận',
        confirmedIntro: 'Phòng khám đã xác nhận lịch hẹn của bạn.',
        declinedSubject: 'Yêu cầu đặt lịch hẹn của bạn đã bị từ chối',
        declinedIntro: 'Phòng khám không thể nhận yêu cầu này. Khung giờ này đã trống trở lại; bạn có thể yêu cầu giờ khác.',
        cancelledSubject: 'Lịch hẹn của bạn đã bị hủy',
        cancelledIntro: 'Phòng khám đã hủy lịch hẹn này.'
    },
    'ko-KR': {
        sentThrough: 'Find a Doc, Japan을 통해 보낸 메일입니다.',
        clinic: '병원',
        time: '일시',
        length: '진료 시간',
        reference: '접수 번호',
        clinicNote: '병원 메시지',
        japanTime: '일본 시간',
        receivedSubject: '예약 요청이 접수되었습니다',
        receivedIntro: '예약 요청이 접수되었습니다. 병원에서 확정할 예정입니다.',
        manageLink: '이 요청을 확인하거나 취소하려면 개인 링크를 여세요:',
        confirmedSubject: '예약이 확정되었습니다',
        confirmedIntro: '병원에서 예약을 확정했습니다.',
        declinedSubject: '예약 요청이 거절되었습니다',
        declinedIntro: '병원에서 이 요청을 받을 수 없습니다. 해당 시간은 다시 비어 있으며, 다른 시간을 요청할 수 있습니다.',
        cancelledSubject: '예약이 취소되었습니다',
        cancelledIntro: '병원에서 이 예약을 취소했습니다.'
    },
    'tl-PH': {
        sentThrough: 'Ipinadala sa pamamagitan ng Find a Doc, Japan.',
        clinic: 'Klinika',
        time: 'Oras',
        length: 'Haba ng konsultasyon',
        reference: 'Sanggunian',
        clinicNote: 'Mensahe mula sa klinika',
        japanTime: 'oras ng Japan',
        receivedSubject: 'Natanggap namin ang iyong kahilingan',
        receivedIntro: 'Natanggap ang iyong kahilingan para sa appointment. Kukumpirmahin ito ng klinika.',
        manageLink: 'Para tingnan o kanselahin ang kahilingang ito, buksan ang iyong pribadong link:',
        confirmedSubject: 'Kumpirmado na ang iyong appointment',
        confirmedIntro: 'Kinumpirma ng klinika ang iyong appointment.',
        declinedSubject: 'Tinanggihan ang iyong kahilingan para sa appointment',
        declinedIntro: 'Hindi matanggap ng klinika ang kahilingang ito. Bakante na ulit ang oras; maaari kang humiling ng iba.',
        cancelledSubject: 'Kinansela ang iyong appointment',
        cancelledIntro: 'Kinansela ng klinika ang appointment na ito.'
    },
    'ne-NP': {
        sentThrough: 'Find a Doc, Japan मार्फत पठाइएको।',
        clinic: 'क्लिनिक',
        time: 'समय',
        length: 'जाँचको अवधि',
        reference: 'सन्दर्भ नम्बर',
        clinicNote: 'क्लिनिकबाट सन्देश',
        japanTime: 'जापानको समय',
        receivedSubject: 'तपाईंको अनुरोध प्राप्त भयो',
        receivedIntro: 'तपाईंको अपोइन्टमेन्ट अनुरोध प्राप्त भयो। क्लिनिकले यसलाई पक्का गर्नेछ।',
        manageLink: 'यो अनुरोध हेर्न वा रद्द गर्न, तपाईंको निजी लिंक खोल्नुहोस्:',
        confirmedSubject: 'तपाईंको अपोइन्टमेन्ट पक्का भयो',
        confirmedIntro: 'क्लिनिकले तपाईंको अपोइन्टमेन्ट पक्का गर्‍यो।',
        declinedSubject: 'तपाईंको अपोइन्टमेन्ट अनुरोध अस्वीकार गरियो',
        declinedIntro: 'क्लिनिकले यो अनुरोध लिन सकेन। त्यो समय फेरि खाली छ; तपाईं अर्को समयको अनुरोध गर्न सक्नुहुन्छ।',
        cancelledSubject: 'तपाईंको अपोइन्टमेन्ट रद्द गरियो',
        cancelledIntro: 'क्लिनिकले यो अपोइन्टमेन्ट रद्द गर्‍यो।'
    },
    'id-ID': {
        sentThrough: 'Dikirim melalui Find a Doc, Japan.',
        clinic: 'Klinik',
        time: 'Waktu',
        length: 'Durasi konsultasi',
        reference: 'Nomor referensi',
        clinicNote: 'Catatan dari klinik',
        japanTime: 'waktu Jepang',
        receivedSubject: 'Permintaan Anda sudah kami terima',
        receivedIntro: 'Permintaan janji temu Anda sudah diterima. Klinik akan mengonfirmasinya.',
        manageLink: 'Untuk melihat atau membatalkan permintaan ini, buka tautan pribadi Anda:',
        confirmedSubject: 'Janji temu Anda sudah dikonfirmasi',
        confirmedIntro: 'Klinik telah mengonfirmasi janji temu Anda.',
        declinedSubject: 'Permintaan janji temu Anda ditolak',
        declinedIntro: 'Klinik tidak dapat menerima permintaan ini. Waktu tersebut kembali kosong; Anda dapat mengajukan waktu lain.',
        cancelledSubject: 'Janji temu Anda dibatalkan',
        cancelledIntro: 'Klinik telah membatalkan janji temu ini.'
    },
    'pt-BR': {
        sentThrough: 'Enviado pelo Find a Doc, Japan.',
        clinic: 'Clínica',
        time: 'Horário',
        length: 'Duração da consulta',
        reference: 'Referência',
        clinicNote: 'Mensagem da clínica',
        japanTime: 'horário do Japão',
        receivedSubject: 'Recebemos seu pedido',
        receivedIntro: 'Seu pedido de consulta foi recebido. A clínica vai confirmá-lo.',
        manageLink: 'Para ver ou cancelar este pedido, abra seu link privado:',
        confirmedSubject: 'Sua consulta está confirmada',
        confirmedIntro: 'A clínica confirmou sua consulta.',
        declinedSubject: 'Seu pedido de consulta foi recusado',
        declinedIntro: 'A clínica não pôde aceitar este pedido. O horário está livre novamente; você pode pedir outro.',
        cancelledSubject: 'Sua consulta foi cancelada',
        cancelledIntro: 'A clínica cancelou esta consulta.'
    },
    'fr-FR': {
        sentThrough: 'Envoyé par Find a Doc, Japan.',
        clinic: 'Clinique',
        time: 'Date et heure',
        length: 'Durée de la visite',
        reference: 'Référence',
        clinicNote: 'Message de la clinique',
        japanTime: 'heure du Japon',
        receivedSubject: 'Nous avons reçu votre demande',
        receivedIntro: 'Votre demande de rendez-vous a bien été reçue. La clinique va la confirmer.',
        manageLink: 'Pour voir ou annuler cette demande, ouvrez votre lien privé :',
        confirmedSubject: 'Votre rendez-vous est confirmé',
        confirmedIntro: 'La clinique a confirmé votre rendez-vous.',
        declinedSubject: 'Votre demande de rendez-vous a été refusée',
        declinedIntro: 'La clinique ne peut pas accepter cette demande. Le créneau est de nouveau libre ; vous pouvez en demander un autre.',
        cancelledSubject: 'Votre rendez-vous a été annulé',
        cancelledIntro: 'La clinique a annulé ce rendez-vous.'
    },
    'ru-RU': {
        sentThrough: 'Отправлено через Find a Doc, Japan.',
        clinic: 'Клиника',
        time: 'Время',
        length: 'Длительность приёма',
        reference: 'Номер',
        clinicNote: 'Сообщение от клиники',
        japanTime: 'японское время',
        receivedSubject: 'Мы получили ваш запрос',
        receivedIntro: 'Ваш запрос на приём получен. Клиника его подтвердит.',
        manageLink: 'Чтобы посмотреть или отменить запрос, откройте вашу личную ссылку:',
        confirmedSubject: 'Ваш приём подтверждён',
        confirmedIntro: 'Клиника подтвердила ваш приём.',
        declinedSubject: 'Ваш запрос на приём отклонён',
        declinedIntro: 'Клиника не может принять этот запрос. Время снова свободно; вы можете запросить другое.',
        cancelledSubject: 'Ваш приём отменён',
        cancelledIntro: 'Клиника отменила этот приём.'
    },
    'de-DE': {
        sentThrough: 'Gesendet über Find a Doc, Japan.',
        clinic: 'Praxis',
        time: 'Termin',
        length: 'Termindauer',
        reference: 'Referenz',
        clinicNote: 'Nachricht der Praxis',
        japanTime: 'japanische Zeit',
        receivedSubject: 'Wir haben Ihre Anfrage erhalten',
        receivedIntro: 'Ihre Terminanfrage ist eingegangen. Die Praxis wird sie bestätigen.',
        manageLink: 'Um diese Anfrage anzusehen oder zu stornieren, öffnen Sie Ihren persönlichen Link:',
        confirmedSubject: 'Ihr Termin ist bestätigt',
        confirmedIntro: 'Die Praxis hat Ihren Termin bestätigt.',
        declinedSubject: 'Ihre Terminanfrage wurde abgelehnt',
        declinedIntro: 'Die Praxis kann diese Anfrage nicht annehmen. Die Zeit ist wieder frei; Sie können einen anderen Termin anfragen.',
        cancelledSubject: 'Ihr Termin wurde storniert',
        cancelledIntro: 'Die Praxis hat diesen Termin storniert.'
    },
    'it-IT': {
        sentThrough: 'Inviato tramite Find a Doc, Japan.',
        clinic: 'Clinica',
        time: 'Orario',
        length: 'Durata della visita',
        reference: 'Riferimento',
        clinicNote: 'Messaggio della clinica',
        japanTime: 'ora giapponese',
        receivedSubject: 'Abbiamo ricevuto la tua richiesta',
        receivedIntro: 'La tua richiesta di appuntamento è stata ricevuta. La clinica la confermerà.',
        manageLink: 'Per vedere o annullare questa richiesta, apri il tuo link privato:',
        confirmedSubject: 'Il tuo appuntamento è confermato',
        confirmedIntro: 'La clinica ha confermato il tuo appuntamento.',
        declinedSubject: 'La tua richiesta di appuntamento è stata rifiutata',
        declinedIntro: 'La clinica non può accettare questa richiesta. L\'orario è di nuovo libero; puoi richiederne un altro.',
        cancelledSubject: 'Il tuo appuntamento è stato annullato',
        cancelledIntro: 'La clinica ha annullato questo appuntamento.'
    }
}

type ClinicCopy = {
    clinic: string
    time: string
    length: string
    bookingId: string
    patientName: string
    patientEmail: string
    reason: string
    japanTime: string
    dashboardLink: string
    requestSubject: string
    requestIntro: string
    patientCancelledSubject: string
    patientCancelledIntro: string
}

/** Clinic notices are Japanese, then English. Neither follows the patient's locale. */
const CLINIC_LOCALES = ['ja-JP', 'en-US'] as const satisfies readonly SiteLocale[]

const CLINIC_COPY: Record<typeof CLINIC_LOCALES[number], ClinicCopy> = {
    'ja-JP': {
        clinic: 'クリニック',
        time: '日時',
        length: '診察時間',
        bookingId: '受付番号',
        patientName: '患者さんのお名前',
        patientEmail: 'メールアドレス',
        reason: 'キャンセルの理由',
        japanTime: '日本時間',
        dashboardLink: '予約ダッシュボード:',
        requestSubject: '新しい予約リクエスト',
        requestIntro: '患者さんから予約リクエストが届きました。Find a Doc, Japanの予約ダッシュボードで確定するか、お断りしてください。',
        patientCancelledSubject: '患者さんが予約をキャンセルしました',
        patientCancelledIntro: '患者さんがこの予約をキャンセルしました。カレンダーのこの時間は再び空いています。'
    },
    'en-US': {
        clinic: 'Clinic',
        time: 'Time',
        length: 'Visit length',
        bookingId: 'Booking id',
        patientName: 'Name',
        patientEmail: 'Email',
        reason: 'Reason',
        japanTime: 'Japan time',
        dashboardLink: 'Booking dashboard:',
        requestSubject: 'New appointment request',
        requestIntro: 'A patient requested an appointment. Confirm or decline it in your Find a Doc, Japan booking dashboard.',
        patientCancelledSubject: 'Appointment cancelled by the patient',
        patientCancelledIntro: 'The patient cancelled this appointment. The time is free again on your calendar.'
    }
}

/** The start in Japan time, in the reader's language, e.g. "Monday, November 2, 2026 at 9:00 AM (Japan time)". */
export function formatJapanTime(startsAt: Date, locale: SiteLocale, japanTimeLabel: string): string {
    const formatted = new Intl.DateTimeFormat(locale, {
        timeZone: JAPAN_TIME_ZONE,
        dateStyle: 'full',
        timeStyle: 'short'
    }).format(startsAt)
    return `${formatted} (${japanTimeLabel})`
}

export function formatVisitLength(minutes: number, locale: SiteLocale): string {
    return new Intl.NumberFormat(locale, { style: 'unit', unit: 'minute', unitDisplay: 'long' }).format(minutes)
}

function visitRows(
    copy: { time: string, length: string, japanTime: string },
    locale: SiteLocale,
    startsAt: Date,
    durationMinutes: number | null
): DetailRow[] {
    return [
        { label: copy.time, value: formatJapanTime(startsAt, locale, copy.japanTime) },
        ...(durationMinutes === null ? [] : [{ label: copy.length, value: formatVisitLength(durationMinutes, locale) }])
    ]
}

function blockText(block: EmailBlock): string {
    if (block.kind === 'paragraph') {
        return block.text
    }
    if (block.kind === 'details') {
        return block.rows.map(row => `${row.label}: ${row.value}`).join('\n')
    }
    return `${block.text}\n${block.href}`
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

/** Google Translate and browser translators skip these elements. */
const NO_TRANSLATE = ' translate="no" class="notranslate"'
const LABEL_STYLE = 'text-align:left;vertical-align:top;padding:4px 16px 4px 0;font-weight:600'

function blockHtml(block: EmailBlock): string {
    if (block.kind === 'paragraph') {
        return `<p style="margin:0 0 16px">${escapeHtml(block.text)}</p>`
    }
    if (block.kind === 'details') {
        const rows = block.rows.map(row =>
            '<tr>'
            + `<th scope="row" style="${LABEL_STYLE}">${escapeHtml(row.label)}</th>`
            + `<td${row.fixed === true ? NO_TRANSLATE : ''} style="padding:4px 0">${escapeHtml(row.value)}</td>`
            + '</tr>').join('')
        return `<table role="presentation" style="border-collapse:collapse;margin:0 0 16px">${rows}</table>`
    }
    return `<p style="margin:0 0 16px">${escapeHtml(block.text)}<br>`
        + `<a${NO_TRANSLATE} href="${escapeHtml(block.href)}" style="color:#1d4ed8;word-break:break-all">${escapeHtml(block.href)}</a></p>`
}

/** One content model, two parts: the HTML part says exactly what the text part says. */
function renderEmail(subject: string, sections: EmailSection[]): BookingEmail {
    const textBody = sections
        .map(section => section.blocks.map(blockText).join('\n\n'))
        .join('\n\n---\n\n')
    const body = sections
        .map(section => `<div lang="${section.lang}">${section.blocks.map(blockHtml).join('')}</div>`)
        .join('<hr style="border:0;border-top:1px solid #d1d5db;margin:24px 0">')
    const htmlBody = '<!doctype html>'
        + `<html lang="${sections[0]?.lang ?? DEFAULT_LOCALE}">`
        + '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        + `<title>${escapeHtml(subject)}</title></head>`
        + '<body style="margin:0;padding:24px 16px;background:#ffffff;color:#111827;'
        + 'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',\'Hiragino Sans\',\'Noto Sans JP\',sans-serif;'
        + 'font-size:16px;line-height:1.6">'
        + `<div style="max-width:560px;margin:0 auto">${body}</div>`
        + '</body></html>'
    return { subject, textBody, htmlBody }
}

/** The patient's receipt, with the private manage link. */
export function patientRequestEmail(input: {
    locale: string | null
    clinicName: string
    startsAt: Date
    durationMinutes: number | null
    reference: string
    manageUrl: string
}): BookingEmail {
    const locale = readerLocale(input.locale)
    const copy = PATIENT_COPY[locale]
    return renderEmail(`${copy.receivedSubject} · ${input.clinicName}`, [{
        lang: locale,
        blocks: [
            { kind: 'paragraph', text: copy.receivedIntro },
            {
                kind: 'details',
                rows: [
                    { label: copy.clinic, value: input.clinicName, fixed: true },
                    ...visitRows(copy, locale, input.startsAt, input.durationMinutes),
                    { label: copy.reference, value: input.reference, fixed: true }
                ]
            },
            { kind: 'link', text: copy.manageLink, href: input.manageUrl },
            { kind: 'paragraph', text: copy.sentThrough }
        ]
    }])
}

export type PatientNoticeStatus = 'confirmed' | 'declined' | 'cancelled'

/** Confirmed, declined, or cancelled by the clinic. A decline or cancel may carry the clinic's note. */
export function patientStatusEmail(input: {
    locale: string | null
    status: PatientNoticeStatus
    clinicName: string
    startsAt: Date
    durationMinutes: number | null
    reference: string
    clinicNote: string | null
}): BookingEmail {
    const locale = readerLocale(input.locale)
    const copy = PATIENT_COPY[locale]
    const { subject, intro } = {
        confirmed: { subject: copy.confirmedSubject, intro: copy.confirmedIntro },
        declined: { subject: copy.declinedSubject, intro: copy.declinedIntro },
        cancelled: { subject: copy.cancelledSubject, intro: copy.cancelledIntro }
    }[input.status]
    return renderEmail(`${subject} · ${input.clinicName}`, [{
        lang: locale,
        blocks: [
            { kind: 'paragraph', text: intro },
            {
                kind: 'details',
                rows: [
                    { label: copy.clinic, value: input.clinicName, fixed: true },
                    ...visitRows(copy, locale, input.startsAt, input.durationMinutes),
                    ...(input.clinicNote === null ? [] : [{ label: copy.clinicNote, value: input.clinicNote }]),
                    { label: copy.reference, value: input.reference, fixed: true }
                ]
            },
            { kind: 'paragraph', text: copy.sentThrough }
        ]
    }])
}

function clinicSubject(pick: (copy: ClinicCopy) => string, clinicName: string): string {
    return `${CLINIC_LOCALES.map(locale => pick(CLINIC_COPY[locale])).join(' / ')} · ${clinicName}`
}

/** A new request, for the clinic's members. */
export function clinicRequestEmail(input: {
    clinicName: string
    startsAt: Date
    durationMinutes: number | null
    bookingId: string
    patientName: string
    patientEmail: string
    dashboardUrl: string | null
}): BookingEmail {
    return renderEmail(clinicSubject(copy => copy.requestSubject, input.clinicName), CLINIC_LOCALES.map(locale => {
        const copy = CLINIC_COPY[locale]
        return {
            lang: locale,
            blocks: [
                { kind: 'paragraph', text: copy.requestIntro },
                {
                    kind: 'details',
                    rows: [
                        { label: copy.clinic, value: input.clinicName, fixed: true },
                        ...visitRows(copy, locale, input.startsAt, input.durationMinutes),
                        { label: copy.bookingId, value: input.bookingId, fixed: true },
                        { label: copy.patientName, value: input.patientName, fixed: true },
                        { label: copy.patientEmail, value: input.patientEmail, fixed: true }
                    ]
                },
                ...(input.dashboardUrl === null
                    ? []
                    : [{ kind: 'link' as const, text: copy.dashboardLink, href: input.dashboardUrl }])
            ]
        }
    }))
}

/** The patient cancelled from their private link. */
export function clinicPatientCancelledEmail(input: {
    clinicName: string
    startsAt: Date
    durationMinutes: number | null
    bookingId: string
    patientName: string
    reason: string | null
}): BookingEmail {
    const subject = clinicSubject(copy => copy.patientCancelledSubject, input.clinicName)
    return renderEmail(subject, CLINIC_LOCALES.map(locale => {
        const copy = CLINIC_COPY[locale]
        return {
            lang: locale,
            blocks: [
                { kind: 'paragraph', text: copy.patientCancelledIntro },
                {
                    kind: 'details',
                    rows: [
                        ...visitRows(copy, locale, input.startsAt, input.durationMinutes),
                        { label: copy.bookingId, value: input.bookingId, fixed: true },
                        { label: copy.patientName, value: input.patientName, fixed: true },
                        ...(input.reason === null ? [] : [{ label: copy.reason, value: input.reason }])
                    ]
                }
            ]
        }
    }))
}
