import type { NotificationChannel, NotificationTrigger } from './types'

/**
 * The notification trigger matrix. Editing a body here changes the message
 * everywhere it is sent — templates are never inlined at the call site.
 * `{{ref}}` and `{{name}}` are interpolated when the notification is pushed.
 */
export const NOTIFICATION_BODIES: Record<NotificationTrigger, { ar: string; en: string }> = {
  received: {
    ar: 'تم استلام طلبك بنجاح. رقم الطلب: {{ref}}. سنوافيك بالمستجدات.',
    en: 'Your application has been received. Reference: {{ref}}. We will keep you posted.',
  },
  incomplete: {
    ar: 'طلبك {{ref}} يحتاج إلى مستندات إضافية. يرجى الدخول على صفحة التتبّع لاستكمالها.',
    en: 'Application {{ref}} needs additional documents. Open the tracking page to complete it.',
  },
  interview_scheduled: {
    ar: 'تم تحديد موعد مقابلتك لطلب {{ref}}. التفاصيل ورابط الاجتماع في صفحة التتبّع.',
    en: 'Your interview for application {{ref}} has been scheduled. Details and the meeting link are on the tracking page.',
  },
  approved: {
    ar: 'مبروك {{name}}! تم اعتماد طلبك {{ref}}. سيصلك العقد للتوقيع الإلكتروني.',
    en: 'Congratulations {{name}}! Application {{ref}} has been approved. Your contract will arrive for e-signature.',
  },
  rejected: {
    ar: 'نأسف، لم يتم قبول طلبك {{ref}}. يمكنك الاطلاع على السبب في صفحة التتبّع.',
    en: 'We are sorry, application {{ref}} was not approved. You can see the reason on the tracking page.',
  },
  contract_signed: {
    ar: 'تم توقيع العقد الخاص بطلب {{ref}} بنجاح. جارٍ تجهيز أمر الصرف.',
    en: 'The contract for application {{ref}} has been signed. Your payment order is being prepared.',
  },
  disbursed: {
    ar: 'تم صرف مبلغ التمويل لطلب {{ref}} إلى حسابك البنكي المسجّل.',
    en: 'The funding for application {{ref}} has been transferred to your registered bank account.',
  },
  follow_up_due: {
    ar: 'حان موعد تقرير المتابعة الدوري لمشروعك ({{ref}}). يستغرق دقيقتين فقط.',
    en: 'Your periodic follow-up report for {{ref}} is due. It only takes two minutes.',
  },
}

/** Default channel mix per trigger — the module 09 matrix; editable in admin settings. */
export const DEFAULT_CHANNELS: Record<NotificationTrigger, NotificationChannel[]> = {
  received: ['sms', 'email'],
  incomplete: ['sms', 'whatsapp'],
  interview_scheduled: ['sms', 'whatsapp', 'email'],
  approved: ['sms', 'email'],
  rejected: ['sms', 'email'],
  contract_signed: ['email'],
  disbursed: ['sms', 'whatsapp'],
  follow_up_due: ['whatsapp'],
}

export interface TemplateParams {
  ref: string
  name: string
}

/**
 * Renders one template. Every `{{placeholder}}` must resolve: an unresolved one
 * would ship to the applicant's phone as literal braces, so anything the params
 * do not cover is stripped rather than left in the body.
 */
export function renderTemplate(
  trigger: NotificationTrigger,
  lang: 'ar' | 'en',
  params: TemplateParams,
): string {
  const template = lang === 'ar' ? NOTIFICATION_BODIES[trigger].ar : NOTIFICATION_BODIES[trigger].en
  return template
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => {
      const value = (params as unknown as Record<string, string | undefined>)[key]
      return value ?? ''
    })
    .replace(/\s{2,}/g, ' ')
    .trim()
}
