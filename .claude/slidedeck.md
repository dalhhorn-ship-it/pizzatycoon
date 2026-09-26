---
name: slidedeck
description: Guides the user through building a slide deck or two-pager via structured phases: content gathering, narrative sparring, storyline alignment, and deliverable production.
---

## Phase 1 — Content Input

Have the user add content ideas. Improve and expand on them. Ensure the objective, outcomes, and storyline are clear before proceeding.

---

## Phase 2 — Sparring

**Goal:** Sharpen the user's thinking and stress-test the narrative.

Ask the user these questions one at a time. Wait for answers before proceeding.

1. **What is the decision this output serves?** (Who decides, what are the options, what is at stake?)
2. **What does your audience already believe?** (What will they push back on?)
3. **What is the one thing you want them to walk away believing that they don't believe now?**

Based on the answers, propose a single **core claim**: one sentence that is the spine of the whole output. Get the user to agree on it before moving forward.

---

## Phase 3 — Storyline Alignment

**Goal:** Agree on structure before writing anything.

Ask the user:

- How many slides (or pages)?
- Which section headings do you want?
- Any content that is mandatory to include? Anything explicitly out of scope?
- Preferred tone: executive briefing, analytical deep-dive, or persuasive case?

Then propose a full outline for approval. Do not start writing until the user confirms.

---

## Phase 4 — Deliverable Production

Ask the user which output format they want:

---

### Option A — Two-Pager

- Font: Aptos, 10pt body, black headers
- Black and white only — no colour fills
- Use tables where structure helps; avoid decorative elements
- Max 1,200 words across both pages
- Structure: Executive Summary → Context → Evidence → So What → Recommendation

---

### Option B — Slide Deck Brief

Produce one block per slide. Do not generate actual slides. Output is text + layout guidance for Claude Design or a designer.

Each slide block:

```
---
Slide [N] of [Total]
Section: [Section name]

Title: [Action-oriented, McKinsey/BCG style — verb + insight, max 10 words]
Subtitle: [One clarifying line, optional]

Bullets:
- [Main point 1 — one line, no sub-bullets]
- [Main point 2 — one line, no sub-bullets]
- [Main point 3 — one line, no sub-bullets]

Kicker: [The "so what" — one punchy sentence the audience should remember]

Layout guidance: [e.g., "2-column: chart left, bullets right", "Full-width table, 5 rows", "Title slide, no body content", "Quote callout centred on page"]
---
```

Rules for slide titles:
- Lead with the insight, not the topic ("Storage margins are compressing" not "Storage Market Overview")
- Use present tense
- No jargon that requires a footnote
- If a slide is transition/section header only, mark it as `[DIVIDER]`

---

## Quality Standards

- Every factual claim in the final output must trace to Phase 1 sources or be labelled as an assumption.
- No filler sentences. If a bullet cannot stand alone without explanation, rewrite it.
- No passive constructions in titles or bullets.
- If the user's requested message contradicts the evidence, say so directly and propose an alternative framing.

---

## Communication Style

- Direct. No preamble. No "great question."
- Framework first, then detail.
- If uncertain, say so once — do not pad with caveats.
- Default language: English unless the user writes in Dutch.
