import type { Editor } from '@tiptap/react'
import { Bold, Italic, Subscript, Superscript } from 'lucide-react'
import { Button } from 'counterfoil-starter-kit'
import Tooltip from '../../Tooltip'

type InlineFormatToolbarProps = {
  editor: Editor
}

export default function InlineFormatToolbar({ editor }: InlineFormatToolbarProps) {
  return (
    <div
      className="mb-1 flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <Tooltip label="Bold (⌘B)">
        <Button
          variant="tertiary"
          size="sm"
          icon={<Bold size={16} />}
          aria-label="Bold"
          aria-pressed={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
      </Tooltip>

      <Tooltip label="Italic (⌘I)">
        <Button
          variant="tertiary"
          size="sm"
          icon={<Italic size={16} />}
          aria-label="Italic"
          aria-pressed={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
      </Tooltip>

      <Tooltip label="Superscript">
        <Button
          variant="tertiary"
          size="sm"
          icon={<Superscript size={16} />}
          aria-label="Superscript"
          aria-pressed={editor.isActive('superscript')}
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
        />
      </Tooltip>

      <Tooltip label="Subscript">
        <Button
          variant="tertiary"
          size="sm"
          icon={<Subscript size={16} />}
          aria-label="Subscript"
          aria-pressed={editor.isActive('subscript')}
          onClick={() => editor.chain().focus().toggleSubscript().run()}
        />
      </Tooltip>
    </div>
  )
}
