export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getStorage } from 'firebase-admin/storage'
import { getFirebaseAdmin, verifyIdToken } from '@/lib/firebase-admin'

/**
 * POST /api/storage/upload
 * Server-side file upload endpoint to avoid CORS issues
 * Uploads files to Firebase Storage with proper authentication
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
    let decodedToken
    try {
      decodedToken = await verifyIdToken(token)
    } catch (error) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      )
    }

    // Get form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const path = formData.get('path') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!path) {
      return NextResponse.json(
        { error: 'No path provided' },
        { status: 400 }
      )
    }

    // Validate file type (for logo uploads, only images)
    if (path.includes('/logo/') && !file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only image files are allowed for logos.' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB for logos)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (path.includes('/logo/') && file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400 }
      )
    }

    // Upload to Firebase Storage using Admin SDK
    const adminApp = getFirebaseAdmin()
    if (!adminApp) {
      console.error('[API/Storage/Upload] Firebase Admin SDK NOT initialized')
      return NextResponse.json(
        { error: 'Internal Server Error - Firebase Admin SDK not available' },
        { status: 500 }
      )
    }
    if (!adminApp) {
      return NextResponse.json(
        { error: 'Internal Server Error - Firebase Admin SDK not available' },
        { status: 500 }
      )
    }
    const storage = getStorage(adminApp)

    // Try to find the correct bucket from the Admin App first, then fallback to common formats
    const projectId = adminApp.options.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'julley-platform-dev'
    const storageBucket = adminApp.options.storageBucket ||
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.GCS_BUCKET_NAME ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      `${projectId}.appspot.com`

    console.log(`[API/Storage/Upload] Attempting upload to bucket: ${storageBucket} for file: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`)

    const bucket = storage.bucket(storageBucket)
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const fileRef = bucket.file(path)

    try {
      await fileRef.save(fileBuffer, {
        metadata: {
          contentType: file.type,
          metadata: {
            uploadedBy: decodedToken.uid,
            uploadedAt: new Date().toISOString(),
          }
        }
      })
      console.log(`[API/Storage/Upload] File saved successfully: ${path}`)
    } catch (saveError: any) {
      console.error(`[API/Storage/Upload] fileRef.save() failed for ${path}:`, saveError)
      throw saveError
    }

    // Generate a signed URL
    let signedUrl: string;
    try {
      const [url] = await fileRef.getSignedUrl({
        action: 'read',
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year from now
      })
      signedUrl = url
    } catch (urlError: any) {
      console.warn(`[API/Storage/Upload] getSignedUrl() failed for ${path}, falling back to public URL format:`, urlError)
      // Fallback if signing fails (might be permission issue on service account)
      signedUrl = `https://storage.googleapis.com/${storageBucket}/${path}`
    }

    return NextResponse.json({
      success: true,
      url: signedUrl,
      path: path,
      name: file.name,
      size: file.size,
      contentType: file.type
    })
  } catch (error: any) {
    console.error('[API/Storage/Upload] Error uploading file:', error)
    if (error.stack) console.error(error.stack)

    // Handle specific GCP billing errors
    let errorMessage = error.message || 'Unknown error'
    let statusCode = 500

    // Check for billing account errors
    if (error.code === 403 || (error.error && error.error.code === 403)) {
      const billingError = error.error || error
      if (billingError.message && billingError.message.includes('billing account')) {
        errorMessage = 'Billing account issue: The GCP project billing account is disabled or delinquent. Please check your Google Cloud billing account status and ensure it is active.'
        statusCode = 503 // Service Unavailable
      } else if (billingError.reason === 'accountDisabled') {
        errorMessage = 'Billing account disabled: The billing account for this GCP project is disabled. Please contact your administrator to resolve the billing issue.'
        statusCode = 503
      }
    }

    // Check for uniform bucket-level access errors
    if (error.message && error.message.includes('uniform bucket-level access')) {
      errorMessage = 'Storage bucket has uniform bucket-level access enabled. Object-level ACLs are not supported. Using signed URLs instead.'
      // This should not happen now, but keep for backward compatibility
    }

    // Check for bucket access/permission errors
    if (error.code === 404 || (error.error && error.error.code === 404)) {
      errorMessage = 'Storage bucket not found. Please ensure the bucket exists and is accessible.'
      statusCode = 404
    }

    return NextResponse.json(
      {
        error: errorMessage,
        message: errorMessage,
        stage: 'api_catch_block',
        details: error.error || (error instanceof Error ? { message: error.message, stack: error.stack } : error)
      },
      { status: statusCode }
    )
  }
}
