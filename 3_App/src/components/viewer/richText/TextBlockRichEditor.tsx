import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Subscript from '@tiptap/extension-subscript'
import Superscript from '@tiptap/extension-superscript'
import { Button } from 'counterfoil-starter-kit'
import InlineFormatToolbar from './InlineFormatToolbar'
import sanitizeInlineHtml from './sanitizeInlineHtml'

type TextBlockRichEditorProps = {
  initialHtml: string
  typographyClass: string
  onCommit: (html: string) => void
  onCancel: () => void
}

export default function TextBlockRichEditor({
  initialHtml,
  typographyClass,
  onCommit,
  onCancel,
}: TextBlockRichEditorProps) {
  const onCommitRef = useRef(onCommit)
  onCommitRef.current = onCommit
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  const [hasChanged, setHasChanged] = useState(false)
  const initialRef = useRef(initialHtml)

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
    content: initialHtml,
    autofocus: 'end',
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
            onCommitRef.current(sanitized)
          }
          return true
        }
        return false
      },
      attributes: {
        class: `textblock-edit-textarea w-full rounded resize-none overflow-hidden border border-input-border bg-input-bg px-3 py-2 font-contentTypeface text-slate-900 placeholder:text-input-placeholder focus:outline-none focus-visible:ring-2 focus-visible:ring-input focus-visible:ring-offset-2 ${typographyClass}`,
        style: 'min-height: 1.5em',
      },
    },
  })

  const handleSave = useCallback(() => {
    if (!editor) return
    const html = sanitizeInlineHtml(editor.getHTML())
    onCommitRef.current(html)
  }, [editor])

  const handleCancel = useCallback(() => {
    onCancelRef.current()
  }, [])

  useEffect(() => {
    return () => {
      editor?.destroy()
    }
  }, [editor])

  return (
    <div onClick={(e) => e.stopPropagation()}>
      {editor && <InlineFormatToolbar editor={editor} />}
      <EditorContent editor={editor} />
      {hasChanged && (
        <div className="mt-2 flex gap-2">
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
          <Button variant="secondary" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
