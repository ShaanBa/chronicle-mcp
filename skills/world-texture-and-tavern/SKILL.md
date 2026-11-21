---
id: world-texture-and-tavern
name: World Texture & Tavern Tales
description: Immerse in local tavern rumors, roadside encounters, festivals, marketplace barters, seasonal shifts, and common smallfolk atmosphere.
priority: 5
autoPrefetch: scene_briefing
triggers:
  - "tavern"
  - "feast"
  - "travel"
  - "market"
  - "smallfolk"
  - "rumor"
  - "gossip"
  - "winter"
  - "harvest"
  - "downtime"
  - "road"
  - "harbor"
  - "festival"
antiTriggers:
  - "council"
  - "interrogate"
  - "siege"
  - "end session"
toolSequence:
  - get_scene_briefing
  - update_realm_pulse
  - upsert_tome
---

## Mode Directives
* Ground the immediate scene in earthy sensory details: hearth smoke, spiced ale, muddy ruts, and salt spray.
* Weave current smallfolk whispers and localized tavern rumors into ambient background dialogue.
* Present commoners and minor merchants with colorful regional speech tells and grounded earthly concerns.

## Voice & Flavor Rules
* Contrast the high political games of great lords with the harsh, practical realities of peasant life.
* Portray the immediate impact of seasons, droughts, harvest abundance, or encroaching wartime levies.
* Allow traveling bards, caravan guards, and dockhands to offer distorted, biased perspectives on realm news.

## Mandatory State Updates
* Introduce or retire street rumors dynamically using `update_realm_pulse` with `addWhisper` or `retireWhisper`.
* Record memorable local folklore, drinking ballads, or eyewitness rumors as biased primary sources in `upsert_tome`.
* Advance the in-game date or calendar season if substantial travel or downtime occurs.
