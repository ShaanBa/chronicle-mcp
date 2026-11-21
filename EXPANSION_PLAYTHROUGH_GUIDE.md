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

## 6. Expanded 6-Section Global Search
`search_chronicle("Gideon")` searches across all 6 memory stores simultaneously:
1. `characters`
2. `timeline`
3. `tomes`
4. `threads`
5. `houses`
6. `secrets` (with `includeSecrets: false` for public record, or `includeSecrets: true` for GM omniscience)

---

## 7. Director & Intrigue Protocol (Phases 1 & 2)

### 7.1 Before Any Multi-Character Scene (`get_scene_briefing`)
Before roleplaying any scene involving two or more characters, always invoke `get_scene_briefing`:

```json
{
  "characterIds": ["Lord Raymund Mooton", "Maester Corwyn", "Ser Bryan"],
  "locationName": "The Salt Cellar, Maidenpool",
  "povCharacterId": "Lord Raymund Mooton",
  "includeOmniscientSecrets": true
}
```

#### What It Returns in Under 12 KB:
1. **Scene Context & Atmosphere**: In-game date, current era, stability (`stable` | `uneasy` | `volatile` | `fracturing`), weather/season, and smallfolk tavern whispers.
2. **Compact Cast Cards**: Age automatically computed from birth year and realm year anchor, noble house motto and sigil, speech tells, fatal flaw, current obsession, and up to 3 formative scars (with personal history logs strictly trimmed to the 2 most recent entries).
3. **In-Room Relational Friction**: Directed ties, asymmetric sentiments (-100 to +100), public facades masking hostility, and covert debts/alliances.
4. **In-Room Grudges**: Unforgiven slights and blood vendettas between characters standing in the room.
5. **Intrigue Matrix**:
   - `activeLeverage`: Who holds proof or suspicion over whom.
   - `sharedConspiracies`: Coded glances and mutual liability shared between characters.
   - `hiddenBlindSpots`: Secrets concerning someone in the room that no one present knows.
   - `gmGuardrail`: **CRITICAL ANTI-METAGAMING GUARD**. Explicitly lists the secrets unbeknownst to the POV character. Play them as genuinely unaware of these hidden truths!

---

### 7.2 Separating Public History from Covert Conspiracy
Never log a hidden conspiracy or covert murder directly as a public timeline event. Maintain strict epistemic separation:

* **Public Record (`log_timeline_event`)**: Use for realm-wide events, battles, open tourneys, treaties, and coronation decrees that are common knowledge.
* **Covert Ground Truth (`upsert_secret`)**: Track hidden truths, bastard lineages, assassinations, and embezzlements with a clear `publicCoverStory`:
  ```json
  {
    "title": "Lord Bryan's True Poisoner",
    "truth": "Lady Eleanor dissolved tears of Lys in his hippocras.",
    "publicCoverStory": "Lord Bryan perished of a sudden belly-ague.",
    "severity": "treason",
    "status": "buried",
    "subjectIds": ["Lady Eleanor", "Lord Bryan"],
    "knownByCharacterIds": ["Lady Eleanor", "Maester Corwyn"],
    "suspectedByCharacterIds": ["Ser Bryan"],
    "leverageNote": "Corwyn kept the poisoned flagon wrapped in silk."
  }
  ```
* **Spreading Knowledge & Exposure (`update_secret_knowledge`)**:
  - `learns`: Character discovers objective ground truth (automatically supersedes suspicion).
  - `suspects`: Character notices clues or unverified whispers.
  - `forgets`: Character is silenced, memory lost, or blackmailed into compliance.
  - `exposes`: Public revelation! Shifts status to `exposed`, records the expose in the secret's history log, and automatically posts an `Exposed:` timeline event if `autoLogTimelineEvent: true`.

---

### 7.3 Keeping the Realm Alive (`update_realm_pulse`)
Periodically advance the living world to reflect ongoing wars, seasons, and tavern mood:

```json
{
  "currentDate": "298 AC, Late Autumn",
  "currentSortYear": 298,
  "currentEra": "The Gathering Storm",
  "realmMood": {
    "atmosphere": "Tense and expectant; grain wagons rumble south through mud.",
    "stability": "volatile",
    "seasonOrWeather": "Chilling rains and early frost"
  },
  "addWhisper": "They say shadows walk the wall near the Nightfort.",
  "addCrisis": "Ironborn reavers sighted off the mouth of the Trident"
}
```

Updating `currentSortYear` immediately updates dynamic age math for every living character in the realm.

---

### 7.4 Cultural Echoes Rule (Biased Primary Sources in `Tome`)
History in chronicle-mcp is written by unreliable, opinionated mortals—not neutral encyclopedists. Whenever a major tragedy, execution, or victory occurs, capture how it echoes through culture:

* Use `sourceType`: `ballad`, `letter`, `decree`, `rumor`, `prophecy`, `epitaph`, `treatise`.
* Set `reliability`: `true`, `biased`, `propaganda`, `myth`, `forged`.
* Credit `inWorldAuthor` and tag `relatedCharacterIds`.

```json
{
  "title": "The Ballad of the Salt Cellars",
  "sourceType": "ballad",
  "inWorldAuthor": "Tom of the Sevenstreams",
  "reliability": "biased",
  "relatedCharacterIds": ["Lord Raymund Mooton"],
  "content": "A mocking tavern song whispered across the riverlands claiming the fish of Maidenpool swim with scales of gold and hearts of salt."
}
```

---

### 7.5 Character Evolution Rule (Scars, Grudges & Obsessions)
Characters should not remain static stat-blocks. When high-stakes scenes conclude:
* **Update `currentObsession`**: e.g., `"Securing a Valyrian steel blade before winter"`.
* **Add `formativeScars`**: Physical or psychological trauma tied to an event ID.
* **Register `activeGrudges`**: Record the target, reason, and intensity (`petty`, `bitter`, `blood_oath`).
* **Update `titles` and `epithet`**: e.g. `"The Iron-Handed"`.

---

### 7.6 Asymmetric & Hidden Social Graph (`add_relationship`)
Noble courts thrive on two-faced courtesies. Use the upgraded relationship flags:
* `isSecret: true`: Hidden lovers, secret alliances, or covert creditors.
* `sentiment`: Numeric score (-100 to +100) matching grand-strategy instincts.
* `publicFacade`: In-room facade, e.g. `"Obsequious smiling vassal"` while the true edge type is `enemy`.
* `oneWay: true`: Writes only the forward edge, leaving the counterpart unaware of the betrayal.
