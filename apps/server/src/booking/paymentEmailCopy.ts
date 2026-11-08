import {
    PATIENT_COPY,
    readerLocale,
    renderEmail,
    visitRows,
    type BookingEmail,
    type DetailRow,
    type EmailBlock,
    type SiteLocale
} from './emailCopy.js'
import type { PaymentMethod } from './formDefinitions.js'
import type { BankDetails, CardInstructions } from './paymentSettings.js'

/**
 * The pending-payment email (online consult v2 §3.4). It replaces the plain receipt when a
 * visit starts as pending_payment, in the patient's form locale. It gives the clinic, time,
 * the pending notice, the fee when the clinic set one, and instructions for the chosen
 * method only.
 *
 * It names the payment method the patient chose. That is the one patient answer a patient
 * email carries: a fixed label from PAYMENT_METHODS, never free text.
 *
 * Bank details are a fixed Japanese block in every language, because the patient's bank
 * app and the clinic's passbook show them in Japanese. When a setting the method needs is
 * missing, the email says the clinic will send payment instructions.
 */

export const PAYPAY_QR_CONTENT_ID = 'paypay-qr'
const PAYPAY_QR_WIDTH = 240

type PaymentCopy = {
    pendingSubject: string
    pendingIntro: string
    paymentMethod: string
    fee: string
    methods: Record<PaymentMethod, string>
    cardLink: string
    cardSentByStaff: string
    bankIntro: string
    payPayIntro: string
    payPayAlt: string
    payPayTextOnly: string
    fallback: string
    afterPayment: string
}

const PAYMENT_COPY: Record<SiteLocale, PaymentCopy> = {
    'en-US': {
        pendingSubject: 'Payment needed to confirm your appointment',
        pendingIntro: 'Your appointment request was received. It is not confirmed yet: '
            + 'it is confirmed once the clinic receives the initial payment.',
        paymentMethod: 'Payment method',
        fee: 'Initial fee',
        methods: { creditCard: 'Credit card', bankTransfer: 'Bank transfer', payPay: 'PayPay' },
        cardLink: 'Pay by credit card at this link:',
        cardSentByStaff: 'The clinic will email you a link to pay by credit card.',
        bankIntro: 'Pay by bank transfer to this account. The details are in Japanese, as Japanese banks show them.',
        payPayIntro: 'Pay with PayPay: open the PayPay app and scan this QR code.',
        payPayAlt: 'PayPay QR code',
        payPayTextOnly: 'The QR code is in this email. If you cannot see it, open the email in an app that shows images.',
        fallback: 'The clinic will contact you with payment instructions.',
        afterPayment: 'The clinic will email you again when it confirms your appointment.'
    },
    'ja-JP': {
        pendingSubject: 'ご予約確定のためお支払いをお願いします',
        pendingIntro: '予約リクエストを受け付けました。ご予約はまだ確定していません。'
            + 'クリニックが初回のお支払いを確認した時点で確定します。',
        paymentMethod: 'お支払い方法',
        fee: '初回料金',
        methods: { creditCard: 'クレジットカード', bankTransfer: '銀行振込', payPay: 'PayPay' },
        cardLink: 'クレジットカードでのお支払いは、こちらのリンクから:',
        cardSentByStaff: 'クレジットカードでのお支払い用リンクは、クリニックからメールでお送りします。',
        bankIntro: '下記の口座へお振込みください。',
        payPayIntro: 'PayPayアプリでこのQRコードを読み取って、お支払いください。',
        payPayAlt: 'PayPayのQRコード',
        payPayTextOnly: 'QRコードはこのメールに含まれています。表示されない場合は、画像を表示できるメールアプリで開いてください。',
        fallback: 'お支払い方法は、クリニックからご案内します。',
        afterPayment: 'クリニックがご予約を確定すると、改めてメールでお知らせします。'
    },
    'zh-CN': {
        pendingSubject: '请付款以确认您的预约',
        pendingIntro: '您的预约申请已收到，但尚未确定。诊所收到首次付款后，预约即确定。',
        paymentMethod: '付款方式',
        fee: '首次费用',
        methods: { creditCard: '信用卡', bankTransfer: '银行转账', payPay: 'PayPay' },
        cardLink: '请通过此链接使用信用卡付款：',
        cardSentByStaff: '诊所会通过电子邮件向您发送信用卡付款链接。',
        bankIntro: '请转账至以下账户。账户信息为日语，与日本银行显示的一致。',
        payPayIntro: '使用 PayPay 付款：打开 PayPay 应用并扫描此二维码。',
        payPayAlt: 'PayPay 二维码',
        payPayTextOnly: '二维码在本邮件中。如果看不到，请使用可显示图片的邮件应用打开。',
        fallback: '诊所会与您联系，告知付款方式。',
        afterPayment: '诊所确认您的预约后，会再次发送电子邮件通知您。'
    },
    'vi-VN': {
        pendingSubject: 'Vui lòng thanh toán để xác nhận lịch hẹn',
        pendingIntro: 'Yêu cầu đặt lịch hẹn của bạn đã được nhận nhưng chưa được xác nhận. '
            + 'Lịch hẹn sẽ được xác nhận khi phòng khám nhận được khoản thanh toán đầu tiên.',
        paymentMethod: 'Phương thức thanh toán',
        fee: 'Phí lần đầu',
        methods: { creditCard: 'Thẻ tín dụng', bankTransfer: 'Chuyển khoản ngân hàng', payPay: 'PayPay' },
        cardLink: 'Thanh toán bằng thẻ tín dụng tại liên kết này:',
        cardSentByStaff: 'Phòng khám sẽ gửi email cho bạn liên kết để thanh toán bằng thẻ tín dụng.',
        bankIntro: 'Vui lòng chuyển khoản vào tài khoản dưới đây. '
            + 'Thông tin được ghi bằng tiếng Nhật, như ngân hàng Nhật Bản hiển thị.',
        payPayIntro: 'Thanh toán bằng PayPay: mở ứng dụng PayPay và quét mã QR này.',
        payPayAlt: 'Mã QR PayPay',
        payPayTextOnly: 'Mã QR nằm trong email này. Nếu bạn không thấy, hãy mở email bằng ứng dụng có hiển thị hình ảnh.',
        fallback: 'Phòng khám sẽ liên hệ với bạn để hướng dẫn thanh toán.',
        afterPayment: 'Phòng khám sẽ gửi email lại cho bạn khi xác nhận lịch hẹn.'
    },
    'ko-KR': {
        pendingSubject: '예약 확정을 위해 결제가 필요합니다',
        pendingIntro: '예약 요청이 접수되었습니다. 아직 확정되지 않았으며, 클리닉이 첫 결제를 확인하면 확정됩니다.',
        paymentMethod: '결제 방법',
        fee: '초진 비용',
        methods: { creditCard: '신용카드', bankTransfer: '계좌 이체', payPay: 'PayPay' },
        cardLink: '이 링크에서 신용카드로 결제하세요:',
        cardSentByStaff: '클리닉에서 신용카드 결제 링크를 이메일로 보내 드립니다.',
        bankIntro: '아래 계좌로 이체해 주세요. 계좌 정보는 일본 은행에서 표시하는 대로 일본어로 적혀 있습니다.',
        payPayIntro: 'PayPay로 결제: PayPay 앱을 열고 이 QR 코드를 스캔하세요.',
        payPayAlt: 'PayPay QR 코드',
        payPayTextOnly: 'QR 코드는 이 이메일에 들어 있습니다. 보이지 않으면 이미지를 표시하는 메일 앱에서 여세요.',
        fallback: '결제 방법은 클리닉에서 안내해 드립니다.',
        afterPayment: '클리닉이 예약을 확정하면 다시 이메일로 알려 드립니다.'
    },
    'tl-PH': {
        pendingSubject: 'Kailangan ang bayad para makumpirma ang iyong appointment',
        pendingIntro: 'Natanggap ang iyong kahilingan para sa appointment. Hindi pa ito kumpirmado: '
            + 'makukumpirma ito kapag natanggap na ng klinika ang unang bayad.',
        paymentMethod: 'Paraan ng pagbabayad',
        fee: 'Paunang singil',
        methods: { creditCard: 'Credit card', bankTransfer: 'Paglipat sa bangko', payPay: 'PayPay' },
        cardLink: 'Magbayad gamit ang credit card sa link na ito:',
        cardSentByStaff: 'Padadalhan ka ng klinika ng email na may link para magbayad gamit ang credit card.',
        bankIntro: 'Magbayad sa pamamagitan ng bank transfer sa account na ito. '
            + 'Nasa Japanese ang mga detalye, gaya ng ipinapakita ng mga bangko sa Japan.',
        payPayIntro: 'Magbayad gamit ang PayPay: buksan ang PayPay app at i-scan ang QR code na ito.',
        payPayAlt: 'QR code ng PayPay',
        payPayTextOnly: 'Nasa email na ito ang QR code. '
            + 'Kung hindi mo ito makita, buksan ang email sa app na nagpapakita ng mga larawan.',
        fallback: 'Makikipag-ugnayan sa iyo ang klinika para sa mga tagubilin sa pagbabayad.',
        afterPayment: 'Mag-e-email muli sa iyo ang klinika kapag nakumpirma na ang iyong appointment.'
    },
    'ne-NP': {
        pendingSubject: 'तपाईंको अपोइन्टमेन्ट पक्का गर्न भुक्तानी आवश्यक छ',
        pendingIntro: 'तपाईंको अपोइन्टमेन्ट अनुरोध प्राप्त भयो। यो अझै पक्का भएको छैन: '
            + 'क्लिनिकले पहिलो भुक्तानी पाएपछि यो पक्का हुन्छ।',
        paymentMethod: 'भुक्तानी विधि',
        fee: 'पहिलो शुल्क',
        methods: { creditCard: 'क्रेडिट कार्ड', bankTransfer: 'बैंक ट्रान्सफर', payPay: 'PayPay' },
        cardLink: 'यो लिङ्कबाट क्रेडिट कार्डले भुक्तानी गर्नुहोस्:',
        cardSentByStaff: 'क्लिनिकले तपाईंलाई क्रेडिट कार्डले भुक्तानी गर्ने लिङ्क इमेलमा पठाउनेछ।',
        bankIntro: 'यो खातामा बैंक ट्रान्सफरमार्फत भुक्तानी गर्नुहोस्। '
            + 'विवरण जापानी भाषामा छ, जापानका बैंकहरूले देखाउने जस्तै।',
        payPayIntro: 'PayPay बाट भुक्तानी: PayPay एप खोल्नुहोस् र यो QR कोड स्क्यान गर्नुहोस्।',
        payPayAlt: 'PayPay QR कोड',
        payPayTextOnly: 'QR कोड यही इमेलमा छ। देखिएन भने, तस्बिर देखाउने इमेल एपमा खोल्नुहोस्।',
        fallback: 'भुक्तानी निर्देशनका लागि क्लिनिकले तपाईंलाई सम्पर्क गर्नेछ।',
        afterPayment: 'क्लिनिकले तपाईंको अपोइन्टमेन्ट पक्का गरेपछि फेरि इमेल पठाउनेछ।'
    },
    'id-ID': {
        pendingSubject: 'Pembayaran diperlukan untuk mengonfirmasi janji temu Anda',
        pendingIntro: 'Permintaan janji temu Anda telah diterima. Janji temu belum dikonfirmasi: '
            + 'janji temu dikonfirmasi setelah klinik menerima pembayaran awal.',
        paymentMethod: 'Metode pembayaran',
        fee: 'Biaya awal',
        methods: { creditCard: 'Kartu kredit', bankTransfer: 'Transfer bank', payPay: 'PayPay' },
        cardLink: 'Bayar dengan kartu kredit melalui tautan ini:',
        cardSentByStaff: 'Klinik akan mengirimkan tautan pembayaran kartu kredit melalui email.',
        bankIntro: 'Bayar dengan transfer bank ke rekening ini. '
            + 'Detailnya dalam bahasa Jepang, seperti yang ditampilkan bank di Jepang.',
        payPayIntro: 'Bayar dengan PayPay: buka aplikasi PayPay dan pindai kode QR ini.',
        payPayAlt: 'Kode QR PayPay',
        payPayTextOnly: 'Kode QR ada di email ini. Jika tidak terlihat, buka email di aplikasi yang menampilkan gambar.',
        fallback: 'Klinik akan menghubungi Anda dengan petunjuk pembayaran.',
        afterPayment: 'Klinik akan mengirim email lagi setelah mengonfirmasi janji temu Anda.'
    },
    'pt-BR': {
        pendingSubject: 'Pagamento necessário para confirmar sua consulta',
        pendingIntro: 'Recebemos seu pedido de consulta. Ele ainda não está confirmado: '
            + 'será confirmado quando a clínica receber o pagamento inicial.',
        paymentMethod: 'Forma de pagamento',
        fee: 'Taxa inicial',
        methods: { creditCard: 'Cartão de crédito', bankTransfer: 'Transferência bancária', payPay: 'PayPay' },
        cardLink: 'Pague com cartão de crédito neste link:',
        cardSentByStaff: 'A clínica enviará por e-mail um link para pagamento com cartão de crédito.',
        bankIntro: 'Pague por transferência bancária para esta conta. '
            + 'Os dados estão em japonês, como os bancos japoneses os mostram.',
        payPayIntro: 'Pague com PayPay: abra o aplicativo PayPay e escaneie este QR code.',
        payPayAlt: 'QR code do PayPay',
        payPayTextOnly: 'O QR code está neste e-mail. '
            + 'Se não conseguir vê-lo, abra o e-mail em um aplicativo que mostre imagens.',
        fallback: 'A clínica entrará em contato com as instruções de pagamento.',
        afterPayment: 'A clínica enviará outro e-mail quando confirmar sua consulta.'
    },
    'fr-FR': {
        pendingSubject: 'Paiement requis pour confirmer votre rendez-vous',
        pendingIntro: 'Votre demande de rendez-vous a bien été reçue. Elle n\'est pas encore confirmée : '
            + 'elle le sera dès que la clinique aura reçu le paiement initial.',
        paymentMethod: 'Moyen de paiement',
        fee: 'Frais initiaux',
        methods: { creditCard: 'Carte bancaire', bankTransfer: 'Virement bancaire', payPay: 'PayPay' },
        cardLink: 'Payez par carte bancaire via ce lien :',
        cardSentByStaff: 'La clinique vous enverra par e-mail un lien pour payer par carte bancaire.',
        bankIntro: 'Payez par virement sur ce compte. '
            + 'Les coordonnées sont en japonais, telles que les banques japonaises les affichent.',
        payPayIntro: 'Payez avec PayPay : ouvrez l\'application PayPay et scannez ce QR code.',
        payPayAlt: 'QR code PayPay',
        payPayTextOnly: 'Le QR code se trouve dans cet e-mail. '
            + 'Si vous ne le voyez pas, ouvrez l\'e-mail dans une application qui affiche les images.',
        fallback: 'La clinique vous contactera pour vous indiquer comment payer.',
        afterPayment: 'La clinique vous enverra un nouvel e-mail lorsqu\'elle confirmera votre rendez-vous.'
    },
    'ru-RU': {
        pendingSubject: 'Для подтверждения записи нужна оплата',
        pendingIntro: 'Ваша заявка на приём получена. Запись ещё не подтверждена: '
            + 'она будет подтверждена, когда клиника получит первый платёж.',
        paymentMethod: 'Способ оплаты',
        fee: 'Первоначальный платёж',
        methods: { creditCard: 'Банковская карта', bankTransfer: 'Банковский перевод', payPay: 'PayPay' },
        cardLink: 'Оплатите банковской картой по этой ссылке:',
        cardSentByStaff: 'Клиника пришлёт вам по электронной почте ссылку для оплаты картой.',
        bankIntro: 'Оплатите банковским переводом на этот счёт. '
            + 'Реквизиты указаны на японском, как их показывают японские банки.',
        payPayIntro: 'Оплата через PayPay: откройте приложение PayPay и отсканируйте этот QR-код.',
        payPayAlt: 'QR-код PayPay',
        payPayTextOnly: 'QR-код находится в этом письме. '
            + 'Если вы его не видите, откройте письмо в приложении, которое показывает изображения.',
        fallback: 'Клиника свяжется с вами и сообщит, как оплатить.',
        afterPayment: 'Клиника снова напишет вам, когда подтвердит запись.'
    },
    'de-DE': {
        pendingSubject: 'Zahlung erforderlich, um Ihren Termin zu bestätigen',
        pendingIntro: 'Ihre Terminanfrage ist eingegangen. Sie ist noch nicht bestätigt: '
            + 'Sie wird bestätigt, sobald die Klinik die erste Zahlung erhalten hat.',
        paymentMethod: 'Zahlungsart',
        fee: 'Anfangsgebühr',
        methods: { creditCard: 'Kreditkarte', bankTransfer: 'Banküberweisung', payPay: 'PayPay' },
        cardLink: 'Zahlen Sie per Kreditkarte über diesen Link:',
        cardSentByStaff: 'Die Klinik schickt Ihnen per E-Mail einen Link zur Zahlung per Kreditkarte.',
        bankIntro: 'Zahlen Sie per Überweisung auf dieses Konto. '
            + 'Die Angaben sind auf Japanisch, so wie japanische Banken sie anzeigen.',
        payPayIntro: 'Mit PayPay zahlen: Öffnen Sie die PayPay-App und scannen Sie diesen QR-Code.',
        payPayAlt: 'PayPay-QR-Code',
        payPayTextOnly: 'Der QR-Code ist in dieser E-Mail enthalten. '
            + 'Wenn Sie ihn nicht sehen, öffnen Sie die E-Mail in einer App, die Bilder anzeigt.',
        fallback: 'Die Klinik meldet sich bei Ihnen mit den Zahlungsinformationen.',
        afterPayment: 'Die Klinik schreibt Ihnen erneut, sobald sie Ihren Termin bestätigt.'
    },
    'it-IT': {
        pendingSubject: 'Pagamento necessario per confermare il tuo appuntamento',
        pendingIntro: 'La tua richiesta di appuntamento è stata ricevuta. Non è ancora confermata: '
            + 'sarà confermata quando la clinica riceverà il pagamento iniziale.',
        paymentMethod: 'Metodo di pagamento',
        fee: 'Quota iniziale',
        methods: { creditCard: 'Carta di credito', bankTransfer: 'Bonifico bancario', payPay: 'PayPay' },
        cardLink: 'Paga con carta di credito a questo link:',
        cardSentByStaff: 'La clinica ti invierà via email un link per pagare con carta di credito.',
        bankIntro: 'Paga con bonifico su questo conto. I dati sono in giapponese, come li mostrano le banche giapponesi.',
        payPayIntro: 'Paga con PayPay: apri l\'app PayPay e scansiona questo codice QR.',
        payPayAlt: 'Codice QR PayPay',
        payPayTextOnly: 'Il codice QR è in questa email. Se non lo vedi, apri l\'email in un\'app che mostra le immagini.',
        fallback: 'La clinica ti contatterà con le istruzioni per il pagamento.',
        afterPayment: 'La clinica ti scriverà di nuovo quando confermerà il tuo appuntamento.'
    }
}

/** Japanese bank labels. They stay Japanese in every email language. */
const BANK_LABELS_JA = {
    bankName: '銀行名',
    bankBranch: '支店名',
    accountType: '口座種別',
    accountNumber: '口座番号',
    accountHolder: '口座名義'
} as const

const ACCOUNT_TYPE_JA = { ordinary: '普通', checking: '当座' } as const

/** The fee in yen in the reader's language, such as "¥5,000" or "￥5,000". */
export function formatFeeJpy(feeJpy: number, locale: SiteLocale): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'JPY' }).format(feeJpy)
}

/**
 * What the email can say for the chosen method. Each part is null when the clinic has not set
 * what the method needs; the method itself is null when the answer was not a known method.
 */
export type PaymentEmailInstructions = {
    method: PaymentMethod | null
    feeJpy: number | null
    card: CardInstructions | null
    bank: BankDetails | null
    /** True when a QR image goes with the email as the PAYPAY_QR_CONTENT_ID inline part. */
    payPayQr: boolean
}

function bankRows(bank: BankDetails): DetailRow[] {
    return [
        { label: BANK_LABELS_JA.bankName, value: bank.bankName, fixed: true },
        { label: BANK_LABELS_JA.bankBranch, value: bank.bankBranch, fixed: true },
        { label: BANK_LABELS_JA.accountType, value: ACCOUNT_TYPE_JA[bank.accountType], fixed: true },
        { label: BANK_LABELS_JA.accountNumber, value: bank.accountNumber, fixed: true },
        { label: BANK_LABELS_JA.accountHolder, value: bank.accountHolder, fixed: true }
    ]
}

function cardBlocks(copy: PaymentCopy, card: CardInstructions): EmailBlock[] {
    return card.mode === 'fixed_link'
        ? [{ kind: 'link', text: copy.cardLink, href: card.url }]
        : [{ kind: 'paragraph', text: copy.cardSentByStaff }]
}

/** Instructions for the chosen method only, or the fallback when its setting is missing. */
function methodBlocks(copy: PaymentCopy, instructions: PaymentEmailInstructions): EmailBlock[] {
    const fallback: EmailBlock[] = [{ kind: 'paragraph', text: copy.fallback }]
    if (instructions.method === 'creditCard') {
        return instructions.card === null ? fallback : cardBlocks(copy, instructions.card)
    }
    if (instructions.method === 'bankTransfer') {
        return instructions.bank === null
            ? fallback
            : [
                { kind: 'paragraph', text: copy.bankIntro },
                { kind: 'details', lang: 'ja-JP', rows: bankRows(instructions.bank) }
            ]
    }
    if (instructions.method === 'payPay' && instructions.payPayQr) {
        return [
            { kind: 'paragraph', text: copy.payPayIntro },
            {
                kind: 'image',
                contentId: PAYPAY_QR_CONTENT_ID,
                alt: copy.payPayAlt,
                textFallback: copy.payPayTextOnly,
                width: PAYPAY_QR_WIDTH
            }
        ]
    }
    return fallback
}

/** The patient's pending-payment email, with the private manage link. The caller adds the QR part. */
export function patientPendingPaymentEmail(input: {
    locale: string | null
    clinicName: string
    startsAt: Date
    durationMinutes: number | null
    reference: string
    manageUrl: string
    instructions: PaymentEmailInstructions
}): BookingEmail {
    const locale = readerLocale(input.locale)
    const copy = PATIENT_COPY[locale]
    const payment = PAYMENT_COPY[locale]
    const { method, feeJpy } = input.instructions
    return renderEmail(`${payment.pendingSubject} · ${input.clinicName}`, [{
        lang: locale,
        blocks: [
            { kind: 'paragraph', text: payment.pendingIntro },
            {
                kind: 'details',
                rows: [
                    { label: copy.clinic, value: input.clinicName, fixed: true },
                    ...visitRows(copy, locale, input.startsAt, input.durationMinutes),
                    ...(method === null ? [] : [{ label: payment.paymentMethod, value: payment.methods[method] }]),
                    ...(feeJpy === null
                        ? []
                        : [{ label: payment.fee, value: formatFeeJpy(feeJpy, locale), fixed: true }]),
                    { label: copy.reference, value: input.reference, fixed: true }
                ]
            },
            ...methodBlocks(payment, input.instructions),
            { kind: 'paragraph', text: payment.afterPayment },
            { kind: 'link', text: copy.manageLink, href: input.manageUrl },
            { kind: 'paragraph', text: copy.sentThrough }
        ]
    }])
}
