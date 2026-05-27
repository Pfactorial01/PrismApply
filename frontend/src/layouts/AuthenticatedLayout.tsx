import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { SidepanelLayout } from '@/components/sidepanel'

export function AuthenticatedLayout() {
  return (
    <>
      <SidepanelLayout />
      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </>
  )
}
