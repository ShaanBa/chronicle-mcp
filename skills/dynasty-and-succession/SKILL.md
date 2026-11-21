---
id: dynasty-and-succession
name: Dynasty, Lineage & Succession
description: Resolve succession crises, coronations, royal regencies, disputed wills, claimant challenges, and noble house cadet branch splits.
priority: 7
autoPrefetch: realm_recap
triggers:
  - "heir"
  - "succession"
  - "regency"
  - "crown"
  - "throne"
  - "bastard"
  - "claimant"
  - "died"
  - "funeral"
  - "will"
  - "cadet"
  - "dynasty"
  - "dynastic"
  - "betrothal"
  - "lineage"
  - "inheritance"
  - "aging"
antiTriggers:
  - "tavern"
  - "battle"
  - "spy"
toolSequence:
  - list_characters
  - upsert_house
  - upsert_thread
  - update_realm_pulse
---

## Mode Directives
* Verify genealogical legitimacy, computed ages, birth order, and cadet branch origins across rival claimants.
* Gauge factional alignment of key vassal houses, comparing house prestige and feudal holdings.
* Surface the precarious nature of interregnums, regency councils, and disputed testaments.

## Voice & Flavor Rules
* Invoke ancestral heraldry, royal sepulchers, ancient decrees, and solemn coronation liturgy.
* Highlight the fragile transition of power: nervous courtiers, opportunistic pretenders, and solemn funeral rites.
* Reflect the dynastic pride and motto of the ruling house as their legacy hangs in the balance.

## Mandatory State Updates
* Upon ruler death or succession, update the deceased via `upsert_character` and appoint the new heir.
* Adjust house prestige or holdings via `upsert_house`, or register a cadet lineage with `cadetOfHouseId`.
* Register contested claims as open plot threads using `upsert_thread` and escalate realm instability.
