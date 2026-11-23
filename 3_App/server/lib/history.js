import path from 'path'
import { promises as fs } from 'fs'
import { workingDir, historyRoot, ensureSafeFilename } from './paths.js'

export const historyDirFor = async (filename) => {
  const safe = ensureSafeFilename(filename)
  const dir = path.join(historyRoot, safe)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export const historyLogPathFor = async (filename) => {
  const dir = await historyDirFor(filename)
  return path.join(dir, 'history.json')
}

export const readHistory = async (filename) => {
  try {
    const logPath = await historyLogPathFor(filename)
    const raw = await fs.readFile(logPath, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export const writeHistory = async (filename, history) => {
  const logPath = await historyLogPathFor(filename)
  await fs.writeFile(logPath, JSON.stringify(history, null, 2), 'utf-8')
}

export const appendHistory = async (filename, entry) => {
  const history = await readHistory(filename)
  history.push(entry)
  await writeHistory(filename, history)
  return history
}

export const createBackup = async (filename) => {
  const safe = ensureSafeFilename(filename)
  const source = path.join(workingDir, safe)
  const historyDir = await historyDirFor(safe)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupName = `${stamp}.epub`
  const backupPath = path.join(historyDir, backupName)
  await fs.copyFile(source, backupPath)
  return backupName
}
