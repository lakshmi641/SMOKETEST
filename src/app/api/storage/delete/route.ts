export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getStorage } from 'firebase-admin/storage'
import { getFirebaseAdmin, verifyIdToken } from '@/lib/firebase-admin'

/**
 * POST /api/storage/delete
 * Server-side file deletion endpoint to avoid CORS and client-side SDK issues
 */
export async function POST(request: NextRequest) {
    try {
        // Get authentication token from headers
        const authHeader = request.headers.get('authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Unauthorized - Missing or invalid authorization token' },
                { status: 401 }
            )
        }

        const token = authHeader.replace('Bearer ', '')

        // Verify the token
        try {
            await verifyIdToken(token)
        } catch (error) {
            return NextResponse.json(
                { error: 'Unauthorized - Invalid token' },
                { status: 401 }
            )
        }

        // Get request body
        const { path } = await request.json()

        if (!path) {
            return NextResponse.json(
                { error: 'No path provided' },
                { status: 400 }
            )
        }

        // Initialize Firebase Admin SDK
        const adminApp = getFirebaseAdmin()
        if (!adminApp) {
            console.error('[API/Storage/Delete] Firebase Admin SDK NOT initialized')
            return NextResponse.json(
                { error: 'Internal Server Error - Firebase Admin SDK not available' },
                { status: 500 }
            )
        }

        const storage = getStorage(adminApp)
        const projectId = adminApp.options.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'julley-platform-dev'
        const storageBucket = adminApp.options.storageBucket ||
            process.env.FIREBASE_STORAGE_BUCKET ||
            process.env.GCS_BUCKET_NAME ||
            process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
            `${projectId}.appspot.com`

        const bucket = storage.bucket(storageBucket)
        const fileRef = bucket.file(path)

        try {
            const [exists] = await fileRef.exists()
            if (exists) {
                await fileRef.delete()
                console.log(`[API/Storage/Delete] File deleted successfully: ${path}`)
            } else {
                console.warn(`[API/Storage/Delete] File not found, skipping storage deletion: ${path}`)
            }
        } catch (deleteError: any) {
            console.error(`[API/Storage/Delete] fileRef.delete() failed for ${path}:`, deleteError)
            // If it's a 404, we treat it as success (already deleted)
            if (deleteError.code !== 404) {
                throw deleteError
            }
        }

        return NextResponse.json({
            success: true,
            message: 'File deleted successfully or not found'
        })
    } catch (error: any) {
        console.error('[API/Storage/Delete] Error deleting file:', error)
        return NextResponse.json(
            {
                error: error.message || 'Unknown error',
                message: error.message || 'Unknown error'
            },
            { status: 500 }
        )
    }
}
