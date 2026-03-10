import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { useCallback, useEffect } from 'react'
import './RichTextEditor.css'

function RichTextEditor({ value, onChange, placeholder = 'Escribe aquí...' }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'rich-text-editor',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (editor && value !== undefined && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', false)
    }
  }, [value, editor])

  const format = useCallback(
    (cmd) => {
      editor?.chain().focus()[cmd]().run()
    },
    [editor]
  )

  if (!editor) return null

  return (
    <div className="rich-text-wrapper">
      <div className="rich-text-toolbar">
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => format('toggleBold')}
          title="Negrita"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => format('toggleItalic')}
          title="Cursiva"
        >
          <em>I</em>
        </button>
        <span className="toolbar-sep" />
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => format('toggleBulletList')}
          title="Lista con guiones"
        >
          •
        </button>
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => format('toggleOrderedList')}
          title="Lista numerada"
        >
          1.
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

export default RichTextEditor
