---
id: court-intrigue
name: Court Intrigue & Shadow Play
description: Navigate tense court councils, covert blackmail, secret interrogations, poison plots, and hidden leverage between rival factions.
priority: 8
autoPrefetch: scene_briefing
triggers:
  - "secret"
  - "spy"
  - "murder"
  - "blackmail"
  - "poison"
  - "conspiracy"
  - "council"
  - "interrogate"
  - "whisper"
  - "plot"
  - "betrayal"
  - "scheme"
  - "leverage"
antiTriggers:
  - "pitched battle"
  - "siege"
  - "tavern song"
  - "end session"
toolSequence:
  - get_scene_briefing
  - get_character_knowledge
  - update_secret_knowledge
  - add_relationship
---

## Mode Directives
* Strictly enforce epistemic separation: never allow the viewpoint character to act on secrets listed in `gmGuardrail`.
* Surface active leverage, mutual liability, and coded glances between characters sharing conspiratorial knowledge.
* Frame spoken dialogue with two-faced courtesy while tracking underlying sentiment (-100 to +100) and hidden grudges.

## Voice & Flavor Rules
* Highlight subtle sensory tells: hushed breath, shifting eyes, wine testing, guarded postures, and veiled threats.
* Emphasize the disparity between public cover stories believed by the court and grim objective ground truths.
* Let fatal flaws, speech tells, and current obsessions bleed into character argumentation and extortion attempts.

## Mandatory State Updates
* When a character uncovers definitive proof, call `update_secret_knowledge` with action `learns` or `suspects`.
* If a conspiracy leaks publicly, invoke `update_secret_knowledge` with action `exposes` and `autoLogTimelineEvent: true`.
* Record any shifting hostility or blackmail ties using `add_relationship` with `isSecret: true` or `publicFacade`.
