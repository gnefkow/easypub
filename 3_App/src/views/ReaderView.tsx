import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import ePub from 'epubjs'
import type {
  Endnote,
  LoadedSection,
  QueueItem,
  SectionMeta,
  TextBlock,
} from '../types/reader'
import AppLayout from '../layouts/AppLayout'
import TopBar from '../components/TopBar'
import QueueSidebar from '../components/QueueSidebar'
import EndnotesSidebar from '../components/endnotesSidebar/EndnotesSidebar'
import Viewer from '../components/viewer/Viewer'
import ProgressBox from '../components/ProgressBox'
import Modal from '../components/Modal'
import SectionSidebar from '../components/sectionSidebar/SectionSidebar'
import Home from './Home'
import {
  buildAddBlockQueueItem,
  getAddBlockQueueItemId,
  optimisticallyInsertBlockAfter,
  removeOptimisticAddBlock,
} from './reader/addBlock'
import { usePowerModeState, type BlockRef, isSameBlockRef } from './reader/usePowerMode'
import { DEFAULT_VIEWER_LANGUAGE } from '../utils/languages'
import sanitizeInlineHtml, { stripHtmlTags } from '../components/viewer/richText/sanitizeInlineHtml'

export default function ReaderView() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [viewerLanguage, setViewerLanguage] = useState(DEFAULT_VIEWER_LANGUAGE)
  const [workingFileTitles, setWorkingFileTitles] = useState<
    Record<string, string>
  >({})
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSection, setIsLoadingSection] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [sections, setSections] = useState<LoadedSection[]>([])
  const [sectionMeta, setSectionMeta] = useState<SectionMeta[]>([])
  const [displayedSections, setDisplayedSections] = useState<
    Record<number, boolean>
  >({})
  const [splitMarkers, setSplitMarkers] = useState<
    {
      id: string
      afterIndex: number
      originalIndex: number
      newIndex: number
      newHref: string
      newTitle: string
      originalBlocks: TextBlock[]
    }[]
  >([])
  const [nextSectionIndex, setNextSectionIndex] = useState<number | null>(null)
  const [workingFiles, setWorkingFiles] = useState<string[]>([])
  const [selectedWorkingFile, setSelectedWorkingFile] = useState<string>('')
  const [editHistory, setEditHistory] = useState<
    { id: string; action: string; timestamp: string }[]
  >([])
  const [queueOpen, setQueueOpen] = useState(false)
  const [endnotesOpen, setEndnotesOpen] = useState(false)
  const [endnotes, setEndnotes] = useState<Endnote[]>([])
  const [editingEndnoteUid, setEditingEndnoteUid] = useState<string | null>(null)
  const noterefMapRef = useRef<Record<string, string>>({})
  const [queueItems, setQueueItems] = useState<QueueItem[]>([])
  const [optimisticAddBlocksByQueueId, setOptimisticAddBlocksByQueueId] =
    useState<Record<string, string>>({})
  const [showDebug, setShowDebug] = useState(false)
  const [showComponents, setShowComponents] = useState(false)
  const [codePanelBlockId, setCodePanelBlockId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [progressVisible, setProgressVisible] = useState(false)
  const [progressPhase, setProgressPhase] = useState<
    | 'idle'
    | 'loading-queue'
    | 'applying'
    | 'writing-epub'
    | 'reloading'
    | 'complete'
  >('idle')
  const [progressCompleted, setProgressCompleted] = useState(0)
  const [progressTotal, setProgressTotal] = useState(0)
  const [titlesLoading, setTitlesLoading] = useState(false)
  const [forceProgressVisible, setForceProgressVisible] = useState(false)
  const [progressModalOpen, setProgressModalOpen] = useState(false)
  const [book, setBook] = useState<any | null>(null)
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number | null>(
    null
  )
  const [customDictionary, setCustomDictionary] = useState<string[]>([])
  const [spellcheckEnabled, setSpellcheckEnabled] = useState(false)
  const [selectedSpellWord, setSelectedSpellWord] = useState<string | null>(null)
  const [dictionaryModalOpen, setDictionaryModalOpen] = useState(false)

  const {
    powerMode,
    togglePowerMode,
    focusedBlock,
    setFocusedBlock,
    editingBlock,
    setEditingBlock,
  } = usePowerModeState()

  const sectionsRef = useRef(sections)
  sectionsRef.current = sections
  const sectionMetaRef = useRef(sectionMeta)
  sectionMetaRef.current = sectionMeta
  const editingBlockRef = useRef(editingBlock)
  editingBlockRef.current = editingBlock
  const powerModeRef = useRef(powerMode)
  powerModeRef.current = powerMode
  const queueItemsRef = useRef(queueItems)
  queueItemsRef.current = queueItems
  const optimisticAddBlocksByQueueIdRef = useRef(optimisticAddBlocksByQueueId)
  optimisticAddBlocksByQueueIdRef.current = optimisticAddBlocksByQueueId
  const splitMarkersRef = useRef(splitMarkers)
  splitMarkersRef.current = splitMarkers
  const nextSectionIndexRef = useRef(nextSectionIndex)
  nextSectionIndexRef.current = nextSectionIndex
  const bookRef = useRef(book)
  bookRef.current = book
  const selectedWorkingFileRef = useRef(selectedWorkingFile)
  selectedWorkingFileRef.current = selectedWorkingFile

  const getBlockByRef = useCallback((ref: BlockRef | null) => {
    if (!ref) return null
    const section = sectionsRef.current.find((item) => item.index === ref.sectionIndex)
    if (!section) return null
    return section.blocks.find((block) => block.id === ref.blockId) ?? null
  }, [])

  const dismissEditingBlock = useCallback((opts?: { clearFocus?: boolean }) => {
    if (!editingBlockRef.current) {
      if (opts?.clearFocus) setFocusedBlock(null)
      return
    }
    setEditingBlock(null)
    if (opts?.clearFocus) setFocusedBlock(null)
  }, [setEditingBlock, setFocusedBlock])

  const beginEditingBlock = useCallback((ref: BlockRef) => {
    if (editingBlockRef.current && !isSameBlockRef(editingBlockRef.current, ref)) {
      dismissEditingBlock()
    }
    const block = getBlockByRef(ref)
    if (!block) return
    if (block.tag.toLowerCase() === 'img') return
    setFocusedBlock(ref)
    setEditingBlock(ref)
  }, [dismissEditingBlock, getBlockByRef, setFocusedBlock, setEditingBlock])

  const cancelEditingBlock = useCallback(() => {
    if (!editingBlockRef.current) return
    const ref = editingBlockRef.current
    setEditingBlock(null)
    setFocusedBlock(ref)
  }, [setEditingBlock, setFocusedBlock])

  const commitEditingBlock = useCallback((draft: string) => {
    if (!editingBlockRef.current) return
    const ref = editingBlockRef.current
    const block = getBlockByRef(ref)
    if (block) {
      handleSaveHtml(ref.sectionIndex, block, draft)
    }
    setEditingBlock(null)
    setFocusedBlock(ref)
  }, [getBlockByRef, setEditingBlock, setFocusedBlock])

  const focusBlock = useCallback((ref: BlockRef) => {
    if (powerModeRef.current && editingBlockRef.current && !isSameBlockRef(editingBlockRef.current, ref)) {
      dismissEditingBlock()
    }
    setFocusedBlock(ref)
  }, [dismissEditingBlock, setFocusedBlock])

  useEffect(() => {
    return () => {
      book?.destroy?.()
    }
  }, [book])

  useEffect(() => {
    void refreshWorkingFiles()
  }, [])

  useEffect(() => {
    if (!spellcheckEnabled) return
    if (!selectedWorkingFileRef.current) return
    const needsSpellcheck = sections.filter((s) =>
      s.blocks.some((b) => b.tag.toLowerCase() !== 'img' && !b.spellcheckHtml)
    )
    for (const section of needsSpellcheck) {
      fetchSpellcheckForBlocks(section.index, section.href, section.blocks)
    }
  }, [spellcheckEnabled, sections])

  const handleLoadClick = () => {
    fileInputRef.current?.click()
  }

  const refreshWorkingFiles = async () => {
    const response = await fetch('/api/working-files')
    const data = await response.json()
    setWorkingFiles(data.files || [])
  }

  const loadSection = async (
    index: number,
    activeBook: any,
    force = false,
    markDisplayed = true
  ) => {
    if (!activeBook || (isLoadingSection && !force)) {
      return
    }

    const section = activeBook.spine.get(index)
    if (!section) {
      setNextSectionIndex(null)
      return
    }

    setIsLoadingSection(true)
    try {
      const output = await section.render(activeBook.load.bind(activeBook))
      const blocks = parseSectionBlocks(output, section.href, index)
      setSections((prev) => {
        const existingIndex = prev.findIndex((item) => item.index === index)
        if (existingIndex >= 0) {
          const next = [...prev]
          next[existingIndex] = { index, href: section.href, blocks }
          return next
        }
        return [...prev, { index, href: section.href, blocks }]
      })
      if (markDisplayed) {
        setDisplayedSections((prev) => ({ ...prev, [index]: true }))
      }
      setSectionMeta((prev) => {
        const existingIndex = prev.findIndex((item) => item.index === index)
        if (existingIndex === -1) {
          return prev
        }
        const updated = [...prev]
        const current = updated[existingIndex]
        const updatedTitle = extractSectionTitle(output) || current.title
        updated[existingIndex] = {
          ...current,
          title: updatedTitle,
          loading: false,
        }
        return updated
      })
      const next = section.next ? section.next() : null
      setNextSectionIndex(next ? next.index : null)

      fetchSpellcheckForBlocks(index, section.href, blocks)
    } finally {
      setIsLoadingSection(false)
    }
  }

  const fetchSpellcheckForBlocks = async (
    sectionIndex: number,
    href: string,
    blocks: TextBlock[]
  ) => {
    const filename = selectedWorkingFileRef.current
    console.log('[section] sync with server', {
      filename: filename || '(none)',
      sectionIndex,
      href,
      blockCount: blocks.length,
    })
    if (!filename) {
      console.log('[section] No filename — server will not be contacted')
      return
    }
    if (blocks.length === 0) {
      console.log('[section] No blocks in this section — server will not be contacted')
      return
    }
    try {
      const res = await fetch(
        `/api/working-files/${encodeURIComponent(filename)}/spellcheck-section`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sectionIndex,
            href,
            blocks: blocks.map((b) => ({ tag: b.tag, html: b.html })),
          }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        console.error('[section] Server error:', res.status, data?.error ?? data)
        return
      }
      if (!data?.blocks) {
        console.error('[section] Server returned no blocks')
        return
      }

      const unknownCount =
        typeof data.unknownWordCount === 'number'
          ? data.unknownWordCount
          : data.blocks.reduce(
              (sum: number, block: { spellcheckHtml?: string }) =>
                sum +
                (block.spellcheckHtml
                  ? [...block.spellcheckHtml.matchAll(/class="spell-unknown"/g)].length
                  : 0),
              0
            )
      if (unknownCount === 0) {
        console.log('[spellcheck] Section complete — 0 unknown words (no misspellings)')
      } else {
        console.log(`[spellcheck] Section complete — ${unknownCount} highlighted unknown word(s)`)
      }

      setSections((prev) =>
        prev.map((section) => {
          if (section.index !== sectionIndex) return section
          return {
            ...section,
            blocks: section.blocks.map((block, i) => ({
              ...block,
              spellcheckHtml: data.blocks[i]?.spellcheckHtml ?? block.spellcheckHtml,
            })),
          }
        })
      )
    } catch (err) {
      console.error('[section] Sync error:', err)
    }
  }

  const preloadSectionTitles = async (activeBook: any) => {
    const items = activeBook.spine?.items || []
    setTitlesLoading(true)
    for (const item of items) {
      const index =
        typeof item.index === 'number'
          ? item.index
          : sectionMeta.find((section) => section.href === item.href)?.index
      if (typeof index !== 'number') {
        continue
      }
      try {
        const section = activeBook.spine.get(index)
        if (!section) {
          continue
        }
        const output = await section.render(activeBook.load.bind(activeBook))
        const title = extractSectionTitle(output)
        setSectionMeta((prev) =>
          prev.map((sectionItem) =>
            sectionItem.index === index
              ? { ...sectionItem, title: title || sectionItem.title, loading: false }
              : sectionItem
          )
        )
      } catch {
        setSectionMeta((prev) =>
          prev.map((sectionItem) =>
            sectionItem.index === index ? { ...sectionItem, loading: false } : sectionItem
          )
        )
      }
    }
    setTitlesLoading(false)
  }

  const loadHistory = async (filename: string) => {
    if (!filename) {
      setEditHistory([])
      return
    }
    const response = await fetch(
      `/api/working-files/${encodeURIComponent(filename)}/history`
    )
    const data = await response.json()
    setEditHistory(data.history || [])
  }

  const loadWorkingFile = async (filename: string) => {
    if (!filename) {
      return
    }

    selectedWorkingFileRef.current = filename
    setSelectedWorkingFile(filename)

    setIsLoading(true)
    const fallbackTitle = filename.replace(/\.epub$/i, '')
    setSections([])
    setNextSectionIndex(null)

    if (book?.destroy) {
      book.destroy()
    }

    const response = await fetch(
      `/api/working-files/${encodeURIComponent(filename)}`
    )
    const arrayBuffer = await response.arrayBuffer()
    const nextBook = ePub(arrayBuffer, { replacements: 'blobUrl' })
    await nextBook.ready
    const metadata = await nextBook.loaded.metadata
    const title = metadata?.title?.trim() || fallbackTitle
    setWorkingFileTitles((prev) => ({ ...prev, [filename]: title }))
    const items = nextBook.spine?.items || []
    const metas: SectionMeta[] = items.map((item: any, idx: number) => ({
      index: typeof item.index === 'number' ? item.index : idx,
      href: item.href,
      title: '',
      loading: true,
    }))
    setSectionMeta(metas)
    const firstIndex = metas[0]?.index ?? 0
    setDisplayedSections({ [firstIndex]: true })
    setBook(nextBook)
    setIsLoading(false)
    await loadHistory(filename)

    try {
      const endnotesRes = await fetch(
        `/api/working-files/${encodeURIComponent(filename)}/endnotes`
      )
      const endnotesData = await endnotesRes.json()
      if (endnotesData?.endnotes?.length) {
        setEndnotes(endnotesData.endnotes)
        noterefMapRef.current = endnotesData.noterefMap || {}
      } else {
        setEndnotes([])
        noterefMapRef.current = {}
      }
    } catch {
      setEndnotes([])
      noterefMapRef.current = {}
    }

    try {
      const dictRes = await fetch(
        `/api/working-files/${encodeURIComponent(filename)}/dictionary`
      )
      const dictData = await dictRes.json()
      setCustomDictionary(dictData?.words ?? [])
    } catch {
      setCustomDictionary([])
    }

    await loadSection(firstIndex, nextBook, true, true)
    void preloadSectionTitles(nextBook)
    setIsLoading(false)
  }

  const handleLoadNextSection = useCallback(() => {
    if (nextSectionIndexRef.current === null || !bookRef.current) {
      return
    }
    void loadSection(nextSectionIndexRef.current, bookRef.current, false, true)
  }, [])

  const handleToggleSection = (index: number) => {
    setDisplayedSections((prev) => ({
      ...prev,
      [index]: !prev[index],
    }))
  }

  const handleGoToSection = async (index: number) => {
    if (!book) {
      return
    }
    const existing = sections.find((section) => section.index === index)
    if (!existing) {
      await loadSection(index, book, true, true)
    } else {
      void fetchSpellcheckForBlocks(index, existing.href, existing.blocks)
    }
    setDisplayedSections((prev) => ({ ...prev, [index]: true }))
    requestAnimationFrame(() => {
      const element = document.getElementById(`section-${index}`)
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch('/api/working-files', {
      method: 'POST',
      body: formData,
    })
    const data = await response.json()
    await refreshWorkingFiles()
    if (data?.filename) {
      setSelectedWorkingFile(data.filename)
      await loadWorkingFile(data.filename)
    }
    setQueueItems([])
    setOptimisticAddBlocksByQueueId({})
    setCodePanelBlockId(null)
    setIsUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleWorkingFileSelect = (filename: string) => {
    const value = filename
    setSelectedWorkingFile(value)
    setQueueItems([])
    setOptimisticAddBlocksByQueueId({})
    setCodePanelBlockId(null)
    void loadWorkingFile(value)
  }

  const buildPathSelector = (element: Element, doc: Document) => {
    const parts: string[] = []
    let current: Element | null = element
    while (current && current !== doc.body && current !== doc.documentElement) {
      const parentEl: Element | null = current.parentElement
      if (!parentEl) {
        break
      }
      const tag = current.tagName.toLowerCase()
      const siblings = Array.from(parentEl.children) as Element[]
      const sameTagSiblings = siblings.filter((child) => child.tagName.toLowerCase() === tag)
      const index =
        sameTagSiblings.findIndex((child) => child === current) + 1
      parts.unshift(`${tag}:nth-of-type(${index})`)
      current = parentEl
    }
    return `body > ${parts.join(' > ')}`
  }

  const parseSectionBlocks = (
    html: string,
    href: string,
    sectionIndex: number
  ) => {
    const parser = new DOMParser()
    let doc = parser.parseFromString(html, 'application/xhtml+xml')
    let body = doc.querySelector('body')
    if (!body) {
      doc = parser.parseFromString(html, 'text/html')
      body = doc.querySelector('body')
    }
    if (!body) {
      return []
    }

    const allowedTags = new Set([
      'P',
      'H1',
      'H2',
      'H3',
      'H4',
      'H5',
      'H6',
      'LI',
      'BLOCKQUOTE',
      'PRE',
      'FIGURE',
      'FIGCAPTION',
      'TABLE',
      'UL',
      'OL',
      'SECTION',
      'ARTICLE',
      'IMG',
    ])

    // Replace noteref <a> elements with placeholder text before extracting block HTML
    const noterefMap = noterefMapRef.current
    if (Object.keys(noterefMap).length) {
      const noteNumToUid = new Map<string, string>()
      for (const [noteId, uid] of Object.entries(noterefMap)) {
        noteNumToUid.set(noteId.replace('note-', ''), uid)
      }
      body.querySelectorAll('a').forEach((a) => {
        const text = a.textContent?.trim() || ''
        const uid = noteNumToUid.get(text)
        if (uid && (a.getAttribute('epub:type') === 'noteref' || a.getAttribute('href')?.includes('endnotes.xhtml'))) {
          a.replaceWith(doc.createTextNode(`<a>placeholder-${uid}</a>`))
        }
      })
    }

    const blocks: TextBlock[] = []
    const walk = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element
        if (allowedTags.has(element.tagName.toUpperCase())) {
          const blockId = element.getAttribute('data-easypub-id') || undefined
          const order = blocks.length
          const tagName = element.tagName.toUpperCase()
          const html =
            tagName === 'IMG'
              ? (element as HTMLImageElement).outerHTML
              : element.innerHTML
          const inlineStyle = element.getAttribute('style') || ''
          const alignMatch = inlineStyle.match(/text-align:\s*(left|right|center|justify)/)
          const justify = alignMatch ? alignMatch[1] : undefined
          blocks.push({
            id: blockId || `${sectionIndex}-${order}`,
            blockId,
            tag: element.tagName.toLowerCase(),
            html,
            selector: buildPathSelector(element, doc),
            href,
            order,
            justify,
          })
          return
        }
      }
      node.childNodes.forEach(walk)
    }

    walk(body)
    return blocks
  }

  const extractSectionTitle = (html: string) => {
    const parser = new DOMParser()
    let doc = parser.parseFromString(html, 'application/xhtml+xml')
    let title = doc.querySelector('title')?.textContent?.trim()
    if (!title) {
      doc = parser.parseFromString(html, 'text/html')
      title = doc.querySelector('title')?.textContent?.trim()
    }
    if (!title) {
      const heading = doc.querySelector('h1, h2, h3, h4, h5, h6')
      title = heading?.textContent?.trim()
    }
    return title || ''
  }

  const queueKey = (fromHref: string, toHref: string) =>
    `${fromHref}>>>${toHref}`

  const isQueued = useCallback((fromHref: string, toHref: string) =>
    queueItemsRef.current.some((item) => item.id === queueKey(fromHref, toHref))
  , [])

  const handleQueueMerge = useCallback((fromHref: string, toHref: string) => {
    if (queueItemsRef.current.some((item) => item.id === queueKey(fromHref, toHref))) {
      return
    }
    const label = `Merge ${fromHref} → ${toHref}`
    setQueueItems((prev) => [
      ...prev,
      { id: queueKey(fromHref, toHref), action: 'merge', fromHref, toHref, label },
    ])
  }, [])

  const changeTagKey = (href: string, selector: string, blockId?: string) =>
    `change-tag|${href}|${blockId || selector}`

  const deleteBlockKey = (href: string, selector: string, blockId?: string) =>
    `delete-block|${href}|${blockId || selector}`

  const appendBlockKey = (
    fromHref: string,
    fromSelector: string,
    fromBlockId?: string
  ) => `append-block|${fromHref}|${fromBlockId || fromSelector}`

  const renameSectionKey = (href: string) => `rename-section|${href}`
  const splitSectionKey = (href: string, splitIndex: number) =>
    `split-section|${href}|${splitIndex}`
  const editTextKey = (href: string, blockIndex: number, blockId?: string) =>
    `edit-text|${href}|${blockId || blockIndex}`
  const editHtmlKey = (href: string, blockIndex: number, blockId?: string) =>
    `edit-html|${href}|${blockId || blockIndex}`

  const changeJustifyKey = (href: string, selector: string, blockId?: string) =>
    `change-justify|${href}|${blockId || selector}`

  const handleQueueChangeTag = (
    href: string,
    selector: string,
    fromTag: string,
    toTag: string,
    blockIndex: number,
    blockId?: string
  ) => {
    setQueueItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.id === changeTagKey(href, selector, blockId)
      )
      const label = `Change ${fromTag} → ${toTag}`
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = {
          ...next[existingIndex],
          fromTag,
          toTag,
          label,
          blockIndex,
          blockId,
        }
        return next
      }
      return [
        ...prev,
        {
          id: changeTagKey(href, selector, blockId),
          action: 'change-tag',
          fromHref: href,
          toHref: href,
          label,
          selector,
          fromTag,
          toTag,
          blockIndex,
          blockId,
        },
      ]
    })
  }

  const handleQueueChangeJustify = (
    href: string,
    selector: string,
    fromJustify: string,
    toJustify: string,
    blockIndex: number,
    blockId?: string
  ) => {
    setQueueItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.id === changeJustifyKey(href, selector, blockId)
      )
      const label = `Justify ${toJustify}`
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = {
          ...next[existingIndex],
          fromJustify,
          toJustify,
          label,
          blockIndex,
          blockId,
        }
        return next
      }
      return [
        ...prev,
        {
          id: changeJustifyKey(href, selector, blockId),
          action: 'change-justify',
          fromHref: href,
          toHref: href,
          label,
          selector,
          fromJustify,
          toJustify,
          blockIndex,
          blockId,
        },
      ]
    })
  }

  const handleQueueDeleteBlock = (
    href: string,
    selector: string,
    tag: string,
    blockIndex: number,
    blockId?: string
  ) => {
    setQueueItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.id === deleteBlockKey(href, selector, blockId)
      )
      if (existingIndex >= 0) {
        return prev
      }
      return [
        ...prev,
        {
          id: deleteBlockKey(href, selector, blockId),
          action: 'delete-block',
          fromHref: href,
          toHref: href,
          label: `Delete ${tag.toUpperCase()} block`,
          selector,
          blockIndex,
          blockId,
        },
      ]
    })
  }

  const handleQueueAppendBlock = (
    fromHref: string,
    fromSelector: string,
    toHref: string,
    toSelector: string,
    direction: 'previous' | 'following',
    fromIndex: number,
    toIndex: number,
    fromBlockId?: string,
    toBlockId?: string
  ) => {
    setQueueItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.id === appendBlockKey(fromHref, fromSelector, fromBlockId)
      )
      const label = `Append to ${direction}`
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = {
          ...next[existingIndex],
          toHref,
          toSelector,
          label,
          direction,
          fromIndex,
          toIndex,
          fromBlockId,
          toBlockId,
        }
        return next
      }
      return [
        ...prev,
        {
          id: appendBlockKey(fromHref, fromSelector, fromBlockId),
          action: 'append-block',
          fromHref,
          toHref,
          label,
          fromSelector,
          toSelector,
          direction,
          fromIndex,
          toIndex,
          fromBlockId,
          toBlockId,
        },
      ]
    })
  }

  const handleQueueRenameSection = (href: string, nextTitle: string) => {
    setQueueItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.id === renameSectionKey(href)
      )
      const label = `Rename section → ${nextTitle}`
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = {
          ...next[existingIndex],
          label,
          title: nextTitle,
        }
        return next
      }
      return [
        ...prev,
        {
          id: renameSectionKey(href),
          action: 'rename-section',
          fromHref: href,
          toHref: href,
          label,
          title: nextTitle,
        },
      ]
    })
  }

  const handleQueueSplitSection = (
    href: string,
    splitIndex: number,
    newHref: string,
    title: string,
    splitBlockId?: string
  ) => {
    setQueueItems((prev) => {
      const id = splitSectionKey(href, splitIndex)
      const existingIndex = prev.findIndex((item) => item.id === id)
      const label = `Split section → ${title}`
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = {
          ...next[existingIndex],
          label,
          title,
          newHref,
          splitIndex,
          splitBlockId,
        }
        return next
      }
      return [
        ...prev,
        {
          id,
          action: 'split-section',
          fromHref: href,
          toHref: newHref,
          label,
          title,
          newHref,
          splitIndex,
          splitBlockId,
        },
      ]
    })
  }

  /** Reserved for future queue integration. */
  // @ts-expect-error TS6133 - intentionally unused for now
  const handleQueueEditText = (
    href: string,
    blockIndex: number,
    nextText: string,
    blockId?: string
  ) => {
    setQueueItems((prev) => {
      const id = editTextKey(href, blockIndex, blockId)
      const existingIndex = prev.findIndex((item) => item.id === id)
      const label = `Edit text (${nextText.trim().slice(0, 24)}${nextText.trim().length > 24 ? '…' : ''})`
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = {
          ...next[existingIndex],
          label,
          text: nextText,
        }
        return next
      }
      return [
        ...prev,
        {
          id,
          action: 'edit-text',
          fromHref: href,
          toHref: href,
          label,
          blockIndex,
          text: nextText,
          blockId,
        },
      ]
    })
  }

  const handleQueueEditHtml = (
    href: string,
    blockIndex: number,
    nextHtml: string,
    blockId?: string
  ) => {
    const preview = stripHtmlTags(nextHtml).trim()
    setQueueItems((prev) => {
      const id = editHtmlKey(href, blockIndex, blockId)
      const existingIndex = prev.findIndex((item) => item.id === id)
      const label = `Edit text (${preview.slice(0, 24)}${preview.length > 24 ? '…' : ''})`
      if (existingIndex >= 0) {
        const next = [...prev]
        next[existingIndex] = {
          ...next[existingIndex],
          label,
          html: nextHtml,
        }
        return next
      }
      return [
        ...prev,
        {
          id,
          action: 'edit-html',
          fromHref: href,
          toHref: href,
          label,
          blockIndex,
          html: nextHtml,
          blockId,
        },
      ]
    })
  }

  const handleRemoveQueueItem = useCallback((id: string) => {
    const tempBlockId = optimisticAddBlocksByQueueIdRef.current[id]
    if (tempBlockId) {
      setSections((prev) =>
        prev.map((section) => ({
          ...section,
          blocks: removeOptimisticAddBlock(section.blocks, tempBlockId),
        }))
      )
      setOptimisticAddBlocksByQueueId((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }
    setQueueItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const handleExecuteQueue = async () => {
    const hasEndnotes = endnotes.some((en) => en.text)
    if (!selectedWorkingFile || (!queueItems.length && !hasEndnotes)) {
      return
    }
    setIsLoading(true)
    setProgressVisible(true)
    setProgressPhase('loading-queue')
    setProgressTotal(queueItems.length)
    setProgressCompleted(0)

    const response = await fetch(
      `/api/working-files/${encodeURIComponent(selectedWorkingFile)}/queue`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endnotes: endnotes.filter((en) => en.text),
          actions: queueItems.map(
            ({
              action,
              fromHref,
              toHref,
              selector,
              toTag,
              fromSelector,
              toSelector,
              direction,
              blockIndex,
              fromIndex,
              toIndex,
              title,
              splitIndex,
              newHref,
              text,
              html,
              blockId,
              fromBlockId,
              toBlockId,
              splitBlockId,
              fromJustify,
              toJustify,
              afterBlockId,
              afterSelector,
              afterIndex,
              insertedText,
              insertedTagHint,
            }) => ({
              action,
              fromHref,
              toHref,
              selector,
              toTag,
              fromSelector,
              toSelector,
              direction,
              blockIndex,
              fromIndex,
              toIndex,
              title,
              splitIndex,
              newHref,
              text,
              html,
              blockId,
              fromBlockId,
              toBlockId,
              splitBlockId,
              fromJustify,
              toJustify,
              afterBlockId,
              afterSelector,
              afterIndex,
              insertedText,
              insertedTagHint,
            })
          ),
        }),
      }
    )

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      console.error('Queue submit failed:', err)
      setIsLoading(false)
      setProgressVisible(false)
      return
    }

    const pollUntilDone = () =>
      new Promise<void>((resolve) => {
        const interval = window.setInterval(async () => {
          try {
            const res = await fetch(
              `/api/working-files/${encodeURIComponent(selectedWorkingFile)}/progress`
            )
            const data = await res.json()
            setProgressPhase(data.phase)
            setProgressTotal(data.total || queueItems.length)
            setProgressCompleted(data.completed || 0)

            if (data.phase === 'complete') {
              window.clearInterval(interval)
              if (data.history) {
                setEditHistory(data.history)
              }
              resolve()
            } else if (data.phase === 'error') {
              window.clearInterval(interval)
              console.error('Queue processing error:', data.error)
              resolve()
            }
          } catch {
            // Transient network error — keep polling
          }
        }, 500)
      })

    await pollUntilDone()
    setQueueItems([])
    setOptimisticAddBlocksByQueueId({})
    setSplitMarkers([])
    setCodePanelBlockId(null)
    setProgressPhase('reloading')
    await loadWorkingFile(selectedWorkingFile)
    setIsLoading(false)
    setProgressPhase('complete')
  }

  const handleUndo = async () => {
    if (!selectedWorkingFile) {
      return
    }
    setIsLoading(true)
    const response = await fetch(
      `/api/working-files/${encodeURIComponent(selectedWorkingFile)}/undo`,
      { method: 'POST' }
    )
    const data = await response.json()
    if (data?.history) {
      setEditHistory(data.history)
    }
    await loadWorkingFile(selectedWorkingFile)
    setIsLoading(false)
  }

  const handleChangeBlockTag = (
    sectionIndex: number,
    blockId: string,
    nextTag: string
  ) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.index !== sectionIndex) {
          return section
        }
        return {
          ...section,
          blocks: section.blocks.map((block) =>
            block.id === blockId ? { ...block, tag: nextTag } : block
          ),
        }
      })
    )
  }

  const handleChangeBlockJustify = (
    sectionIndex: number,
    blockId: string,
    nextJustify: string
  ) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.index !== sectionIndex) {
          return section
        }
        return {
          ...section,
          blocks: section.blocks.map((block) =>
            block.id === blockId ? { ...block, justify: nextJustify } : block
          ),
        }
      })
    )
  }

  const handleDeleteBlock = (sectionIndex: number, blockId: string) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.index !== sectionIndex) {
          return section
        }
        return {
          ...section,
          blocks: section.blocks.map((block) =>
            block.id === blockId ? { ...block, queuedForDelete: true } : block
          ),
        }
      })
    )
  }

  const handleRestoreBlock = (sectionIndex: number, blockId: string) => {
    setSections((prev) =>
      prev.map((section) => {
        if (section.index !== sectionIndex) {
          return section
        }
        return {
          ...section,
          blocks: section.blocks.map((block) =>
            block.id === blockId
              ? {
                  ...block,
                  queuedForDelete: false,
                }
              : block
          ),
        }
      })
    )
  }

  const findAdjacentBlock = (
    sectionIndex: number,
    blockId: string,
    direction: 'previous' | 'following'
  ) => {
    const orderedSections = [...sectionsRef.current].sort((a, b) => a.index - b.index)
    const currentSection = orderedSections.find(
      (section) => section.index === sectionIndex
    )
    if (!currentSection) {
      return null
    }
    const currentBlockIndex = currentSection.blocks.findIndex(
      (block) => block.id === blockId
    )
    if (currentBlockIndex === -1) {
      return null
    }

    if (direction === 'previous') {
      if (currentBlockIndex > 0) {
        return {
          sectionIndex,
          block: currentSection.blocks[currentBlockIndex - 1],
        }
      }
      const previousSectionIndex = orderedSections.findIndex(
        (section) => section.index === sectionIndex
      )
      for (let i = previousSectionIndex - 1; i >= 0; i -= 1) {
        const section = orderedSections[i]
        if (section.blocks.length) {
          return {
            sectionIndex: section.index,
            block: section.blocks[section.blocks.length - 1],
          }
        }
      }
    } else {
      if (currentBlockIndex < currentSection.blocks.length - 1) {
        return {
          sectionIndex,
          block: currentSection.blocks[currentBlockIndex + 1],
        }
      }
      const currentSectionIndex = orderedSections.findIndex(
        (section) => section.index === sectionIndex
      )
      for (let i = currentSectionIndex + 1; i < orderedSections.length; i += 1) {
        const section = orderedSections[i]
        if (section.blocks.length) {
          return { sectionIndex: section.index, block: section.blocks[0] }
        }
      }
    }

    return null
  }

  const handleAppendBlock = (
    sectionIndex: number,
    blockId: string,
    direction: 'previous' | 'following'
  ) => {
    const adjacent = findAdjacentBlock(sectionIndex, blockId, direction)
    if (!adjacent) {
      return
    }
    const source = sectionsRef.current
      .find((section) => section.index === sectionIndex)
      ?.blocks.find((block) => block.id === blockId)
    if (!source) {
      return
    }
    const targetId = adjacent.block.id

    setSections((prev) =>
      prev.map((section) => {
        if (
          section.index === sectionIndex ||
          section.index === adjacent.sectionIndex
        ) {
          return {
            ...section,
            blocks: section.blocks.map((block) =>
              block.id === blockId
                ? { ...block, queuedForDelete: true }
                : block.id === targetId
                ? {
                    ...block,
                    appendedFromId: blockId,
                    appendedHtml: source.html,
                    appendedPosition:
                      direction === 'following' ? 'prepend' : 'append',
                    queuedWithAppend: true,
                    originalHtml: block.html,
                  }
                : block
            ),
          }
        }
        return section
      })
    )

    handleQueueAppendBlock(
      source.href,
      source.selector,
      adjacent.block.href,
      adjacent.block.selector,
      direction,
      source.order,
      adjacent.block.order,
      source.blockId,
      adjacent.block.blockId
    )
    handleQueueDeleteBlock(
      source.href,
      source.selector,
      source.tag,
      source.order,
      source.blockId
    )
  }

  const handleUndoAppend = useCallback((blockId: string) => {
    setSections((prev) =>
      prev.map((section) => ({
        ...section,
        blocks: section.blocks.map((block) => {
          if (block.appendedFromId === blockId) {
            return {
              ...block,
              appendedFromId: undefined,
              appendedHtml: undefined,
              appendedPosition: undefined,
              queuedWithAppend: false,
              originalHtml: undefined,
            }
          }
          if (block.id === blockId) {
            return { ...block, queuedForDelete: false }
          }
          return block
        }),
      }))
    )
    const source = sectionsRef.current
      .flatMap((section) => section.blocks)
      .find((block) => block.id === blockId)
    if (source) {
      handleRemoveQueueItem(
        appendBlockKey(source.href, source.selector, source.blockId)
      )
      handleRemoveQueueItem(
        deleteBlockKey(source.href, source.selector, source.blockId)
      )
    }
  }, [handleRemoveQueueItem])

  const handleAddTextBlock = (sectionIndex: number, afterBlock: TextBlock) => {
    const id = getAddBlockQueueItemId(afterBlock)
    if (queueItemsRef.current.some((item) => item.id === id)) {
      return
    }
    if (optimisticAddBlocksByQueueIdRef.current[id]) {
      return
    }

    let tempBlockId: string | null = null
    setSections((prev) =>
      prev.map((section) => {
        if (section.index !== sectionIndex) {
          return section
        }
        const inserted = optimisticallyInsertBlockAfter(section.blocks, afterBlock)
        if (!inserted) {
          return section
        }
        tempBlockId = inserted.tempBlockId
        return { ...section, blocks: inserted.nextBlocks }
      })
    )
    if (!tempBlockId) {
      return
    }

    setOptimisticAddBlocksByQueueId((prev) => ({ ...prev, [id]: tempBlockId! }))
    setQueueItems((prev) => [...prev, buildAddBlockQueueItem(afterBlock)])
  }

  const handleSelectAction = useCallback((
    sectionIndex: number,
    block: TextBlock,
    action: string
  ) => {
    if (action === 'see') {
      setCodePanelBlockId(block.id)
      return
    }
    if (action === 'add-block') {
      handleAddTextBlock(sectionIndex, block)
      return
    }
    if (action === 'delete') {
      handleDeleteBlock(sectionIndex, block.id)
      handleQueueDeleteBlock(
        block.href,
        block.selector,
        block.tag,
        block.order,
        block.blockId
      )
      return
    }
    if (action === 'append-prev') {
      handleAppendBlock(sectionIndex, block.id, 'previous')
      return
    }
    if (action === 'append-next') {
      handleAppendBlock(sectionIndex, block.id, 'following')
      return
    }
    if (action === 'break-below') {
      handleSplitSection(sectionIndex, block.id)
    }
  }, [])

  const handleChangeTag = useCallback((
    sectionIndex: number,
    block: TextBlock,
    nextTag: string
  ) => {
    if (nextTag === block.tag) {
      return
    }
    handleChangeBlockTag(sectionIndex, block.id, nextTag)
    handleQueueChangeTag(
      block.href,
      block.selector,
      block.tag,
      nextTag,
      block.order,
      block.blockId
    )
  }, [])

  const handleChangeJustify = useCallback((
    sectionIndex: number,
    block: TextBlock,
    nextJustify: string
  ) => {
    if (nextJustify === (block.justify || 'left')) {
      return
    }
    handleChangeBlockJustify(sectionIndex, block.id, nextJustify)
    handleQueueChangeJustify(
      block.href,
      block.selector,
      block.justify || 'left',
      nextJustify,
      block.order,
      block.blockId
    )
  }, [])

  const handleRestore = useCallback((sectionIndex: number, block: TextBlock) => {
    handleRestoreBlock(sectionIndex, block.id)
    handleRemoveQueueItem(
      deleteBlockKey(block.href, block.selector, block.blockId)
    )
  }, [handleRemoveQueueItem])

  const handleSaveHtml = (sectionIndex: number, block: TextBlock, nextHtml: string) => {
    const sanitized = sanitizeInlineHtml(nextHtml)
    setSections((prev) =>
      prev.map((section) => {
        if (section.index !== sectionIndex) {
          return section
        }
        return {
          ...section,
          blocks: section.blocks.map((item) =>
            item.id === block.id ? { ...item, html: sanitized, spellcheckHtml: undefined } : item
          ),
        }
      })
    )
    handleQueueEditHtml(block.href, block.order, sanitized, block.blockId)

    const filename = selectedWorkingFileRef.current
    if (filename && spellcheckEnabled) {
      fetch(
        `/api/working-files/${encodeURIComponent(filename)}/spellcheck-block`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html: sanitized }),
        }
      )
        .then((res) => res.json())
        .then((data) => {
          if (data?.spellcheckHtml) {
            setSections((prev) =>
              prev.map((section) => {
                if (section.index !== sectionIndex) return section
                return {
                  ...section,
                  blocks: section.blocks.map((item) =>
                    item.id === block.id
                      ? { ...item, spellcheckHtml: data.spellcheckHtml }
                      : item
                  ),
                }
              })
            )
          }
        })
        .catch(() => {})
    }
  }

  const handleAddToDictionary = useCallback((word: string) => {
    setCustomDictionary((prev) => {
      if (prev.some((w) => w.toLowerCase() === word.toLowerCase())) return prev
      const next = [...prev, word]
      if (selectedWorkingFile) {
        fetch(
          `/api/working-files/${encodeURIComponent(selectedWorkingFile)}/dictionary`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ words: next }),
          }
        ).catch(() => {})
      }
      return next
    })
    setSelectedSpellWord(null)
    document.querySelectorAll('.spell-selected').forEach((el) => {
      el.classList.remove('spell-selected')
    })
    document
      .querySelectorAll(`[data-word].spell-unknown`)
      .forEach((el) => {
        if (el.getAttribute('data-word')?.toLowerCase() === word.toLowerCase()) {
          el.classList.replace('spell-unknown', 'spell-dictionary')
        }
      })
  }, [selectedWorkingFile])

  const handleRemoveFromDictionary = useCallback((word: string) => {
    setCustomDictionary((prev) => {
      const next = prev.filter((w) => w.toLowerCase() !== word.toLowerCase())
      if (selectedWorkingFile) {
        fetch(
          `/api/working-files/${encodeURIComponent(selectedWorkingFile)}/dictionary`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ words: next }),
          }
        ).catch(() => {})
      }
      return next
    })
    document
      .querySelectorAll(`[data-word].spell-dictionary`)
      .forEach((el) => {
        if (el.getAttribute('data-word')?.toLowerCase() === word.toLowerCase()) {
          el.classList.replace('spell-dictionary', 'spell-unknown')
        }
      })
  }, [selectedWorkingFile])

  const handleRenameSection = useCallback((href: string, nextTitle: string) => {
    const isSplitSection = splitMarkersRef.current.some((marker) => marker.newHref === href)
    setSectionMeta((prev) =>
      prev.map((section) =>
        section.href === href ? { ...section, title: nextTitle } : section
      )
    )
    if (isSplitSection) {
      setSplitMarkers((prev) =>
        prev.map((marker) =>
          marker.newHref === href ? { ...marker, newTitle: nextTitle } : marker
        )
      )
      setQueueItems((prev) =>
        prev.map((item) =>
          item.action === 'split-section' && item.newHref === href
            ? { ...item, title: nextTitle, label: `Split section → ${nextTitle}` }
            : item
        )
      )
      return
    }
    handleQueueRenameSection(href, nextTitle)
    setQueueItems((prev) =>
      prev.map((item) =>
        item.action === 'split-section' && item.newHref === href
          ? { ...item, title: nextTitle, label: `Split section → ${nextTitle}` }
          : item
      )
    )
  }, [])

  const handleSplitSection = (sectionIndex: number, blockId: string) => {
    const section = sectionsRef.current.find((item) => item.index === sectionIndex)
    if (!section) {
      return
    }
    const splitBlock = section.blocks.find((block) => block.id === blockId)
    const splitIndex = section.blocks.findIndex((block) => block.id === blockId)
    if (splitIndex === -1 || splitIndex === section.blocks.length - 1) {
      return
    }
    const existingHrefs = new Set(
      sectionMetaRef.current.map((item) => item.href)
    )
    const hrefDir = section.href.includes('/')
      ? section.href.slice(0, section.href.lastIndexOf('/') + 1)
      : ''

    let randomId = ''
    let newHref = ''
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = Math.floor(Math.random() * 1e8)
        .toString()
        .padStart(8, '0')
      const candidateHref = `${hrefDir}section-${candidate}.xhtml`
      if (!existingHrefs.has(candidateHref)) {
        randomId = candidate
        newHref = candidateHref
        break
      }
    }
    if (!randomId || !newHref) {
      return
    }

    const newTitle = `New Section ${randomId}`
    const newIndex = Date.now()
    const originalBlocks = section.blocks
    const headBlocks = section.blocks
      .slice(0, splitIndex + 1)
      .map((block, index) => ({ ...block, order: index }))
    const tailBlocks = section.blocks
      .slice(splitIndex + 1)
      .map((block, index) => ({ ...block, order: index, href: newHref }))

    setSections((prev) =>
      prev
        .map((item) =>
          item.index === sectionIndex ? { ...item, blocks: headBlocks } : item
        )
        .concat({ index: newIndex, href: newHref, blocks: tailBlocks })
    )

    setSectionMeta((prev) => {
      const next = [...prev]
      const position = next.findIndex((item) => item.index === sectionIndex)
      const insertAt = position >= 0 ? position + 1 : next.length
      next.splice(insertAt, 0, { index: newIndex, href: newHref, title: newTitle })
      return next
    })

    setDisplayedSections((prev) => ({ ...prev, [newIndex]: true }))
    setSplitMarkers((prev) => [
      ...prev,
      {
        id: splitSectionKey(section.href, splitIndex),
        afterIndex: sectionIndex,
        originalIndex: sectionIndex,
        newIndex,
        newHref,
        newTitle,
        originalBlocks,
      },
    ])

    handleQueueSplitSection(
      section.href,
      splitIndex,
      newHref,
      newTitle,
      splitBlock?.blockId
    )
  }

  const handleUndoSplit = useCallback((id: string) => {
    const marker = splitMarkersRef.current.find((item) => item.id === id)
    if (!marker) {
      return
    }
    setSections((prev) =>
      prev
        .filter((item) => item.index !== marker.newIndex)
        .map((item) =>
          item.index === marker.originalIndex
            ? { ...item, blocks: marker.originalBlocks }
            : item
        )
    )
    setSectionMeta((prev) => prev.filter((item) => item.index !== marker.newIndex))
    setDisplayedSections((prev) => {
      const next = { ...prev }
      delete next[marker.newIndex]
      return next
    })
    setSplitMarkers((prev) => prev.filter((item) => item.id !== id))
    handleRemoveQueueItem(id)
  }, [handleRemoveQueueItem])

  const handleTogglePowerMode = useCallback(() => {
    togglePowerMode()
    dismissEditingBlock({ clearFocus: true })
  }, [togglePowerMode, dismissEditingBlock])

  const handleRequestFocusBlock = useCallback((sectionIndex: number, blockId: string) =>
    focusBlock({ sectionIndex, blockId })
  , [focusBlock])

  const handleRequestEditBlock = useCallback((sectionIndex: number, blockId: string) =>
    beginEditingBlock({ sectionIndex, blockId })
  , [beginEditingBlock])

  const handleRequestClickOutside = useCallback(() =>
    dismissEditingBlock({ clearFocus: true })
  , [dismissEditingBlock])

  const handleToggleCode = useCallback((id: string) =>
    setCodePanelBlockId((prev) => (prev === id ? null : id))
  , [])

  const handleUndoMerge = useCallback((fromHref: string, toHref: string) =>
    handleRemoveQueueItem(queueKey(fromHref, toHref))
  , [handleRemoveQueueItem])

  const handleDisplayHidden = useCallback((indices: number[]) =>
    setDisplayedSections((prev) => {
      const next = { ...prev }
      indices.forEach((index) => {
        next[index] = true
      })
      return next
    })
  , [])

  const handleCreateEndnote = useCallback(() => {
    const uid = crypto.randomUUID().slice(0, 4)
    const newEndnote: Endnote = { uid, text: '' }
    setEndnotes((prev) => [...prev, newEndnote])
    setEditingEndnoteUid(uid)
  }, [])

  const handleCommitEndnote = useCallback((uid: string, text: string) => {
    setEndnotes((prev) =>
      prev.map((en) => (en.uid === uid ? { ...en, text } : en))
    )
    setEditingEndnoteUid(null)
  }, [])

  const handleCancelEndnoteEdit = useCallback(() => {
    setEndnotes((prev) => {
      const editing = prev.find((en) => en.uid === editingEndnoteUid)
      if (editing && !editing.text) {
        return prev.filter((en) => en.uid !== editingEndnoteUid)
      }
      return prev
    })
    setEditingEndnoteUid(null)
  }, [editingEndnoteUid])

  const handleDeleteEndnote = useCallback((uid: string) => {
    setEndnotes((prev) => prev.filter((en) => en.uid !== uid))
    if (editingEndnoteUid === uid) {
      setEditingEndnoteUid(null)
    }
  }, [editingEndnoteUid])

  const header = (
    <TopBar
      isUploading={isUploading}
      onImport={handleLoadClick}
      onUndo={handleUndo}
      canUndo={!!selectedWorkingFile && !!editHistory.length}
      queueOpen={queueOpen}
      onToggleQueue={() => {
        setQueueOpen((prev) => !prev)
        setEndnotesOpen(false)
      }}
      endnotesOpen={endnotesOpen}
      onToggleEndnotes={() => {
        setEndnotesOpen((prev) => !prev)
        setQueueOpen(false)
      }}
      showDebug={showDebug}
      onToggleDebug={() => setShowDebug((prev) => !prev)}
      showComponents={showComponents}
      onToggleComponents={() => setShowComponents((prev) => !prev)}
      workingFiles={workingFiles}
      workingFileTitles={workingFileTitles}
      selectedWorkingFile={selectedWorkingFile}
      onWorkingFileSelect={handleWorkingFileSelect}
      viewerLanguage={viewerLanguage}
      onViewerLanguageChange={setViewerLanguage}
      onExecuteQueue={handleExecuteQueue}
      canExecute={!!(queueItems.length || endnotes.some((en) => en.text)) && !!selectedWorkingFile}
      queueCount={queueItems.length}
      onShowHistory={() => setHistoryOpen(true)}
      onShowProgressBox={() => {
        setForceProgressVisible(true)
        setProgressModalOpen(true)
      }}
      spellcheckEnabled={spellcheckEnabled}
      onToggleSpellcheck={() => setSpellcheckEnabled((prev) => !prev)}
      onShowDictionary={() => setDictionaryModalOpen(true)}
    />
  )

  const showHome = !book

  const leftSidebar = showHome ? null : (
    <SectionSidebar
      sections={sectionMeta.map((section) => ({
        index: section.index,
        href: section.href,
        title:
          section.title && section.title !== section.href
            ? section.title
            : section.href.replace(/\.x?html$/i, ''),
        loading: section.loading,
      }))}
      displayedSections={displayedSections}
      currentSectionIndex={currentSectionIndex}
      onToggle={handleToggleSection}
      onGoTo={handleGoToSection}
      onRename={handleRenameSection}
      loading={titlesLoading}
    />
  )
  const rightSidebar = endnotesOpen ? (
    <EndnotesSidebar
      endnotes={endnotes}
      editingEndnoteUid={editingEndnoteUid}
      onRequestEdit={setEditingEndnoteUid}
      onCommit={handleCommitEndnote}
      onCancel={handleCancelEndnoteEdit}
      onCreate={handleCreateEndnote}
      onDelete={handleDeleteEndnote}
    />
  ) : queueOpen ? (
    <QueueSidebar items={queueItems} onRemove={handleRemoveQueueItem} />
  ) : null

  const displayedOrder = useMemo(() =>
    sectionMeta
      .map((section) => section.index)
      .filter((index) => displayedSections[index])
  , [sectionMeta, displayedSections])

  const fullOrder = useMemo(() =>
    sectionMeta.map((section) => section.index)
  , [sectionMeta])

  const sectionTitles = useMemo(() =>
    sectionMeta.reduce<Record<number, { title: string; href: string }>>(
      (acc, section) => {
        acc[section.index] = {
          title:
            section.title && section.title !== section.href
              ? section.title
              : section.href.replace(/\.x?html$/i, ''),
          href: section.href,
        }
        return acc
      },
      {}
    )
  , [sectionMeta])

  const viewerSplitMarkers = useMemo(() =>
    splitMarkers.map((marker) => ({
      id: marker.id,
      afterIndex: marker.originalIndex,
      newTitle: marker.newTitle,
      newHref: marker.newHref,
    }))
  , [splitMarkers])

  return (
    <>
      <ProgressBox
        title={`Updating ${progressTotal} items in ${selectedWorkingFile || 'epub'}`}
        total={progressTotal}
        completed={progressCompleted}
        phase={progressPhase}
        visible={
          progressVisible ||
          forceProgressVisible ||
          progressModalOpen ||
          (showDebug && progressPhase !== 'idle')
        }
        showDebug={showDebug}
        onDismiss={() => {
          setProgressVisible(false)
          setForceProgressVisible(false)
          setProgressModalOpen(false)
          setProgressPhase('idle')
        }}
      />
      <AppLayout
        header={header}
        leftSidebar={leftSidebar}
        rightSidebar={rightSidebar}
        showComponents={showComponents}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".epub"
          onChange={handleFileChange}
          className="hidden"
        />
        {showHome ? (
          <Home onSelectBook={handleWorkingFileSelect} />
        ) : (
          <Viewer
            sections={sections}
            powerMode={powerMode}
            onTogglePowerMode={handleTogglePowerMode}
            focusedBlock={powerMode ? focusedBlock : null}
            editingBlock={editingBlock}
            onRequestFocusBlock={handleRequestFocusBlock}
            onRequestEditBlock={handleRequestEditBlock}
            onRequestCancelEdit={cancelEditingBlock}
            onRequestCommitEdit={commitEditingBlock}
            onRequestClickOutside={handleRequestClickOutside}
            sectionOrder={displayedOrder}
            fullOrder={fullOrder}
            splitMarkers={viewerSplitMarkers}
            sectionTitles={sectionTitles}
            isLoading={isLoading}
            isLoadingSection={isLoadingSection}
            nextSectionIndex={nextSectionIndex}
            showDebug={showDebug}
            codePanelBlockId={codePanelBlockId}
            onSelectAction={handleSelectAction}
            onChangeTag={handleChangeTag}
            onChangeJustify={handleChangeJustify}
            onRestoreBlock={handleRestore}
            onUndoAppend={handleUndoAppend}
            onToggleCode={handleToggleCode}
            onLoadNextSection={handleLoadNextSection}
            isMergeQueued={isQueued}
            onQueueMerge={handleQueueMerge}
            onUndoMerge={handleUndoMerge}
            onDisplayHidden={handleDisplayHidden}
            onUndoSplit={handleUndoSplit}
            onRenameSection={handleRenameSection}
            onSectionVisible={setCurrentSectionIndex}
            viewerLanguage={viewerLanguage}
            spellcheckEnabled={spellcheckEnabled}
            selectedSpellWord={selectedSpellWord}
            onSelectSpellWord={setSelectedSpellWord}
            onAddToDictionary={handleAddToDictionary}
          />
        )}
        <Modal
          open={dictionaryModalOpen}
          title={`Dictionary (${customDictionary.length} word${customDictionary.length === 1 ? '' : 's'})`}
          onClose={() => setDictionaryModalOpen(false)}
          widthClassName="max-w-lg"
        >
          {customDictionary.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">
              No words added yet. Click a highlighted word in the viewer to add
              it.
            </p>
          ) : (
            <ul className="mt-3 max-h-80 space-y-1 overflow-auto">
              {[...customDictionary]
                .sort((a, b) => a.localeCompare(b))
                .map((word) => (
                  <li
                    key={word}
                    className="flex items-center justify-between rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <span>{word}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromDictionary(word)}
                      className="text-xs text-slate-400 hover:text-red-500"
                    >
                      Remove
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </Modal>

        {historyOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
            <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700">
                File History
              </h2>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>
            <div className="max-h-80 overflow-auto px-4 py-3 text-sm text-slate-700">
              <p className="text-xs text-slate-500">
                {editHistory.length} edits
              </p>
              <ul className="mt-3 space-y-2">
                {editHistory.map((entry) => (
                  <li key={entry.id} className="rounded-md border px-3 py-2">
                    <div className="text-xs text-slate-600">
                      {new Date(entry.timestamp).toLocaleString()}
                    </div>
                  </li>
                ))}
                {!editHistory.length && (
                  <li className="rounded-md border border-dashed px-3 py-2 text-xs text-slate-400">
                    No edits recorded yet.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
    </>
  )
}
