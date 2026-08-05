import { useTranslation } from 'react-i18next'
import type { Application, Contract } from '@/data/types'
import { BrandMark, DateText, Money } from '@/components/shared'
import { groupIban } from '@/lib/format'

const CLAUSES = ['clause1', 'clause2', 'clause3', 'clause4'] as const

/**
 * The contract as the client will see it printed.
 * Styled to read like a document, not like the rest of the admin UI — and the
 * print stylesheet strips the app chrome around it.
 */
export function ContractDocument({
  contract,
  application,
}: {
  contract: Contract
  application: Application
}) {
  const { t } = useTranslation()

  return (
    // `text-card-foreground` is paired with `bg-card` explicitly: the document
    // is also rendered outside a dialog, where it would otherwise inherit
    // whatever foreground its container happened to set.
    <article className="mx-auto max-w-3xl bg-card p-8 text-sm leading-relaxed text-card-foreground print:p-0 print:shadow-none">
      <header className="mb-8 border-b-2 border-primary pb-5 text-center">
        {/* Letterhead. Decorative — the issuing party is named right below it. */}
        <BrandMark size={52} className="mb-3 text-primary" />
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-terracotta-ink">
          {t('contracts.doc.party1Name')}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t('contracts.doc.heading')}</h1>
        <p className="mt-2 text-xs text-muted-foreground tabular">
          {contract.contractNo} · <DateText value={contract.sentAt ?? new Date().toISOString()} />
        </p>
      </header>

      <section className="mb-6 grid gap-5 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('contracts.doc.party1')}
          </p>
          <p className="font-semibold">{t('contracts.doc.party1Name')}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('contracts.doc.party2')}
          </p>
          <p className="font-semibold">{application.beneficiary.fullName}</p>
          <p className="text-xs text-muted-foreground tabular">
            {application.beneficiary.nationalId}
          </p>
        </div>
      </section>

      <section className="mb-6 rounded-lg bg-gold-soft p-4 text-gold-ink">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide">
            {t('apply.project.requestedAmount')}
          </span>
          <span className="text-xl font-semibold">
            <Money value={contract.amount} />
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 text-xs">
          <span>{t('contracts.installments')}</span>
          <span className="font-semibold tabular">{contract.installments}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2 text-xs">
          <span>{t('common.iban')}</span>
          <span className="font-semibold tabular" dir="ltr">
            {groupIban(application.beneficiary.iban)}
          </span>
        </div>
      </section>

      <p className="mb-4">{t('contracts.doc.preamble')}</p>

      <ol className="mb-8 space-y-3">
        {CLAUSES.map((clause, index) => (
          <li key={clause} className="flex gap-3">
            <span className="font-semibold tabular">{index + 1}.</span>
            <span>{t(`contracts.doc.${clause}`)}</span>
          </li>
        ))}
      </ol>

      {/* Both parties sign. The programme's mark is stamped on centrally when
          the contract is drawn up; the beneficiary's comes back from her portal
          and is what completes the agreement. Whichever is missing says so
          explicitly rather than leaving an ambiguous blank line. */}
      <footer className="grid gap-8 border-t border-border pt-8 sm:grid-cols-2">
        <SignatureBlock
          testId="contract-signature-org"
          title={t('contracts.doc.signature1')}
          party={contract.orgSignatureName ?? t('contracts.doc.party1Name')}
          image={contract.orgSignatureImage}
          alt={t('contracts.doc.orgSignatureAlt')}
          at={contract.orgSignedAt}
          signed={Boolean(contract.orgSignatureName || contract.orgSignatureImage)}
        />
        <SignatureBlock
          testId="contract-signature-beneficiary"
          title={t('contracts.doc.signature2')}
          party={contract.signatureName ?? application.beneficiary.fullName}
          image={contract.signatureImage}
          alt={t('contracts.doc.beneficiarySignatureAlt')}
          at={contract.signedAt}
          signed={Boolean(contract.signatureName || contract.signatureImage)}
        />
      </footer>
    </article>
  )
}

/**
 * One party's signature on the document: the mark, who signed, and when.
 *
 * The ink is an `<img>`, so it cannot follow the theme the way the live pad
 * does — the marks are authored in colours that read on both the light and the
 * dark card, and `print:` keeps them on the page rather than in a background.
 */
function SignatureBlock({
  testId,
  title,
  party,
  image,
  alt,
  at,
  signed,
}: {
  testId: string
  title: string
  party: string
  image?: string
  alt: string
  at?: string
  signed: boolean
}) {
  const { t } = useTranslation()

  return (
    <div data-testid={testId} data-signed={signed ? 'true' : 'false'}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>

      {image ? (
        <img src={image} alt={alt} className="mb-1 h-14 w-auto max-w-full object-contain object-start" />
      ) : signed ? (
        <p className="mb-1 h-14 text-2xl leading-[3.5rem] text-terracotta-ink" style={{ fontFamily: 'cursive' }}>
          {party}
        </p>
      ) : (
        <p className="mb-1 flex h-14 items-center text-xs font-medium text-muted-foreground">
          {t('contracts.doc.awaitingSignature')}
        </p>
      )}

      <div className="border-t border-input pt-2 text-xs text-muted-foreground">
        {party}
        {signed && at ? (
          <>
            {' · '}
            <DateText value={at} withTime />
          </>
        ) : null}
      </div>
    </div>
  )
}
