/**
 * BPMN Feature Flags
 *
 * Controls the gradual rollout of BPMN workflow features.
 * Allows instant enable/disable without deployment.
 *
 * @module lib/bpmn/feature-flags
 * @version 1.0.0
 * @since Stage 1 - Foundation & Contracts
 */

import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

// =============================================================================
// FEATURE FLAG TYPES
// =============================================================================

/**
 * Individual feature flags for BPMN functionality
 */
export interface BpmnFeatureFlags {
  // Master switch - if OFF, all BPMN features are disabled
  enableBpmnExecution: boolean

  // Individual feature toggles
  enableWebhookProcessing: boolean      // Stage 2: Process Flowable webhooks
  enableTaskCompletionBridge: boolean   // Stage 3: Bridge task completion to Flowable
  enableBpmnEscalation: boolean         // Stage 4: Escalation for BPMN steps
  enableVariableEngine: boolean         // Stage 5: Process variable management
  enableNotificationIntegration: boolean // Stage 6: BPMN notifications
  enableErrorRecovery: boolean          // Stage 7: Retry, DLQ, circuit breaker
  enableObservability: boolean          // Stage 8: Metrics and monitoring

  // Rollout configuration
  rolloutPercentage: number             // 0-100, percentage of companies enabled
  enabledCompanyIds: string[]           // Explicitly enabled companies (whitelist)
  disabledCompanyIds: string[]          // Explicitly disabled companies (blacklist)

  // Debug settings
  enableDebugLogging: boolean           // Verbose logging for troubleshooting
  enableDryRun: boolean                 // Process but don't execute (for testing)

  // Metadata
  lastUpdatedAt?: string
  lastUpdatedBy?: string
}

/**
 * Feature flag key type for type safety
 */
export type BpmnFeatureFlagKey = keyof Omit<
  BpmnFeatureFlags,
  'rolloutPercentage' | 'enabledCompanyIds' | 'disabledCompanyIds' |
  'enableDebugLogging' | 'enableDryRun' | 'lastUpdatedAt' | 'lastUpdatedBy'
>

// =============================================================================
// DEFAULT VALUES
// =============================================================================

/**
 * Default flags - ALL FEATURES OFF for safety
 * Features are enabled incrementally during rollout
 */
export const DEFAULT_BPMN_FLAGS: BpmnFeatureFlags = {
  // Master switch - OFF by default
  enableBpmnExecution: false,

  // Individual features - all OFF
  enableWebhookProcessing: false,
  enableTaskCompletionBridge: false,
  enableBpmnEscalation: false,
  enableVariableEngine: false,
  enableNotificationIntegration: false,
  enableErrorRecovery: false,
  enableObservability: false,

  // Rollout - 0% by default
  rolloutPercentage: 0,
  enabledCompanyIds: [],
  disabledCompanyIds: [],

  // Debug - OFF in production
  enableDebugLogging: false,
  enableDryRun: false
}

/**
 * Flags for local development - more permissive
 */
export const DEV_BPMN_FLAGS: BpmnFeatureFlags = {
  enableBpmnExecution: true,
  enableWebhookProcessing: true,
  enableTaskCompletionBridge: true,
  enableBpmnEscalation: true,
  enableVariableEngine: true,
  enableNotificationIntegration: true,
  enableErrorRecovery: true,
  enableObservability: true,
  rolloutPercentage: 100,
  enabledCompanyIds: [],
  disabledCompanyIds: [],
  enableDebugLogging: true,
  enableDryRun: false
}

// =============================================================================
// FLAG RETRIEVAL
// =============================================================================

// In-memory cache for flags
let cachedFlags: BpmnFeatureFlags | null = null
let cacheTimestamp: number = 0
const CACHE_TTL_MS = 60000 // 1 minute cache

/**
 * Get BPMN feature flags from Firestore
 *
 * Flags are stored at: bpmnConfig/featureFlags
 * Company overrides at: companies/{companyId}/settings/bpmnFlags
 *
 * @param companyId - Optional company ID for company-specific overrides
 * @returns Feature flags
 */
export async function getBpmnFlags(companyId?: string): Promise<BpmnFeatureFlags> {
  try {
    // Check cache first
    if (cachedFlags && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
      return applyCompanyOverrides(cachedFlags, companyId)
    }

    // Fetch global flags
    const flagsRef = doc(db, 'bpmnConfig', 'featureFlags')
    const flagsSnap = await getDoc(flagsRef)

    if (flagsSnap.exists()) {
      cachedFlags = { ...DEFAULT_BPMN_FLAGS, ...flagsSnap.data() } as BpmnFeatureFlags
    } else {
      cachedFlags = DEFAULT_BPMN_FLAGS
    }

    cacheTimestamp = Date.now()

    // Apply company-specific overrides if provided
    return applyCompanyOverrides(cachedFlags, companyId)

  } catch (error) {
    console.error('[BpmnFeatureFlags] Error fetching flags, using defaults', error)
    return DEFAULT_BPMN_FLAGS
  }
}

/**
 * Apply company-specific flag overrides
 */
async function applyCompanyOverrides(
  globalFlags: BpmnFeatureFlags,
  companyId?: string
): Promise<BpmnFeatureFlags> {
  if (!companyId) {
    return globalFlags
  }

  try {
    const companyFlagsRef = doc(db, 'companies', companyId, 'settings', 'bpmnFlags')
    const companyFlagsSnap = await getDoc(companyFlagsRef)

    if (companyFlagsSnap.exists()) {
      const companyOverrides = companyFlagsSnap.data()
      return { ...globalFlags, ...companyOverrides } as BpmnFeatureFlags
    }

    return globalFlags

  } catch (error) {
    console.error('[BpmnFeatureFlags] Error fetching company overrides', error)
    return globalFlags
  }
}

/**
 * Subscribe to flag changes (for real-time updates)
 */
export function subscribeToBpmnFlags(
  callback: (flags: BpmnFeatureFlags) => void
): () => void {
  const flagsRef = doc(db, 'bpmnConfig', 'featureFlags')

  return onSnapshot(flagsRef, (snap) => {
    if (snap.exists()) {
      const flags = { ...DEFAULT_BPMN_FLAGS, ...snap.data() } as BpmnFeatureFlags
      cachedFlags = flags
      cacheTimestamp = Date.now()
      callback(flags)
    } else {
      callback(DEFAULT_BPMN_FLAGS)
    }
  }, (error) => {
    console.error('[BpmnFeatureFlags] Subscription error', error)
    callback(DEFAULT_BPMN_FLAGS)
  })
}

// =============================================================================
// FLAG CHECKING
// =============================================================================

/**
 * Check if a specific BPMN feature is enabled for a company
 *
 * Decision tree:
 * 1. If master switch (enableBpmnExecution) is OFF -> false
 * 2. If company is in disabledCompanyIds -> false
 * 3. If company is in enabledCompanyIds -> check feature flag
 * 4. If company hash falls within rolloutPercentage -> check feature flag
 * 5. Otherwise -> false
 *
 * @param flags - Feature flags object
 * @param companyId - Company to check
 * @param featureKey - Specific feature to check
 * @returns Whether the feature is enabled
 */
export function isBpmnFeatureEnabled(
  flags: BpmnFeatureFlags,
  companyId: string,
  featureKey: BpmnFeatureFlagKey
): boolean {
  // 1. Master switch must be ON
  if (!flags.enableBpmnExecution) {
    return false
  }

  // 2. Blacklist check - explicitly disabled companies
  if (flags.disabledCompanyIds.includes(companyId)) {
    return false
  }

  // 3. Whitelist check - explicitly enabled companies
  if (flags.enabledCompanyIds.includes(companyId)) {
    return flags[featureKey] as boolean
  }

  // 4. Rollout percentage check
  const isInRollout = isCompanyInRollout(companyId, flags.rolloutPercentage)
  if (!isInRollout) {
    return false
  }

  // 5. Check the specific feature flag
  return flags[featureKey] as boolean
}

/**
 * Convenience function: Check if BPMN execution is enabled for a company
 */
export async function isBpmnEnabled(companyId: string): Promise<boolean> {
  const flags = await getBpmnFlags(companyId)
  return isBpmnFeatureEnabled(flags, companyId, 'enableBpmnExecution')
}

/**
 * Convenience function: Check if webhook processing is enabled
 */
export async function isWebhookProcessingEnabled(companyId: string): Promise<boolean> {
  const flags = await getBpmnFlags(companyId)
  return isBpmnFeatureEnabled(flags, companyId, 'enableWebhookProcessing')
}

/**
 * Convenience function: Check if task completion bridge is enabled
 */
export async function isTaskCompletionBridgeEnabled(companyId: string): Promise<boolean> {
  const flags = await getBpmnFlags(companyId)
  return isBpmnFeatureEnabled(flags, companyId, 'enableTaskCompletionBridge')
}

/**
 * Convenience function: Check if BPMN escalation is enabled
 */
export async function isBpmnEscalationEnabled(companyId: string): Promise<boolean> {
  const flags = await getBpmnFlags(companyId)
  return isBpmnFeatureEnabled(flags, companyId, 'enableBpmnEscalation')
}

/**
 * Check if debug logging is enabled
 */
export async function isDebugLoggingEnabled(companyId?: string): Promise<boolean> {
  const flags = await getBpmnFlags(companyId)
  return flags.enableDebugLogging
}

/**
 * Check if dry run mode is enabled (process but don't execute)
 */
export async function isDryRunEnabled(companyId?: string): Promise<boolean> {
  const flags = await getBpmnFlags(companyId)
  return flags.enableDryRun
}

// =============================================================================
// ROLLOUT CALCULATION
// =============================================================================

/**
 * Deterministic hash function for consistent rollout
 * Uses company ID to generate a number 0-99
 */
function hashCompanyId(companyId: string): number {
  let hash = 0
  for (let i = 0; i < companyId.length; i++) {
    const char = companyId.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash) % 100
}

/**
 * Check if a company falls within the rollout percentage
 *
 * Uses deterministic hashing so a company always gets the same result
 * for a given rollout percentage.
 */
function isCompanyInRollout(companyId: string, rolloutPercentage: number): boolean {
  if (rolloutPercentage >= 100) return true
  if (rolloutPercentage <= 0) return false

  const companyHash = hashCompanyId(companyId)
  return companyHash < rolloutPercentage
}

// =============================================================================
// FLAG MANAGEMENT (ADMIN)
// =============================================================================

/**
 * Update global BPMN feature flags
 * Should only be called by admin users
 */
export async function updateBpmnFlags(
  flags: Partial<BpmnFeatureFlags>,
  updatedBy: string
): Promise<void> {
  const flagsRef = doc(db, 'bpmnConfig', 'featureFlags')

  await setDoc(flagsRef, {
    ...flags,
    lastUpdatedAt: new Date().toISOString(),
    lastUpdatedBy: updatedBy
  }, { merge: true })

  // Clear cache to force refresh
  cachedFlags = null
  cacheTimestamp = 0

  console.log('[BpmnFeatureFlags] Flags updated', {
    updatedBy,
    updatedFlags: Object.keys(flags)
  })
}

/**
 * Update company-specific flag overrides
 */
export async function updateCompanyBpmnFlags(
  companyId: string,
  flags: Partial<BpmnFeatureFlags>,
  updatedBy: string
): Promise<void> {
  const companyFlagsRef = doc(db, 'companies', companyId, 'settings', 'bpmnFlags')

  await setDoc(companyFlagsRef, {
    ...flags,
    lastUpdatedAt: new Date().toISOString(),
    lastUpdatedBy: updatedBy
  }, { merge: true })

  console.log('[BpmnFeatureFlags] Company flags updated', {
    companyId,
    updatedBy,
    updatedFlags: Object.keys(flags)
  })
}

/**
 * Add company to whitelist
 */
export async function enableBpmnForCompany(
  companyId: string,
  updatedBy: string
): Promise<void> {
  const flagsRef = doc(db, 'bpmnConfig', 'featureFlags')
  const flagsSnap = await getDoc(flagsRef)

  const currentFlags = flagsSnap.exists()
    ? flagsSnap.data() as BpmnFeatureFlags
    : DEFAULT_BPMN_FLAGS

  const enabledCompanyIds = new Set(currentFlags.enabledCompanyIds || [])
  enabledCompanyIds.add(companyId)

  // Also remove from disabled list if present
  const disabledCompanyIds = new Set(currentFlags.disabledCompanyIds || [])
  disabledCompanyIds.delete(companyId)

  await setDoc(flagsRef, {
    enabledCompanyIds: Array.from(enabledCompanyIds),
    disabledCompanyIds: Array.from(disabledCompanyIds),
    lastUpdatedAt: new Date().toISOString(),
    lastUpdatedBy: updatedBy
  }, { merge: true })

  // Clear cache
  cachedFlags = null

  console.log('[BpmnFeatureFlags] Company added to whitelist', { companyId, updatedBy })
}

/**
 * Add company to blacklist
 */
export async function disableBpmnForCompany(
  companyId: string,
  updatedBy: string
): Promise<void> {
  const flagsRef = doc(db, 'bpmnConfig', 'featureFlags')
  const flagsSnap = await getDoc(flagsRef)

  const currentFlags = flagsSnap.exists()
    ? flagsSnap.data() as BpmnFeatureFlags
    : DEFAULT_BPMN_FLAGS

  const disabledCompanyIds = new Set(currentFlags.disabledCompanyIds || [])
  disabledCompanyIds.add(companyId)

  // Also remove from enabled list if present
  const enabledCompanyIds = new Set(currentFlags.enabledCompanyIds || [])
  enabledCompanyIds.delete(companyId)

  await setDoc(flagsRef, {
    enabledCompanyIds: Array.from(enabledCompanyIds),
    disabledCompanyIds: Array.from(disabledCompanyIds),
    lastUpdatedAt: new Date().toISOString(),
    lastUpdatedBy: updatedBy
  }, { merge: true })

  // Clear cache
  cachedFlags = null

  console.log('[BpmnFeatureFlags] Company added to blacklist', { companyId, updatedBy })
}

/**
 * Set rollout percentage
 */
export async function setRolloutPercentage(
  percentage: number,
  updatedBy: string
): Promise<void> {
  if (percentage < 0 || percentage > 100) {
    throw new Error('Rollout percentage must be between 0 and 100')
  }

  await updateBpmnFlags({ rolloutPercentage: percentage }, updatedBy)

  console.log('[BpmnFeatureFlags] Rollout percentage updated', { percentage, updatedBy })
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Get a summary of current flag status for logging/debugging
 */
export async function getBpmnFlagsSummary(companyId?: string): Promise<{
  masterEnabled: boolean
  features: Record<string, boolean>
  rollout: {
    percentage: number
    companyInRollout: boolean
    isWhitelisted: boolean
    isBlacklisted: boolean
  }
}> {
  const flags = await getBpmnFlags(companyId)

  return {
    masterEnabled: flags.enableBpmnExecution,
    features: {
      webhookProcessing: flags.enableWebhookProcessing,
      taskCompletionBridge: flags.enableTaskCompletionBridge,
      bpmnEscalation: flags.enableBpmnEscalation,
      variableEngine: flags.enableVariableEngine,
      notificationIntegration: flags.enableNotificationIntegration,
      errorRecovery: flags.enableErrorRecovery,
      observability: flags.enableObservability
    },
    rollout: {
      percentage: flags.rolloutPercentage,
      companyInRollout: companyId
        ? isCompanyInRollout(companyId, flags.rolloutPercentage)
        : false,
      isWhitelisted: companyId
        ? flags.enabledCompanyIds.includes(companyId)
        : false,
      isBlacklisted: companyId
        ? flags.disabledCompanyIds.includes(companyId)
        : false
    }
  }
}

/**
 * Clear the flag cache (useful for testing)
 */
export function clearBpmnFlagsCache(): void {
  cachedFlags = null
  cacheTimestamp = 0
}
