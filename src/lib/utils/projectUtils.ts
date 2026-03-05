/**
 * Utility functions for project management (Jira-style)
 */

/**
 * Generate a project key from project name (similar to Jira)
 * Examples:
 *   "Robot Assembly Line" → "RAL"
 *   "Quality Control System" → "QCS"
 *   "Manufacturing Execution" → "ME"
 */
export function generateProjectKey(projectName: string): string {
  // Remove special characters and split into words
  const words = projectName
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 0)

  if (words.length === 0) {
    return 'PROJ'
  }

  // Take first letter of each word, max 4 letters
  let key = words
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 4)

  // If key is less than 2 characters, use first 2-4 chars of project name
  if (key.length < 2) {
    key = projectName
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 4)
      .toUpperCase()
  }

  // Ensure minimum 2 characters
  if (key.length < 2) {
    key = key.padEnd(2, 'X')
  }

  return key
}

/**
 * Generate a task key (Jira-style)
 * Example: "RAL-123" for Robot Assembly Line project
 */
export function generateTaskKey(projectKey: string, taskNumber: number): string {
  return `${projectKey}-${taskNumber}`
}

/**
 * Parse a task key back into components
 * Example: "RAL-123" → { projectKey: "RAL", taskNumber: 123 }
 */
export function parseTaskKey(taskKey: string): { projectKey: string; taskNumber: number } | null {
  const match = taskKey.match(/^([A-Z]{2,4})-(\d+)$/)
  if (!match) return null
  
  return {
    projectKey: match[1]!,
    taskNumber: parseInt(match[2]!, 10)
  }
}

/**
 * Validate project key format
 * - 2-4 uppercase letters
 * - Must start with a letter
 */
export function isValidProjectKey(key: string): boolean {
  return /^[A-Z][A-Z0-9]{1,3}$/.test(key)
}

/**
 * Format project display name with key
 * Example: "RAL · Robot Assembly Line"
 */
export function formatProjectDisplay(projectKey: string, projectName: string): string {
  return `${projectKey} · ${projectName}`
}

/**
 * Get project color based on status
 */
export function getProjectStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800 border-green-300'
    case 'planning':
      return 'bg-blue-100 text-blue-800 border-blue-300'
    case 'on-hold':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    case 'completed':
      return 'bg-gray-100 text-gray-800 border-gray-300'
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-300'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300'
  }
}

