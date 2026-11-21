---
id: diplomacy-and-oaths
name: Diplomacy & Sacred Oaths
description: Negotiate treaties, dynastic betrothals, feudal petitions, vassal homage, ransoms, and solemn oaths of fealty across noble houses.
priority: 7
autoPrefetch: scene_briefing
triggers:
  - "treaty"
  - "marriage"
  - "betrothal"
  - "alliance"
  - "vassal"
  - "petition"
  - "parley"
  - "negotiate"
  - "oath"
  - "pact"
  - "tribute"
  - "court"
  - "ransom"
antiTriggers:
  - "assassinate"
  - "battle"
  - "end session"
toolSequence:
  - get_scene_briefing
  - list_relationships
  - add_relationship
  - upsert_thread
---

## Mode Directives
* Establish the formal protocol, ancestral customs, and ceremonial weight of the meeting before terms are exchanged.
* Factor each noble house's reputation, ancestral motto, and current holdings into their leverage and demands.
* Track bilateral concessions, hostages, dowries, and territorial pledges as actionable conditions.

## Voice & Flavor Rules
* Reflect feudal formality, high court etiquette, and religious oaths sworn before ancestral gods or high maesters.
* Showcase underlying resentment or warmth through polite facades, gift-giving, and heraldic honors.
* Remind participants of the binding social costs and blood consequences of oathbreaking.

## Mandatory State Updates
* Record finalized treaties, betrothals, or vassalages via `add_relationship` with appropriate sentiment and notes.
* If a pact is unilateral or deceptive, flag the relationship with `oneWay: true` or `publicFacade`.
* Log unresolved negotiations or hostage arrangements as open plot threads using `upsert_thread`.
