---
title: Design system
tags: [interface]
---

# Design system

MUI with a **Material 3 tonal palette**, generated rather than hand-picked.

## Tone, not hexes

`theme/m3.ts` runs a seed colour through `@material/material-color-utilities` —
the same HCT engine behind the Material Theme Builder — and reads standard tone
assignments off the resulting palettes:

```
light   role 40  /  on 100  /  container 90  /  on-container 10
dark    role 80  /  on 20   /  container 30  /  on-container 90
```

Both schemes come from one set of tonal palettes, so light and dark **cannot
drift apart**, and every `on-` pair has adequate contrast by construction
rather than by checking afterwards.

Measured across both schemes: **zero contrast failures**. Light floor 6.43:1,
dark floor 7.21:1.

The five `surfaceContainer` tones are derived too — that is how M3 gets depth
without shadows.

## Risk bands are colour roles

Not decoration. `moderate` and `low` are registered M3 custom colours with
`blend: false`.

> Harmonising "moderate" toward the blue seed would stop it reading as caution,
> which is the one thing it exists to do.

`high` reuses M3's built-in error role.

## The deviation from the generated palette

The generator nominates **amber as the CTA accent**. That was overridden.

In a product whose entire output is a risk band, amber is already spoken for —
it *is* what "moderate" looks like. A button and a risk badge sharing a colour
would make the most important signal on the page ambiguous.

| | |
| --- | --- |
| **Primary blue** | calls to action, navigation, links |
| **Amber** | the moderate risk band, and nothing else |

Semantic colour stays separate from the accent hue, which is the rule the
generated palette was applying anyway.

## Never colour alone

- Risk bands are **chips with the band spelled out**
- Chart bars carry their score and headcount as text beside them
- The training-load chart uses **two labelled series** — "Window already
  missed" / "Scheduled ahead" — rather than one series coloured per bar, so the
  legend names the distinction in words
- Charts carry `sr-only` text summaries with every value

## Type

Roboto and Roboto Mono, on the M3 type scale mapped onto MUI's variant slots.
Display and headline sizes carry negative tracking; body and label sizes carry
positive tracking, which is what keeps M3 text legible at small sizes.

## Touch targets

At the touch breakpoint every control is at least **44px**. On desktop the
smaller mouse targets stay — they still clear the 24×24 CSS px web floor.

---

Related: [[Pages and navigation]]
