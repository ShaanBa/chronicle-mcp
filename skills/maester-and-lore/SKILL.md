---
id: maester-and-lore
name: Maester Lore & Primary Archives
description: Consult recorded tomes, archaic scrolls, partisan letters, ancient ballads, heraldic lineages, and prophecies in public Maester archives.
priority: 6
autoPrefetch: public_archive_hint
triggers:
  - "maester"
  - "archive"
  - "library"
  - "letter"
  - "ballad"
  - "prophecy"
  - "chronicle"
  - "history"
  - "research"
  - "decree"
  - "epitaph"
  - "in-world"
  - "lore"
antiTriggers:
  - "battle"
  - "interrogate"
  - "end session"
toolSequence:
  - search_chronicle
  - list_tomes
  - upsert_tome
---

## Mode Directives
* Treat archival materials as subjective in-world artifacts shaped by the author's personal biases and patron loyalties.
* Check source reliability (`true`, `biased`, `propaganda`, `myth`, `forged`) before treating parchment claims as fact.
* Present lore through excerpted in-world text, parchment quotes, or maester marginalia rather than out-of-character wiki summaries.

## Voice & Flavor Rules
* Evoke musty vellum, cracked wax seals, faded iron-gall ink, and the careful intellectual cadence of an archivist.
* Differentiate between high scholarly treatises, royal propaganda decrees, and popular tavern ballads.
* Respect historical ambiguity: conflicting dates, missing pages, and partisan redactions are features of authentic lore.

## Mandatory State Updates
* Archive newly written letters, decrees, prophecies, or epic songs using `upsert_tome` with appropriate reliability tags.
* When discovering ancient historical links, tag relevant characters and events so future searches cross-reference cleanly.
