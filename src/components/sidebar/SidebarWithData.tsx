/**
 * Server Component Wrapper for Sidebar
 * Delegates to Sidebar; sidebar data is loaded on the client (useSidebarLogic).
 *
 * Use this in server components (e.g. layout.tsx).
 * For client components, use the regular <Sidebar /> component.
 */

import { Sidebar } from './Sidebar'

export async function SidebarWithData({ className }: { className?: string }) {
  return <Sidebar className={className} />
}

