export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getStorage } from 'firebase-admin/storage'
import { getFirebaseAdmin, verifyIdToken } from '@/lib/firebase-admin'

/**
 * GET /api/storage/download?path=<storagePath>&filename=<downloadName>
 *
 * Server-side file download endpoint to sidestep browser CORS restrictions.
 * The browser cannot directly fetch Firebase Storage URLs cross-origin,
 * so this route acts as a proxy: it fetches the file via Admin SDK and
 * streams it back with Content-Disposition: attachment to trigger a download.
 *
 * Authentication: Bearer token required in Authorization header.
 */
export async function GET(request: NextRequest) {
    try {
        // ── 1. Authenticate the user ──────────────────────────────────────────
        const authHeader = request.headers.get('authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Unauthorized - Missing or invalid authorization token' },
                { status: 401 }
            )
        }

        const token = authHeader.replace('Bearer ', '')
        try {
            await verifyIdToken(token)
        } catch {
            return NextResponse.json(
                { error: 'Unauthorized - Invalid token' },
                { status: 401 }
            )
        }

        // ── 2. Read query parameters ──────────────────────────────────────────
        const { searchParams } = new URL(request.url)
        const storagePath = searchParams.get('path')     // Firebase Storage path or signed URL
        const filename = searchParams.get('filename') || 'download'

        if (!storagePath) {
            return NextResponse.json(
                { error: 'Missing required query parameter: path' },
                { status: 400 }
            )
        }

        // ── 3. Initialise Firebase Admin SDK ──────────────────────────────────
        const adminApp = getFirebaseAdmin()
        if (!adminApp) {
            return NextResponse.json(
                { error: 'Internal Server Error - Firebase Admin SDK not available' },
                { status: 500 }
            )
        }

        const storage = getStorage(adminApp)
        const projectId = adminApp.options.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'julley-platform-dev'
        const storageBucket =
            adminApp.options.storageBucket ||
            process.env.FIREBASE_STORAGE_BUCKET ||
            process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
            `${projectId}.appspot.com`

        const bucket = storage.bucket(storageBucket)

        // ── 4. Determine whether storagePath is a signed URL or a plain path ──
        let resolvedPath: string

        if (storagePath.startsWith('http')) {
            // Extract the object path from a signed URL
            try {
                const url = new URL(storagePath)

                if (url.hostname === 'firebasestorage.googleapis.com') {
                    // Firebase Storage URL — path encoded after /o/
                    const oIndex = url.pathname.indexOf('/o/')
                    resolvedPath = oIndex !== -1
                        ? decodeURIComponent(url.pathname.slice(oIndex + 3))
                        : url.pathname
                } else {
                    // GCS signed URL — path is everything after /<bucket>/
                    resolvedPath = url.pathname.replace(`/${storageBucket}/`, '')
                    // Handle potential leading slash if it wasn't stripped correctly
                    if (resolvedPath.startsWith('/')) resolvedPath = resolvedPath.slice(1)
                }
            } catch {
                resolvedPath = storagePath // fallback: use as-is
            }
        } else {
            // Already a plain storage path
            resolvedPath = storagePath
        }

        // ── 5. Download file from Firebase Storage ────────────────────────────
        const fileRef = bucket.file(resolvedPath)

        let fileBuffer: Buffer
        let contentType = 'application/octet-stream'

        try {
            const [fileContents] = await fileRef.download()
            fileBuffer = fileContents

            // Fetch metadata for correct Content-Type
            const [metadata] = await fileRef.getMetadata()
            contentType = metadata.contentType || contentType
        } catch (storageError: any) {
            console.error('[API/Storage/Download] Failed to fetch file:', storageError)

            if (storageError.code === 404) {
                return NextResponse.json(
                    { error: 'File not found in storage' },
                    { status: 404 }
                )
            }

            return NextResponse.json(
                { error: 'Failed to retrieve file from storage' },
                { status: 500 }
            )
        }

        // ── 6. Stream file back to browser with download headers ──────────────
        const sanitizedFilename = filename.replace(/[^\x20-\x7E]/g, '_')

        return new NextResponse(new Uint8Array(fileBuffer), {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${sanitizedFilename}"`,
                'Content-Length': String(fileBuffer.length),
                'Cache-Control': 'private, no-cache',
            },
        })
    } catch (error: any) {
        console.error('[API/Storage/Download] Unhandled error:', error)
        return NextResponse.json(
            { error: error.message || 'Internal Server Error' },
            { status: 500 }
        )
    }
}
