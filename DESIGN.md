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

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `bg` | `#F4F5EF` | `#141A17` | Page |
| `surface` | `#FFFFFF` | `#1C2420` | Cards |
| `line` | `#DFE3D5` | `#2C3631` | Borders |
| `ink` / `muted` | `#20271F` / `#5D665B` | `#ECF0EC` / `#A0AAA3` | Text |
| `accent` / `on-accent` | `#277A70` / `#FFFFFF` | `#5FB3A7` / `#0F2420` | Primary actions, today's session |
| `accent-soft` / `accent-ink` | `#E1EFEA` / `#1F6259` | `#1E3430` / `#9FD3CA` | Today's hero card |
| `on-plan` / `on-plan-soft` | `#2F6A3B` / `#E1EDDD` | `#8FD4A8` / `#1A3324` | Target hit |
| `off-plan` / `off-plan-soft` | `#7E5A10` / `#FAEED3` | `#F0C47A` / `#36291A` | Over or under, gentle |
| `warning` | `#A3412D` | `#E8836C` | Safety rules only |
| `rounded-card` / `rounded-button` | 20px / 14px | | Shapes |

Font: Figtree via `next/font` (self-hosted at build), tabular figures on every number. Dark values
apply under `prefers-color-scheme: dark`. Every text/background token pair the app uses meets
WCAG AA (4.5:1) in both modes; fading text with `opacity` can break that. `line` is for
decorative borders only (about 1.3:1 on `surface`), so never let a border alone carry meaning.

## Rules

- Use the token names (`bg-surface`, `text-muted`, `rounded-card`), never raw hex or arbitrary values.
- Phone width first. Touch targets at least 44px. Text contrast WCAG AA.
- Components never fetch data; pages pass it in.
