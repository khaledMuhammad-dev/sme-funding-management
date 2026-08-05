import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DateText } from '@/components/shared'
import type { Application, Contract } from '@/data/types'
import { useSignContractAsBeneficiary } from '@/lib/api'
import { ContractDocument } from './ContractDocument'
import { SignaturePad } from './SignaturePad'

/**
 * The demo verification code.
 *
 * Deliberately fixed and printed under the field: a demo that asks for a code
 * nobody can guess dead-ends in front of the client.
 */
export const DEMO_OTP = '1234'

export interface BeneficiarySigningDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The contract she was sent. `null` while none is loaded. */
  contract: Contract | null
  /** Her application — the document is merged from it. */
  application?: Application
  /** Fired after the signature has been recorded, for a toast or a scroll. */
  onSigned?: (contract: Contract) => void
}

/**
 * The applicant signs her funding contract.
 *
 * This is the *only* interactive signing surface in the product. The programme
 * has already signed — its authorised signatory is configured once in
 * `/admin/settings` and stamped onto the contract when it is drawn up — so what
 * happens here is the beneficiary returning the completed agreement. Her
 * signature is what flips the contract to `signed` and releases the money path.
 *
 * Fully operable from the keyboard: the pad's "use typed name" fallback writes
 * the name already entered above into the pad as the signature mark, so a
 * pointer is never required to get through the flow.
 *
 * Self-contained — it owns the mutation, the toast and its own reset. Mount it
 * anywhere the applicant can see her contract; it needs no state from the host
 * beyond `open`.
 */
export function BeneficiarySigningDialog({
  open,
  onOpenChange,
  contract,
  application,
  onSigned,
}: BeneficiarySigningDialogProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState(false)
  const signContract = useSignContractAsBeneficiary()

  // Every open starts from a blank slate — a leftover code or name from the
  // previous session would be worse than an empty form.
  useEffect(() => {
    if (open) {
      setName('')
      setSignature(null)
      setOtp('')
      setOtpError(false)
    }
  }, [open, contract?.id])

  const alreadySigned = contract?.status === 'signed'
  const canSign =
    !alreadySigned && name.trim().length >= 4 && Boolean(signature) && otp.length === 4

  const handleConfirm = () => {
    if (!contract) return
    if (otp !== DEMO_OTP) {
      setOtpError(true)
      return
    }
    signContract.mutate(
      { contractId: contract.id, signatureName: name.trim(), signatureImage: signature ?? undefined },
      {
        onSuccess: () => {
          toast.success(t('contracts.signing.success'))
          onSigned?.(contract)
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="beneficiary-signing-dialog"
        className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl [&>*]:min-w-0"
      >
        <DialogHeader className="min-w-0">
          <DialogTitle>{t('contracts.signing.title')}</DialogTitle>
          <DialogDescription>{t('contracts.signing.beneficiaryDescription')}</DialogDescription>
        </DialogHeader>

        {contract && application ? (
          <div className="min-w-0 space-y-5">
            {/* She is signing something already signed by the programme — saying
                so removes the "am I signing first, into the void?" hesitation. */}
            <p
              data-testid="signing-org-note"
              className="rounded-lg bg-info-soft px-4 py-3 text-xs font-medium text-info"
            >
              {contract.orgSignatureName
                ? t('contracts.signing.orgAlreadySigned', { name: contract.orgSignatureName })
                : t('contracts.signing.orgSignaturePending')}
              {contract.orgSignedAt ? (
                <>
                  {' · '}
                  <DateText value={contract.orgSignedAt} />
                </>
              ) : null}
            </p>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
              <ContractDocument contract={contract} application={application} />
            </div>

            {alreadySigned ? (
              <p className="rounded-lg bg-success-soft px-4 py-3 text-sm font-medium text-success">
                {t('contracts.signing.alreadySigned')}
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="sign-name">{t('contracts.signing.nameLabel')}</Label>
                  <Input
                    id="sign-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={application.beneficiary.fullName}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>{t('contracts.signing.padLabel')}</Label>
                  <SignaturePad onChange={setSignature} typedName={name} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="sign-otp">{t('contracts.signing.otpLabel')}</Label>
                  <Input
                    id="sign-otp"
                    value={otp}
                    onChange={(event) => {
                      setOtp(event.target.value.replace(/\D/g, '').slice(0, 4))
                      setOtpError(false)
                    }}
                    inputMode="numeric"
                    maxLength={4}
                    dir="ltr"
                    aria-invalid={otpError}
                    className="w-32 text-center text-lg tracking-[0.4em] tabular"
                  />
                  {otpError ? (
                    <p className="text-xs font-medium text-destructive">
                      {t('contracts.signing.otpWrong')}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t('contracts.signing.otpHint', { code: DEMO_OTP })}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        ) : null}

        <DialogFooter className="min-w-0 flex-wrap">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={signContract.isPending}
          >
            {t('common.cancel')}
          </Button>
          {!alreadySigned ? (
            <Button onClick={handleConfirm} disabled={!canSign || signContract.isPending}>
              {signContract.isPending ? t('common.saving') : t('contracts.signing.confirm')}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Button + dialog in one, for hosts that only want to drop signing in.
 *
 * Renders nothing unless the contract is actually awaiting her signature, so a
 * host can mount it unconditionally next to the contract it belongs to.
 */
export function BeneficiarySignAction({
  contract,
  application,
  className,
}: {
  contract: Contract | null
  application?: Application
  className?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  if (!contract || !application || contract.status !== 'sent') return null

  return (
    <>
      <Button
        size="sm"
        className={className}
        data-testid="track-contract-sign"
        onClick={() => setOpen(true)}
      >
        {t('contracts.signing.signNow')}
      </Button>
      <BeneficiarySigningDialog
        open={open}
        onOpenChange={setOpen}
        contract={contract}
        application={application}
      />
    </>
  )
}
