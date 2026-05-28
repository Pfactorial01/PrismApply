import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { exampleTierLabel, seniorityToExampleTier } from './fieldExampleTier'
import { getFieldExample, type FieldExampleKey } from './fieldExamples'

type FieldExampleModalProps = {
  exampleKey: FieldExampleKey
  seniorityTarget: string
  /** Override question when field label varies by step (e.g. transitional copy). */
  questionOverride?: string
}

export function FieldExampleButton({
  exampleKey,
  seniorityTarget,
  questionOverride,
}: FieldExampleModalProps) {
  const [open, setOpen] = useState(false)
  const example = getFieldExample(exampleKey, seniorityTarget)

  if (!example) return null

  const tier = seniorityToExampleTier(seniorityTarget)
  const question = questionOverride ?? example.question

  return (
    <>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto px-0 py-0 text-xs font-normal text-primary"
        onClick={() => setOpen(true)}
      >
        View example
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Example · {exampleTierLabel(tier)} level
            </p>
            <DialogTitle className="text-base leading-snug">{question}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto rounded-md border bg-muted/30 px-4 py-3">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {example.answer}
            </p>
          </div>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  )
}
