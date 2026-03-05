import { NextRequest, NextResponse } from 'next/server';
import { fileValidationService, type FileType } from '@/lib/services/analytics/file-validation-service';

/**
 * POST /api/pipeline/validate
 * Validate file format and field mapping
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileTypeParam = formData.get('fileType') as string | null;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: 'No file provided',
        },
        { status: 400 }
      );
    }

    // Convert File to Buffer for validation
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate file
    const fileType: FileType | undefined = fileTypeParam
      ? (fileTypeParam as FileType)
      : undefined;

    const validationResult = await fileValidationService.validateFile(
      buffer,
      file.name,
      fileType
    );

    return NextResponse.json({
      success: true,
      data: validationResult,
    });
  } catch (error) {
    console.error('Error validating file:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to validate file',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

