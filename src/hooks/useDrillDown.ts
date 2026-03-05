import { useState, useCallback } from 'react'

export type DrillDownLevel = 'organization' | 'workspace' | 'project' | 'matrix'

interface BreadcrumbItem {
    id: string
    name: string
    level: DrillDownLevel
}

export function useDrillDown() {
    const [isOpen, setIsOpen] = useState(false)
    const [level, setLevel] = useState<DrillDownLevel>('organization')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [selectedName, setSelectedName] = useState<string | null>(null)
    const [selectedData, setSelectedData] = useState<any | null>(null)
    const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([])

    const openWorkspace = useCallback((id: string, name: string) => {
        setSelectedId(id)
        setSelectedName(name)
        setSelectedData(null)
        setLevel('workspace')
        setBreadcrumb([{ id: 'org', name: 'Organization', level: 'organization' }, { id, name, level: 'workspace' }])
        setIsOpen(true)
    }, [])

    const openProject = useCallback((id: string, name: string, workspaceContext?: { id: string, name: string }) => {
        setSelectedId(id)
        setSelectedName(name)
        setSelectedData(null)
        setLevel('project')

        const newBreadcrumb: BreadcrumbItem[] = [{ id: 'org', name: 'Organization', level: 'organization' }]
        if (workspaceContext) {
            newBreadcrumb.push({ ...workspaceContext, level: 'workspace' })
        }
        newBreadcrumb.push({ id, name, level: 'project' })

        setBreadcrumb(newBreadcrumb)
        setIsOpen(true)
    }, [])

    const openMatrixQuadrant = useCallback((id: string, name: string, items: any[]) => {
        setSelectedId(id)
        setSelectedName(name)
        setSelectedData(items)
        setLevel('matrix')
        setBreadcrumb([{ id: 'org', name: 'Organization', level: 'organization' }, { id, name, level: 'matrix' }])
        setIsOpen(true)
    }, [])

    const navigateTo = useCallback((item: BreadcrumbItem) => {
        if (item.level === 'organization') {
            setIsOpen(false)
            return
        }

        setLevel(item.level)
        setSelectedId(item.id)
        setSelectedName(item.name)
        if (item.level !== 'matrix') {
            setSelectedData(null)
        }

        const index = breadcrumb.findIndex(b => b.id === item.id)
        if (index !== -1) {
            setBreadcrumb(breadcrumb.slice(0, index + 1))
        }
    }, [breadcrumb])

    const close = useCallback(() => {
        setIsOpen(false)
        setSelectedId(null)
        setSelectedName(null)
        setSelectedData(null)
        setBreadcrumb([])
    }, [])

    return {
        isOpen,
        level,
        selectedId,
        selectedName,
        selectedData,
        breadcrumb,
        openWorkspace,
        openProject,
        openMatrixQuadrant,
        navigateTo,
        close
    }
}
