// Organization Structure Services
// CRUD operations for org units, positions, assignments, and delegations

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  runTransaction,
} from 'firebase/firestore'
import { db } from '../../firebase'
import {
  orgUnitsCollectionPathSegments,
  positionsCollectionPathSegments,
  companyCollectionPathSegments
} from '../../firestore-paths'
import type {
  OrgUnit,
  Position,
  PositionAssignment,
  Delegation,
  OrgAuditLog,
  EffectiveAssignment,
  PositionHistoryView,
  WorkItemAssignmentContext,
  DelegationResolutionCache,
} from '@/types/org-schema'

// ============================================================================
// ORG UNIT OPERATIONS
// ============================================================================

/**
 * Create a new org unit
 */
export async function createOrgUnit(
  companyId: string,
  data: Omit<OrgUnit, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string,
  groupId?: string
): Promise<OrgUnit> {
  if (!groupId) {
    throw new Error('groupId is required for createOrgUnit')
  }

  const orgUnitRef = doc(collection(db, ...orgUnitsCollectionPathSegments(groupId, companyId)))
  const now = new Date().toISOString()

  const orgUnit: OrgUnit = {
    ...data,
    id: orgUnitRef.id,
    companyId,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    updatedBy: userId,
  }

  await setDoc(orgUnitRef, orgUnit)

  // Log audit trail
  await createAuditLog({
    companyId,
    entityType: 'orgUnit',
    entityId: orgUnit.id,
    action: 'create',
    userId,
    changes: [
      { field: 'name', oldValue: null, newValue: orgUnit.name, dataType: 'string' },
      { field: 'code', oldValue: null, newValue: orgUnit.code, dataType: 'string' },
    ],
    reason: 'Org Unit created',
  }, groupId)

  return orgUnit
}

/**
 * Update an org unit
 */
export async function updateOrgUnit(
  companyId: string,
  orgUnitId: string,
  updates: Partial<OrgUnit>,
  userId: string,
  groupId?: string
): Promise<void> {
  if (!groupId) {
    throw new Error('groupId is required for updateOrgUnit')
  }
  const orgUnitRef = doc(db, ...orgUnitsCollectionPathSegments(groupId, companyId), orgUnitId)
  const orgUnitSnap = await getDoc(orgUnitRef)

  if (!orgUnitSnap.exists()) {
    throw new Error('Org Unit not found')
  }

  const oldData = orgUnitSnap.data() as OrgUnit
  const now = new Date().toISOString()

  await updateDoc(orgUnitRef, {
    ...updates,
    updatedAt: now,
    updatedBy: userId,
  })

  // Log changes
  const changes = Object.keys(updates)
    .filter(key => key !== 'updatedAt' && key !== 'updatedBy')
    .filter(key => {
      const oldVal = oldData[key as keyof OrgUnit]
      const newVal = updates[key as keyof OrgUnit]
      return oldVal !== newVal
    })
    .map(key => ({
      field: key,
      oldValue: oldData[key as keyof OrgUnit] ?? null,
      newValue: updates[key as keyof OrgUnit] ?? null,
      dataType: typeof (updates[key as keyof OrgUnit] ?? oldData[key as keyof OrgUnit]) as any,
    }))

  await createAuditLog({
    companyId: oldData.companyId,
    entityType: 'orgUnit',
    entityId: orgUnitId,
    action: 'update',
    userId,
    changes,
    reason: 'Org Unit updated',
  }, groupId)
}

/**
 * Get org unit by ID
 */
export async function getOrgUnit(companyId: string, orgUnitId: string, groupId?: string): Promise<OrgUnit | null> {
  const effectiveGroupId = groupId || companyId
  const orgUnitSnap = await getDoc(doc(db, ...orgUnitsCollectionPathSegments(effectiveGroupId, companyId), orgUnitId))
  return orgUnitSnap.exists() ? (orgUnitSnap.data() as OrgUnit) : null
}

/**
 * Get all org units for a company
 */
export async function getOrgUnits(companyId: string, groupId?: string): Promise<OrgUnit[]> {
  const effectiveGroupId = groupId || companyId
  const q = query(
    collection(db, ...orgUnitsCollectionPathSegments(effectiveGroupId, companyId)),
    where('status', '==', 'active')
  )

  const snapshot = await getDocs(q)
  const orgUnits = snapshot.docs.map(doc => doc.data() as OrgUnit)

  // Sort on client side to avoid needing composite index
  return orgUnits.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Delete an org unit (soft delete by setting status to archived)
 */
export async function deleteOrgUnit(companyId: string, orgUnitId: string, userId: string, groupId?: string): Promise<void> {
  await updateOrgUnit(companyId, orgUnitId, { status: 'archived' }, userId, groupId)
}

// ============================================================================
// POSITION OPERATIONS
// ============================================================================

/**
 * Create a new position
 */
export async function createPosition(
  companyId: string,
  data: Omit<Position, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string,
  groupId?: string
): Promise<Position> {
  if (!groupId) {
    throw new Error('groupId is required for createPosition')
  }
  const positionRef = doc(collection(db, ...positionsCollectionPathSegments(groupId, companyId)))
  const now = new Date().toISOString()

  const position: Position = {
    ...data,
    id: positionRef.id,
    companyId,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    updatedBy: userId,
  }

  await setDoc(positionRef, position)

  await createAuditLog({
    companyId,
    entityType: 'position',
    entityId: position.id,
    action: 'create',
    userId,
    changes: [
      { field: 'title', oldValue: null, newValue: position.title, dataType: 'string' },
      { field: 'code', oldValue: null, newValue: position.code, dataType: 'string' },
      { field: 'orgUnitId', oldValue: null, newValue: position.orgUnitId, dataType: 'string' },
    ],
    reason: 'Position created',
  }, groupId)

  return position
}

/**
 * Update a position
 */
export async function updatePosition(
  companyId: string,
  positionId: string,
  updates: Partial<Position>,
  userId: string,
  groupId?: string
): Promise<void> {
  if (!groupId) {
    throw new Error('groupId is required for updatePosition')
  }
  const positionRef = doc(db, ...positionsCollectionPathSegments(groupId, companyId), positionId)
  const positionSnap = await getDoc(positionRef)

  if (!positionSnap.exists()) {
    throw new Error('Position not found')
  }

  const oldData = positionSnap.data() as Position
  const now = new Date().toISOString()

  await updateDoc(positionRef, {
    ...updates,
    updatedAt: now,
    updatedBy: userId,
  })

  const changes = Object.keys(updates)
    .filter(key => key !== 'updatedAt' && key !== 'updatedBy')
    .filter(key => {
      const oldVal = oldData[key as keyof Position]
      const newVal = updates[key as keyof Position]
      // Deep check for arrays if needed, but for now simple comparison is fine for these fields
      return oldVal !== newVal
    })
    .map(key => ({
      field: key,
      oldValue: oldData[key as keyof Position] ?? null,
      newValue: updates[key as keyof Position] ?? null,
      dataType: typeof (updates[key as keyof Position] ?? oldData[key as keyof Position]) as any,
    }))

  await createAuditLog({
    companyId: oldData.companyId,
    entityType: 'position',
    entityId: positionId,
    action: 'update',
    userId,
    changes,
    reason: 'Position updated',
  }, groupId)
}

/**
 * Get position by ID
 */
export async function getPosition(companyId: string, positionId: string, groupId?: string): Promise<Position | null> {
  const effectiveGroupId = groupId || companyId
  const positionSnap = await getDoc(doc(db, ...positionsCollectionPathSegments(effectiveGroupId, companyId), positionId))
  return positionSnap.exists() ? (positionSnap.data() as Position) : null
}

/**
 * Get all positions for a company
 */
export async function getPositions(companyId: string, groupId?: string): Promise<Position[]> {
  const effectiveGroupId = groupId || companyId
  const q = query(
    collection(db, ...positionsCollectionPathSegments(effectiveGroupId, companyId)),
    where('status', '==', 'active')
  )

  const snapshot = await getDocs(q)
  const positions = snapshot.docs.map(doc => doc.data() as Position)
  return positions.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
}

/**
 * Get positions by org unit
 */
export async function getPositionsByOrgUnit(companyId: string, orgUnitId: string, groupId?: string): Promise<Position[]> {
  const effectiveGroupId = groupId || companyId
  const q = query(
    collection(db, ...positionsCollectionPathSegments(effectiveGroupId, companyId)),
    where('orgUnitId', '==', orgUnitId),
    where('status', '==', 'active')
  )

  const snapshot = await getDocs(q)
  const positions = snapshot.docs.map(doc => doc.data() as Position)
  return positions.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
}

/**
 * Delete a position
 */
export async function deletePosition(companyId: string, positionId: string, userId: string, groupId?: string): Promise<void> {
  await updatePosition(companyId, positionId, { status: 'archived' }, userId, groupId)
}

/**
 * Delete multiple positions (bulk)
 */
export async function deletePositions(companyId: string, positionIds: string[], userId: string, groupId?: string): Promise<void> {
  if (!groupId) {
    throw new Error('groupId is required for deletePositions')
  }
  const batch = writeBatch(db)
  const now = new Date().toISOString()

  // Fetch user data once for audit logging
  const userSnap = await getDoc(doc(db, 'enterpriseGroups', groupId, 'users', userId))
  const userData = userSnap.data()
  const userName = userData?.name || 'Unknown'
  const userEmail = userData?.email || 'unknown@example.com'

  for (const positionId of positionIds) {
    const positionRef = doc(db, ...positionsCollectionPathSegments(groupId, companyId), positionId)
    batch.update(positionRef, {
      status: 'archived',
      updatedAt: now,
      updatedBy: userId,
    })

    // Create audit log ref
    const auditRef = doc(collection(db, ...companyCollectionPathSegments(groupId, companyId, 'orgAuditLogs')))
    batch.set(auditRef, {
      id: auditRef.id,
      companyId,
      entityType: 'position',
      entityId: positionId,
      action: 'update',
      userId,
      userName,
      userEmail,
      timestamp: now,
      changes: [
        { field: 'status', oldValue: 'active', newValue: 'archived', dataType: 'string' }
      ],
      reason: 'Position archived (bulk)',
    } as OrgAuditLog)
  }

  await batch.commit()
}

// ============================================================================
// POSITION ASSIGNMENT OPERATIONS
// ============================================================================

/**
 * Get all current active assignments for a position
 */
export async function getCurrentAssignments(companyId: string, positionId: string, groupId?: string): Promise<PositionAssignment[]> {
  if (!groupId) {
    throw new Error('groupId is required for getCurrentAssignments')
  }
  const q = query(
    collection(db, ...companyCollectionPathSegments(groupId, companyId, 'positionAssignments')),
    where('positionId', '==', positionId),
    where('status', '==', 'active')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PositionAssignment))
}

/**
 * Get all users currently assigned to a position
 */
export async function getUsersByPosition(companyId: string, positionId: string, groupId?: string): Promise<string[]> {
  const assignments = await getCurrentAssignments(companyId, positionId, groupId)
  return assignments.map(a => a.userId)
}

/**
 * Assign a user to a position
 */
export async function assignUserToPosition(
  companyId: string,
  positionId: string,
  userId: string,
  data: {
    assignmentType: 'permanent' | 'temporary' | 'acting'
    startAt: string
    endAt?: string | null
    reason: string
    notes: string
    designation?: string
  },
  assignedBy: string,
  groupId?: string
): Promise<{ assignment: PositionAssignment; positionCode: string }> {
  if (!groupId) {
    throw new Error('groupId is required for assignUserToPosition')
  }
  // Fetch position and current active assignments
  // We use the positions collection path helper for consistency
  const [position] = await Promise.all([
    getPosition(companyId, positionId, groupId)
  ])

  if (!position) {
    throw new Error('Position not found')
  }

  // 1. Calculate unique slot ID (e.g., INT-001)
  const rawCode = (position.code || '').trim();
  let generationBase = rawCode;

  // Robustly handle cases where the base code already ends in a numeric sequence
  // e.g., if code is "INT-001", we use "INT" as base to produce "INT-001", "INT-002", etc.
  const suffixMatch = rawCode.match(/^(.*)-(\d+)$/);
  if (suffixMatch && suffixMatch[1]) {
    generationBase = suffixMatch[1];
  }

  // Fetch ALL users in the company who have a positionCode starting with our generation base.
  // This is more robust than relying on the assignments collection, as it prevents collisions 
  // across duplicate positions and handles stale indices better.
  const usersRef = collection(db, 'enterpriseGroups', groupId, 'users');
  const collisionQuery = query(
    usersRef,
    where('positionCode', '>=', generationBase + '-'),
    where('positionCode', '<=', generationBase + '-\uf8ff')
  );

  const [userAssignmentsSnap, companyUserSnaps, positionAssignments] = await Promise.all([
    getDocs(query(
      collection(db, ...companyCollectionPathSegments(groupId, companyId, 'positionAssignments')),
      where('userId', '==', userId),
      where('status', '==', 'active')
    )),
    getDocs(collisionQuery),
    getCurrentAssignments(companyId, positionId, groupId)
  ]);

  // Fetch profiles of current position occupants specifically via getDoc (strongly consistent)
  // to avoid indexing latency for users in the same position.
  const occupantProfiles = await Promise.all(
    positionAssignments.map(a => getDoc(doc(db, 'enterpriseGroups', groupId, 'users', a.userId)))
  );

  const usedSlots = new Set<number>();

  // Combine all detected user profiles (both from company-wide query and specific occupant fetch)
  const allUserSnaps = [...companyUserSnaps.docs, ...occupantProfiles];

  allUserSnaps.forEach(snap => {
    if (!snap.exists()) return;
    // Skip the current user to prevent self-collision if they already have a temporary code
    if (snap.id === userId) return;

    const data = snap.data();
    // Ensure the user actually belongs to this company (group users can be in multiple)
    if (!data.companyIds?.includes(companyId) && data.companyId !== companyId) return;

    const pCode = (data.positionCode as string || '').trim();
    if (pCode) {
      const lastDashIndex = pCode.lastIndexOf('-');
      if (lastDashIndex !== -1) {
        const prefix = pCode.substring(0, lastDashIndex);
        const suffix = pCode.substring(lastDashIndex + 1);

        if (prefix.toLowerCase() === generationBase.toLowerCase() ||
          prefix.toLowerCase() === rawCode.toLowerCase()) {
          const slotNum = parseInt(suffix, 10);
          if (!isNaN(slotNum)) {
            usedSlots.add(slotNum);
          }
        }
      }
    }
  });

  let slot = 1
  while (usedSlots.has(slot)) {
    slot++
  }

  const paddedSlot = slot.toString().padStart(3, '0')
  const uniquePositionCode = `${generationBase}-${paddedSlot}`

  // Fetch org unit if needed
  let orgUnit: OrgUnit | null = null
  if (position.orgUnitId) {
    orgUnit = await getOrgUnit(companyId, position.orgUnitId, groupId)
  }

  const assignment = await runTransaction(db, async (transaction) => {
    const now = new Date().toISOString()
    const userRef = doc(db, 'enterpriseGroups', groupId, 'users', userId)

    // 1. End any other active assignments for this user
    userAssignmentsSnap.docs.forEach(d => {
      const assignmentRef = doc(db, ...companyCollectionPathSegments(groupId, companyId, 'positionAssignments'), d.id)
      transaction.update(assignmentRef, {
        status: 'ended',
        endAt: now,
        updatedAt: now,
        notes: (d.data().notes || '') + ' [Auto-ended: User assigned to new position]'
      })
    })

    // 2. Create new assignment
    const newAssignmentRef = doc(collection(db, ...companyCollectionPathSegments(groupId, companyId, 'positionAssignments')))
    const newAssignment: PositionAssignment = {
      id: newAssignmentRef.id,
      companyId,
      positionId,
      userId,
      assignmentType: data.assignmentType,
      startAt: data.startAt,
      endAt: data.endAt || null,
      reason: data.reason,
      notes: data.notes,
      status: 'active',
      assignedBy,
      approvedBy: null,
      createdAt: now,
      updatedAt: now,
      previousAssignmentId: null,
    }

    transaction.set(newAssignmentRef, newAssignment)

    // 3. Update user profile
    const profileUpdate: any = {
      position: position.title,
      positionCode: uniquePositionCode,
      updatedAt: now,
    };

    if (data.designation) {
      profileUpdate.designation = data.designation;
    } else {
      profileUpdate.designation = position.title;
    }

    if (orgUnit?.name) {
      profileUpdate.department = orgUnit.name;
    }

    transaction.update(userRef, profileUpdate);

    return newAssignment
  })

  // Return assignment immediately - don't block on these operations
  // Invalidate cache and generate tasks asynchronously
  Promise.all([
    invalidateDelegationCache(companyId, positionId, groupId).catch(err =>
      console.error('Error invalidating delegation cache:', err)
    ),
    // Generate tasks asynchronously - this can take time and shouldn't block the response
    (async () => {
      try {
        const { PositionTaskAssignmentService } = await import('../tasks/position-task-assignment-service')
        await PositionTaskAssignmentService.generateTasksOnPositionAssignment(
          companyId,
          positionId,
          userId,
          data.assignmentType,
          groupId
        )
        console.log(`Generated tasks for user ${userId} assigned to position ${positionId}`)
      } catch (error) {
        console.error('Error generating tasks on position assignment:', error)
        // Don't throw error - position assignment succeeded, task generation is secondary
      }
    })()
  ]).catch(err => {
    // Log but don't fail - these are background operations
    console.error('Error in background operations after assignment:', err)
  })

  return { assignment, positionCode: uniquePositionCode }
}

/**
 * Get current active assignment for a user
 */
export async function getCurrentAssignmentForUser(companyId: string, userId: string, groupId?: string): Promise<PositionAssignment | null> {
  const effectiveGroupId = groupId || companyId
  const q = query(
    collection(db, ...companyCollectionPathSegments(effectiveGroupId, companyId, 'positionAssignments')),
    where('userId', '==', userId),
    where('status', '==', 'active')
  )

  const snapshot = await getDocs(q)
  if (snapshot.empty) {
    return null
  }

  const doc = snapshot.docs[0]
  if (!doc) {
    return null
  }
  return { id: doc.id, ...doc.data() } as PositionAssignment
}

/**
 * Get current active assignment for a position (single - for backward compatibility)
 * @deprecated Use getCurrentAssignments instead to support multiple assignments
 */
export async function getCurrentAssignment(companyId: string, positionId: string, groupId?: string): Promise<PositionAssignment | null> {
  const assignments = await getCurrentAssignments(companyId, positionId, groupId)
  return assignments.length > 0 ? (assignments[0] ?? null) : null
}

/**
 * Get all active assignments for a company (optimized batch query)
 */
export async function getAllActiveAssignments(companyId: string, groupId?: string): Promise<PositionAssignment[]> {
  const effectiveGroupId = groupId || companyId
  const q = query(
    collection(db, ...companyCollectionPathSegments(effectiveGroupId, companyId, 'positionAssignments')),
    where('status', '==', 'active')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PositionAssignment))
}

/**
 * Get assignment history for a position
 */
export async function getPositionAssignmentHistory(
  companyId: string,
  positionId: string,
  groupId?: string
): Promise<PositionAssignment[]> {
  const effectiveGroupId = groupId || companyId
  const q = query(
    collection(db, ...companyCollectionPathSegments(effectiveGroupId, companyId, 'positionAssignments')),
    where('positionId', '==', positionId),
    orderBy('startAt', 'desc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => doc.data() as PositionAssignment)
}

/**
 * Get all assignments for a user
 */
export async function getUserAssignments(companyId: string, userId: string, groupId?: string): Promise<PositionAssignment[]> {
  const effectiveGroupId = groupId || companyId
  const q = query(
    collection(db, ...companyCollectionPathSegments(effectiveGroupId, companyId, 'positionAssignments')),
    where('userId', '==', userId),
    orderBy('startAt', 'desc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => doc.data() as PositionAssignment)
}

/**
 * End a position assignment
 */
export async function endPositionAssignment(
  companyId: string,
  assignmentId: string,
  endAt: string,
  userId: string,
  groupId?: string
): Promise<void> {
  const effectiveGroupId = groupId || companyId
  const assignmentRef = doc(db, ...companyCollectionPathSegments(effectiveGroupId, companyId, 'positionAssignments'), assignmentId)

  await updateDoc(assignmentRef, {
    endAt,
    status: 'ended',
    updatedAt: new Date().toISOString(),
  })

  const assignment = await getDoc(assignmentRef)
  const assignmentData = assignment.data() as PositionAssignment

  // Check if user has any other active assignments
  const userActiveAssignments = query(
    collection(db, ...companyCollectionPathSegments(effectiveGroupId, companyId, 'positionAssignments')),
    where('userId', '==', assignmentData.userId),
    where('status', '==', 'active')
  )

  const activeSnap = await getDocs(userActiveAssignments)

  // Update user profile
  const userRef = doc(db, 'enterpriseGroups', effectiveGroupId, 'users', assignmentData.userId)

  if (!activeSnap.empty && activeSnap.docs[0]) {
    // User has other active assignments, update to the most recent one
    const latestAssignment = activeSnap.docs[0].data() as PositionAssignment
    const position = await getPosition(companyId, latestAssignment.positionId, groupId)
    let orgUnit: OrgUnit | null = null

    if (position?.orgUnitId) {
      orgUnit = await getOrgUnit(companyId, position.orgUnitId, groupId)
    }

    if (position) {
      await updateDoc(userRef, {
        position: position.title,
        department: orgUnit?.name || position.orgUnitId,
        updatedAt: new Date().toISOString(),
      })
    }
  } else {
    // No active assignments, clear position and org unit
    await updateDoc(userRef, {
      position: 'Unassigned',
      department: 'Unassigned',
      updatedAt: new Date().toISOString(),
    })
  }

  await createAuditLog({
    companyId: assignmentData.companyId,
    entityType: 'assignment',
    entityId: assignmentId,
    action: 'unassign',
    userId,
    changes: [
      { field: 'endAt', oldValue: null, newValue: endAt, dataType: 'date' },
      { field: 'status', oldValue: 'active', newValue: 'ended', dataType: 'string' },
    ],
    reason: 'Assignment ended',
  }, groupId)

  // Invalidate cache
  await invalidateDelegationCache(companyId, assignmentData.positionId, groupId)
}

// ============================================================================
// DELEGATION OPERATIONS
// ============================================================================

/**
 * Create a delegation
 */
export async function createDelegation(
  companyId: string,
  data: Omit<Delegation, 'id' | 'companyId' | 'createdAt' | 'updatedAt' | 'status' | 'activatedAt' | 'revokedAt' | 'revokedBy'>,
  userId: string,
  groupId?: string
): Promise<Delegation> {
  if (!groupId) {
    throw new Error('groupId is required for createDelegation')
  }
  const delegationRef = doc(collection(db, ...companyCollectionPathSegments(groupId, companyId, 'delegations')))
  const now = new Date().toISOString()

  const delegation: Delegation = {
    ...data,
    id: delegationRef.id,
    companyId,
    status: data.requiresApproval ? 'pending' : 'active',
    createdAt: now,
    updatedAt: now,
    revokedAt: null,
    revokedBy: null,
    activatedAt: data.requiresApproval ? null : now,
  }

  await setDoc(delegationRef, delegation)

  // Invalidate cache
  await invalidateDelegationCache(companyId, data.delegatorPositionId, groupId)

  await createAuditLog({
    companyId,
    entityType: 'delegation',
    entityId: delegation.id,
    action: 'create',
    userId,
    changes: [
      { field: 'delegatorUserId', oldValue: null, newValue: data.delegatorUserId, dataType: 'string' },
      { field: 'delegateUserId', oldValue: null, newValue: data.delegateUserId, dataType: 'string' },
      { field: 'startAt', oldValue: null, newValue: data.startAt, dataType: 'date' },
      { field: 'endAt', oldValue: null, newValue: data.endAt, dataType: 'date' },
    ],
    reason: `Delegation created: ${data.reason}`,
  }, groupId)

  return delegation
}

/**
 * Approve a delegation
 */
export async function approveDelegation(
  companyId: string,
  delegationId: string,
  approverUserId: string,
  groupId?: string
): Promise<void> {
  if (!groupId) {
    throw new Error('groupId is required for approveDelegation')
  }
  const delegationRef = doc(db, ...companyCollectionPathSegments(groupId, companyId, 'delegations'), delegationId)
  const now = new Date().toISOString()

  await updateDoc(delegationRef, {
    status: 'active',
    approvedBy: approverUserId,
    approvedAt: now,
    activatedAt: now,
    updatedAt: now,
  })

  const delegation = await getDoc(delegationRef)
  const delegationData = delegation.data() as Delegation

  await invalidateDelegationCache(companyId, delegationData.delegatorPositionId, groupId)

  await createAuditLog({
    companyId: delegationData.companyId,
    entityType: 'delegation',
    entityId: delegationId,
    action: 'approve',
    userId: approverUserId,
    changes: [
      { field: 'status', oldValue: 'pending', newValue: 'active', dataType: 'string' },
    ],
    reason: 'Delegation approved',
  }, groupId)
}

/**
 * Reject a delegation
 */
export async function rejectDelegation(
  companyId: string,
  delegationId: string,
  approverUserId: string,
  reason: string,
  groupId?: string
): Promise<void> {
  if (!groupId) {
    throw new Error('groupId is required for rejectDelegation')
  }
  const delegationRef = doc(db, ...companyCollectionPathSegments(groupId, companyId, 'delegations'), delegationId)

  await updateDoc(delegationRef, {
    status: 'rejected',
    approvedBy: approverUserId,
    approvedAt: new Date().toISOString(),
    rejectionReason: reason,
    updatedAt: new Date().toISOString(),
  })

  const delegation = await getDoc(delegationRef)
  const delegationData = delegation.data() as Delegation

  await createAuditLog({
    companyId: delegationData.companyId,
    entityType: 'delegation',
    entityId: delegationId,
    action: 'reject',
    userId: approverUserId,
    changes: [
      { field: 'status', oldValue: 'pending', newValue: 'rejected', dataType: 'string' },
    ],
    reason: `Delegation rejected: ${reason}`,
  }, groupId)
}

/**
 * Revoke a delegation
 */
export async function revokeDelegation(
  companyId: string,
  delegationId: string,
  userId: string,
  reason: string,
  groupId?: string
): Promise<void> {
  if (!groupId) {
    throw new Error('groupId is required for revokeDelegation')
  }
  const delegationRef = doc(db, ...companyCollectionPathSegments(groupId, companyId, 'delegations'), delegationId)
  const now = new Date().toISOString()

  await updateDoc(delegationRef, {
    status: 'revoked',
    revokedAt: now,
    revokedBy: userId,
    updatedAt: now,
  })

  const delegation = await getDoc(delegationRef)
  const delegationData = delegation.data() as Delegation

  await invalidateDelegationCache(companyId, delegationData.delegatorPositionId, groupId)

  await createAuditLog({
    companyId: delegationData.companyId,
    entityType: 'delegation',
    entityId: delegationId,
    action: 'revoke',
    userId,
    changes: [
      { field: 'status', oldValue: 'active', newValue: 'revoked', dataType: 'string' },
    ],
    reason: `Delegation revoked: ${reason}`,
  }, groupId)
}

/**
 * Get active delegations for a user (as delegator)
 */
export async function getActiveDelegations(companyId: string, userId: string, groupId?: string): Promise<Delegation[]> {
  if (!groupId) {
    throw new Error('groupId is required for getActiveDelegations')
  }
  const now = new Date().toISOString()

  const q = query(
    collection(db, ...companyCollectionPathSegments(groupId, companyId, 'delegations')),
    where('delegatorUserId', '==', userId),
    where('status', '==', 'active'),
    where('endAt', '>', now)
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => doc.data() as Delegation)
}

/**
 * Get delegations received by a user (as delegate)
 */
export async function getReceivedDelegations(companyId: string, userId: string, groupId?: string): Promise<Delegation[]> {
  if (!groupId) {
    throw new Error('groupId is required for getReceivedDelegations')
  }
  const now = new Date().toISOString()

  const q = query(
    collection(db, ...companyCollectionPathSegments(groupId, companyId, 'delegations')),
    where('delegateUserId', '==', userId),
    where('status', '==', 'active'),
    where('endAt', '>', now)
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => doc.data() as Delegation)
}

// ============================================================================
// EFFECTIVE ASSIGNMENT & DELEGATION RESOLUTION
// ============================================================================

/**
 * Resolve effective assignment for a position (with delegation consideration)
 * Target: < 60s resolution time
 */
export async function resolveEffectiveAssignment(
  companyId: string,
  positionId: string,
  groupId?: string
): Promise<EffectiveAssignment | null> {
  if (!groupId) {
    throw new Error('groupId is required for resolveEffectiveAssignment')
  }

  // Guard: If no positionId, no effective assignment possible (return early)
  if (!positionId) {
    return null
  }

  const startTime = Date.now()

  // Check cache first
  const cached = await getDelegationCache(companyId, positionId, groupId)
  if (cached && cached.validUntil > new Date().toISOString()) {
    return {
      positionId,
      userId: cached.effectiveUserId,
      assignmentId: '', // Would need to store this in cache
      isDelegated: cached.delegationIds.length > 0,
      delegationId: cached.delegationIds[0] || null,
      originalUserId: null, // Would need to fetch if delegated
      validFrom: cached.validFrom,
      validUntil: cached.validUntil,
      resolvedAt: new Date().toISOString(),
      resolutionTimeMs: Date.now() - startTime,
    }
  }

  // Get current assignment
  const assignment = await getCurrentAssignment(companyId, positionId, groupId)
  if (!assignment) {
    return null
  }

  // Check for active delegations
  // Note: We use only ONE range filter (endAt) in Firestore to simplify index requirements
  // Then filter startAt client-side
  const now = new Date().toISOString()
  const delegationsQuery = query(
    collection(db, ...companyCollectionPathSegments(groupId, companyId, 'delegations')),
    where('delegatorPositionId', '==', positionId),
    where('status', '==', 'active'),
    where('endAt', '>', now)
  )

  const delegationSnap = await getDocs(delegationsQuery)

  let effectiveUserId = assignment.userId
  let isDelegated = false
  let delegationId: string | null = null
  let originalUserId: string | null = null

  // Filter for delegations that have started (startAt <= now)
  const validDelegations = delegationSnap.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Delegation))
    .filter(d => d.startAt <= now)

  if (validDelegations.length > 0 && validDelegations[0]) {
    // Use first active delegation (would need more complex logic for multiple delegations)
    const delegation = validDelegations[0]
    effectiveUserId = delegation.delegateUserId
    isDelegated = true
    delegationId = delegation.id
    originalUserId = assignment.userId
  }

  const resolutionTimeMs = Date.now() - startTime

  // Cache the result
  await cacheDelegationResolution(companyId, positionId, effectiveUserId, delegationId ? [delegationId] : [], groupId)

  return {
    positionId,
    userId: effectiveUserId,
    assignmentId: assignment.id,
    isDelegated,
    delegationId,
    originalUserId,
    validFrom: assignment.startAt,
    validUntil: assignment.endAt,
    resolvedAt: new Date().toISOString(),
    resolutionTimeMs,
  }
}

/**
 * Cache delegation resolution
 */
async function cacheDelegationResolution(
  companyId: string,
  positionId: string,
  effectiveUserId: string,
  delegationIds: string[],
  groupId?: string
): Promise<void> {
  if (!groupId) {
    throw new Error('groupId is required for cacheDelegationResolution')
  }
  // Guard: Prevent invalid Firestore path segments
  if (!positionId) {
    return
  }
  const cacheRef = doc(db, ...companyCollectionPathSegments(groupId, companyId, 'delegationCache'), positionId)
  const now = new Date().toISOString()
  const validUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minute cache

  const cache: DelegationResolutionCache = {
    id: positionId,
    companyId: companyId,
    positionId,
    effectiveUserId,
    delegationIds,
    validFrom: now,
    validUntil,
    createdAt: now,
    lastUsedAt: now,
    hitCount: 0,
  }

  await setDoc(cacheRef, cache, { merge: true })
}

/**
 * Get delegation cache
 */
async function getDelegationCache(companyId: string, positionId: string, groupId?: string): Promise<DelegationResolutionCache | null> {
  if (!groupId) {
    throw new Error('groupId is required for getDelegationCache')
  }
  // Guard: Prevent invalid Firestore path segments
  if (!positionId) {
    return null
  }
  const cacheSnap = await getDoc(doc(db, ...companyCollectionPathSegments(groupId, companyId, 'delegationCache'), positionId))

  if (!cacheSnap.exists()) {
    return null
  }

  // Update hit count
  await updateDoc(cacheSnap.ref, {
    lastUsedAt: new Date().toISOString(),
    hitCount: (cacheSnap.data().hitCount || 0) + 1,
  })

  return cacheSnap.data() as DelegationResolutionCache
}

/**
 * Invalidate delegation cache
 */
async function invalidateDelegationCache(companyId: string, positionId: string, groupId?: string): Promise<void> {
  if (!groupId) {
    throw new Error('groupId is required for invalidateDelegationCache')
  }
  // Guard: Prevent invalid Firestore path segments
  if (!positionId) {
    return
  }
  const cacheRef = doc(db, ...companyCollectionPathSegments(groupId, companyId, 'delegationCache'), positionId)
  try {
    await deleteDoc(cacheRef)
  } catch (error) {
    // Cache might not exist, ignore error
  }
}

// ============================================================================
// AUDIT & REPORTING
// ============================================================================

/**
 * Create an audit log entry
 */
export async function createAuditLog(data: {
  companyId: string
  entityType: 'orgUnit' | 'position' | 'assignment' | 'delegation'
  entityId: string
  action: 'create' | 'update' | 'delete' | 'assign' | 'unassign' | 'approve' | 'reject' | 'revoke'
  userId: string
  changes: Array<{ field: string; oldValue: any; newValue: any; dataType: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' }>
  reason: string
  notes?: string
  relatedEntities?: Array<{ entityType: string; entityId: string; relationshipType: string }>
}, groupId?: string): Promise<void> {
  if (!groupId) {
    throw new Error('groupId is required for createAuditLog')
  }
  const auditRef = doc(collection(db, ...companyCollectionPathSegments(groupId, data.companyId, 'orgAuditLogs')))

  // Get user details
  const userSnap = await getDoc(doc(db, 'enterpriseGroups', groupId, 'users', data.userId))
  const userData = userSnap.data()

  const auditLog: OrgAuditLog = {
    id: auditRef.id,
    companyId: data.companyId,
    entityType: data.entityType,
    entityId: data.entityId,
    action: data.action,
    userId: data.userId,
    userName: userData?.name || 'Unknown',
    userEmail: userData?.email || 'unknown@example.com',
    changes: data.changes,
    reason: data.reason,
    notes: data.notes || '',
    relatedEntities: data.relatedEntities || [],
    ipAddress: null,
    userAgent: null,
    timestamp: new Date().toISOString(),
    approvalChain: [],
  }

  await setDoc(auditRef, auditLog)
}

/**
 * Get position history for compliance reports
 */
export async function getPositionHistory(
  companyId: string,
  positionId: string,
  groupId?: string,
  atTimestamp?: string
): Promise<PositionHistoryView> {
  const position = await getPosition(companyId, positionId, groupId)
  if (!position) {
    throw new Error('Position not found')
  }

  const orgUnit = position.orgUnitId ? await getOrgUnit(companyId, position.orgUnitId, groupId) : null
  const assignments = await getPositionAssignmentHistory(companyId, positionId, groupId)

  // Get user details for each assignment
  const assignmentsWithUsers = await Promise.all(
    assignments.map(async (assignment) => {
      const userSnap = await getDoc(doc(db, 'enterpriseGroups', groupId!, 'users', assignment.userId))
      const userData = userSnap.data()

      return {
        userId: assignment.userId,
        userName: userData?.name || 'Unknown',
        userEmail: userData?.email || 'unknown@example.com',
        startAt: assignment.startAt,
        endAt: assignment.endAt,
        assignmentType: assignment.assignmentType,
        reason: assignment.reason,
        isActive: assignment.status === 'active',
      }
    })
  )

  const result: PositionHistoryView = {
    positionId,
    positionTitle: position.title,
    orgUnitName: orgUnit?.name || 'Unknown',
    assignments: assignmentsWithUsers,
  }

  // If specific timestamp requested, find who was in position at that time
  if (atTimestamp) {
    const occupantAtTime = assignmentsWithUsers.find(
      (a) => a.startAt <= atTimestamp && (!a.endAt || a.endAt > atTimestamp)
    )

    if (occupantAtTime) {
      const assignment = assignments.find(a => a.userId === occupantAtTime.userId)
      result.occupantAt = {
        timestamp: atTimestamp,
        userId: occupantAtTime.userId,
        userName: occupantAtTime.userName,
        userEmail: occupantAtTime.userEmail,
        assignmentId: assignment?.id || '',
      }
    }
  }

  return result
}

/**
 * Get audit logs for a specific entity
 */
export async function getEntityAuditLogs(
  companyId: string,
  entityType: string,
  entityId: string,
  groupId?: string
): Promise<OrgAuditLog[]> {
  if (!groupId) {
    throw new Error('groupId is required for getEntityAuditLogs')
  }
  const q = query(
    collection(db, ...companyCollectionPathSegments(groupId, companyId, 'orgAuditLogs')),
    where('entityType', '==', entityType),
    where('entityId', '==', entityId),
    orderBy('timestamp', 'desc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => doc.data() as OrgAuditLog)
}

/**
 * Get audit logs for a company within a time range
 */
export async function getCompanyAuditLogs(
  companyId: string,
  startDate: string,
  endDate: string,
  groupId?: string
): Promise<OrgAuditLog[]> {
  if (!groupId) {
    throw new Error('groupId is required for getCompanyAuditLogs')
  }
  const q = query(
    collection(db, ...companyCollectionPathSegments(groupId, companyId, 'orgAuditLogs')),
    where('companyId', '==', companyId),
    where('timestamp', '>=', startDate),
    where('timestamp', '<=', endDate),
    orderBy('timestamp', 'desc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => doc.data() as OrgAuditLog)
}

