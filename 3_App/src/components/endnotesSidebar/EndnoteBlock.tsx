import { useState, useRef, useCallback, useEffect, type MouseEvent as ReactMouseEvent } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Copy } from 'lucide-react'
import { Button } from 'counterfoil-starter-kit'
import Tooltip from '../Tooltip'
import InlineFormatToolbar from '../viewer/richText/InlineFormatToolbar'
import sanitizeInlineHtml from '../viewer/richText/sanitizeInlineHtml'
import type { Endnote } from '../../types/reader'

type EndnoteBlockProps = {
  endnote: Endnote
  displayNumber: number
  isEditing: boolean
  onRequestEdit: (uid: string) => void
  onCommit: (uid: string, text: string) => void
  onCancel: () => void
  onDelete: (uid: string) => void
}

export default function EndnoteBlock({
  endnote,
  displayNumber,
  isEditing,
  onRequestEdit,
  onCommit,
  onCancel,
  onDelete,
}: EndnoteBlockProps) {
  const [hasChanged, setHasChanged] = useState(false)
  const initialRef = useRef(endnote.text)
  const onCommitRef = useRef(onCommit)
  onCommitRef.current = onCommit
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      Superscript,
      Subscript,
    ],
    content: endnote.text,
    autofocus: 'end',
    editable: isEditing,
    onUpdate({ editor: e }) {
      setHasChanged(e.getHTML() !== initialRef.current)
    },
    editorProps: {
      handleKeyDown(_view, event) {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onCancelRef.current()
          return true
        }
        if (event.key === 'Enter' && event.metaKey) {
          event.preventDefault()
          const html = editor?.getHTML() ?? ''
          const sanitized = sanitizeInlineHtml(html)
          if (sanitized !== initialRef.current) {
            onCommitRef.current(endnote.uid, sanitized)
          } else {
            onCancelRef.current()
          }
          return true
        }
        return false
      },
      attributes: {
        class:
          'w-full rounded resize-none overflow-hidden border border-input-border bg-input-bg px-2 py-1.5 font-contentTypeface text-sm text-slate-900 placeholder:text-input-placeholder focus:outline-none focus-visible:ring-2 focus-visible:ring-input focus-visible:ring-offset-2',
        style: 'min-height: 1.5em',
      },
    },
  })

  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing)
      if (isEditing) {
        initialRef.current = endnote.text
        editor.commands.setContent(endnote.text)
        setHasChanged(false)
        editor.commands.focus('end')
      }
    }
  }, [isEditing, editor, endnote.text])

  useEffect(() => {
    return () => {
      editor?.destroy()
    }
  }, [editor])

  const handleSave = useCallback(() => {
    if (!editor) return
    const html = sanitizeInlineHtml(editor.getHTML())
    onCommitRef.current(endnote.uid, html)
  }, [editor, endnote.uid])

  const handleCancel = useCallback(() => {
    onCancelRef.current()
  }, [])

  const [copied, setCopied] = useState(false)
  const handleCopyAnchor = useCallback((e: ReactMouseEvent) => {
    e.stopPropagation()
    const anchor = `<a>placeholder-${endnote.uid}</a>`
    navigator.clipboard.writeText(anchor)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [endnote.uid])

  if (isEditing) {
    return (
      <div
        className="rounded-md border border-slate-200 bg-white p-2"
        onClick={(e) => e.stopPropagation()}
        data-component="EndnoteBlock"
      >
        <div className="mb-1 flex items-center gap-1.5">
          <span className="text-xs font-mono text-slate-400">placeholder-{endnote.uid}</span>
        </div>
        {editor && <InlineFormatToolbar editor={editor} />}
        <EditorContent editor={editor} />
        <div className="mt-2 flex gap-2">
          <Button variant="primary" size="sm" onClick={handleSave} disabled={!hasChanged}>
            Save
          </Button>
          <Button variant="secondary" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <div className="flex-1" />
          <Button variant="tertiary" size="sm" onClick={() => onDelete(endnote.uid)}>
            Delete
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="group cursor-pointer rounded-md px-2 py-1.5 hover:bg-bg-secondary-hover transition"
      onClick={() => onRequestEdit(endnote.uid)}
      data-component="EndnoteBlock"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-mono text-slate-400">
          placeholder-{endnote.uid}
        </span>
        <Tooltip label={copied ? 'Copied!' : 'Copy anchor'}>
          <Button
            variant="tertiary"
            size="sm"
            icon={<Copy size={12} />}
            aria-label="Copy anchor"
            onClick={handleCopyAnchor}
          />
        </Tooltip>
      </div>
      <p
        className="text-sm text-slate-700 font-contentTypeface"
        dangerouslySetInnerHTML={{ __html: endnote.text || '<em>Empty endnote</em>' }}
      />
    </div>
  )
}
