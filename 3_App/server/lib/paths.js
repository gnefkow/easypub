import path from 'path'
import { fileURLToPath } from 'url'
import { promises as fs } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
export const rootDir = path.resolve(__dirname, '../..')
export const workingDir = path.join(rootDir, 'workingFiles')
export const historyRoot = path.join(workingDir, '.history')

export const ensureSafeFilename = (filename) => {
  if (!filename || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid filename.')
  }
  return filename
}

export async function ensureDirs() {
  await fs.mkdir(workingDir, { recursive: true })
  await fs.mkdir(historyRoot, { recursive: true })
}
