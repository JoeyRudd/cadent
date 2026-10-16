# Design

Direction **D · Sage & Teal**: data-first, calm and friendly. Tokens live in `web/src/tokens.css`;
this file records the rules they encode.

## Principles

- **The number is the hero.** One main figure per screen, large; details quieter beneath it.
- **Calm by default.** Sage-tinted neutrals, generous spacing, few borders. Colour carries meaning only.
- **Friendly, not cute.** Rounded shapes and encouraging copy. No confetti or mascots.
- **Honest and kind.** Off-plan is stated plainly and gently ("2 km short today, that's fine").
  Safety warnings are the one place the UI is firm.

## Tokens

| Token | Light | Use |
| --- | --- | --- |
| `bg` | `#F4F5EF` | Page |
| `surface` | `#FFFFFF` | Cards |
| `line` | `#DFE3D5` | Borders |
| `ink` / `muted` | `#20271F` / `#5D665B` | Text |
| `accent` | `#277A70` | Primary actions, today's session |
| `accent-soft` / `accent-ink` | `#E1EFEA` / `#1F6259` | Today's hero card |
| `on-plan` / `on-plan-soft` | `#2F6A3B` / `#E1EDDD` | Target hit |
| `off-plan` / `off-plan-soft` | `#7E5A10` / `#FAEED3` | Over or under, gentle |
| `warning` | `#A3412D` | Safety rules only |
| `rounded-card` / `rounded-button` | 20px / 14px | Shapes |

Font: Figtree (variable, self-hosted), tabular figures on every number. Dark-mode values are in
`tokens.css` and still need a contrast check.

## Rules

- No raw hex values or arbitrary Tailwind values in components (ESLint enforces it).
- Touch targets at least 44px. Text contrast WCAG AA.
- Components never fetch data; pages pass it in.
