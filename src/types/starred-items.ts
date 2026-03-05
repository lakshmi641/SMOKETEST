export interface StarredItem {
    id: string
    userId: string
    entityType: 'task' | 'project' | 'workspace'
    entityId: string
    starredAt: string
    createdAt: string
    updatedAt: string
}

export interface StarredItemsMap {
    tasks: Set<string>
    projects: Set<string>
    workspaces: Set<string>
}
