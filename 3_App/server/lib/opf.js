import path from 'path'
import { XMLParser, XMLBuilder } from 'fast-xml-parser'

export const xmlParser = new XMLParser({ ignoreAttributes: false })
export const xmlBuilder = new XMLBuilder({ ignoreAttributes: false })

export const parseOpf = (zip, opfPath) => {
  const entry = zip.getEntry(opfPath)
  if (!entry) {
    throw new Error('OPF file not found in EPUB.')
  }
  const xml = zip.readAsText(entry)
  return { xml, data: xmlParser.parse(xml) }
}

export const writeOpf = (zip, opfPath, data) => {
  const updatedXml = xmlBuilder.build(data)
  zip.updateFile(opfPath, Buffer.from(updatedXml, 'utf-8'))
}

export const resolveHref = (opfPath, href) => {
  const opfDir = path.posix.dirname(opfPath)
  return path.posix.normalize(path.posix.join(opfDir, href))
}

export const getManifestItems = (opfData) => {
  const manifest = opfData?.package?.manifest
  if (!manifest) {
    return []
  }
  const items = manifest.item || []
  return Array.isArray(items) ? items : [items]
}

export const setManifestItems = (opfData, items) => {
  if (!opfData.package.manifest) {
    opfData.package.manifest = {}
  }
  opfData.package.manifest.item = items
}

export const getSpineItems = (opfData) => {
  const spine = opfData?.package?.spine
  if (!spine) {
    return []
  }
  const itemrefs = spine.itemref || []
  return Array.isArray(itemrefs) ? itemrefs : [itemrefs]
}

export const setSpineItems = (opfData, items) => {
  if (!opfData.package.spine) {
    opfData.package.spine = {}
  }
  opfData.package.spine.itemref = items
}

export const propertyTokens = (props) =>
  String(props || '')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)

export const hasManifestProperty = (item, name) => propertyTokens(item?.['@_properties']).includes(name)

export const addManifestProperty = (item, name) => {
  const tokens = propertyTokens(item['@_properties'])
  if (!tokens.includes(name)) {
    tokens.push(name)
  }
  item['@_properties'] = tokens.join(' ')
}

export const isImageManifestItem = (item) =>
  typeof item?.['@_media-type'] === 'string' && item['@_media-type'].startsWith('image/')

export const getMetadataMetas = (opfData) => {
  const metadata = opfData?.package?.metadata
  if (!metadata) {
    return []
  }
  const meta = metadata.meta
  if (!meta) {
    return []
  }
  return Array.isArray(meta) ? meta : [meta]
}

export const setMetadataMetas = (opfData, metas) => {
  if (!opfData.package) {
    opfData.package = {}
  }
  if (!opfData.package.metadata) {
    opfData.package.metadata = {}
  }
  opfData.package.metadata.meta = metas
}

/** Sync EPUB 2 + EPUB 3 cover declarations when exactly one side is present. Mutates opfData. */
export const normalizeCoverMetadata = (opfData) => {
  const manifestItems = getManifestItems(opfData)
  const coverImageItems = manifestItems.filter(
    (item) => hasManifestProperty(item, 'cover-image') && isImageManifestItem(item)
  )
  if (coverImageItems.length > 1) {
    return
  }

  const coverImageItem = coverImageItems[0] || null
  const metas = getMetadataMetas(opfData)
  const coverMeta = metas.find((m) => m && m['@_name'] === 'cover' && m['@_content'])
  const coverMetaTarget = coverMeta
    ? manifestItems.find(
        (item) => item['@_id'] === coverMeta['@_content'] && isImageManifestItem(item)
      )
    : null

  if (coverImageItem && !coverMeta) {
    setMetadataMetas(opfData, [
      ...metas,
      { '@_name': 'cover', '@_content': coverImageItem['@_id'] },
    ])
    return
  }

  if (coverMetaTarget && !coverImageItem) {
    addManifestProperty(coverMetaTarget, 'cover-image')
    setManifestItems(opfData, manifestItems)
  }
}

export const extractMetadataFromOpf = (opfData) => {
  const metadata = opfData?.package?.metadata || {}
  const getText = (val) => {
    if (!val) return ''
    if (typeof val === 'string') return val.trim()
    return (val['#text'] ?? val['_'] ?? '').trim() || ''
  }
  const title = getText(metadata['dc:title']) || getText(metadata['dc\\:title'])
  const creator = getText(metadata['dc:creator']) || getText(metadata['dc\\:creator'])
  return { title, author: creator }
}
