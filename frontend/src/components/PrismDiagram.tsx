type PrismDiagramProps = {
  className?: string
}

type Point = { x: number; y: number }

function lerp(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  }
}

/** Point on edge, shifted outward (away from triangle interior). */
function offsetFromEdge(edgeStart: Point, edgeEnd: Point, t: number, gap: number): Point {
  const p = lerp(edgeStart, edgeEnd, t)
  const dx = edgeEnd.x - edgeStart.x
  const dy = edgeEnd.y - edgeStart.y
  const len = Math.hypot(dx, dy) || 1
  const nx = dy / len
  const ny = -dx / len
  return { x: p.x + nx * gap, y: p.y + ny * gap }
}

const BEAM_LENGTH = 180
const LABEL_GAP = 12
const BEAM_FACE_GAP = 18

/** Side-view triangular prism: one story in, many tailored applications out. */
export function PrismDiagram({ className }: PrismDiagramProps) {
  const apex: Point = { x: 320, y: 52 }
  const baseLeft: Point = { x: 150, y: 220 }
  const baseRight: Point = { x: 490, y: 220 }

  const incomingY = 148
  const beams = [
    {
      origin: offsetFromEdge(apex, baseRight, 0.26, BEAM_FACE_GAP),
      angle: -10,
      label: 'Tailored application 1',
      grad: 'pa-beam-1',
    },
    {
      origin: offsetFromEdge(apex, baseRight, 0.52, BEAM_FACE_GAP),
      angle: 0,
      label: 'Tailored application 2',
      grad: 'pa-beam-2',
    },
    {
      origin: offsetFromEdge(apex, baseRight, 0.78, BEAM_FACE_GAP),
      angle: 10,
      label: 'Tailored application 3',
      grad: 'pa-beam-3',
    },
  ] as const

  return (
    <svg
      viewBox="0 0 920 260"
      fill="none"
      overflow="visible"
      role="img"
      aria-labelledby="prism-diagram-title"
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <title id="prism-diagram-title">Your story enters a triangular prism and becomes tailored applications</title>
      <defs>
        <linearGradient id="pa-beam-in" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0" />
          <stop offset="45%" stopColor="var(--color-primary)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.6" />
        </linearGradient>
        <linearGradient id="pa-beam-1" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ff6b6b" />
        </linearGradient>
        <linearGradient id="pa-beam-2" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#51cf66" />
        </linearGradient>
        <linearGradient id="pa-beam-3" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#4dabf7" />
        </linearGradient>
        <linearGradient id="pa-prism-glass" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.1" />
        </linearGradient>
      </defs>

      {/* incoming beam */}
      <g transform={`rotate(0, 16, ${incomingY})`}>
        <rect x={16} y={incomingY - 5} width={148} height={10} rx={5} fill="url(#pa-beam-in)" />
        <text
          x={16}
          y={incomingY - 12}
          fill="currentColor"
          fontFamily="Inter, system-ui, sans-serif"
          fontSize="13"
          fontWeight="600"
        >
          Your story
        </text>
      </g>

      {/* triangular prism — side view */}
      <path
        d={`M ${baseLeft.x} ${baseLeft.y} L ${apex.x} ${apex.y} L ${baseRight.x} ${baseRight.y} Z`}
        fill="url(#pa-prism-glass)"
        stroke="var(--color-primary)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d={`M ${baseLeft.x + 22} ${baseLeft.y - 14} L ${apex.x} ${apex.y + 16} L ${baseRight.x - 22} ${baseRight.y - 14} Z`}
        fill="var(--color-primary)"
        fillOpacity="0.14"
      />
      <line
        x1={baseLeft.x}
        y1={baseLeft.y}
        x2={baseRight.x}
        y2={baseRight.y}
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeOpacity="0.35"
      />

      {/* outgoing beams + labels — origins offset from prism face */}
      {beams.map((beam) => {
        const { x: ox, y: oy } = beam.origin
        return (
          <g key={beam.label} transform={`rotate(${beam.angle}, ${ox}, ${oy})`}>
            <rect
              x={ox}
              y={oy - 5}
              width={BEAM_LENGTH}
              height={10}
              rx={5}
              fill={`url(#${beam.grad})`}
            />
            <text
              x={ox + BEAM_LENGTH + LABEL_GAP}
              y={oy + 4}
              fill="currentColor"
              fillOpacity="0.9"
              fontFamily="Inter, system-ui, sans-serif"
              fontSize="12"
              fontWeight="500"
              style={{ whiteSpace: 'pre' }}
            >
              {beam.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
