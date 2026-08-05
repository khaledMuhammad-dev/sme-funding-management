import type {
  Application,
  ApplicationStatus,
  Beneficiary,
  CriterionKey,
  DocumentKind,
  Project,
  Region,
  ScoreCard,
  Sector,
  TimelineEvent,
  UploadedDoc,
} from '../types'
import { daysAgo, intBetween, pad, pick, rng } from './seed'

/** Default criterion weights — also the initial state of the settings store. */
export const DEFAULT_WEIGHTS: Record<CriterionKey, number> = {
  income_stability: 25,
  project_experience: 20,
  seriousness: 15,
  repayment_ability: 25,
  data_completeness: 15,
}

const CITIES: Record<Region, string[]> = {
  riyadh: ['الرياض', 'الدرعية', 'الخرج'],
  jeddah: ['جدة', 'رابغ'],
  dammam: ['الدمام', 'الخبر', 'الظهران'],
  abha: ['أبها', 'خميس مشيط'],
  madinah: ['المدينة المنورة', 'ينبع'],
  qassim: ['بريدة', 'عنيزة'],
  tabuk: ['تبوك'],
}

interface Row {
  name: string
  nameEn: string
  region: Region
  sector: Sector
  project: string
  projectEn: string
  amount: number
  status: ApplicationStatus
}

/**
 * 25 applications spread across every status and region.
 * Order matters: `ref` numbers are assigned by index, so they stay stable.
 */
const ROWS: Row[] = [
  { name: 'نورة عبدالله القحطاني', nameEn: 'Noura Abdullah Al-Qahtani', region: 'riyadh', sector: 'food', project: 'مخبز نورة المنزلي', projectEn: 'Noura Home Bakery', amount: 85000, status: 'disbursed' },
  { name: 'ريم سعد الدوسري', nameEn: 'Reem Saad Al-Dosari', region: 'jeddah', sector: 'fashion', project: 'أتيليه ريم للخياطة', projectEn: 'Reem Tailoring Atelier', amount: 150000, status: 'follow_up' },
  { name: 'سارة محمد العتيبي', nameEn: 'Sarah Mohammed Al-Otaibi', region: 'dammam', sector: 'beauty', project: 'صالون لمسات', projectEn: 'Lamsat Beauty Salon', amount: 220000, status: 'under_review' },
  { name: 'هند فهد الشمري', nameEn: 'Hind Fahd Al-Shammari', region: 'abha', sector: 'crafts', project: 'حرف السروات', projectEn: 'Sarawat Crafts', amount: 60000, status: 'new' },
  { name: 'لمياء خالد الغامدي', nameEn: 'Lamia Khalid Al-Ghamdi', region: 'madinah', sector: 'retail', project: 'متجر لمياء الإلكتروني', projectEn: 'Lamia Online Store', amount: 95000, status: 'awaiting_interview' },
  { name: 'أمل ناصر الحربي', nameEn: 'Amal Nasser Al-Harbi', region: 'riyadh', sector: 'food', project: 'مطبخ أمل للتموين', projectEn: 'Amal Catering Kitchen', amount: 180000, status: 'approved' },
  { name: 'جواهر تركي المطيري', nameEn: 'Jawaher Turki Al-Mutairi', region: 'qassim', sector: 'services', project: 'مركز جواهر للتدريب', projectEn: 'Jawaher Training Centre', amount: 130000, status: 'incomplete' },
  { name: 'دانة عمر الزهراني', nameEn: 'Dana Omar Al-Zahrani', region: 'jeddah', sector: 'tech', project: 'منصة دانة التعليمية', projectEn: 'Dana Learning Platform', amount: 250000, status: 'rejected' },
  { name: 'مها سلطان العنزي', nameEn: 'Maha Sultan Al-Anazi', region: 'tabuk', sector: 'food', project: 'قهوة مها المختصة', projectEn: 'Maha Specialty Coffee', amount: 110000, status: 'disbursed' },
  { name: 'شهد بندر السبيعي', nameEn: 'Shahad Bandar Al-Subaie', region: 'riyadh', sector: 'beauty', project: 'عيادة شهد للتجميل', projectEn: 'Shahad Beauty Clinic', amount: 300000, status: 'under_review' },
  { name: 'عبير ماجد البقمي', nameEn: 'Abeer Majed Al-Buqami', region: 'dammam', sector: 'fashion', project: 'عباءات عبير', projectEn: 'Abeer Abayas', amount: 75000, status: 'follow_up' },
  { name: 'منال راشد الحارثي', nameEn: 'Manal Rashed Al-Harthi', region: 'abha', sector: 'crafts', project: 'فخار منال', projectEn: 'Manal Pottery', amount: 55000, status: 'new' },
  { name: 'رغد وليد الشهري', nameEn: 'Raghad Waleed Al-Shehri', region: 'madinah', sector: 'services', project: 'رغد لتنظيم المناسبات', projectEn: 'Raghad Event Planning', amount: 140000, status: 'awaiting_interview' },
  { name: 'أروى صالح القرني', nameEn: 'Arwa Saleh Al-Qarni', region: 'jeddah', sector: 'food', project: 'حلويات أروى', projectEn: 'Arwa Sweets', amount: 90000, status: 'approved' },
  { name: 'بشاير عادل الجهني', nameEn: 'Bashayer Adel Al-Juhani', region: 'riyadh', sector: 'retail', project: 'بشاير للهدايا', projectEn: 'Bashayer Gifts', amount: 65000, status: 'under_review' },
  { name: 'وجدان يوسف المالكي', nameEn: 'Wijdan Yousef Al-Malki', region: 'qassim', sector: 'tech', project: 'وجدان للتصميم الرقمي', projectEn: 'Wijdan Digital Design', amount: 120000, status: 'incomplete' },
  { name: 'الجوهرة فيصل الرشيد', nameEn: 'Aljawhara Faisal Al-Rasheed', region: 'riyadh', sector: 'services', project: 'الجوهرة للاستشارات', projectEn: 'Aljawhara Consulting', amount: 200000, status: 'disbursed' },
  { name: 'خلود مشعل العمري', nameEn: 'Khulood Mishaal Al-Amri', region: 'dammam', sector: 'beauty', project: 'خلود للعناية', projectEn: 'Khulood Care', amount: 80000, status: 'rejected' },
  { name: 'رنا إبراهيم البلوي', nameEn: 'Rana Ibrahim Al-Balawi', region: 'tabuk', sector: 'fashion', project: 'رنا للأزياء', projectEn: 'Rana Fashion', amount: 105000, status: 'new' },
  { name: 'غادة حمد الخالدي', nameEn: 'Ghada Hamad Al-Khalidi', region: 'jeddah', sector: 'crafts', project: 'غادة للسجاد اليدوي', projectEn: 'Ghada Handmade Rugs', amount: 70000, status: 'follow_up' },
  { name: 'ندى طلال الأحمدي', nameEn: 'Nada Talal Al-Ahmadi', region: 'madinah', sector: 'food', project: 'ندى للعصائر الطبيعية', projectEn: 'Nada Natural Juices', amount: 50000, status: 'awaiting_interview' },
  { name: 'أسماء زياد الثقفي', nameEn: 'Asma Ziad Al-Thaqafi', region: 'abha', sector: 'retail', project: 'أسماء للعطور', projectEn: 'Asma Perfumes', amount: 115000, status: 'under_review' },
  { name: 'لينا سامي الصاعدي', nameEn: 'Lina Sami Al-Saedi', region: 'riyadh', sector: 'tech', project: 'لينا لتطبيقات المتاجر', projectEn: 'Lina Store Apps', amount: 280000, status: 'approved' },
  { name: 'حصة عبدالعزيز الفهد', nameEn: 'Hessa Abdulaziz Al-Fahad', region: 'qassim', sector: 'food', project: 'حصة للتمور المعبأة', projectEn: 'Hessa Packed Dates', amount: 160000, status: 'disbursed' },
  { name: 'ملاك سعود الرشيدي', nameEn: 'Malak Saud Al-Rashidi', region: 'dammam', sector: 'services', project: 'ملاك للترجمة', projectEn: 'Malak Translation', amount: 45000, status: 'incomplete' },
]

const STAFF = ['فاطمة الأنصاري', 'عمر السالم', 'ليلى الحمد', 'يوسف النعيمي']

const DOC_FILES: Record<DocumentKind, string> = {
  national_id: 'national-id.pdf',
  iban_cert: 'iban-certificate.pdf',
  commercial_register: 'commercial-register.pdf',
  feasibility_study: 'feasibility-study.pdf',
  photos: 'project-photos.zip',
}

/** How far along the timeline a status is — drives how many days ago it started. */
const AGE_BY_STATUS: Record<ApplicationStatus, number> = {
  new: 3,
  incomplete: 9,
  under_review: 16,
  awaiting_interview: 26,
  approved: 40,
  rejected: 33,
  disbursed: 62,
  follow_up: 96,
}

function buildDocuments(row: Row, i: number, r: () => number): UploadedDoc[] {
  const kinds: DocumentKind[] = ['national_id', 'iban_cert', 'feasibility_study']
  if (i % 3 === 0) kinds.push('commercial_register')
  if (i % 4 !== 1) kinds.push('photos')

  const age = AGE_BY_STATUS[row.status]
  return kinds.map((kind, k) => ({
    id: `DOC-${pad(i + 1, 3)}-${k + 1}`,
    kind,
    fileName: DOC_FILES[kind],
    sizeKb: intBetween(r(), 180, 4200),
    uploadedAt: daysAgo(age - 1, 9 + k),
    // `incomplete` applications are missing exactly the document staff flagged
    missing: row.status === 'incomplete' && kind === 'iban_cert',
  }))
}

function buildScore(row: Row, r: () => number): ScoreCard | undefined {
  // No score before an officer opens the file.
  if (row.status === 'new' || row.status === 'incomplete') return undefined

  const strong = ['approved', 'disbursed', 'follow_up'].includes(row.status)
  const weak = row.status === 'rejected'

  const criteria = (Object.keys(DEFAULT_WEIGHTS) as CriterionKey[]).map((key) => {
    const base = strong ? 74 : weak ? 32 : 55
    return { key, weight: DEFAULT_WEIGHTS[key], value: Math.min(100, base + intBetween(r(), 0, 22)) }
  })

  const total = Math.round(
    criteria.reduce((sum, c) => sum + (c.value * c.weight) / 100, 0),
  )

  return {
    total,
    verdict: total >= 70 ? 'eligible' : total >= 50 ? 'manual_review' : 'ineligible',
    criteria,
    computedAt: daysAgo(AGE_BY_STATUS[row.status] - 2, 11),
  }
}

/** Every status an application passed through on its way to its current one. */
function historyFor(status: ApplicationStatus): ApplicationStatus[] {
  const path: Record<ApplicationStatus, ApplicationStatus[]> = {
    new: ['new'],
    incomplete: ['new', 'incomplete'],
    under_review: ['new', 'under_review'],
    awaiting_interview: ['new', 'under_review', 'awaiting_interview'],
    approved: ['new', 'under_review', 'awaiting_interview', 'approved'],
    rejected: ['new', 'under_review', 'rejected'],
    disbursed: ['new', 'under_review', 'awaiting_interview', 'approved', 'disbursed'],
    follow_up: ['new', 'under_review', 'awaiting_interview', 'approved', 'disbursed', 'follow_up'],
  }
  return path[status]
}

function buildTimeline(row: Row, i: number): TimelineEvent[] {
  const history = historyFor(row.status)
  const age = AGE_BY_STATUS[row.status]
  const step = Math.max(1, Math.floor(age / history.length))

  return history.map((to, k) => ({
    id: `TL-${pad(i + 1, 3)}-${k + 1}`,
    kind: 'status_change' as const,
    at: daysAgo(age - k * step, 10 + (k % 6)),
    messageKey: k === 0 ? 'timeline.submitted' : 'timeline.statusChanged',
    params: { status: to },
    actor: k === 0 ? row.name : STAFF[(i + k) % STAFF.length],
    from: k === 0 ? undefined : history[k - 1],
    to,
  }))
}

function buildBeneficiary(row: Row, i: number, r: () => number): Beneficiary {
  const cities = CITIES[row.region]
  const hasCr = i % 3 === 0
  return {
    id: `BEN-${pad(i + 1, 3)}`,
    fullName: row.name,
    fullNameEn: row.nameEn,
    nationalId: `1${pad(intBetween(r(), 100000000, 999999999), 9)}`,
    phone: `05${intBetween(r(), 10000000, 59999999)}`,
    email: `${row.nameEn.split(' ')[0].toLowerCase()}@example.sa`,
    region: row.region,
    city: pick(cities, r()),
    iban: `SA${pad(intBetween(r(), 10, 99), 2)}${pad(intBetween(r(), 1000, 9999), 4)}${pad(intBetween(r(), 10000000, 99999999), 8)}${pad(intBetween(r(), 100000, 999999), 6)}`,
    hasCommercialRegister: hasCr,
    commercialRegisterNo: hasCr ? `${intBetween(r(), 1010000000, 4030999999)}` : undefined,
  }
}

function buildProject(row: Row, r: () => number): Project {
  return {
    name: row.project,
    nameEn: row.projectEn,
    sector: row.sector,
    description: `مشروع ${row.project} يهدف إلى تقديم منتجات وخدمات عالية الجودة في ${row.region === 'riyadh' ? 'منطقة الرياض' : 'المنطقة'} مع خطة توسع خلال ١٨ شهرًا.`,
    requestedAmount: row.amount,
    monthlyIncome: intBetween(r(), 3000, 22000),
    experienceYears: intBetween(r(), 1, 12),
  }
}

function buildApplication(row: Row, i: number): Application {
  const r = rng(1000 + i * 37)
  const age = AGE_BY_STATUS[row.status]
  const year = new Date().getFullYear()

  return {
    id: `APP-${pad(i + 1, 3)}`,
    ref: `APP-${year}-${pad(i + 1)}`,
    beneficiary: buildBeneficiary(row, i, r),
    project: buildProject(row, r),
    documents: buildDocuments(row, i, r),
    termsAccepted: true,
    status: row.status,
    score: buildScore(row, r),
    timeline: buildTimeline(row, i),
    assignee: row.status === 'new' ? undefined : STAFF[i % STAFF.length],
    createdAt: daysAgo(age),
    updatedAt: daysAgo(Math.max(0, age - Math.floor(age / 2))),
  }
}

export const applications: Application[] = ROWS.map(buildApplication)

/** Lookup used by the fixture builders for the other entities. */
export const applicationsById = new Map(applications.map((a) => [a.id, a]))
