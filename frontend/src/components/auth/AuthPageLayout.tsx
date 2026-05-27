import type { ReactNode } from 'react'
import { Briefcase, FileText, Mic, Search } from 'lucide-react'
import { PrismDiagram } from '@/components/PrismDiagram'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  describeOnceLine,
  interviewPrepLine,
  productName,
  tagline,
  truthPledge,
} from '@/lib/copy'

const FEATURES = [
  {
    icon: Search,
    title: 'We search & tailor',
    description: describeOnceLine,
  },
  {
    icon: FileText,
    title: 'Tailored, not generic',
    description: 'Resume, cover letter, and form answers rewritten per role.',
  },
  {
    icon: Mic,
    title: 'You prep for interviews',
    description: interviewPrepLine,
  },
] as const

type AuthPageLayoutProps = {
  title: string
  description: ReactNode
  children: ReactNode
}

export function AuthPageLayout({ title, description, children }: AuthPageLayoutProps) {
  return (
    <div className="grid h-dvh max-h-dvh overflow-hidden lg:grid-cols-[3fr_2fr] xl:grid-cols-[7fr_5fr]">
      {/* Brand panel */}
      <div className="relative hidden min-h-0 border-r border-border bg-sidebar lg:flex lg:flex-col lg:overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-chart-3/10 dark:from-primary/15 dark:to-chart-3/8"
          aria-hidden
        />

        <div className="relative flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-8 xl:gap-5 xl:p-10">
          {/* Header */}
          <div className="shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground">
                P
              </div>
              <span className="text-lg font-semibold tracking-tight">{productName}</span>
            </div>
            <p className="mt-5 text-xl font-semibold leading-snug tracking-tight text-foreground xl:text-2xl">
              {tagline}
            </p>
            <p className="mt-2 max-w-md text-sm leading-snug text-muted-foreground">
              Stop sending{' '}
              <span className="line-through decoration-muted-foreground/70 text-muted-foreground/80">
                generic
              </span>{' '}
              applications. Start sending{' '}
              <span className="font-medium text-foreground">tailored</span> ones — built from your
              story, never fabricated.
            </p>
          </div>

          {/* Features */}
          <ul className="grid shrink-0 gap-2 lg:grid-cols-3 lg:gap-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3 rounded-lg border border-border/60 bg-card/50 p-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <f.icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight text-foreground">{f.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-muted-foreground">
                    {f.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {/* Prism — between features and bottom cards */}
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-visible px-1 py-2">
            <PrismDiagram className="h-auto w-full max-h-[min(260px,42vh)] text-muted-foreground" />
          </div>

          {/* Bottom row */}
          <div className="mt-auto grid shrink-0 gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card/80 p-3.5 shadow-whisper backdrop-blur-sm">
              <p className="text-xs font-medium text-foreground">Our truth pledge</p>
              <p className="mt-1 line-clamp-3 text-xs leading-snug text-muted-foreground">
                {truthPledge}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card/80 p-3.5 shadow-whisper backdrop-blur-sm">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-chart-3/15">
                  <Briefcase className="size-3.5 text-chart-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">Senior Software Engineer</p>
                  <p className="truncate text-xs text-muted-foreground">DeleteMe · Ready to send</p>
                </div>
                <span className="shrink-0 rounded-sm bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  Tailored
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex min-h-0 flex-col overflow-y-auto bg-background">
        <div className="flex items-center gap-3 border-b border-border px-6 py-4 lg:hidden">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            P
          </div>
          <span className="text-sm font-semibold">{productName}</span>
        </div>

        <div className="flex flex-1 flex-col justify-center px-6 py-8 sm:px-10 lg:px-12 lg:py-10 xl:px-16">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-6 lg:hidden">
              <h2 className="text-xl font-semibold tracking-tight">{tagline}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {describeOnceLine} {interviewPrepLine}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {FEATURES.map((f) => (
                  <span
                    key={f.title}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    <f.icon className="size-3.5 text-primary" />
                    {f.title}
                  </span>
                ))}
              </div>
            </div>

            <Card className="w-full shadow-soft">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent>{children}</CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
