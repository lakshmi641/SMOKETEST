'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { PageService } from '@/lib/services'
import { Monitor, Tablet, Smartphone, Undo, Redo, Save, Loader2, Languages } from 'lucide-react'
import { toast } from 'react-hot-toast'
import type { WebsitePage } from '@/types/website-schema'

interface BlockEditorProps {
  pageId: string
  websiteId: string
  companyId: string
  groupId: string
  supportedLanguages?: string[]
}

export function BlockEditor({ pageId, websiteId, companyId, groupId, supportedLanguages = ['en'] }: BlockEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const gjsRef = useRef<any>(null)
  const [page, setPage] = useState<WebsitePage | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeLang, setActiveLang] = useState<string>('en')
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const showLangToggle = supportedLanguages.length > 1 && supportedLanguages.includes('hi')

  // Load page data
  useEffect(() => {
    PageService.getPage(groupId, companyId, websiteId, pageId)
      .then(setPage)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [groupId, companyId, websiteId, pageId])

  // Save handler — saves to English content or localized content based on active language
  const saveContent = useCallback(async () => {
    if (!gjsRef.current || saving) return
    setSaving(true)
    try {
      const editor = gjsRef.current
      const html = editor.getHtml()
      const css = editor.getCss()
      const components = JSON.parse(JSON.stringify(editor.getComponents()))
      const content = { html, css, components }

      if (activeLang === 'en') {
        await PageService.updatePageContent(groupId, companyId, websiteId, pageId, content)
      } else {
        await PageService.updateLocalizedContent(groupId, companyId, websiteId, pageId, activeLang, content)
      }
      toast.success(`Saved (${activeLang.toUpperCase()})`, { duration: 1500 })
    } catch (error) {
      console.error('Save failed:', error)
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }, [groupId, companyId, websiteId, pageId, saving, activeLang])

  // Switch language — save current, load target
  const switchLanguage = useCallback(async (targetLang: string) => {
    if (!gjsRef.current || !page || targetLang === activeLang) return
    // Save current language content first
    await saveContent()
    // Load target language content into the editor
    const editor = gjsRef.current
    if (targetLang === 'en') {
      editor.setComponents(page.content.html || '')
      editor.setStyle(page.content.css || '')
    } else {
      const localized = page.localizedContent?.[targetLang]
      editor.setComponents(localized?.html || '')
      editor.setStyle(localized?.css || '')
    }
    setActiveLang(targetLang)
    // Reload page data to keep state fresh
    PageService.getPage(groupId, companyId, websiteId, pageId).then((p) => {
      if (p) setPage(p)
    })
  }, [gjsRef, page, activeLang, saveContent, groupId, companyId, websiteId, pageId])

  // Auto-save with debounce
  const scheduleAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveContent()
    }, 30000) // 30 second debounce
  }, [saveContent])

  // Initialize GrapesJS
  useEffect(() => {
    if (!editorRef.current || !page || gjsRef.current) return

    let mounted = true

    const initEditor = async () => {
      const grapesjs = (await import('grapesjs')).default
      // @ts-expect-error -- CSS module import, no type declarations needed
      await import('grapesjs/dist/css/grapes.min.css')
      const julleyBlocksPlugin = (await import('./blocks/julley-blocks-plugin')).default

      if (!mounted || !editorRef.current) return

      const editor = grapesjs.init({
        container: editorRef.current,
        height: '100%',
        width: 'auto',
        fromElement: false,
        storageManager: false, // We handle storage ourselves
        plugins: [julleyBlocksPlugin],
        canvas: {
          styles: [
            'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap',
          ],
        },
        deviceManager: {
          devices: [
            { name: 'Desktop', width: '' },
            { name: 'Tablet', width: '768px' },
            { name: 'Mobile', width: '375px' },
          ],
        },
      })

      // Load existing content
      if (page.content.html) {
        editor.setComponents(page.content.html)
      }
      if (page.content.css) {
        editor.setStyle(page.content.css)
      }

      // Listen for changes → schedule auto-save
      editor.on('component:update', scheduleAutoSave)
      editor.on('style:change', scheduleAutoSave)

      gjsRef.current = editor
    }

    initEditor()

    return () => {
      mounted = false
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (gjsRef.current) {
        gjsRef.current.destroy()
        gjsRef.current = null
      }
    }
  }, [page, scheduleAutoSave])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!page) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <p className="text-gray-500">Page not found</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-900">{page.title}</h2>
          <span className="text-xs text-gray-400">/{page.slug}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Viewport Toggle */}
          <button
            onClick={() => gjsRef.current?.setDevice('Desktop')}
            className="p-2 hover:bg-gray-100 rounded"
            title="Desktop"
          >
            <Monitor className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={() => gjsRef.current?.setDevice('Tablet')}
            className="p-2 hover:bg-gray-100 rounded"
            title="Tablet (768px)"
          >
            <Tablet className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={() => gjsRef.current?.setDevice('Mobile')}
            className="p-2 hover:bg-gray-100 rounded"
            title="Mobile"
          >
            <Smartphone className="h-4 w-4 text-gray-600" />
          </button>

          {/* Language Toggle */}
          {showLangToggle && (
            <>
              <div className="w-px h-6 bg-gray-200 mx-1" />
              <div className="inline-flex items-center rounded border border-gray-200 overflow-hidden">
                <button
                  onClick={() => switchLanguage('en')}
                  className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
                    activeLang === 'en'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                  title="English"
                >
                  EN
                </button>
                <button
                  onClick={() => switchLanguage('hi')}
                  className={`px-2.5 py-1 text-xs font-semibold transition-colors ${
                    activeLang === 'hi'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                  title="Hindi"
                >
                  HI
                </button>
              </div>
            </>
          )}

          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* Undo/Redo */}
          <button
            onClick={() => gjsRef.current?.UndoManager.undo()}
            className="p-2 hover:bg-gray-100 rounded"
            title="Undo"
          >
            <Undo className="h-4 w-4 text-gray-600" />
          </button>
          <button
            onClick={() => gjsRef.current?.UndoManager.redo()}
            className="p-2 hover:bg-gray-100 rounded"
            title="Redo"
          >
            <Redo className="h-4 w-4 text-gray-600" />
          </button>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* Save */}
          <button
            onClick={saveContent}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Editor Container */}
      <div ref={editorRef} className="flex-1" />
    </div>
  )
}
