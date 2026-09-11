[← Documentation index](../README.md)

# The ALE model

The three ideas the product is named for. Each one shows up somewhere concrete
in the code, which is the only test of whether a principle is real.

## Anticipate

*See the problem before it arrives, and plan for it in advance.*

In the code: [Scheduling arithmetic](../04-engine/scheduling-arithmetic.md) works **backwards** from an arrival
date. The output is not "this role is exposed" but "training must begin on
14 October or you will not be ready".

## Lead

*Talk to people honestly before the change, not after it.*

In the code: the only exportable document is a set of dated training
commitments — see [Ethical constraints](../09-ethics/ethical-constraints.md). There is no endpoint that produces
a ranked displaceability list, because that is the document you hand someone
*after* deciding.

## Evolve

*Build a system that keeps improving.*

In the code: [The baseline gate](../05-machine-learning/the-baseline-gate.md). The product starts on a transparent rule
engine and replaces it with a fitted model **only when the fitted model
measurably wins** — and keeps reporting which one produced each number.

---

Related: [What is ALE Insight](what-is-ale-insight.md) · [Ethical constraints](../09-ethics/ethical-constraints.md)
