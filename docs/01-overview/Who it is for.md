---
title: Who it is for
tags: [overview, users]
---

# Who it is for

Three people look at the same plan for different reasons. Each gets the view
that answers their own question.

```mermaid
flowchart LR
    PM(["Production<br/>manager"])
    BC(["Brand &<br/>compliance"])
    PF(["Planning &<br/>finance"])

    UC1["Enter the roster<br/>and machine roadmap"]
    UC2["See who to train,<br/>in what order, by when"]
    UC3["Check the training<br/>calendar against capacity"]
    UC4["Export dated<br/>training commitments"]
    UC5["Inspect why a role<br/>scored what it did"]
    UC6["Compare capital outlay<br/>against payback"]
    UC7["Record what actually<br/>happened after an arrival"]
    UC8["Train and audit<br/>the prediction model"]

    PM --> UC1
    PM --> UC2
    PM --> UC3
    PM --> UC7

    BC --> UC4
    BC --> UC5

    PF --> UC6
    PF --> UC2
    PF --> UC8

    UC2 -.->|includes| UC5
    UC4 -.->|extends| UC2
    UC8 -.->|requires| UC7

    style PM fill:#e7f0fd,stroke:#1E40AF
    style BC fill:#e7f0fd,stroke:#1E40AF
    style PF fill:#e7f0fd,stroke:#1E40AF
```

## Production manager

*You know which machines are coming. You need to know who to train, in what
order, and by when — against the training capacity you actually have.*

Lands on [[Pages and navigation|Plan]]. Capacity is the binding constraint in
every schedule, which is why [[Training and wages|training seat capacity]] is
a first-class input rather than an afterthought.

## Brand and compliance

*You need evidence that a supplier saw the change coming and acted on it:
dated training commitments, not a statement of intent.*

Lands on **Report**. This is the artifact with value outside the factory, and
it is the reason a factory pays — compliance pressure from brands, not
conscience. Deliberately a list of commitments, never a risk register.

## Planning and finance

*You need the purchase case: capital outlay, payback period, and what each
machine creates as well as what it removes.*

Lands on **Machines** and the economics panel on **Overview**. See
[[Machine catalogue]].

> A short payback beside a large net displacement is the combination worth
> flagging: it means the purchase is very likely to proceed, so the training
> window is the only variable actually in play.

---

Related: [[Pages and navigation]] · [[Machine catalogue]] · [[Recording outcomes]]
