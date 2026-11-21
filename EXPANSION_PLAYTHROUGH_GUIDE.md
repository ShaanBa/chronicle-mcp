# chronicle-mcp — Playthrough Agent Briefing & Tool Guide

Give this document to your RP Campaign AI Agent instance to instruct it on how to utilize the expanded **chronicle-mcp** toolset during gameplay.

---

## 1. Multi-Campaign Management & Switching
`chronicle-mcp` supports multiple playthrough campaigns in one server instance. Switching campaigns is a single tool call!

* **List Campaigns**: Call `list_campaigns` to see all stored campaigns and their active status.
* **Create New Campaign**: Call `create_campaign({ name: "Britannia" })` to register a new campaign.
* **Switch Active Campaign**: Call `set_active_campaign({ name_or_id: "Britannia" })`. All subsequent character lookups, timeline logs, plot threads, and recaps will instantly scope to the new campaign!
* **Get Active Campaign**: Call `get_active_campaign` to verify which campaign is currently active.

---

## 2. Automatic Character History Logging (No Extra Call Needed!)
When you log an event using `log_timeline_event`, the server **automatically finds every character tagged in `tags` and appends a history entry to their personal `historyLog` array**.

* **Rule**: Always include full character names or IDs in `tags` when calling `log_timeline_event` (e.g. `tags: ["Duke Gideon", "Phineas"]`). Both character dossiers will automatically record the event!

---

## 2. Structured Directed Relationships
Use the relationship tools to maintain formal ties between characters and noble houses without text drifting out of sync.

### Adding & Updating Relationships (`add_relationship`)
* Automatically creates both the forward edge and its inverse edge (e.g. adding `A is parent of B` automatically creates `B is child of A`).
* **Symmetric Types**: `spouse`, `ally`, `rival`, `enemy`, `sibling`, `other` (inverse is identical).
* **Asymmetric Pairs**: `parent` ↔ `child`, `liege` ↔ `vassal`, `debtor` ↔ `creditor`.
* **Deduplication**: Calling `add_relationship` for an existing relationship type updates the note rather than creating duplicate edges.

```json
{
  "fromType": "character",
  "fromId": "Phineas",
  "toType": "character",
  "toId": "Gideon Gideon",
  "type": "parent",
  "note": "Devoted father who built Semien treasury for his son."
}
```

### Listing Relationships (`list_relationships`)
* Call `list_relationships({ entityType: "character", entityId: "Gideon" })` to see all resolved allies, rivals, family, and lieges along with target names and life status.

---

## 3. Mechanical Outcomes on Timeline Events
When logging major mechanical events (wars, duels, plots, successions), include the optional `mechanicalOutcome` field in `log_timeline_event`:

```json
{
  "entry": {
    "title": "The First Border War of Semien",
    "date": "1066 AD, Winter",
    "tags": ["Gideon", "Gondar"],
    "narrative": "Semien fought off Gondar raiders in the mountain pass.",
    "mechanicalOutcome": {
      "summary": "Won defensive war: +200 prestige, 0 territory gained",
      "goldDelta": -45,
      "prestigeDelta": 200,
      "casualties": "120 Semien levies"
    }
  }
}
```

---

## 4. Open Plot-Thread Tracker
Track unresolved plots, blood feuds, and long-term goals using the `Thread` tools.

* **Create Plot**: Call `upsert_thread({ title: "Depose Bishop Odo", summary: "Vassal conspiracy to force Odo out of the council.", status: "open", tags: ["Plot"] })`.
* **Session Start Recap**: At the start of a session, call `get_realm_recap`. The return payload now includes `openThreads` with all unresolved plots!
* **Resolve Plot**: Call `resolve_thread({ id: "...", resolutionNote: "Odo surrendered his land and retired to a monastery." })`.

---

## 5. Noble House Entities (`House`)
Manage noble dynasties and realm holdings separately from individual characters.

* **Create/Update House**: Call `upsert_house({ name: "Gideon", status: "ruling", holdings: ["Semien", "Gondar"], prestige: 850, tags: ["Jewish", "Highland"] })`.
* Like characters, passing `house.id` along with `note` appends to the house's append-only `historyLog`.

---

## 6. Expanded 5-Section Global Search
`search_chronicle("Gideon")` now searches across all 5 memory stores simultaneously:
1. `characters`
2. `timeline`
3. `tomes`
4. `threads`
5. `houses`
