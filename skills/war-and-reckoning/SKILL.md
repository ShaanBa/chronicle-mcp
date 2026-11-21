---
id: war-and-reckoning
name: War, Reckoning & Strife
description: Conduct martial clashes, desperate sieges, lethal duels, field skirmishes, rebellion marches, and brutal public executions with mechanical fallout.
priority: 8
autoPrefetch: none
triggers:
  - "battle"
  - "siege"
  - "war"
  - "duel"
  - "rebellion"
  - "execution"
  - "raid"
  - "casualties"
  - "army"
  - "march"
  - "sack"
  - "ambush"
antiTriggers:
  - "parley"
  - "quiet tavern"
  - "research"
toolSequence:
  - log_timeline_event
  - upsert_character
  - upsert_tome
  - update_realm_pulse
---

## Mode Directives
* Describe visceral martial action: troop morale, environmental chaos, weapon shock, and tactical discipline.
* Calculate and explicitly state tangible mechanical outcomes: casualty figures, gold spent, prestige, and territory shifted.
* Mark severe trauma immediately on surviving commanders through formative scars and mortal grudges.

## Voice & Flavor Rules
* Strip away romantic chivalry in favor of mud, blood, splintered iron, panic, and grueling logistical reality.
* Integrate commanders' traits, formative combat scars, and House mottos during battlefield climaxes.
* Keep turns dynamic with rapid tactical pivots rather than prolonged passive exposition.

## Mandatory State Updates
* Log the engagement using `log_timeline_event` with a detailed `mechanicalOutcome` and complete character tags.
* Update character life status to `dead` (recording `deathYear` and `causeOfDeath`) or append `formativeScars`.
* Shift realm atmosphere and stability via `update_realm_pulse` if the conflict destabilizes the province.
