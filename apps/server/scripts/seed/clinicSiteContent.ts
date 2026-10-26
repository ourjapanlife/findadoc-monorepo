/**
 * Page copy for hosted clinics. Another clinic is another entry in `clinicSiteSeeds`.
 * English is the fallback the site uses when a locale has no row yet.
 * Spoken-language codes here (ne, id) are clinic languages, not site UI locales.
 */

import {
    FacilitySource,
    FacilityVerificationStatus,
    Locale
} from '@findadoc/graphql'
import type { FacilitySeed } from './schema.js'

/** Stable id. Accounts and a future CRM attach to this, not to a directory facility. */
export const SHOWCASE_CLINIC_SITE_ID = 'a303a8ac-31c9-45d8-96d1-cf6630aa11bd'

/** Directory listing created for this page. The row stays unresolved: the page has no municipality. */
export const SHOWCASE_FACILITY_ID = 'c32c316a-a368-499b-abaf-c5c973cb67e5'

const SHOWCASE_SEEDED_AT = '2026-10-26T00:00:00.000Z'

export const showcaseClinicFacility: FacilitySeed = {
    id: SHOWCASE_FACILITY_ID,
    code: null,
    name_en: 'Multilingual online clinic',
    name_ja: '多言語オンラインクリニック',
    contact: {
        email: null,
        phone: '000-0000-0000',
        website: null,
        googleMapsUrl: 'https://www.google.com/maps',
        address: {
            postalCode: '',
            prefectureEn: '',
            prefectureJa: '',
            cityEn: '',
            cityJa: '',
            addressLine1En: '',
            addressLine1Ja: '',
            addressLine2En: '',
            addressLine2Ja: ''
        }
    },
    map_latitude: 0,
    map_longitude: 0,
    created_date: SHOWCASE_SEEDED_AT,
    updated_date: SHOWCASE_SEEDED_AT,
    firestore_id: null,
    payment_options: [],
    city_id: null,
    google_place_id: null,
    source: FacilitySource.Manual,
    verification_status: FacilityVerificationStatus.UnverifiedLocation,
    supported_languages: [
        Locale.JaJp,
        Locale.EnUs,
        Locale.ZhCn,
        Locale.TlPh,
        Locale.FrFr,
        Locale.NeNp,
        Locale.IdId
    ]
}

export type ClinicLandingLanguage = {
    code: string
    native: string
    bcp47: string
}

export type ClinicLandingDoctor = {
    nameJa: string
    nameEn: string
    image: string
    position: string
}

export type ClinicLandingCopy = {
    name: string
    description: string
    book: string
    seeFees: string
    sectionNavLabel: string
    heroBadge: string
    heroTitleBefore: string
    heroTitleHighlight: string
    heroLead: string
    heroNote: string
    heroAlt: string
    badgeTitle: string
    badgeDetail: string
    highlights: readonly string[]
    aboutEyebrow: string
    aboutTitle: string
    about: readonly string[]
    navDoctors: string
    navCases: string
    navFees: string
    navFlow: string
    doctorsEyebrow: string
    doctorsTitle: string
    doctorCopy: ReadonlyArray<{
        role: string
        tag: string
        paragraphs: readonly string[]
        alt: string
    }>
    casesEyebrow: string
    casesTitle: string
    casesLead: string
    cases: ReadonlyArray<{ title: string, detail: string }>
    noticeEyebrow: string
    noticeTitle: string
    noticeLead: string
    notices: ReadonlyArray<{ title: string, detail: string, feesLink?: boolean }>
    feesLink: string
    feesEyebrow: string
    feesTitle: string
    feesLead: string
    rangeLabel: string
    plans: ReadonlyArray<{ amount: string, note: string }>
    includedLabel: string
    fees: readonly string[]
    referralNote: string
    flowEyebrow: string
    flowTitle: string
    steps: ReadonlyArray<{ title: string, detail: string }>
    bookEyebrow: string
    bookTitle: string
    bookLead: string
    bookNote: string
    ctaTitle: string
    ctaLead: string
    ctaButton: string
    emergency: string
}

const HERO = '/clinic-landings/multilingual-online-clinic/hero.jpg'

const DOCTORS: readonly ClinicLandingDoctor[] = [
    {
        nameJa: '田中 完',
        nameEn: 'TANAKA Kan',
        image: '/clinic-landings/multilingual-online-clinic/tanaka.jpg',
        position: 'center 22%'
    },
    {
        nameJa: '弓野 綾',
        nameEn: 'YUMINO Aya',
        image: '/clinic-landings/multilingual-online-clinic/yumino.jpg',
        position: 'center 30%'
    }
]

const LANGUAGES: readonly ClinicLandingLanguage[] = [
    { code: 'ja', native: '日本語', bcp47: 'ja' },
    { code: 'en', native: 'English', bcp47: 'en' },
    { code: 'zh', native: '中文', bcp47: 'zh' },
    { code: 'vi', native: 'Tiếng Việt', bcp47: 'vi' },
    { code: 'tl', native: 'Tagalog', bcp47: 'tl' },
    { code: 'fr', native: 'Français', bcp47: 'fr' },
    { code: 'ne', native: 'नेपाली', bcp47: 'ne' },
    { code: 'id', native: 'Bahasa Indonesia', bcp47: 'id' }
]

const en: ClinicLandingCopy = {
    name: 'Multilingual online clinic',
    description: 'An online clinic for foreign residents of Japan. Consultations in eight languages. You can be seen without a credit card.',
    book: 'Book',
    seeFees: 'See fees',
    sectionNavLabel: 'On this page',
    heroBadge: 'Online consultations in 8 languages',
    heroTitleBefore: 'Healthcare in Japan, ',
    heroTitleHighlight: 'in the language you speak.',
    heroLead: 'An online clinic for foreign residents of Japan. You can see a doctor even without a credit card.',
    heroNote: 'By appointment only. Consultations are not free.',
    heroAlt: 'A patient holding a smartphone during an online consultation, with a smiling doctor waving on screen.',
    badgeTitle: 'No credit card needed',
    badgeDetail: 'Ask us about payment options',
    highlights: ['Available in 8 languages', 'No credit card required', 'See a doctor from home'],
    aboutEyebrow: 'About us',
    aboutTitle: 'About this multilingual online clinic',
    about: [
        'This clinic supports foreign residents in Japan. You can use it even if you do not have a credit card.',
        'This page is a short overview before you book. Questions can wait for the appointment itself.'
    ],
    navDoctors: 'Doctors',
    navCases: 'Conditions',
    navFees: 'Fees',
    navFlow: 'How it works',
    doctorsEyebrow: 'Our doctors',
    doctorsTitle: 'A message from our doctors',
    doctorCopy: [
        {
            role: 'Clinic Director',
            tag: 'Language should never stand between you and medical care.',
            paragraphs: [
                'Falling ill in Japan can be worrying, especially if you are unsure whether you can explain your symptoms clearly.',
                'That is why we offer consultations in your own language, and take the time to understand each patient’s circumstances and background.'
            ],
            alt: 'Photo of Dr. Kan Tanaka, Clinic Director'
        },
        {
            role: 'Physician',
            tag: 'A place where no concern is too small to ask about.',
            paragraphs: [
                'If you are unsure whether a symptom is serious enough to see a doctor, that is exactly the right time to talk to us.',
                'We respect differences in lifestyle and culture, and make sure every patient understands their care and feels comfortable with it.'
            ],
            alt: 'Photo of Dr. Aya Yumino, Physician'
        }
    ],
    casesEyebrow: 'Conditions',
    casesTitle: 'Common conditions',
    casesLead: 'Some of the symptoms people most often consult us about online.',
    cases: [
        { title: 'Common cold', detail: 'Fever, sore throat, runny nose, cough' },
        { title: 'Influenza', detail: 'Sudden high fever, aching joints, whole-body fatigue' },
        { title: 'Asthma', detail: 'Coughing, shortness of breath, wheezing' },
        { title: 'Mental health', detail: 'Insomnia, anxiety, low mood' },
        { title: 'Stomach pain', detail: 'Stomach ache, diarrhea, nausea' }
    ],
    noticeEyebrow: 'Before you book',
    noticeTitle: 'Please read before booking',
    noticeLead: 'Four things to know before your first appointment.',
    notices: [
        { title: 'By appointment only', detail: 'The clinic sees patients by appointment only.' },
        { title: 'Consultation fees apply', detail: 'This is not a free consultation service.', feesLink: true },
        { title: 'Additional costs may apply', detail: 'After your consultation there may be further costs, such as medication or a referral letter.' },
        { title: 'Supported languages', detail: 'Japanese, English, Chinese, Vietnamese, Tagalog, French, Nepali and Indonesian' }
    ],
    feesLink: 'See the fee guide',
    feesEyebrow: 'Fees',
    feesTitle: 'Fee guide',
    feesLead: 'These are estimates. Actual costs may vary depending on your consultation.',
    rangeLabel: 'Fee guide',
    plans: [
        { amount: 'From ¥1,500', note: 'Without medication' },
        { amount: 'From ¥2,600', note: 'With medication' }
    ],
    includedLabel: 'What the fee can include',
    fees: ['Initial consultation', 'System fee', 'Medication', 'Medication shipping'],
    referralNote: 'Referral letters are charged separately. Ask the clinic for that amount.',
    flowEyebrow: 'How it works',
    flowTitle: 'How a visit works',
    steps: [
        { title: 'Ask for an appointment', detail: 'Tell the clinic the language you want to use.' },
        { title: 'We confirm the time', detail: 'The clinic reviews your request and sends the date and time.' },
        { title: 'Online consultation', detail: 'Talk with a doctor from home or from work.' },
        { title: 'Payment and next steps', detail: 'The clinic explains how to pay and, if needed, medication and referral letters.' }
    ],
    bookEyebrow: 'Booking',
    bookTitle: 'Book an appointment',
    bookLead: 'The visit starts with an appointment. Nothing is sent until that flow is ready.',
    bookNote: 'The clinic sees patients by appointment only, and the consultation is not free.',
    ctaTitle: 'Start with an appointment.',
    ctaLead: 'After you book, the clinic confirms the date and time.',
    ctaButton: 'Book an appointment',
    emergency: 'In an emergency, do not use an online consultation. Call 119 for an ambulance.'
}

const ja: ClinicLandingCopy = {
    name: '多言語オンラインクリニック',
    description: '在日外国人のためのオンラインクリニック。8言語で受診できます。クレジットカードがなくても診察を受けられます。',
    book: '予約する',
    seeFees: '費用を見る',
    sectionNavLabel: 'このページ内',
    heroBadge: '8言語対応のオンライン診療',
    heroTitleBefore: '日本での受診に、',
    heroTitleHighlight: 'ことばの壁をなくす。',
    heroLead: '在日外国人のみなさまを支えるオンラインクリニックです。クレジットカードをお持ちでない方でも、安心してご受診いただけます。',
    heroNote: '完全予約制です。診察は有料です。',
    heroAlt: 'スマートフォンでオンライン診療を受けている様子。画面の中で医師が手を振っています。',
    badgeTitle: 'クレジットカード不要',
    badgeDetail: 'お支払い方法はご相談ください',
    highlights: ['8言語に対応', 'クレジットカードは不要', 'ご自宅から受診できます'],
    aboutEyebrow: 'クリニックについて',
    aboutTitle: '多言語オンラインクリニックについて',
    about: [
        '在日外国人の方をサポートするためのオンラインクリニックです。クレジットカードをお持ちでない方でも安心してご利用いただけます。',
        '受診の前に読んでいただく短い案内です。ご不明な点は、予約のときに一緒に確認できます。'
    ],
    navDoctors: '医師紹介',
    navCases: '対応症例',
    navFees: '費用',
    navFlow: 'ご利用の流れ',
    doctorsEyebrow: '医師紹介',
    doctorsTitle: '医師からのあいさつ',
    doctorCopy: [
        {
            role: '院長',
            tag: '「ことばの不安」を、受診のハードルにしない。',
            paragraphs: [
                '日本で体調を崩したとき、症状をうまく伝えられるか不安に感じる方は少なくありません。',
                '当院では、母語で安心して話せる環境を整え、一人ひとりの状況や背景に合わせた診療を心がけています。'
            ],
            alt: '院長 田中 完の写真'
        },
        {
            role: '医師',
            tag: '小さな不調も、気軽に相談できる場所に。',
            paragraphs: [
                '「このくらいで受診していいのかな」と迷うような不調こそ、早めのご相談が大切です。',
                '生活や文化の違いにも寄り添いながら、一人ひとりが納得できる医療をお届けします。'
            ],
            alt: '医師 弓野 綾の写真'
        }
    ],
    casesEyebrow: '対応症例',
    casesTitle: '代表的な症例',
    casesLead: 'オンライン診療でよくご相談いただく症状です。',
    cases: [
        { title: '風邪', detail: '発熱・のどの痛み・鼻水・せき' },
        { title: 'インフルエンザ', detail: '急な高熱・関節痛・全身のだるさ' },
        { title: '喘息', detail: 'せき・息苦しさ・ゼーゼーする呼吸' },
        { title: 'メンタルヘルス', detail: '不眠・不安・気分の落ち込み' },
        { title: '腹痛', detail: '胃の痛み・下痢・吐き気' }
    ],
    noticeEyebrow: '予約前のご確認',
    noticeTitle: 'ご予約の前にご確認ください',
    noticeLead: 'はじめての方に、あらかじめ知っておいていただきたい4つのことです。',
    notices: [
        { title: '完全予約制です', detail: '当クリニックは完全予約制です。' },
        { title: '診察は有料です', detail: '無料の相談サービスではありません。', feesLink: true },
        { title: '追加費用が発生する場合があります', detail: '診察後に、薬代や紹介状などの追加費用が発生する場合があります。' },
        { title: '対応言語', detail: '日本語・英語・中国語・ベトナム語・タガログ語・フランス語・ネパール語・インドネシア語' }
    ],
    feesLink: '費用の目安を見る',
    feesEyebrow: '費用',
    feesTitle: '費用の目安',
    feesLead: '表示は目安です。診察の内容により変わる場合があります。',
    rangeLabel: '費用の目安',
    plans: [
        { amount: '1,500円〜', note: 'お薬なしの場合' },
        { amount: '2,600円〜', note: 'お薬ありの場合' }
    ],
    includedLabel: '費用に含まれる項目',
    fees: ['初診料', 'システム手数料', '薬代', '薬の送料'],
    referralNote: '紹介状の発行は別料金です。金額はクリニックへお問い合わせください。',
    flowEyebrow: 'ご利用の流れ',
    flowTitle: 'ご利用の流れ',
    steps: [
        { title: '予約を申し込む', detail: 'ご希望の言語をクリニックにお伝えください。' },
        { title: '予約確定のご連絡', detail: '内容を確認のうえ、診察の日時をご連絡します。' },
        { title: 'オンラインで診察', detail: 'ご自宅や職場から、医師とお話しいただけます。' },
        { title: 'お支払いとご案内', detail: 'お支払い方法のほか、必要に応じてお薬や紹介状についてご案内します。' }
    ],
    bookEyebrow: 'ご予約',
    bookTitle: 'ご予約',
    bookLead: '受診は予約から始まります。予約の手続きは、これからこの場所につながります。',
    bookNote: '完全予約制です。診察は有料です。',
    ctaTitle: 'まずは、ご予約からはじめましょう。',
    ctaLead: 'ご予約のあと、日時をご連絡します。',
    ctaButton: '予約する',
    emergency: '緊急の場合はオンライン診療ではなく、119番（救急）にお電話ください。'
}

const zh: ClinicLandingCopy = {
    ...en,
    name: '多语言在线诊所',
    description: '为在日外国人提供的在线诊所。支持8种语言。没有信用卡也可以就诊。',
    book: '立即预约',
    seeFees: '查看费用',
    sectionNavLabel: '本页内容',
    heroBadge: '支持8种语言的在线诊疗',
    heroTitleBefore: '在日本看病，',
    heroTitleHighlight: '用您熟悉的语言。',
    heroLead: '专为在日外国人服务的在线诊所。即使没有信用卡，也可以放心就诊。',
    heroNote: '仅接受预约。诊疗需付费。',
    heroAlt: '患者正在用智能手机接受在线诊疗，屏幕中的医生微笑着挥手。',
    badgeTitle: '无需信用卡',
    badgeDetail: '付款方式欢迎咨询',
    highlights: ['支持8种语言', '无需信用卡', '在家即可就诊'],
    aboutEyebrow: '关于我们',
    aboutTitle: '关于多语言在线诊所',
    about: [
        '这是为在日外国人提供支持的在线诊所。即使没有信用卡，也可以放心使用。',
        '以下是就诊前的简要说明。有疑问可以留到预约时一起确认。'
    ],
    navDoctors: '医生介绍',
    navCases: '常见病症',
    navFees: '费用',
    navFlow: '就诊流程',
    doctorsEyebrow: '医生介绍',
    doctorsTitle: '医生寄语',
    doctorCopy: [
        {
            role: '院长',
            tag: '不让语言成为就医的障碍。',
            paragraphs: [
                '在日本生病时，很多人都会担心自己能否把症状说清楚。',
                '本院为您提供可以用母语安心交流的就诊环境，并根据每位患者的具体情况进行诊疗。'
            ],
            alt: '院长田中完医生的照片'
        },
        {
            role: '医生',
            tag: '再小的不适，也欢迎随时咨询。',
            paragraphs: [
                '当您犹豫“这点不舒服要不要看医生”时，正是应该尽早咨询的时候。',
                '我们尊重生活习惯与文化的差异，努力让每一位患者都能理解并放心接受治疗。'
            ],
            alt: '弓野绫医生的照片'
        }
    ],
    casesEyebrow: '诊疗范围',
    casesTitle: '常见病症',
    casesLead: '以下是在线诊疗中常见的咨询症状。',
    cases: [
        { title: '感冒', detail: '发烧、喉咙痛、流鼻涕、咳嗽' },
        { title: '流感', detail: '突发高烧、关节疼痛、全身乏力' },
        { title: '哮喘', detail: '咳嗽、呼吸困难、喘鸣' },
        { title: '心理健康', detail: '失眠、焦虑、情绪低落' },
        { title: '腹痛', detail: '胃痛、腹泻、恶心' }
    ],
    noticeEyebrow: '预约须知',
    noticeTitle: '预约前请阅读',
    noticeLead: '首次就诊前，请先了解以下四点。',
    notices: [
        { title: '仅接受预约', detail: '本诊所只为已预约的患者看诊。' },
        { title: '诊疗需付费', detail: '本服务并非免费咨询。', feesLink: true },
        { title: '可能产生额外费用', detail: '就诊后可能会产生药费、转诊信等额外费用。' },
        { title: '支持语言', detail: '日语、英语、中文、越南语、他加禄语、法语、尼泊尔语、印尼语' }
    ],
    feesLink: '查看费用参考',
    feesEyebrow: '费用',
    feesTitle: '费用参考',
    feesLead: '以下金额仅供参考，实际费用可能因诊疗内容而不同。',
    rangeLabel: '费用参考',
    plans: [
        { amount: '1,500日元起', note: '无需开药时' },
        { amount: '2,600日元起', note: '需要开药时' }
    ],
    includedLabel: '费用可能包含',
    fees: ['初诊费', '系统服务费', '药费', '药品邮寄费'],
    referralNote: '开具转诊信需另行收费。具体金额请向诊所咨询。',
    flowEyebrow: '就诊流程',
    flowTitle: '就诊流程',
    steps: [
        { title: '提出预约', detail: '请告诉诊所您希望使用的语言。' },
        { title: '确认时间', detail: '我们确认内容后，会通知您就诊的日期和时间。' },
        { title: '在线就诊', detail: '在家或在单位即可与医生交流。' },
        { title: '付款与后续说明', detail: '我们会说明付款方式，并视需要说明药品和转诊信。' }
    ],
    bookEyebrow: '预约',
    bookTitle: '预约就诊',
    bookLead: '就诊从预约开始。预约流程稍后会接在这里。',
    bookNote: '本诊所仅接受预约，诊疗需要付费。',
    ctaTitle: '第一步，从预约开始。',
    ctaLead: '预约之后，我们会与您确认就诊时间。',
    ctaButton: '预约就诊',
    emergency: '紧急情况下请勿使用在线诊疗，请拨打119呼叫救护车。'
}

const COPY: Record<string, ClinicLandingCopy> = {
    'en-US': en,
    'ja-JP': ja,
    'zh-CN': zh
}

function withLocale(base: ClinicLandingCopy, patch: Partial<ClinicLandingCopy>): ClinicLandingCopy {
    return { ...base, ...patch }
}

COPY['vi-VN'] = withLocale(en, {
    name: 'Phòng khám trực tuyến đa ngôn ngữ',
    description: 'Phòng khám trực tuyến cho người nước ngoài đang sống tại Nhật. Khám bằng 8 ngôn ngữ. Không có thẻ tín dụng vẫn đi khám được.',
    book: 'Đặt lịch',
    seeFees: 'Xem chi phí',
    sectionNavLabel: 'Trong trang này',
    heroBadge: 'Khám trực tuyến bằng 8 ngôn ngữ',
    heroTitleBefore: 'Khám bệnh tại Nhật, ',
    heroTitleHighlight: 'bằng chính ngôn ngữ của bạn.',
    heroLead: 'Phòng khám trực tuyến dành cho người nước ngoài đang sinh sống tại Nhật Bản. Bạn vẫn có thể đi khám dù không có thẻ tín dụng.',
    heroNote: 'Chỉ khám theo lịch hẹn. Khám bệnh có tính phí.',
    heroAlt: 'Bệnh nhân khám trực tuyến qua điện thoại, bác sĩ mỉm cười vẫy tay trên màn hình.',
    badgeTitle: 'Không cần thẻ tín dụng',
    badgeDetail: 'Hãy trao đổi cách thanh toán với chúng tôi',
    highlights: ['Hỗ trợ 8 ngôn ngữ', 'Không cần thẻ tín dụng', 'Khám ngay tại nhà'],
    aboutEyebrow: 'Giới thiệu',
    aboutTitle: 'Về phòng khám trực tuyến đa ngôn ngữ',
    about: [
        'Phòng khám hỗ trợ người nước ngoài đang sinh sống tại Nhật Bản. Bạn có thể dùng dù không có thẻ tín dụng.',
        'Đây là thông tin ngắn trước khi đặt lịch. Thắc mắc có thể để đến lúc hẹn.'
    ],
    navDoctors: 'Bác sĩ',
    navCases: 'Bệnh thường gặp',
    navFees: 'Chi phí',
    navFlow: 'Quy trình',
    doctorsEyebrow: 'Đội ngũ bác sĩ',
    doctorsTitle: 'Lời nhắn từ bác sĩ',
    bookEyebrow: 'Đặt lịch',
    bookTitle: 'Đặt lịch khám',
    bookLead: 'Việc khám bắt đầu bằng lịch hẹn. Phần đặt lịch sẽ được nối vào đây.',
    bookNote: 'Phòng khám chỉ nhận bệnh nhân có lịch hẹn, và việc khám có tính phí.',
    ctaTitle: 'Hãy bắt đầu bằng việc đặt lịch.',
    ctaLead: 'Sau khi bạn đặt lịch, phòng khám sẽ báo ngày giờ khám.',
    ctaButton: 'Đặt lịch khám',
    emergency: 'Trường hợp khẩn cấp, đừng dùng khám trực tuyến. Hãy gọi 119 để gọi xe cấp cứu.',
    feesLink: 'Xem chi phí tham khảo',
    feesEyebrow: 'Chi phí',
    feesTitle: 'Chi phí tham khảo',
    feesLead: 'Các mức này chỉ để tham khảo và có thể đổi theo nội dung khám.',
    rangeLabel: 'Chi phí tham khảo',
    plans: [
        { amount: 'Từ 1.500 yên', note: 'Không kê thuốc' },
        { amount: 'Từ 2.600 yên', note: 'Có kê thuốc' }
    ],
    includedLabel: 'Chi phí có thể gồm',
    fees: ['Phí khám lần đầu', 'Phí hệ thống', 'Tiền thuốc', 'Phí gửi thuốc'],
    referralNote: 'Giấy giới thiệu tính phí riêng. Hãy hỏi phòng khám về số tiền đó.'
})

COPY['ko-KR'] = withLocale(en, {
    name: '다국어 온라인 클리닉',
    description: '일본에 사는 외국인을 위한 온라인 클리닉입니다. 8개 언어로 진료합니다. 신용카드가 없어도 진료를 받을 수 있습니다.',
    book: '예약하기',
    seeFees: '비용 보기',
    sectionNavLabel: '이 페이지에서',
    heroBadge: '8개 언어로 받는 온라인 진료',
    heroTitleBefore: '일본에서 진료를, ',
    heroTitleHighlight: '당신의 언어로.',
    heroLead: '일본에 사는 외국인을 위한 온라인 클리닉입니다. 신용카드가 없어도 의사를 만날 수 있습니다.',
    heroNote: '예약제로만 진료합니다. 진료는 유료입니다.',
    heroAlt: '스마트폰으로 온라인 진료를 받는 환자. 화면 속 의사가 손을 흔들고 있습니다.',
    badgeTitle: '신용카드가 필요 없습니다',
    badgeDetail: '결제 방법은 상의해 주세요',
    highlights: ['8개 언어 지원', '신용카드가 필요 없습니다', '집에서 진료받을 수 있습니다'],
    aboutEyebrow: '클리닉 소개',
    aboutTitle: '다국어 온라인 클리닉 소개',
    about: [
        '일본에 사는 외국인을 돕는 온라인 클리닉입니다. 신용카드가 없어도 이용할 수 있습니다.',
        '예약 전에 읽어 두는 짧은 안내입니다. 궁금한 점은 예약 때 함께 확인하면 됩니다.'
    ],
    navDoctors: '의사 소개',
    navCases: '진료 증상',
    navFees: '비용',
    navFlow: '이용 순서',
    doctorsEyebrow: '의사 소개',
    doctorsTitle: '의사의 인사',
    bookEyebrow: '예약',
    bookTitle: '진료 예약',
    bookLead: '진료는 예약으로 시작합니다. 예약 절차는 나중에 이 버튼에 연결됩니다.',
    bookNote: '이 클리닉은 예약으로만 진료하며, 진료는 유료입니다.',
    ctaTitle: '먼저 예약부터 시작해 보세요.',
    ctaLead: '예약 후 진료 일시를 알려 드립니다.',
    ctaButton: '진료 예약',
    emergency: '응급일 때는 온라인 진료를 이용하지 말고 119로 전화해 주세요.',
    feesLink: '비용 안내 보기',
    feesEyebrow: '비용',
    feesTitle: '비용 안내',
    feesLead: '표시된 금액은 안내이며, 진료 내용에 따라 달라질 수 있습니다.',
    rangeLabel: '비용 안내',
    plans: [
        { amount: '1,500엔부터', note: '약이 없는 경우' },
        { amount: '2,600엔부터', note: '약이 있는 경우' }
    ],
    includedLabel: '비용에 들어갈 수 있는 항목',
    fees: ['초진 비용', '시스템 수수료', '약값', '약 배송비'],
    referralNote: '진료의뢰서는 별도 요금입니다. 금액은 클리닉에 물어봐 주세요.'
})

COPY['fr-FR'] = withLocale(en, {
    name: 'Clinique en ligne multilingue',
    description: 'Une clinique en ligne pour les résidents étrangers au Japon. Consultations en huit langues. Une carte de crédit n’est pas nécessaire.',
    book: 'Réserver',
    seeFees: 'Voir les tarifs',
    sectionNavLabel: 'Sur cette page',
    heroBadge: 'Téléconsultation en 8 langues',
    heroTitleBefore: 'Se soigner au Japon, ',
    heroTitleHighlight: 'dans votre langue.',
    heroLead: 'Une clinique en ligne pour les résidents étrangers au Japon. Vous pouvez consulter même sans carte de crédit.',
    heroNote: 'Uniquement sur rendez-vous. La consultation est payante.',
    heroAlt: 'Une personne en téléconsultation sur son téléphone ; à l’écran, le médecin sourit et salue.',
    badgeTitle: 'Sans carte de crédit',
    badgeDetail: 'Parlons du mode de paiement',
    highlights: ['Disponible en 8 langues', 'Aucune carte de crédit requise', 'Consultez depuis chez vous'],
    aboutEyebrow: 'À propos',
    aboutTitle: 'À propos de cette clinique en ligne',
    about: [
        'Cette clinique accompagne les résidents étrangers au Japon. Vous pouvez l’utiliser sans carte de crédit.',
        'Cette page est un bref aperçu avant le rendez-vous. Les questions peuvent attendre la consultation.'
    ],
    navDoctors: 'Médecins',
    navCases: 'Motifs',
    navFees: 'Tarifs',
    navFlow: 'Déroulement',
    doctorsEyebrow: 'Nos médecins',
    doctorsTitle: 'Le mot de nos médecins',
    bookEyebrow: 'Rendez-vous',
    bookTitle: 'Prendre rendez-vous',
    bookLead: 'La consultation commence par un rendez-vous. Le parcours de réservation arrivera ici.',
    bookNote: 'La clinique reçoit uniquement sur rendez-vous, et la consultation est payante.',
    ctaTitle: 'Commencez par prendre rendez-vous.',
    ctaLead: 'Après la demande, la clinique confirme la date et l’heure.',
    ctaButton: 'Prendre rendez-vous',
    emergency: 'En cas d’urgence, n’utilisez pas la téléconsultation : composez le 119.',
    feesLink: 'Voir les tarifs indicatifs',
    feesEyebrow: 'Tarifs',
    feesTitle: 'Tarifs indicatifs',
    feesLead: 'Ces montants sont indicatifs et peuvent varier selon la consultation.',
    rangeLabel: 'Tarifs indicatifs',
    plans: [
        { amount: 'Dès 1 500 ¥', note: 'Sans médicaments' },
        { amount: 'Dès 2 600 ¥', note: 'Avec médicaments' }
    ],
    includedLabel: 'Ce que les frais peuvent couvrir',
    fees: ['Première consultation', 'Frais de service', 'Médicaments', 'Envoi des médicaments'],
    referralNote: 'La lettre d’orientation est facturée à part. Demandez le montant à la clinique.'
})

COPY['de-DE'] = withLocale(en, {
    name: 'Mehrsprachige Online-Klinik',
    description: 'Eine Online-Klinik für ausländische Einwohner in Japan. Beratung in acht Sprachen. Auch ohne Kreditkarte.',
    book: 'Termin',
    seeFees: 'Kosten ansehen',
    sectionNavLabel: 'Auf dieser Seite',
    heroBadge: 'Online-Sprechstunde in 8 Sprachen',
    heroTitleBefore: 'Versorgung in Japan, ',
    heroTitleHighlight: 'in Ihrer Sprache.',
    heroLead: 'Eine Online-Klinik für ausländische Einwohner in Japan. Sie können auch ohne Kreditkarte einen Arzt sprechen.',
    heroNote: 'Nur mit Termin. Die Beratung ist kostenpflichtig.',
    heroAlt: 'Eine Person in der Videosprechstunde am Telefon; der Arzt auf dem Bildschirm winkt.',
    badgeTitle: 'Keine Kreditkarte nötig',
    badgeDetail: 'Sprechen Sie mit uns über die Zahlung',
    highlights: ['In 8 Sprachen', 'Keine Kreditkarte nötig', 'Arztgespräch von zu Hause'],
    aboutEyebrow: 'Über uns',
    aboutTitle: 'Über diese mehrsprachige Online-Klinik',
    about: [
        'Die Klinik unterstützt ausländische Einwohner in Japan. Sie können sie ohne Kreditkarte nutzen.',
        'Diese Seite ist ein kurzer Überblick vor dem Termin. Fragen können bis zum Gespräch warten.'
    ],
    navDoctors: 'Ärztinnen und Ärzte',
    navCases: 'Beschwerden',
    navFees: 'Kosten',
    navFlow: 'Ablauf',
    doctorsEyebrow: 'Unser Team',
    doctorsTitle: 'Ein Gruß vom Team',
    bookEyebrow: 'Termin',
    bookTitle: 'Einen Termin vereinbaren',
    bookLead: 'Der Besuch beginnt mit einem Termin. Der Buchungsweg kommt an diese Stelle.',
    bookNote: 'Die Klinik behandelt nur nach Termin, und die Beratung ist kostenpflichtig.',
    ctaTitle: 'Beginnen Sie mit einem Termin.',
    ctaLead: 'Danach bestätigt die Klinik Datum und Uhrzeit.',
    ctaButton: 'Termin vereinbaren',
    emergency: 'Im Notfall keine Online-Beratung nutzen. Rufen Sie 119 für einen Krankenwagen an.',
    feesLink: 'Kostenübersicht ansehen',
    feesEyebrow: 'Kosten',
    feesTitle: 'Kostenübersicht',
    feesLead: 'Die Beträge sind Schätzungen und können je nach Beratung abweichen.',
    rangeLabel: 'Kostenübersicht',
    plans: [
        { amount: 'Ab 1.500 ¥', note: 'Ohne Medikamente' },
        { amount: 'Ab 2.600 ¥', note: 'Mit Medikamenten' }
    ],
    includedLabel: 'Was die Kosten umfassen können',
    fees: ['Erstberatung', 'Systemgebühr', 'Medikamente', 'Versand der Medikamente'],
    referralNote: 'Eine Überweisung wird getrennt berechnet. Fragen Sie die Klinik nach dem Betrag.'
})

COPY['tl-PH'] = withLocale(en, {
    name: 'Multilingual na online clinic',
    description: 'Online clinic para sa mga dayuhang naninirahan sa Japan. Konsulta sa 8 wika. Puwede kahit walang credit card.',
    book: 'Mag-book',
    seeFees: 'Tingnan ang bayad',
    sectionNavLabel: 'Sa pahinang ito',
    heroBadge: 'Online na konsulta sa 8 wika',
    heroTitleBefore: 'Magpatingin sa Japan, ',
    heroTitleHighlight: 'sa sarili ninyong wika.',
    heroLead: 'Isang online clinic para sa mga dayuhang naninirahan sa Japan. Makakapagpatingin kayo kahit walang credit card.',
    heroNote: 'Sa appointment lamang. May bayad ang konsulta.',
    heroAlt: 'Isang pasyenteng kumokonsulta online sa telepono, kumakaway ang doktor sa screen.',
    badgeTitle: 'Hindi kailangan ng credit card',
    badgeDetail: 'Pag-usapan natin ang pagbabayad',
    highlights: ['Available sa 8 wika', 'Hindi kailangan ng credit card', 'Magpatingin mula sa bahay'],
    aboutEyebrow: 'Tungkol sa amin',
    aboutTitle: 'Tungkol sa multilingual na online clinic',
    about: [
        'Sumusuporta ang clinic na ito sa mga dayuhang naninirahan sa Japan. Magagamit ninyo ito kahit walang credit card.',
        'Maikling buod ito bago magpa-appointment. Ang mga tanong ay puwede nang sa konsultang mismo.'
    ],
    navDoctors: 'Mga doktor',
    navCases: 'Mga kondisyon',
    navFees: 'Bayad',
    navFlow: 'Daloy',
    doctorsEyebrow: 'Ang aming mga doktor',
    doctorsTitle: 'Mensahe mula sa mga doktor',
    bookEyebrow: 'Appointment',
    bookTitle: 'Magpa-appointment',
    bookLead: 'Nagsisimula ang pagpapagamot sa appointment. Ang daloy ng booking ay dito ilalagay.',
    bookNote: 'Appointment lamang ang tinatanggap, at may bayad ang konsulta.',
    ctaTitle: 'Magsimula sa pagpa-appointment.',
    ctaLead: 'Pagkatapos ninyong magpa-appointment, kakumpirmahin ang petsa at oras.',
    ctaButton: 'Magpa-appointment',
    emergency: 'Sa emergency, huwag gumamit ng online na konsulta. Tumawag sa 119 para sa ambulansya.',
    feesLink: 'Tingnan ang gabay sa bayad',
    feesEyebrow: 'Bayad',
    feesTitle: 'Gabay sa bayad',
    feesLead: 'Tantiya lamang ang mga halagang ito at maaaring magbago depende sa konsulta.',
    rangeLabel: 'Gabay sa bayad',
    plans: [
        { amount: 'Mula 1,500 yen', note: 'Kung walang gamot' },
        { amount: 'Mula 2,600 yen', note: 'Kung may gamot' }
    ],
    includedLabel: 'Maaaring kasama sa bayad',
    fees: ['Unang konsulta', 'System fee', 'Gamot', 'Padala ng gamot'],
    referralNote: 'May hiwalay na bayad ang referral letter. Itanong sa clinic ang halaga.'
})

COPY['pt-BR'] = withLocale(en, {
    name: 'Clínica online multilíngue',
    description: 'Uma clínica online para quem mora no Japão e veio de outro país. Consultas em oito idiomas. Dá para ser atendido sem cartão de crédito.',
    book: 'Reservar',
    seeFees: 'Ver valores',
    sectionNavLabel: 'Nesta página',
    heroBadge: 'Consultas online em 8 idiomas',
    heroTitleBefore: 'Cuidado de saúde no Japão, ',
    heroTitleHighlight: 'no idioma que você fala.',
    heroLead: 'Uma clínica online para residentes estrangeiros no Japão. Você pode consultar um médico mesmo sem cartão de crédito.',
    heroNote: 'Somente com hora marcada. A consulta é paga.',
    heroAlt: 'Uma pessoa em consulta online pelo celular, com um médico sorrindo e acenando na tela.',
    badgeTitle: 'Sem cartão de crédito',
    badgeDetail: 'Fale conosco sobre o pagamento',
    highlights: ['Disponível em 8 idiomas', 'Não precisa de cartão', 'Consulte de casa'],
    aboutEyebrow: 'Sobre a clínica',
    aboutTitle: 'Sobre esta clínica online multilíngue',
    about: [
        'A clínica apoia estrangeiros que moram no Japão. Dá para usar mesmo sem cartão de crédito.',
        'Esta página é um resumo antes da consulta. As dúvidas podem esperar o horário marcado.'
    ],
    navDoctors: 'Médicos',
    navCases: 'Sintomas',
    navFees: 'Valores',
    navFlow: 'Como funciona',
    doctorsEyebrow: 'Nossos médicos',
    doctorsTitle: 'Uma mensagem dos médicos',
    bookEyebrow: 'Reserva',
    bookTitle: 'Marcar uma consulta',
    bookLead: 'O atendimento começa com um horário marcado. O fluxo de reserva vai ficar neste botão.',
    bookNote: 'A clínica atende só com hora marcada, e a consulta é paga.',
    ctaTitle: 'Comece marcando uma consulta.',
    ctaLead: 'Depois do pedido, a clínica confirma o dia e a hora.',
    ctaButton: 'Marcar uma consulta',
    emergency: 'Em uma emergência, não use a consulta online. Ligue 119 para uma ambulância.',
    feesLink: 'Ver a tabela de valores',
    feesEyebrow: 'Valores',
    feesTitle: 'Valores de referência',
    feesLead: 'Os valores são uma estimativa e podem mudar conforme a consulta.',
    rangeLabel: 'Valores de referência',
    plans: [
        { amount: 'A partir de ¥1.500', note: 'Sem remédio' },
        { amount: 'A partir de ¥2.600', note: 'Com remédio' }
    ],
    includedLabel: 'O que pode entrar no valor',
    fees: ['Consulta inicial', 'Taxa do sistema', 'Remédio', 'Envio do remédio'],
    referralNote: 'A carta de encaminhamento é cobrada à parte. Pergunte o valor à clínica.'
})

COPY['ru-RU'] = withLocale(en, {
    name: 'Многоязычная онлайн-клиника',
    description: 'Онлайн-клиника для иностранцев, живущих в Японии. Приём на восьми языках. Кредитная карта не нужна.',
    book: 'Записаться',
    seeFees: 'Стоимость',
    sectionNavLabel: 'На этой странице',
    heroBadge: 'Онлайн-приём на 8 языках',
    heroTitleBefore: 'Медицина в Японии ',
    heroTitleHighlight: 'на вашем языке.',
    heroLead: 'Онлайн-клиника для иностранцев в Японии. К врачу можно попасть и без кредитной карты.',
    heroNote: 'Только по записи. Приём платный.',
    heroAlt: 'Человек на онлайн-консультации по телефону: врач на экране улыбается и машет рукой.',
    badgeTitle: 'Без кредитной карты',
    badgeDetail: 'Способ оплаты можно обсудить',
    highlights: ['8 языков', 'Карта не нужна', 'Приём из дома'],
    aboutEyebrow: 'О клинике',
    aboutTitle: 'Об этой многоязычной онлайн-клинике',
    about: [
        'Клиника помогает иностранцам, которые живут в Японии. Ею можно пользоваться без кредитной карты.',
        'Это короткое описание перед записью. Вопросы можно оставить до самого приёма.'
    ],
    navDoctors: 'Врачи',
    navCases: 'Жалобы',
    navFees: 'Стоимость',
    navFlow: 'Как это проходит',
    doctorsEyebrow: 'Наши врачи',
    doctorsTitle: 'Слово от врачей',
    bookEyebrow: 'Запись',
    bookTitle: 'Записаться на приём',
    bookLead: 'Визит начинается с записи. Сама запись позже откроется на этой кнопке.',
    bookNote: 'Клиника принимает только по записи, и консультация платная.',
    ctaTitle: 'Начните с записи на приём.',
    ctaLead: 'После заявки клиника подтвердит дату и время.',
    ctaButton: 'Записаться на приём',
    emergency: 'В экстренной ситуации не пользуйтесь онлайн-приёмом. Звоните 119, чтобы вызвать скорую.',
    feesLink: 'Смотреть ориентир по стоимости',
    feesEyebrow: 'Стоимость',
    feesTitle: 'Ориентир по стоимости',
    feesLead: 'Суммы примерные и могут измениться в зависимости от консультации.',
    rangeLabel: 'Ориентир по стоимости',
    plans: [
        { amount: 'От 1 500 иен', note: 'Без лекарств' },
        { amount: 'От 2 600 иен', note: 'С лекарствами' }
    ],
    includedLabel: 'Что может входить в стоимость',
    fees: ['Первичный приём', 'Системный сбор', 'Лекарства', 'Доставка лекарств'],
    referralNote: 'Направление оплачивается отдельно. Сумму подскажет клиника.'
})

COPY['it-IT'] = withLocale(en, {
    name: 'Clinica online multilingue',
    description: 'Una clinica online per chi vive in Giappone e viene da un altro paese. Visite in otto lingue. Si può essere visitati senza carta di credito.',
    book: 'Prenota',
    seeFees: 'Vedi i costi',
    sectionNavLabel: 'In questa pagina',
    heroBadge: 'Visite online in 8 lingue',
    heroTitleBefore: 'Cure in Giappone, ',
    heroTitleHighlight: 'nella tua lingua.',
    heroLead: 'Una clinica online per i residenti stranieri in Giappone. Puoi parlare con un medico anche senza carta di credito.',
    heroNote: 'Solo su appuntamento. La visita è a pagamento.',
    heroAlt: 'Una persona in visita online dal telefono; il medico sullo schermo sorride e saluta.',
    badgeTitle: 'Senza carta di credito',
    badgeDetail: 'Parliamo di come pagare',
    highlights: ['Disponibile in 8 lingue', 'Nessuna carta di credito', 'Visita da casa'],
    aboutEyebrow: 'Chi siamo',
    aboutTitle: 'Su questa clinica online multilingue',
    about: [
        'La clinica accompagna i residenti stranieri in Giappone. Si può usare anche senza carta di credito.',
        'Questa pagina è un breve riepilogo prima dell’appuntamento. Le domande possono aspettare la visita.'
    ],
    navDoctors: 'Medici',
    navCases: 'Disturbi',
    navFees: 'Costi',
    navFlow: 'Come funziona',
    doctorsEyebrow: 'I nostri medici',
    doctorsTitle: 'Un messaggio dai medici',
    bookEyebrow: 'Appuntamento',
    bookTitle: 'Prenota una visita',
    bookLead: 'La visita inizia con un appuntamento. Il percorso di prenotazione arriverà su questo pulsante.',
    bookNote: 'La clinica riceve solo su appuntamento e la visita è a pagamento.',
    ctaTitle: 'Inizia prenotando una visita.',
    ctaLead: 'Dopo la richiesta, la clinica conferma data e ora.',
    ctaButton: 'Prenota una visita',
    emergency: 'In caso di emergenza non usare la visita online. Chiama il 119 per un’ambulanza.',
    feesLink: 'Vedi la guida ai costi',
    feesEyebrow: 'Costi',
    feesTitle: 'Guida ai costi',
    feesLead: 'Gli importi sono indicativi e possono cambiare in base alla visita.',
    rangeLabel: 'Guida ai costi',
    plans: [
        { amount: 'Da 1.500 ¥', note: 'Senza farmaci' },
        { amount: 'Da 2.600 ¥', note: 'Con farmaci' }
    ],
    includedLabel: 'Cosa può comprendere il costo',
    fees: ['Prima visita', 'Costo di sistema', 'Farmaci', 'Spedizione dei farmaci'],
    referralNote: 'La lettera di invio si paga a parte. Chiedi l’importo alla clinica.'
})

export type ClinicSiteSeed = {
    id: string
    facility_id: string | null
    slug: string
    status: 'draft' | 'preview' | 'published'
    share_image_path: string
    hero_path: string
    theme: { primary: string }
    languages: readonly ClinicLandingLanguage[]
    doctors: readonly ClinicLandingDoctor[]
    copy: Record<string, ClinicLandingCopy>
}

export const clinicSiteSeeds: readonly ClinicSiteSeed[] = [
    {
        id: SHOWCASE_CLINIC_SITE_ID,
        facility_id: SHOWCASE_FACILITY_ID,
        slug: 'multilingual-online-clinic',
        status: 'preview',
        share_image_path: HERO,
        hero_path: HERO,
        theme: { primary: '#177A80' },
        languages: LANGUAGES,
        doctors: DOCTORS,
        copy: COPY
    }
]
