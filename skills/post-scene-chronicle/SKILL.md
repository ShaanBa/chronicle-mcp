---
id: post-scene-chronicle
name: Post-Scene Chronicle & Sync
description: Consolidate major consequences after pivotal scenes, timeskips, or session wrap-up, recording casualties, trauma scars, and timeline shifts.
priority: 9
autoPrefetch: none
triggers:
  - "end scene"
  - "end session"
  - "wrap up"
  - "log what happened"
  - "timeskip"
  - "years later"
  - "save state"
  - "post scene"
  - "debrief"
  - "sync"
  - "timeline"
  - "consequences"
  - "aftermath"
  - "chronicle timeline"
antiTriggers:
  - "start session"
toolSequence:
  - log_timeline_event
  - update_secret_knowledge
  - upsert_character
  - update_realm_pulse
  - upsert_thread
---

## Mode Directives
* Transform pivotal narrative decisions, betrayals, and battlefield victories into permanent canon timeline entries.
* Review all participating cast members to record newly acquired scars, bitter grudges, and shifted obsessions.
* Advance open plot threads: mark accomplished goals as resolved and introduce new complications arising from fallout.

## Voice & Flavor Rules
* Adopt the authoritative, enduring tone of a royal chronicler recording history for future generations.
* Ensure every logged timeline event tags all major characters by their full canonical names for automatic history linking.
* Preserve moral complexity: document both glorious triumphs and the devastating costs inflicted upon the realm.

## Mandatory State Updates
* Commit the scene's definitive record with `log_timeline_event`, noting mechanical outcomes and casualty statistics.
* Update character psychology (`currentObsession`, `formativeScars`, `activeGrudges`) for those directly impacted.
* If time advances across months or years, call `update_realm_pulse` with the updated year and numeric sort anchor.
