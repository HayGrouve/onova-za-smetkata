/**
 * PROTOTYPE — Direction A tokens. Scoped on `.proto-a` and remapped onto the
 * shadcn variables, so Sheet / Dialog / DropdownMenu pick the palette up too.
 * `.dark` lives on <html> (next-themes), so portals in <body> match as well.
 */
export const FONT_URL =
  'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@500&display=swap'

export const PROTO_A_CSS = `
.proto-a {
  --a-bg: oklch(0.985 0.002 250);
  --a-surface: oklch(0.995 0 0);
  --a-surface-2: oklch(0.965 0.003 250);
  --a-text: oklch(0.24 0.01 260);
  --a-muted: oklch(0.52 0.012 260);
  --a-hairline: oklch(0.92 0.004 250);
  --a-accent: oklch(0.52 0.19 262);
  --a-on-accent: oklch(0.985 0.004 262);
  --a-accent-soft: oklch(0.95 0.03 262);
  --a-paid: oklch(0.5 0.12 155);
  --a-pending: oklch(0.53 0.13 62);
  --a-pending-strong: oklch(0.68 0.15 70);
  --a-danger: oklch(0.56 0.19 27);
  --a-field: oklch(0.72 0.01 255);
  --a-sheet-shadow: 0 -8px 30px oklch(0.24 0.01 260 / 0.12);

  --background: var(--a-bg);
  --foreground: var(--a-text);
  --card: var(--a-surface);
  --card-foreground: var(--a-text);
  --popover: var(--a-surface);
  --popover-foreground: var(--a-text);
  --primary: var(--a-accent);
  --primary-foreground: var(--a-on-accent);
  --secondary: var(--a-surface-2);
  --secondary-foreground: var(--a-text);
  --muted: var(--a-surface-2);
  --muted-foreground: var(--a-muted);
  --accent: var(--a-accent-soft);
  --accent-foreground: var(--a-accent);
  --destructive: var(--a-danger);
  --border: var(--a-hairline);
  --input: var(--a-field);
  --ring: oklch(0.52 0.19 262 / 45%);

  font-family: 'Geist', ui-sans-serif, system-ui, sans-serif;
  color: var(--a-text);
  -webkit-font-smoothing: antialiased;
  font-feature-settings: 'ss01' on;
}
.dark .proto-a {
  --a-bg: oklch(0.17 0.005 260);
  --a-surface: oklch(0.215 0.006 260);
  --a-surface-2: oklch(0.25 0.007 260);
  --a-text: oklch(0.94 0.004 250);
  --a-muted: oklch(0.7 0.01 255);
  --a-hairline: oklch(0.3 0.008 260);
  --a-accent: oklch(0.68 0.15 258);
  --a-on-accent: oklch(0.17 0.03 262);
  --a-accent-soft: oklch(0.3 0.07 262);
  --a-paid: oklch(0.72 0.13 155);
  --a-pending: oklch(0.78 0.13 75);
  --a-pending-strong: oklch(0.78 0.13 75);
  --a-danger: oklch(0.66 0.17 27);
  --a-field: oklch(0.45 0.01 260);
  --a-sheet-shadow: 0 -8px 30px oklch(0.08 0.01 260 / 0.5);
  --ring: oklch(0.68 0.15 258 / 50%);
}
.proto-a .a-mono { font-family: 'Geist Mono', ui-monospace, monospace; }
.proto-a ::selection { background: var(--a-accent-soft); }
`
