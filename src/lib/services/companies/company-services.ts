// Company Service for Multi-Tenant Project Management System

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  DocumentSnapshot
} from 'firebase/firestore';
import { getFirestoreInstance } from '../../firebase';
import {
  Company,
  CompanyUser,
  CompanyInvitation,
  CompanyActivity,
  CompanyStats,
  CompanySettings,
  CompanySubscription,
  CompanyBranding,
  CompanyLimits,
  CompanyFeatures,
  PMSConfig
} from '../../../types/company-schema';

// Helper to convert Firestore timestamps to ISO strings
const convertTimestamps = (data: any): any => {
  if (!data) return data;
  
  const converted = { ...data };
  Object.keys(converted).forEach(key => {
    if (converted[key] instanceof Timestamp) {
      converted[key] = converted[key].toDate().toISOString();
    } else if (typeof converted[key] === 'object' && converted[key] !== null) {
      converted[key] = convertTimestamps(converted[key]);
    }
  });
  
  return converted;
};

// Company Service
export class CompanyService {
  /**
   * Get all companies. When groupId is provided (multi-org), reads from enterpriseGroups/{groupId}/companies.
   * Otherwise reads from root companies (legacy).
   */
  static async getCompanies(groupId?: string): Promise<Company[]> {
    const db = getFirestoreInstance()
    try {
      const coll = groupId
        ? collection(db, 'enterpriseGroups', groupId, 'companies')
        : collection(db, 'companies')
      const q = query(coll, orderBy('createdAt', 'desc'))
      const snapshot = await getDocs(q)
      return snapshot.docs.map(d => ({
        id: d.id,
        ...convertTimestamps(d.data())
      } as Company))
    } catch (error) {
      console.error('Error getting companies:', error)
      throw error
    }
  }

  /**
   * Get company by ID. When groupId is provided (multi-org), reads from enterpriseGroups/{groupId}/companies/{companyId}.
   * Otherwise reads from root companies (legacy).
   */
  static async getCompany(companyId: string, groupId?: string): Promise<Company | null> {
    const db = getFirestoreInstance()
    try {
      const docRef = groupId
        ? doc(db, 'enterpriseGroups', groupId, 'companies', companyId)
        : doc(db, 'companies', companyId)
      const docSnap = await getDoc(docRef)
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...convertTimestamps(docSnap.data())
        } as Company
      }
      return null
    } catch (error) {
      console.error('Error getting company:', error)
      throw error
    }
  }

  // Get company by domain
  static async getCompanyByDomain(domain: string): Promise<Company | null> {
    const db = getFirestoreInstance()
    try {
      const q = query(
        collection(db, 'companies'),
        where('domain', '==', domain),
        limit(1)
      );
      
      const snapshot = await getDocs(q);
      if (snapshot.docs.length > 0) {
        const firstDoc = snapshot.docs[0]!;
        return {
          id: firstDoc.id,
          ...convertTimestamps(firstDoc.data())
        } as Company;
      }
      return null;
    } catch (error) {
      console.error('Error getting company by domain:', error);
      throw error;
    }
  }

  // Create new company
  static async createCompany(company: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const db = getFirestoreInstance()
    try {
      const docRef = await addDoc(collection(db, 'companies'), {
        ...company,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating company:', error);
      throw error;
    }
  }

  // Update company. When groupId is provided, updates enterpriseGroups/{groupId}/companies/{companyId}.
  // Otherwise updates root companies/{companyId} (legacy).
  static async updateCompany(companyId: string, updates: Partial<Company>, groupId?: string): Promise<void> {
    const db = getFirestoreInstance()
    try {
      const docRef = groupId
        ? doc(db, 'enterpriseGroups', groupId, 'companies', companyId)
        : doc(db, 'companies', companyId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating company:', error);
      throw error;
    }
  }

  // Delete company (soft delete by setting status to inactive)
  static async deleteCompany(companyId: string): Promise<void> {
    try {
      await this.updateCompany(companyId, { status: 'inactive' });
    } catch (error) {
      console.error('Error deleting company:', error);
      throw error;
    }
  }

  // Update company settings
  static async updateCompanySettings(companyId: string, settings: Partial<CompanySettings>): Promise<void> {
    const db = getFirestoreInstance()
    try {
      const docRef = doc(db, 'companies', companyId);
      await updateDoc(docRef, {
        'settings': settings,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating company settings:', error);
      throw error;
    }
  }

  // Update company subscription
  static async updateCompanySubscription(companyId: string, subscription: Partial<CompanySubscription>): Promise<void> {
    const db = getFirestoreInstance()
    try {
      const docRef = doc(db, 'companies', companyId);
      await updateDoc(docRef, {
        'subscription': subscription,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating company subscription:', error);
      throw error;
    }
  }

  // Update company branding. When groupId is provided, updates enterpriseGroups/{groupId}/companies/{companyId}.
  // Otherwise updates root companies/{companyId} (legacy).
  static async updateCompanyBranding(companyId: string, branding: Partial<CompanyBranding>, groupId?: string): Promise<void> {
    const db = getFirestoreInstance()
    try {
      const docRef = groupId
        ? doc(db, 'enterpriseGroups', groupId, 'companies', companyId)
        : doc(db, 'companies', companyId);
      await updateDoc(docRef, {
        'branding': branding,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating company branding:', error);
      throw error;
    }
  }

  // Update company limits
  static async updateCompanyLimits(companyId: string, limits: Partial<CompanyLimits>): Promise<void> {
    const db = getFirestoreInstance()
    try {
      const docRef = doc(db, 'companies', companyId);
      await updateDoc(docRef, {
        'limits': limits,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating company limits:', error);
      throw error;
    }
  }

  // Update company features
  static async updateCompanyFeatures(companyId: string, features: Partial<CompanyFeatures>): Promise<void> {
    const db = getFirestoreInstance()
    try {
      const docRef = doc(db, 'companies', companyId);
      await updateDoc(docRef, {
        'features': features,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating company features:', error);
      throw error;
    }
  }

  // Update PMS Config. When groupId is provided, updates enterpriseGroups/{groupId}/companies/{companyId}.
  // Otherwise updates root companies/{companyId} (legacy).
  static async updatePMSConfig(companyId: string, pmsConfig: Partial<PMSConfig>, groupId?: string): Promise<void> {
    const db = getFirestoreInstance()
    try {
      const docRef = groupId
        ? doc(db, 'enterpriseGroups', groupId, 'companies', companyId)
        : doc(db, 'companies', companyId);
      
      const updateData: any = {
        updatedAt: Timestamp.now()
      };

      if (pmsConfig.industry !== undefined) updateData['pmsConfig.industry'] = pmsConfig.industry;
      if (pmsConfig.description !== undefined) updateData['pmsConfig.description'] = pmsConfig.description;
      if (pmsConfig.features !== undefined) updateData['pmsConfig.features'] = pmsConfig.features;
      if (pmsConfig.equipmentTypes !== undefined) updateData['pmsConfig.equipmentTypes'] = pmsConfig.equipmentTypes;
      if (pmsConfig.manufacturingPhases !== undefined) updateData['pmsConfig.manufacturingPhases'] = pmsConfig.manufacturingPhases;
      if (pmsConfig.qualityStandards !== undefined) updateData['pmsConfig.qualityStandards'] = pmsConfig.qualityStandards;
      if (pmsConfig.complianceRequirements !== undefined) updateData['pmsConfig.complianceRequirements'] = pmsConfig.complianceRequirements;

      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error('Error updating PMS config:', error);
      throw error;
    }
  }
}

// Company User Service
export class CompanyUserService {
  // Get company users. Always uses enterprise path (effectiveGroupId = groupId || companyId).
  static async getCompanyUsers(companyId: string, groupId?: string): Promise<CompanyUser[]> {
    const db = getFirestoreInstance()
    try {
      const effectiveGroupId = groupId || companyId
      const usersRef = collection(db, 'enterpriseGroups', effectiveGroupId, 'companies', companyId, 'users')
      const q = query(usersRef, orderBy('joinedAt', 'desc'))
      const snapshot = await getDocs(q)
      return snapshot.docs.map(d => ({
        id: d.id,
        ...convertTimestamps(d.data())
      } as CompanyUser))
    } catch (error) {
      console.error('Error getting company users:', error)
      throw error
    }
  }

  /**
   * Get enterprise group user doc (enterpriseGroups/{groupId}/users/{userId}).
   * Used to resolve per-company role from roles[companyId] when company-level user doc does not exist.
   */
  static async getEnterpriseGroupUser(
    groupId: string,
    userId: string
  ): Promise<{ roles?: Record<string, string>; companyIds?: string[] } | null> {
    const db = getFirestoreInstance()
    try {
      const ref = doc(db, 'enterpriseGroups', groupId, 'users', userId)
      const snap = await getDoc(ref)
      if (!snap.exists()) return null
      const data = snap.data() as { roles?: Record<string, string>; companyIds?: string[] }
      return { roles: data.roles, companyIds: data.companyIds }
    } catch (error) {
      console.error('Error getting enterprise group user:', error)
      return null
    }
  }

  // Get a specific company user by ID. Always uses enterprise path (effectiveGroupId = groupId || companyId).
  static async getCompanyUser(companyId: string, userId: string, groupId?: string): Promise<CompanyUser | null> {
    const db = getFirestoreInstance()
    try {
      const effectiveGroupId = groupId || companyId
      const usersRef = collection(db, 'enterpriseGroups', effectiveGroupId, 'companies', companyId, 'users')
      const userDocRef = doc(usersRef, userId)
      const userDoc = await getDoc(userDocRef)
      if (userDoc.exists()) {
        return {
          id: userDoc.id,
          ...convertTimestamps(userDoc.data())
        } as CompanyUser
      }
      const q = query(
        usersRef,
        where('userId', '==', userId),
        limit(1)
      )
      const snapshot = await getDocs(q)
      if (!snapshot.empty && snapshot.docs[0]) {
        const d = snapshot.docs[0]
        return {
          id: d.id,
          ...convertTimestamps(d.data())
        } as CompanyUser
      }
      return null
    } catch (error: any) {
      if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
        console.warn('getCompanyUser: permission denied (user may not be in group/company yet)', { companyId, userId, groupId })
        return null
      }
      console.error('Error getting company user:', error)
      throw error
    }
  }

  // Get user's companies
  static async getUserCompanies(userId: string): Promise<CompanyUser[]> {
    const db = getFirestoreInstance()
    try {
      const q = query(
        collection(db, 'companies'),
        where('adminUsers', 'array-contains', userId)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      } as CompanyUser));
    } catch (error) {
      console.error('Error getting user companies:', error);
      throw error;
    }
  }

  // Add user to company
  static async addUserToCompany(companyId: string, user: Omit<CompanyUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const db = getFirestoreInstance()
    try {
      const docRef = await addDoc(collection(db, `companies/${companyId}/users`), {
        ...user,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error adding user to company:', error);
      throw error;
    }
  }

  // Update user role in company
  static async updateUserRole(companyId: string, userId: string, role: string, permissions: any): Promise<void> {
    const db = getFirestoreInstance()
    try {
      const docRef = doc(db, `companies/${companyId}/users`, userId);
      await updateDoc(docRef, {
        role,
        permissions,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  }

  // Remove user from company
  static async removeUserFromCompany(companyId: string, userId: string): Promise<void> {
    const db = getFirestoreInstance()
    try {
      const docRef = doc(db, `companies/${companyId}/users`, userId);
      await updateDoc(docRef, {
        status: 'removed',
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error removing user from company:', error);
      throw error;
    }
  }
}

// Company Invitation Service
export class CompanyInvitationService {
  // Get company invitations
  static async getCompanyInvitations(companyId: string): Promise<CompanyInvitation[]> {
    const db = getFirestoreInstance()
    try {
      const q = query(
        collection(db, `companies/${companyId}/invitations`),
        orderBy('invitedAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      } as CompanyInvitation));
    } catch (error) {
      console.error('Error getting company invitations:', error);
      throw error;
    }
  }

  // Create invitation
  static async createInvitation(companyId: string, invitation: Omit<CompanyInvitation, 'id'>): Promise<string> {
    const db = getFirestoreInstance()
    try {
      const docRef = await addDoc(collection(db, `companies/${companyId}/invitations`), {
        ...invitation,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating invitation:', error);
      throw error;
    }
  }

  // Accept invitation
  static async acceptInvitation(companyId: string, invitationId: string, userId: string): Promise<void> {
    const db = getFirestoreInstance()
    try {
      const docRef = doc(db, `companies/${companyId}/invitations`, invitationId);
      await updateDoc(docRef, {
        status: 'accepted',
        acceptedAt: Timestamp.now(),
        acceptedBy: userId,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error accepting invitation:', error);
      throw error;
    }
  }

  // Cancel invitation
  static async cancelInvitation(companyId: string, invitationId: string): Promise<void> {
    const db = getFirestoreInstance()
    try {
      const docRef = doc(db, `companies/${companyId}/invitations`, invitationId);
      await updateDoc(docRef, {
        status: 'cancelled',
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      throw error;
    }
  }
}

// Company Activity Service
export class CompanyActivityService {
  // Get company activities
  static async getCompanyActivities(companyId: string, limitCount: number = 100): Promise<CompanyActivity[]> {
    const db = getFirestoreInstance()
    try {
      const q = query(
        collection(db, `companies/${companyId}/activities`),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      } as CompanyActivity));
    } catch (error) {
      console.error('Error getting company activities:', error);
      throw error;
    }
  }

  // Log activity
  static async logActivity(companyId: string, activity: Omit<CompanyActivity, 'id'>): Promise<string> {
    const db = getFirestoreInstance()
    try {
      const docRef = await addDoc(collection(db, `companies/${companyId}/activities`), {
        ...activity,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error logging activity:', error);
      throw error;
    }
  }
}

// Export all services
export const companyServices = {
  CompanyService,
  CompanyUserService,
  CompanyInvitationService,
  CompanyActivityService
};
