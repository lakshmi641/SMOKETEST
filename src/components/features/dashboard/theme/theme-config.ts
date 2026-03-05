export type DashboardTheme = 'modern' | 'compact' | 'clean' | 'contrast'

export interface ThemeConfig {
  container: string
  card: string
  header: string
  metric: string
  progress: string
  table: string
  badge: string
}

export const THEME_STYLES: Record<DashboardTheme, ThemeConfig> = {
  // Native System Style - Matches Project Overview
  modern: {
    container: 'space-y-6 mt-6 bg-background',
    card: 'rounded-lg border shadow-sm bg-card hover:shadow-md transition-shadow',
    header: 'text-lg font-semibold text-foreground mb-4',
    metric: 'text-2xl font-bold text-foreground',
    progress: 'h-2 rounded-full bg-gray-200',
    table: 'w-full text-sm',
    badge: 'rounded-sm px-2 py-1 text-xs font-medium'
  },

  // Inspiration: Jira (Dense, Flat, Square)
  compact: {
    container: 'space-y-4 p-4 bg-background',
    card: 'rounded-sm border border-border bg-card p-3 shadow-none',
    header: 'text-lg font-semibold text-foreground mb-4 uppercase tracking-wide',
    metric: 'text-2xl font-bold text-foreground',
    progress: 'h-2 rounded-none bg-secondary',
    table: 'w-full text-sm border-collapse',
    badge: 'rounded-sm px-2 py-0.5 text-xs font-semibold'
  },

  // Inspiration: Asana (Airy, Minimalist)
  clean: {
    container: 'space-y-8 p-8 bg-secondary/5',
    card: 'rounded-2xl border-none bg-background/50 backdrop-blur-sm p-6',
    header: 'text-xl font-medium text-foreground/80 mb-8',
    metric: 'text-4xl font-light text-foreground',
    progress: 'h-1 rounded-full bg-primary/20',
    table: 'w-full',
    badge: 'rounded-lg px-3 py-1 text-xs uppercase tracking-wider'
  },

  // Inspiration: ClickUp (High Contrast, Utility)
  contrast: {
    container: 'space-y-4 p-4 bg-background',
    card: 'rounded-md border-2 border-border bg-card p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]',
    header: 'text-xl font-black text-foreground mb-4',
    metric: 'text-3xl font-black text-foreground',
    progress: 'h-4 rounded border-2 border-foreground bg-background',
    table: 'w-full border-2 border-foreground',
    badge: 'rounded px-2 py-1 font-bold border border-foreground'
  }
}

