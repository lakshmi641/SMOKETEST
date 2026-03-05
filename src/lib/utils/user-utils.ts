import type { User } from '@/types'
import { Timestamp } from 'firebase/firestore'

/**
 * Standardizes Firestore user data into the User interface.
 * Handles multiple phone number fallbacks and date conversions.
 */
export function mapFirestoreUser(id: string, data: any, extras: Partial<User> = {}): User {
    // Robust date handling
    const createdAt = typeof data.createdAt === 'string'
        ? data.createdAt
        : (data.createdAt as Timestamp)?.toDate?.()?.toISOString() || new Date().toISOString()

    const updatedAt = typeof data.updatedAt === 'string'
        ? data.updatedAt
        : (data.updatedAt as Timestamp)?.toDate?.()?.toISOString() || new Date().toISOString()

    // Robust phone number extraction
    // 1. Nested contact.phone (preferred)
    // 2. data.phoneNumber (Firebase Auth style)
    // 3. data.phone (Flat legacy style)
    // 4. data.mobile (Common CSV variant)
    // 5. data.contact_number (Common CSV variant)
    const phone = data.contact?.phone ||
        data.phoneNumber ||
        data.phone ||
        data.mobile ||
        data.contact_number ||
        ''

    return {
        id,
        email: (data.email as string) ?? '',
        name: (data.name as string) ?? '',
        role: (data.role as User['role']) ?? 'employee',
        position: (data.position as string) ?? '',
        companyId: (data.companyId as string) ?? (data.primaryCompanyId as string) ?? '',
        orgUnitId: data.orgUnitId as string | undefined,
        orgUnitName: data.orgUnitName as string | undefined,
        avatar: data.avatar as string | undefined,
        skills: Array.isArray(data.skills) ? (data.skills as string[]) : [],
        contact: {
            phone: phone || (data.contact?.phone as string) || '',
            slack: (data.contact?.slack as string) ?? ''
        },
        spocTeams: data.spocTeams as string[] | undefined,
        positionCode: data.positionCode as string | undefined,
        designation: data.designation as string | undefined,
        createdAt,
        updatedAt,
        ...extras
    } as User
}
