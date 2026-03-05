'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import type { User } from '@/types'
import dynamic from 'next/dynamic'
import { EmojiStyle } from 'emoji-picker-react'
import {
  Send,
  Loader2,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough as StrikethroughIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  Code,
  AtSign,
  Smile,
  Image as ImageIcon,
  X as XIcon
} from 'lucide-react'
import { uploadCommentImage } from '@/lib/services/storage/comment-image-service'
import type { CommentAttachment } from '@/types/task-comment'

// Dynamic import for emoji picker (client-side only)
const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false })

interface CommentFormProps {
  allUsers: User[]
  onSubmit: (
    text: string,
    plainText: string,
    mentions: string[],
    attachments: CommentAttachment[]
  ) => Promise<void>
  submitting: boolean
  initialValue?: string
  onCancel?: () => void
  taskId?: string // For draft persistence
  initialAttachments?: CommentAttachment[]
}

// Quick comment templates (Jira-style)
const QUICK_TEMPLATES = [
  { icon: '🎉', text: 'Looks good!' },
  { icon: '👋', text: 'Need help?' },
  { icon: '🚫', text: 'This is blocked...' },
  { icon: '🔍', text: 'Can you clarify...?' },
  { icon: '✅', text: 'This is on track' }
]

// Helper functions for avatars
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function getAvatarColor(id: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-red-500',
    'bg-orange-500',
    'bg-teal-500'
  ]
  const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
  return (colors[index] || colors[0]) as string
}

export function CommentForm({
  allUsers,
  onSubmit,
  submitting,
  initialValue,
  onCancel,
  taskId,
  initialAttachments
}: CommentFormProps) {
  const [mentions, setMentions] = useState<string[]>([])
  const [showTemplates, setShowTemplates] = useState(!initialValue)
  const [, forceUpdate] = useState({})
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [pendingImages, setPendingImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [existingAttachments, setExistingAttachments] = useState<CommentAttachment[]>(
    initialAttachments ?? []
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Draft key for localStorage
  const draftKey = taskId ? `comment-draft-${taskId}` : null

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline hover:text-blue-800'
        }
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'mention-tag inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full text-sm border border-blue-200'
        },
        renderHTML({ options, node }) {
          const userId = node.attrs.id
          const user = allUsers.find(u => u.id === userId)
          const avatar = user?.avatar
          const name = user?.name || node.attrs.label

          if (avatar) {
            return [
              'span',
              options.HTMLAttributes,
              [
                'img',
                {
                  src: avatar,
                  alt: name,
                  class: 'inline-block h-4 w-4 rounded-full object-cover'
                }
              ],
              ['span', {}, `@${name}`]
            ]
          } else {
            const initials = getInitials(name || 'Unknown')
            const bgColor = getAvatarColor(userId || 'unknown')
            return [
              'span',
              options.HTMLAttributes,
              [
                'span',
                {
                  class: `inline-flex items-center justify-center h-4 w-4 rounded-full ${bgColor} text-white text-xs font-medium`
                },
                initials
              ],
              ['span', {}, `@${name}`]
            ]
          }
        },
        suggestion: {
          items: ({ query }) => {
            return allUsers
              .filter(user => {
                const searchTerm = query.toLowerCase()
                const name = user.name?.toLowerCase() || ''
                const email = user.email.toLowerCase()
                return name.includes(searchTerm) || email.includes(searchTerm)
              })
              .slice(0, 10)
              .map(user => ({
                id: user.id,
                label: user.name || user.email,
                email: user.email,
                name: user.name || user.email,
                avatar: user.avatar || null
              }))
          },
          render: () => {
            let component: HTMLElement | null = null
            let popupProps: any = null
            let selectedIndex = 0

            const updateSelection = (index: number) => {
              if (!component) return
              const items = component.querySelectorAll('.mention-item')
              items.forEach((item, i) => {
                if (i === index) {
                  item.classList.add('bg-blue-50', 'ring-1', 'ring-blue-200')
                } else {
                  item.classList.remove('bg-blue-50', 'ring-1', 'ring-blue-200')
                }
              })
              const selectedEl = items[index] as HTMLElement
              if (selectedEl) {
                selectedEl.scrollIntoView({ block: 'nearest' })
              }
            }

            const renderContent = () => {
              if (!component || !popupProps) return
              const { items } = popupProps

              if (items.length === 0) {
                component.innerHTML = '<div class="px-4 py-3 text-sm text-gray-500">No users found</div>'
                return
              }

              component.innerHTML = items.map((item: any, index: number) => {
                const initials = getInitials(item.name)
                const bgColor = getAvatarColor(item.id)
                const avatarHtml = item.avatar
                  ? `<img src="${item.avatar}" alt="${item.name}" class="h-8 w-8 rounded-full object-cover shrink-0" />`
                  : `<div class="${bgColor} h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0">${initials}</div>`

                return `<div class="mention-item px-3 py-2 cursor-pointer transition-colors flex items-center gap-3" data-index="${index}" style="user-select: none;">
                    ${avatarHtml}
                    <div class="flex-1 min-w-0 pointer-events-none">
                      <div class="text-sm font-semibold text-gray-900 truncate">${item.name}</div>
                      <div class="text-xs text-gray-500 truncate">${item.email}</div>
                    </div>
                  </div>`
              }).join('')

              component.querySelectorAll('.mention-item').forEach((el: any, index: number) => {
                el.addEventListener('mouseenter', () => {
                  selectedIndex = index
                  updateSelection(index)
                })
              })

              updateSelection(selectedIndex)
            }

            return {
              onStart: props => {
                popupProps = props
                selectedIndex = 0

                component = document.createElement('div')
                component.className = 'mention-suggestions absolute bg-white border border-gray-200 rounded-lg shadow-2xl max-h-80 overflow-y-auto z-[9999] min-w-[240px] py-1'

                // Use mousedown with preventDefault to keep editor focus
                component.addEventListener('mousedown', (e: MouseEvent) => {
                  const itemEl = (e.target as HTMLElement).closest('.mention-item')
                  if (itemEl && popupProps) {
                    e.preventDefault()
                    e.stopPropagation()
                    const index = parseInt(itemEl.getAttribute('data-index') || '0')
                    popupProps.command(popupProps.items[index])
                  }
                })

                if (containerRef.current) {
                  containerRef.current.appendChild(component)
                }

                const updatePosition = () => {
                  if (!component || !containerRef.current) return
                  const clientRect = props.clientRect?.()
                  if (clientRect) {
                    const containerRect = containerRef.current.getBoundingClientRect()
                    component.style.top = `${clientRect.top - containerRect.top + 24}px`
                    component.style.left = `${clientRect.left - containerRect.left}px`
                  }
                }

                updatePosition()
                renderContent()
              },

              onUpdate: props => {
                popupProps = props
                if (selectedIndex >= props.items.length) {
                  selectedIndex = 0
                }

                if (component && containerRef.current) {
                  const clientRect = props.clientRect?.()
                  if (clientRect) {
                    const containerRect = containerRef.current.getBoundingClientRect()
                    component.style.top = `${clientRect.top - containerRect.top + 24}px`
                    component.style.left = `${clientRect.left - containerRect.left}px`
                  }
                  renderContent()
                }
              },

              onKeyDown: props => {
                if (props.event.key === 'Escape') {
                  return true
                }
                if (props.event.key === 'ArrowUp') {
                  selectedIndex = (selectedIndex + popupProps.items.length - 1) % popupProps.items.length
                  updateSelection(selectedIndex)
                  return true
                }
                if (props.event.key === 'ArrowDown') {
                  selectedIndex = (selectedIndex + 1) % popupProps.items.length
                  updateSelection(selectedIndex)
                  return true
                }
                if (props.event.key === 'Enter' || props.event.key === 'Tab') {
                  if (popupProps.items.length > 0) {
                    popupProps.command(popupProps.items[selectedIndex])
                    return true
                  }
                }
                return false
              },

              onExit: () => {
                // Small delay to allow mousedown handlers to finish before removal
                setTimeout(() => {
                  if (component) {
                    component.remove()
                    component = null
                  }
                }, 10)
              }
            }
          }
        }
      })
    ],
    content: initialValue || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[80px] px-3 py-2 text-sm',
        style: 'list-style-position: inside;'
      }
    },
    onUpdate: ({ editor }) => {
      const mentionedUsers: string[] = []
      editor.state.doc.descendants(node => {
        if (node.type.name === 'mention') {
          mentionedUsers.push(node.attrs.id)
        }
      })
      setMentions(mentionedUsers)

      // Save draft to localStorage
      if (draftKey && !initialValue) {
        const content = editor.getHTML()
        if (content && content !== '<p></p>') {
          localStorage.setItem(draftKey, content)
        } else {
          localStorage.removeItem(draftKey)
        }
      }

      // Force React to re-render to update button states
      forceUpdate({})
    },
    onSelectionUpdate: () => {
      // Force re-render when selection changes (for toggle button states)
      forceUpdate({})
    }
  })

  // Load draft from localStorage on mount
  useEffect(() => {
    if (editor && draftKey && !initialValue) {
      const draft = localStorage.getItem(draftKey)
      if (draft && draft !== '<p></p>') {
        editor.commands.setContent(draft)
      }
    }
  }, [editor, draftKey, initialValue])

  function insertTemplate(text: string) {
    if (!editor) return
    // Use insertContent instead of setContent to preserve emojis
    editor.chain().focus().setContent(`<p>${text}</p>`).run()
    setShowTemplates(false)
  }

  function insertEmoji(emoji: any) {
    if (!editor) return
    editor.chain().focus().insertContent(emoji.emoji).run()
    setShowEmojiPicker(false)
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const validFiles = files.filter(f => f.type.startsWith('image/'))
    if (validFiles.length === 0) return

    setPendingImages(prev => [...prev, ...validFiles])

    // Generate object URLs for local preview
    const previews = validFiles.map(f => URL.createObjectURL(f))
    setImagePreviews(prev => [...prev, ...previews])

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removePendingImage(index: number) {
    URL.revokeObjectURL(imagePreviews[index] ?? '')
    setPendingImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  function removeExistingAttachment(index: number) {
    setExistingAttachments(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit() {
    if (!editor) return

    const html = editor.getHTML()
    const plainText = editor.getText()

    // Guard: require text (mandatory)
    if (!plainText.trim()) return

    try {
      setUploadingImages(true)

      // Upload all pending images first
      let newlyUploaded: CommentAttachment[] = []
      if (pendingImages.length > 0 && taskId) {
        newlyUploaded = await Promise.all(
          pendingImages.map(file => uploadCommentImage(taskId, file))
        )
      }

      await onSubmit(html, plainText, mentions, [...existingAttachments, ...newlyUploaded])

      // Clear draft from localStorage
      if (draftKey) {
        localStorage.removeItem(draftKey)
      }

      editor.commands.clearContent()
      setMentions([])
      setShowTemplates(true)

      // Free object URLs
      imagePreviews.forEach(url => URL.revokeObjectURL(url))
      setPendingImages([])
      setImagePreviews([])
    } catch (error) {
      console.error('Error submitting comment with images:', error)
      // Note: error handling should ideally be bubbled up to show a toast
    } finally {
      setUploadingImages(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (!editor) return null

  return (
    <div ref={containerRef} className="border rounded-md bg-white relative">
      {/* Compact Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1 bg-gray-50 border-b flex-wrap rounded-t-md">
        {/* Text Formatting */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1 rounded hover:bg-gray-200 transition-colors ${editor.isActive('bold') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'
            }`}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1 rounded hover:bg-gray-200 transition-colors ${editor.isActive('italic') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'
            }`}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1 rounded hover:bg-gray-200 transition-colors ${editor.isActive('underline') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'
            }`}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1 rounded hover:bg-gray-200 transition-colors ${editor.isActive('strike') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'
            }`}
          title="Strikethrough"
        >
          <StrikethroughIcon className="h-3.5 w-3.5" />
        </button>

        {/* Separator */}
        <div className="w-px h-4 bg-gray-300 mx-0.5" />

        {/* Lists */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1 rounded hover:bg-gray-200 transition-colors ${editor.isActive('bulletList') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'
            }`}
          title="Bullet List"
        >
          <List className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1 rounded hover:bg-gray-200 transition-colors ${editor.isActive('orderedList') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'
            }`}
          title="Numbered List"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>

        {/* Separator */}
        <div className="w-px h-4 bg-gray-300 mx-0.5" />

        {/* Code Block */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={`p-1 rounded hover:bg-gray-200 transition-colors ${editor.isActive('codeBlock') ? 'bg-gray-200 text-blue-600' : 'text-gray-600'
            }`}
          title="Code Block"
        >
          <Code className="h-3.5 w-3.5" />
        </button>

        {/* Link - Disabled for now (to be improved later) */}
        {/* <button
          type="button"
          onClick={() => {
            const url = window.prompt('Enter URL:')
            if (url) {
              editor.chain().focus().setLink({ href: url }).run()
            }
          }}
          className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${
            editor.isActive('link') ? 'bg-gray-200 text-blue-600' : 'text-gray-700'
          }`}
          title="Add Link"
        >
          <LinkIcon className="h-4 w-4" />
        </button> */}

        {/* Separator */}
        <div className="w-px h-4 bg-gray-300 mx-0.5" />

        {/* Mention */}
        <button
          type="button"
          onClick={() => {
            editor.chain().focus().insertContent('@').run()
          }}
          className="p-1 rounded hover:bg-gray-200 transition-colors text-gray-600"
          title="Mention someone (@)"
        >
          <AtSign className="h-3.5 w-3.5" />
        </button>

        {/* Emoji Picker */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`p-1 rounded hover:bg-gray-200 transition-colors ${showEmojiPicker ? 'bg-gray-200 text-blue-600' : 'text-gray-600'
              }`}
            title="Insert emoji"
          >
            <Smile className="h-3.5 w-3.5" />
          </button>

          {showEmojiPicker && (
            <>
              {/* Backdrop to close picker when clicking outside */}
              <div
                className="fixed inset-0 z-[9998]"
                onClick={() => setShowEmojiPicker(false)}
              />
              <div className="absolute bottom-full left-0 mb-2 z-[9999] shadow-2xl rounded-lg border border-gray-200 origin-bottom-left transform scale-[0.85]">
                <EmojiPicker
                  onEmojiClick={insertEmoji}
                  width={320}
                  height={280}
                  previewConfig={{ showPreview: false }}
                  searchDisabled={false}
                  skinTonesDisabled
                  lazyLoadEmojis={true}
                  emojiStyle={EmojiStyle.NATIVE}
                />
                <style jsx global>{`
                  .EmojiPickerReact .epr-search-container {
                    padding: 4px 8px !important;
                    margin-bottom: 0 !important;
                  }
                  .EmojiPickerReact .epr-search-container input {
                    height: 28px !important;
                    font-size: 12px !important;
                    padding: 0 8px !important;
                  }
                  .EmojiPickerReact .epr-category-nav {
                    padding: 0 4px !important;
                    height: 30px !important;
                  }
                  .EmojiPickerReact .epr-category-nav > button {
                    height: 24px !important;
                    width: 24px !important;
                    padding: 2px !important;
                  }
                  .EmojiPickerReact .epr-header-overlay {
                    padding: 4px !important;
                  }
                `}</style>
              </div>
            </>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-4 bg-gray-300 mx-0.5" />

        {/* Image Attach */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-1 rounded hover:bg-gray-200 transition-colors text-gray-600"
          title="Attach image"
        >
          <ImageIcon className="h-3.5 w-3.5" />
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageSelect}
        />
      </div>

      {/* Quick Comment Templates (Compact) */}
      {showTemplates && !initialValue && (
        <div className="px-3 py-2 border-b bg-gray-50/50">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TEMPLATES.map((template, index) => (
              <button
                key={index}
                type="button"
                onClick={() => insertTemplate(template.text)}
                className="px-2 py-1 text-xs border border-gray-200 rounded hover:bg-white hover:border-gray-300 transition-colors flex items-center gap-1"
              >
                <span className="text-sm">{template.icon}</span>
                <span className="text-gray-600">{template.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editor Content */}
      <div
        onKeyDown={handleKeyDown}
        onFocus={() => setShowTemplates(false)}
        className="comment-editor"
      >
        <EditorContent editor={editor} />
        <style jsx global>{`
          .comment-editor .ProseMirror ul,
          .comment-editor .ProseMirror ol {
            padding-left: 1.5rem;
            margin: 0.5rem 0;
          }
          .comment-editor .ProseMirror ul {
            list-style-type: disc;
          }
          .comment-editor .ProseMirror ol {
            list-style-type: decimal;
          }
          .comment-editor .ProseMirror li {
            margin: 0.25rem 0;
          }
          .comment-editor .ProseMirror p {
            margin: 0.25rem 0;
          }
          .comment-editor .ProseMirror code {
            background-color: #f3f4f6;
            padding: 0.125rem 0.25rem;
            border-radius: 0.25rem;
            font-size: 0.875em;
          }
          .comment-editor .ProseMirror pre {
            background-color: #1f2937;
            color: #f9fafb;
            padding: 0.75rem;
            border-radius: 0.375rem;
            overflow-x: auto;
            margin: 0.5rem 0;
          }
          .comment-editor .ProseMirror pre code {
            background-color: transparent;
            padding: 0;
            color: inherit;
          }
        `}</style>
      </div>

      {/* Existing Attachments Previews (Edit Mode) */}
      {existingAttachments.length > 0 && (
        <div className="px-3 py-2 border-t flex flex-wrap gap-2 bg-gray-50/30">
          {existingAttachments.map((att, i) => (
            <div key={i} className="relative group">
              <img
                src={att.url}
                alt={att.name}
                className="h-16 w-16 object-cover rounded border border-gray-200"
              />
              <button
                type="button"
                onClick={() => removeExistingAttachment(i)}
                className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <XIcon className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pending Image Previews */}
      {imagePreviews.length > 0 && (
        <div className="px-3 py-2 border-t flex flex-wrap gap-2">
          {imagePreviews.map((src, i) => (
            <div key={i} className="relative group">
              <img
                src={src}
                alt={`attachment-${i}`}
                className="h-16 w-16 object-cover rounded border border-blue-200"
              />
              <button
                type="button"
                onClick={() => removePendingImage(i)}
                className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <XIcon className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-t rounded-b-md">
        <div className="text-xs text-gray-400">
          @ to mention • Ctrl+Enter to post
        </div>

        <div className="flex gap-1.5">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-2.5 py-1 text-xs text-gray-600 hover:text-gray-800 disabled:opacity-50 font-medium"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || uploadingImages || !editor?.getText().trim()}
            className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 font-medium"
          >
            {uploadingImages ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Uploading...
              </>
            ) : submitting ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Posting...
              </>
            ) : (
              'Post'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
