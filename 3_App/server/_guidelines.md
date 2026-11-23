# **Server folder guidelines**

This file is a signpost for humans and AI agents working on the EasyPub API. Read it before adding a route, extracting logic, or planning a server ticket.

It sits alongside the app-wide [Design Philosophy](../../2_Product-Overview-and-Requirements.md/1_Overview/Design_Philosophy_for_EasyPub.md). That doc says: no god files, prefer many small boring modules. This file says how that applies *inside* `server/`.

----------------------------------------------------------------------------------------------------

## **How the folder is orchestrated**

```
server/
  index.js          # boot only
  _guidelines.md    # this file
  routes/           # HTTP endpoints (Express)
  lib/              # reusable non-HTTP logic
```

Request flow is always the same direction:

1. **`index.js`** creates the Express app and mounts routers.
2. **`routes/`** receives the HTTP request, validates params/body lightly, calls into `lib/`.
3. **`lib/`** does the real work (EPUB zip, OPF, HTML, filesystem, spellcheck, etc.) and returns data or mutates the zip/files.
4. **`routes/`** sends the JSON (or file) response.

Do **not** reverse that: helpers in `lib/` should not import Express or reach into route handlers.

----------------------------------------------------------------------------------------------------

## **`index.js` — boot only**

**Include**

- Create the Express app
- Shared middleware that truly applies to the whole API (e.g. JSON body parser setup, if kept global)
- Mount routers from `routes/` (e.g. `app.use('/api/...', someRouter)`)
- Start listening on the port (and port-in-use error messaging)

**Do not include**

- Route handler bodies
- EPUB / OPF / HTML / spellcheck / history logic
- Growing collections of helper functions

If you are tempted to paste a new `app.get` / `app.post` into `index.js`, stop — put it in `routes/` instead.

----------------------------------------------------------------------------------------------------

## **`routes/` — HTTP only**

Each file here owns a **slice of the API surface** (a group of related URLs). Exact filenames will change as the product grows; the rule is “group by user-facing API concern,” not by implementation detail.

**Include**

- Express `Router` definitions
- Reading `req.params` / `req.body` / uploads
- Status codes and response shape (`res.json`, `res.status`, sending files)
- Calling into `lib/` and mapping results (or errors) to HTTP

**Do not include**

- Deep EPUB parsing, Cheerio HTML edits, OPF mutation algorithms, dictionary/nspell guts
- Big switchboards of business rules that other routes might need later

**Thin routes.** A handler should read like: resolve safe filename → load what we need → call 1–3 lib functions → respond. If a handler needs a long narrative comment to explain *how* EPUB is changing, that logic almost certainly belongs in `lib/`.

----------------------------------------------------------------------------------------------------

## **`lib/` — reusable work, no HTTP**

Each file here owns a **domain of behavior** (package document, HTML blocks, history on disk, etc.). New product features usually add or extend a `lib/` module, then wire a thin route.

**Include**

- Functions that take explicit inputs (`zip`, `opfPath`, `opfData`, HTML strings, paths, etc.) and return results or update those inputs in place
- Shared helpers used by more than one route
- Shared non-domain state used by more than one route (e.g. Update-Epub `progressState` in `progress.js`) — still no Express
- Edge-case comments when EPUB/W3C behavior is non-obvious

**Do not include**

- `req` / `res`
- Express routers
- Knowledge of specific URL paths

**Pure-ish helpers.** Prefer functions you could unit-test without spinning up Express. They should not secretly read global request state. Sharing paths/config (working files directory, etc.) via small dedicated modules is fine.

**One concern per file.** If a file starts mixing “OPF cover metadata” with “spellcheck dictionaries,” split it. Prefer many small boring files over one clever kitchen sink. Aim for roughly the Design Philosophy size band (~150–200 lines); if something must be longer (e.g. a complex queue orchestrator), it should still be *one* concern.

----------------------------------------------------------------------------------------------------

## **Principles (cheat sheet)**

| Principle | Meaning here |
|---|---|
| **Thin routes** | HTTP in `routes/`; algorithms in `lib/` |
| **Pure-ish helpers** | Lib functions take clear args; no Express coupling |
| **One concern per file** | Open one file to change one kind of behavior |
| **Standard & simple** | Express routers + plain JS modules — no plugin frameworks or DI for “elegance” |

----------------------------------------------------------------------------------------------------

## **Adding a future feature**

When a ticket needs new server behavior, decide where it lands with this checklist:

1. **Is it a new URL or response shape?** → add/extend a file under `routes/`. Keep the handler short.
2. **Is it EPUB / HTML / filesystem / shared logic?** → add/extend a file under `lib/`. Give it a name that matches the concern, not the ticket number.
3. **Would two routes need the same logic?** → it belongs in `lib/` from day one — do not copy-paste between route files.
4. **Would `index.js` grow?** → no; only mount the new router there if needed.
5. **Is a file about to balloon?** → extract immediately rather than “we’ll split later.”

When unsure, prefer a new small `lib/` module over stuffing more into an existing large one.
