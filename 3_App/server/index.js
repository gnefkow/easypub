import express from 'express'
import { ensureDirs } from './lib/paths.js'
import workingFilesRouter from './routes/working-files.js'
import queueRouter from './routes/queue.js'
import spellcheckRouter from './routes/spellcheck.js'

await ensureDirs()

const app = express()
const port = process.env.WORKING_FILES_PORT || 5174

app.use('/api', (req, _res, next) => {
  if (req.method !== 'GET' || !req.path.endsWith('/working-files')) {
    console.log(`[api] ${req.method} ${req.originalUrl}`)
  }
  next()
})

app.use(express.json({ limit: '1mb' }))

app.use('/api/working-files', workingFilesRouter)
app.use('/api/working-files', queueRouter)
app.use('/api/working-files', spellcheckRouter)

const server = app.listen(port)

server.on('listening', () => {
  console.log(`[server] EasyPub API running on http://localhost:${port}`)
  console.log('[server] Section loads log as [section] load: ... in this terminal')
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] ERROR: Port ${port} is already in use.`)
    console.error(`[server] Kill the old process: lsof -ti :${port} | xargs kill`)
    console.error('[server] Then restart with: npm run dev')
  } else {
    console.error('[server] Failed to start:', err.message)
  }
  process.exit(1)
})
