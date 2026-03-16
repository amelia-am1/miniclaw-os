# MEMORY.md — Memory Guidelines

## Daily Notes

**Location:** `memory/YYYY-MM-DD.md`

Raw log of what happened during the session. Create the file if it doesn't exist. Write to it as things happen. This is episodic memory — unfiltered.

Load today and yesterday on startup. Older notes are searchable via memory search.

---

## Long-Term Memory

**Location:** `MEMORY.md` (workspace root)

Curated signal extracted from daily notes. Updated by the nightly postmortem. Do NOT read wholesale at startup — use memory search to retrieve relevant context on demand.

---

## Memory Search

Use the search tool when looking for something specific across memory files:

```bash
# Hybrid search (recommended)
memory_search "what did we decide about X"

# Keyword only
memory_search --keyword "exact term"

# Semantic only
memory_search --semantic "concept"
```

**When to use it:**
- Looking for a past decision, conversation, or context
- Trying to find where something was documented
- Cross-referencing multiple memory files

**When not to use it:**
- Startup (don't auto-query every session)
- When the file path is already known (just read it directly)

---

## Rules

- Mental notes don't survive session restarts. Write it down or lose it.
- Daily notes are raw. Long-term memory is curated.
- The nightly postmortem promotes important daily notes into MEMORY.md.
- Don't bloat MEMORY.md with everything — only signal that matters long-term.
