/**
 * PROTOTYPE - Direction B „Фокус“ tokens. Scoped to `.proto-b` (and to Radix
 * portal content that carries the same class). `.dark` comes from next-themes
 * on <html>. Monochrome + one emerald accent, Sofia Sans.
 */
export const B_FONT_URL =
  'https://fonts.googleapis.com/css2?family=Sofia+Sans:wght@300;400;500;600;700;800&display=swap'

const CSS = `
.proto-b {
  --b-bg: oklch(0.975 0.003 160);
  --b-surface: oklch(0.99 0.002 160);
  --b-text: oklch(0.2 0.01 165);
  --b-muted: oklch(0.5 0.01 165);
  --b-line: oklch(0.9 0.005 160);
  --b-accent: oklch(0.52 0.13 162);
  --b-accent-ink: oklch(0.98 0.01 162);
  --b-warn: oklch(0.56 0.14 60);
  --b-fill: color-mix(in oklch, var(--b-text) 5%, transparent);
  --b-fill-strong: color-mix(in oklch, var(--b-text) 9%, transparent);
  --b-accent-soft: color-mix(in oklch, var(--b-accent) 11%, transparent);
  --b-lift: 0 -18px 50px -12px oklch(0.2 0.02 165 / 0.18);
  font-family: 'Sofia Sans', ui-sans-serif, system-ui, sans-serif;
  font-size: 17px;
  line-height: 1.4;
  color: var(--b-text);
  background: var(--b-bg);
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}
.dark .proto-b {
  --b-bg: oklch(0.16 0.006 165);
  --b-surface: oklch(0.2 0.008 165);
  --b-text: oklch(0.95 0.004 160);
  --b-muted: oklch(0.7 0.01 160);
  --b-line: oklch(0.3 0.01 165);
  --b-accent: oklch(0.74 0.14 162);
  --b-accent-ink: oklch(0.18 0.04 162);
  --b-warn: oklch(0.8 0.12 75);
  --b-fill: color-mix(in oklch, var(--b-text) 6%, transparent);
  --b-fill-strong: color-mix(in oklch, var(--b-text) 11%, transparent);
  --b-accent-soft: color-mix(in oklch, var(--b-accent) 14%, transparent);
  --b-lift: 0 -18px 50px -12px oklch(0.05 0.01 165 / 0.6);
}
.proto-b .b-num { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1, 'lnum' 1; }
.proto-b .b-display { font-weight: 300; letter-spacing: -0.04em; line-height: 0.95; }
.proto-b .b-question { font-weight: 600; letter-spacing: -0.015em; line-height: 1.1; text-wrap: balance; }
.proto-b :focus-visible { outline: 2px solid var(--b-accent); outline-offset: 3px; }
.proto-b input:focus-visible { outline: none; }
.proto-b input::placeholder { color: var(--b-muted); opacity: 1; }
.proto-b .b-skel { background: var(--b-fill-strong); border-radius: 999px; position: relative; overflow: hidden; }
@media (prefers-reduced-motion: no-preference) {
  .proto-b .b-skel::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent, color-mix(in oklch, var(--b-surface) 70%, transparent), transparent);
    transform: translateX(-100%);
    animation: b-shimmer 1.4s ease-in-out infinite;
  }
}
@keyframes b-shimmer { to { transform: translateX(100%); } }
.proto-b .b-context { opacity: 0.5; filter: saturate(0.6); transition: opacity 0.3s ease, filter 0.3s ease; }
.proto-b .b-context:hover, .proto-b .b-context:focus-within { opacity: 1; filter: none; }
`

export function BStyles() {
  return <style>{CSS}</style>
}
