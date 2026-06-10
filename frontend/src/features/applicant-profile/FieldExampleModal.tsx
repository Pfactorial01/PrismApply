import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { exampleTierLabel, seniorityToExampleTier, type ExampleTier } from './fieldExampleTier'
import {
  getFieldExample,
  getFieldExamplesForAllTiers,
  hasFieldExample,
  type FieldExampleKey,
} from './fieldExamples'

type FieldExampleModalProps = {
  exampleKey: FieldExampleKey
  seniorityTarget: string
  /** Override question when field label varies by step (e.g. transitional copy). */
  questionOverride?: string
  /** When true, show junior, mid-level, and senior examples in one modal. */
  showAllTiers?: boolean
}

export function FieldExampleButton({
  exampleKey,
  seniorityTarget,
  questionOverride,
  showAllTiers = false,
}: FieldExampleModalProps) {
  const [open, setOpen] = useState(false)
  const tier = seniorityToExampleTier(seniorityTarget)
  const singleExample = getFieldExample(exampleKey, seniorityTarget)
  const allExamples = showAllTiers ? getFieldExamplesForAllTiers(exampleKey) : []
  const defaultTier = allExamples.some((e) => e.tier === tier)
    ? tier
    : (allExamples[0]?.tier ?? 'junior')

  if (!hasFieldExample(exampleKey)) return null
  const question =
    questionOverride ??
    (showAllTiers ? allExamples[0]?.example.question : singleExample?.question) ??
    'Example answer'

  return (
    <>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto px-0 py-0 text-xs font-normal text-primary"
        onClick={() => setOpen(true)}
      >
        View examples
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={showAllTiers ? 'sm:max-w-2xl' : 'sm:max-w-lg'} showCloseButton>
          <DialogHeader>
            {!showAllTiers ? (
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Example · {exampleTierLabel(tier)} level
              </p>
            ) : (
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Example answers by level
              </p>
            )}
            <DialogTitle className="text-base leading-snug">{question}</DialogTitle>
          </DialogHeader>
          {showAllTiers ? (
            open ? (
              <TierExampleTabs examples={allExamples} defaultTier={defaultTier} />
            ) : null
          ) : (
            <ExampleAnswerPanel answer={singleExample?.answer ?? ''} />
          )}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  )
}

function TierExampleTabs({
  examples,
  defaultTier,
}: {
  examples: Array<{ tier: ExampleTier; example: { answer: string } }>
  defaultTier: ExampleTier
}) {
  const [activeTier, setActiveTier] = useState(defaultTier)
  const activeExample = examples.find((e) => e.tier === activeTier) ?? examples[0]

  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <div
        className="grid w-full grid-cols-3 gap-1 rounded-md border border-border bg-muted p-1 dark:bg-secondary"
        role="tablist"
        aria-label="Example level"
      >
        {examples.map(({ tier }) => {
          const selected = activeTier === tier
          return (
            <button
              key={tier}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTier(tier)}
              className={cn(
                'rounded-sm px-2 py-2 text-sm font-medium transition-colors',
                selected
                  ? 'bg-background text-foreground shadow-sm dark:bg-card'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {exampleTierLabel(tier)}
            </button>
          )
        })}
      </div>
      <div role="tabpanel">
        <ExampleAnswerPanel answer={activeExample?.example.answer ?? ''} />
      </div>
    </div>
  )
}

function ExampleAnswerPanel({ answer }: { answer: string }) {
  return (
    <div className="h-72 w-full min-w-0 overflow-y-auto rounded-md border bg-muted/30 px-4 py-3">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{answer}</p>
    </div>
  )
}
