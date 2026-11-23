import { xmlParser } from './opf.js'

export const getContainerOpfPath = (zip) => {
  const containerEntry = zip.getEntry('META-INF/container.xml')
  if (!containerEntry) {
    throw new Error('container.xml not found in EPUB.')
  }
  const xml = zip.readAsText(containerEntry)
  const parsed = xmlParser.parse(xml)
  const rootfiles =
    parsed?.container?.rootfiles?.rootfile ||
    parsed?.container?.rootfiles?.['rootfile']
  const rootfile = Array.isArray(rootfiles) ? rootfiles[0] : rootfiles
  const fullPath = rootfile?.['@_full-path']
  if (!fullPath) {
    throw new Error('OPF path not found in container.xml.')
  }
  return fullPath
}
