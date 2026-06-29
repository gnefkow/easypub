---
**Keywords**: ETIMEDOUT, proxy timeout, event loop blocking, synchronous processing, progress polling, setImmediate, queue, save, express, cheerio, adm-zip, split-section, delete-block, merge, TCP backlog, 202 Accepted, fire-and-forget, non-blocking
---

When saving queued changes (split-section, delete-block, merge, etc.), the server processes all actions synchronously inside the Express route handler. This blocks the event loop for the entire duration, preventing the `/progress` endpoint from responding. The result: Vite's proxy reports `ETIMEDOUT` errors, the progress UI stalls, and the user sees scary errors even though the save succeeds in the background.

**Current quick-fix**: proxy timeout bumped to 120s in `vite.config.ts`. This suppresses the error but doesn't make the progress endpoint actually useful.


## **Plan: Non-Blocking Queue Processing**

### **Context**
- **Location**: `server/index.js`, the `POST /api/working-files/:filename/queue` handler (lines ~763–1268).
- **Problem**: All zip/cheerio operations are synchronous. A 7-action queue on a 1MB epub blocks for several seconds — long enough to exhaust TCP backlog and cause `ETIMEDOUT` on progress polls.
- **Goal**: The queue endpoint should respond immediately, process in the background, and let the client poll `/progress` for real-time status. When done, the client fetches the final result.

### **Steps**

1. **Respond immediately, process in background**
   - When `POST /queue` is called, validate the payload, set initial progress state, respond with `202 Accepted` and a `jobId`.
   - Kick off the actual processing via `setImmediate` (or a microtask) so the event loop is free to handle other requests.

2. **Yield between actions**
   - Inside the processing loop, insert a `await new Promise(resolve => setImmediate(resolve))` between each action iteration. This gives the event loop a chance to handle incoming progress polls without meaningfully slowing down total processing time.

3. **Update progress state as before**
   - The existing `progressState.set(...)` calls remain. The difference is that now the `/progress` endpoint can actually respond because the event loop isn't blocked.

4. **Add a completion/error field to progress state**
   - When processing finishes, set `phase: 'complete'` and include the history payload in the progress state.
   - If processing throws, set `phase: 'error'` with a message so the client can surface it.

5. **Update the frontend polling logic**
   - Instead of `await fetch('/api/.../queue')` (which currently blocks until the server responds), fire the POST and immediately begin polling.
   - When progress reaches `phase: 'complete'`, read the history from the progress response (or a separate endpoint), clear the queue, and reload.
   - If `phase: 'error'`, surface the error to the user.

6. **Remove the proxy timeout bump (optional cleanup)**
   - Once the event loop is no longer blocked, the default proxy timeout is fine. Remove the `timeout: 120000` from `vite.config.ts`.

### **Files to touch**
- `server/index.js` — refactor `POST /queue` handler to respond immediately and process via yielding loop; add completion/error to progress state.
- `src/views/ReaderView.tsx` — update `handleSaveQueue` to fire-and-forget the POST and rely solely on progress polling for status.
- `vite.config.ts` — (cleanup) revert proxy timeout to default after fix is confirmed.

### **Trade-offs**
- **Yielding with `setImmediate`** adds negligible overhead (microseconds per action) but keeps the progress endpoint responsive. No worker threads or child processes needed for this workload.
- **Fire-and-forget POST** means the client no longer gets a direct response from the queue endpoint. All status comes from polling. This is a slightly different contract but simpler and more robust for long-running operations.
- **Error handling** becomes more important — if the server crashes mid-processing, the progress state is lost. A future enhancement could persist progress to disk, but for now in-memory is fine since the backup is created before processing begins.

### **Out of scope**
- Worker threads or child process offloading (overkill for this workload).
- WebSocket or SSE for progress (polling at 500ms is adequate for this use case).
- Retry logic on the client if the server crashes mid-queue.
