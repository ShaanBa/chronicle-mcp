# chronicle-mcp — Roleplay Playthrough Guide & Skill Router Protocol

Give this lean protocol to your RP Campaign AI Agent. Instead of loading static prompt bloat, chronicle-mcp uses dynamic **Skill Routing** to stream compact, context-sensitive playbooks and prefetched world intelligence in a single round-trip.

---

## 1. The 3-Beat Roleplay Loop

Every campaign beat is managed through `route_skill`:

### Beat 1: Start of Session / Campaign Resume
Call `route_skill` with your session opening intent:
```json
{
  "intent": "start session, where were we and what are the urgent matters?"
}
```
* **Payload returned**: The `session-bootstrap` playbook + auto-prefetched `realmRecap` (current date, active era, realm mood, stability, smallfolk whispers, and open plot threads).

### Beat 2: Scene & Mode Shifts
Before roleplaying any multi-character scene, council, parley, or battle:
```json
{
  "intent": "Hold a tense council meeting with Lord Raymund and Saera regarding the poison rumors",
  "characterIds": ["Lord Raymund Mooton", "Saera Targaryen"],
  "locationName": "The Salt Cellar, Maidenpool",
  "povCharacterId": "Lord Raymund Mooton",
  "autoBrief": true
}
```
* **Payload returned**: The best-matched skill playbook (e.g. `court-intrigue`, boosted by Secret Heat) + optional secondary blend directives + auto-prefetched `sceneBriefing` (compact cast cards, in-room relational friction, grudges, and the Intrigue Matrix with anti-metagaming GM guardrails).

### Beat 3: After Major Scenes, Battles, or Timeskips
When a major confrontation resolves, years pass, or you wrap up play:
```json
{
  "intent": "post scene chronicle, log what happened and update casualties and grudges"
}
```
* **Payload returned**: The `post-scene-chronicle` playbook guiding permanent canon updates (`log_timeline_event` with `mechanicalOutcome`, `upsert_character` for scars/grudges, `update_realm_pulse`).

---

## 2. Hard Global Invariants (Always Active)

1. **Strict Epistemic Isolation**: Never violate `intrigueMatrix.gmGuardrail`. If the briefing notes that the POV character does not know a secret, roleplay them as genuinely ignorant of the hidden truth.
2. **Automatic History Stamping**: Always include full character names in `log_timeline_event.tags` (e.g. `tags: ["Lord Raymund Mooton", "Saera Targaryen"]`). Both dossiers will automatically append the event to their permanent `historyLog`.
3. **No Double-Fetching**: When `prefetchNotice` indicates that `sceneBriefing` or `realmRecap` is already attached, **do NOT call `get_scene_briefing` or `get_realm_recap` again** on the subsequent turn.

---

## 3. Custom Campaign Skills

Drop campaign-specific cartridges into `skills/custom/<name>/SKILL.md` (e.g. `skills/custom/prophecy/SKILL.md`):
```markdown
---
id: high-valyrian-blood-magic
name: High Valyrian Blood Magic
description: Ancient Valyrian blood sorcery rituals, dragonbinding, and prophetic visions.
priority: 9
campaignScope: ["campaign-valyria", "Valyria"]
autoPrefetch: scene_briefing
triggers: ["blood magic", "bind dragon", "pyromancer", "valyrian spell"]
toolSequence: ["get_scene_briefing", "upsert_tome"]
---
## Mode Directives
* Describe sacrifice, heat, dragonglass, and arcane glyphs.
```
Custom cartridges load dynamically with live mtime detection—no server restart required.

---

## 4. Quick Tool Index

* **`route_skill`**: Main gateway for dynamic playbook routing and prefetching.
* **`list_skills`**: List all 8 core playbooks + active custom cartridges.
* **`get_skill`**: View full directives for a specific skill (`court-intrigue`, `war-and-reckoning`, etc.).
* **`list_commands`**: Catalog of all 38+ Chronicle MCP commands with usage examples.
