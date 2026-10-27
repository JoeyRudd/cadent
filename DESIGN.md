# Design

Direction **D · Sage & Teal**: data-first, calm and friendly. Tokens live in `src/app/globals.css`;
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

Font: Figtree via `next/font` (self-hosted at build), tabular figures on every number. Dark-mode
values are in `globals.css` and still need a contrast check.

## Rules

- Use the token names (`bg-surface`, `text-muted`, `rounded-card`), never raw hex or arbitrary values.
- Phone width first. Touch targets at least 44px. Text contrast WCAG AA.
- Components never fetch data; pages pass it in.
