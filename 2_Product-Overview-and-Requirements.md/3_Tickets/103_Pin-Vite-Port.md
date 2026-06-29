---
**Keywords**: ETIMEDOUT, port collision, strictPort, vite auto-increment, 5173, 5174, proxy error, concurrently, dev server startup, port conflict, AggregateError
---

When something else occupies port 5173, Vite silently auto-increments to 5174 — the same port the Express backend uses. This causes both processes to collide and the proxy to fail with `ETIMEDOUT`.


## **Plan: Pin Vite Port with strictPort**

### **Context**
- **Location**: `vite.config.ts`, server config.
- **Problem**: Vite's default behavior is to try the next port if its preferred port is taken. Since the Express backend is hard-coded to 5174, Vite bumping from 5173 → 5174 creates a silent collision.
- **Goal**: Vite should fail fast with a clear error if 5173 is unavailable, rather than silently stealing the backend's port.

### **Steps**

1. **Add `port` and `strictPort` to Vite server config**
   - Set `port: 5173` explicitly.
   - Set `strictPort: true` so Vite exits with an error if the port is taken.

### **Files to touch**
- `vite.config.ts` — add `port: 5173` and `strictPort: true` to the `server` block.

### **Trade-offs**
- With `strictPort: true`, if port 5173 is occupied the dev server won't start at all. The developer must kill whatever is on that port first. This is preferable to a silent collision that produces confusing proxy errors.

### **Out of scope**
- Changing the Express backend port (5174 is fine; the issue is only Vite's auto-increment behavior).
- Adding port-conflict detection scripts or kill-port tooling.
