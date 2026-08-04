# Module 09 — Notifications & Automation (الإشعارات والأتمتة)

**Audience:** system-wide (simulated). **Surfaces:** notification center (admin header bell), per-application
timeline, `/admin/settings` templates, beneficiary `/track` inbox strip.
**Load with:** `foundation/data-model.md`, `foundation/localization.md`, `foundation/state-management.md`.

## Purpose
Simulate SMS / WhatsApp / Email automation on every lifecycle event. Demo shows WHAT would be sent and WHEN.

## Trigger matrix (auto-fired inside `useDemoDataStore` mutators — single choke point)

| Trigger | Fired by | Default channels |
|---|---|---|
| `received` | submit application (m01) | sms + email |
| `incomplete` | mark incomplete (m02) | sms + whatsapp |
| `interview_scheduled` | schedule interview (m04) | sms + whatsapp + email |
| `approved` / `rejected` | decision (m02) | sms + email |
| `contract_signed` | signing (m05) | email |
| `disbursed` | mark paid (m06) | sms + whatsapp |
| `follow_up_due` | reminder / auto-schedule (m07) | whatsapp |

## Behaviors

1. **Message templates** — `src/features/notifications/templates.ts`: per trigger × channel, AR + EN,
   with `{{name}} {{ref}} {{date}} {{amount}}` interpolation. Toggleable per channel in `/admin/settings`.
2. **Notification center** — bell (GSAP morph: rings on new) in admin header → popover list
   (channel icon, applicant, rendered message preview, time-ago). "Simulated delivery" badge.
3. **Phone mock preview** — in settings & in application timeline: clicking a notification opens a
   phone-frame dialog rendering the message as an SMS/WhatsApp bubble (WhatsApp-green vs SMS-gray) — client wow-moment.
4. **Beneficiary side** — `/track` shows her notifications for that application as a message list.

## Acceptance criteria
- Every mutator in the demo store fires the right trigger exactly once; timeline + bell + track all show it.
- Disabling a channel in settings stops future messages on that channel only.
