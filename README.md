# chronicle-mcp

**chronicle-mcp** is a local Model Context Protocol (MCP) server providing persistent, queryable memory for Crusader Kings II tabletop-style roleplaying sessions. It equips AI agents with direct tools to log and retrieve characters, timeline events, and lore documents ("tomes"), backed entirely by plain JSON files on disk.

## Features & Safe Upsert Behavior

- **Explicit ID Upserting**: Calling `upsert_character` or `upsert_tome` without an `id` always creates a new record with a fresh ID, even if an existing character or tome shares the same name/title (crucial for tabletop RP campaigns with recurring or dynastic names across generations).
- **Lookup Helpers**: Use `find_character_by_name` or `find_tome_by_title` to search for existing records and retrieve their `id` before performing updates with `upsert_*`.
- **Standardized Responses**: All tool responses follow a consistent `{ success: boolean, ...data, message?: string }` shape.
- **Robust Storage**: Fast in-memory cached reads paired with ~300ms debounced disk writes and automatic recovery for corrupted JSON files.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

## Running the Smoke Test

To run the complete automated smoke test suite (including isolated CRUD, non-overwriting upsert checks, and corrupt file recovery tests) against a temporary scratch directory (`./data-test/`), run:
```bash
npm run test:smoke
```

## Antigravity CLI Registration

Register `chronicle-mcp` in your Antigravity CLI configuration (global at `~/.gemini/config/mcp_config.json` or project-level at `.agents/mcp_config.json`):

```json
{
  "mcpServers": {
    "chronicle": {
      "command": "node",
      "args": ["/path/to/chronicle-mcp/build/index.js"],
      "env": {
        "CHRONICLE_DATA_DIR": "/path/to/chronicle-mcp/data"
      }
    }
  }
}
```
*(Replace `/path/to/chronicle-mcp` with the absolute path to your local `chronicle-mcp` installation directory).*

## Data & Backups

All persistent campaign memory is stored in three plain JSON files inside the `data/` directory (`characters.json`, `timeline.json`, and `tomes.json`). Creating a full backup of your RP campaign is as simple as copying or committing the `data/` folder. You can also customize the data storage location by setting the `CHRONICLE_DATA_DIR` environment variable in your `mcp_config.json`.
"# chronicle-mcp" 
