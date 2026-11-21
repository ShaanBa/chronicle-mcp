---
id: session-bootstrap
name: Session Bootstrap & Catch-up
description: Open a campaign session, review realm stability, active crises, open plot threads, and establish the opening scene focus.
priority: 10
autoPrefetch: realm_recap
triggers:
  - "start session"
  - "resume"
  - "begin"
  - "recap"
  - "where were we"
  - "switch campaign"
  - "new session"
  - "start chronicle"
  - "new chronicle"
  - "introduce setting"
  - "start campaign"
  - "bootstrap"
  - "prologue"
antiTriggers:
  - "end session"
  - "wrap up"
  - "battle"
toolSequence:
  - get_realm_recap
  - list_threads
  - list_secrets
---

## Mode Directives
* Present a crisp 3-sentence summary of the realm's current geopolitical footing, active season, and stability.
* Highlight the top 2 unresolved plot threads demanding immediate attention from the active ruler or party.
* Frame the opening beat by placing the viewpoint character into an active sensory situation rather than an empty room.

## Voice & Flavor Rules
* Echo smallfolk rumors and atmospheric whispers to color the opening environment before dialogue begins.
* Anchor all references in canonical dates, ruling dynasty prestige, and prevailing weather conditions.
* Never dump raw JSON; distill recap intelligence into evocative in-world prose suited for an ongoing chronicle.

## Mandatory State Updates
* If continuing from an extended hiatus, invoke `update_realm_pulse` to advance the date or refresh tavern whispers.
* Confirm the active player character using `set_active_campaign` if switching focal dynasties or storylines.
