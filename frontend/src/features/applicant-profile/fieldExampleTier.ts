/** Maps wizard seniority target to example copy tier. */
export type ExampleTier = 'junior' | 'mid' | 'senior'

const JUNIOR_SENIORITY = new Set(['intern', 'junior', ''])
const MID_SENIORITY = new Set(['mid'])
// staff, principal, lead, manager, director → senior examples

export function seniorityToExampleTier(seniorityTarget: string): ExampleTier {
  if (MID_SENIORITY.has(seniorityTarget)) return 'mid'
  if (JUNIOR_SENIORITY.has(seniorityTarget)) return 'junior'
  return 'senior'
}

export function exampleTierLabel(tier: ExampleTier): string {
  switch (tier) {
    case 'junior':
      return 'Junior'
    case 'mid':
      return 'Mid-level'
    case 'senior':
      return 'Senior'
  }
}
