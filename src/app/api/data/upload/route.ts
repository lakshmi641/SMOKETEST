import { NextRequest, NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { fileValidationService } from '@/lib/services/analytics/file-validation-service';

/**
 * POST /api/data/upload
 * Unified endpoint to upload multiple data files (sales or master data) to GCP bucket
 * Files will be processed by Firebase Functions which will load them into ClickHouse
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const companyId = formData.get('companyId') as string;

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    if (!companyId) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      );
    }

    // Supported file formats
    const supportedExtensions = ['xlsx', 'xls', 'csv', 'parquet'];
    const supportedMimeTypes = [
      // Excel
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
      // CSV
      'text/csv',
      'application/csv',
      'text/plain',
      // Parquet
      'application/parquet',
      'application/x-parquet',
    ];

    // Validate file formats and process uploads
    const results: Array<{
      fileName: string;
      uploadedFileName: string;
      filePath: string;
      fileType: string;
      status: 'success' | 'error';
      size: number;
      error?: string;
    }> = [];

    const errors: Array<{
      fileName: string;
      error: string;
    }> = [];

    const storage = new Storage();
    const bucketName = process.env.GCS_BUCKET_NAME || process.env.GCP_BUCKET_NAME || 'julley-pms-dev';
    const bucket = storage.bucket(bucketName);

    // Generate timestamp for this batch
    // Format: YYYYMMDD_HHMMSS
    const now = new Date();
    const timestampFormatted = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;

    // Process each file
    for (const file of files) {
      const fileName = file.name;
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

      // Validate file format
      if (!supportedExtensions.includes(fileExtension)) {
        errors.push({
          fileName,
          error: `Unsupported file format. Supported formats: ${supportedExtensions.join(', ')}`,
        });
        continue;
      }

      // Check MIME type (optional check, extension is primary)
      const mimeType = file.type;
      if (mimeType && !supportedMimeTypes.some(mt => mimeType.includes(mt.split('/')[1] || mt))) {
        // MIME type check is lenient - if extension is valid, proceed
      }

      // Detect file type from filename
      const fileType = fileValidationService.detectFileType(fileName);
      if (!fileType) {
        errors.push({
          fileName,
          error: 'Could not determine file type from filename. Ensure filename contains "sales", "item", "account", etc.',
        });
        continue;
      }

      // Generate timestamped filename
      const fileNameWithoutExt = fileName.replace(/\.(xlsx|xls|csv|parquet)$/i, '');
      const uploadedFileName = `${fileNameWithoutExt}_${timestampFormatted}.${fileExtension}`;

      // Determine upload path based on file type
      let uploadPath: string;
      if (fileType === 'sales') {
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        uploadPath = `raw/sales/${year}/${month}/${uploadedFileName}`;
      } else {
        // Master data files
        const folderMap: Record<string, string> = {
          item: 'items',
          account: 'accounts',
          customer_type: 'customer-types',
          industry_type: 'industry-types',
          region: 'regions',
          sale_type: 'sale-types',
          model: 'models',
        };
        const folderName = folderMap[fileType] || fileType.replace('_', '-') + 's';
        uploadPath = `raw/master-data/${folderName}/${uploadedFileName}`;
      }

      // Upload file to GCP
      try {
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const gcsFile = bucket.file(uploadPath);
        await gcsFile.save(fileBuffer, {
          metadata: {
            contentType: file.type || getContentType(fileExtension),
          },
        });

        results.push({
          fileName,
          uploadedFileName,
          filePath: uploadPath,
          fileType,
          status: 'success',
          size: file.size,
        });
      } catch (uploadError) {
        const errorMessage = uploadError instanceof Error ? uploadError.message : 'Unknown upload error';
        errors.push({
          fileName,
          error: `Failed to upload to GCP: ${errorMessage}`,
        });
      }
    }

    // Return results
    const successCount = results.length;
    const errorCount = errors.length;
    const totalCount = files.length;

    return NextResponse.json({
      success: successCount > 0,
      message: successCount > 0
        ? `Successfully uploaded ${successCount} of ${totalCount} file(s) to GCP bucket. Firebase Functions will process them shortly.`
        : `Failed to upload ${errorCount} file(s).`,
      results,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total: totalCount,
        successful: successCount,
        failed: errorCount,
      },
    });
  } catch (error) {
    console.error('File upload error:', error);
    
    // Enhanced authentication error detection
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorString = JSON.stringify(error);
    
    const authErrorPatterns = [
      'Authentication',
      'invalid_grant',
      'invalid_rapt',
      'reauth',
      'Could not load the default credentials',
      'Could not refresh access token',
      'unauthorized',
      'Unauthorized',
      'credentials',
      'Credential',
      'access_denied',
      'Access Denied',
    ];
    
    const isAuthError = authErrorPatterns.some(pattern => 
      errorMessage.includes(pattern) || 
      errorString.includes(pattern)
    ) ||
    (error as any)?.code === 'UNAUTHENTICATED' ||
    (error as any)?.statusCode === 401 ||
    (error as any)?.statusCode === 403;
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upload files',
        message: errorMessage,
        isAuthError,
        suggestion: isAuthError 
          ? 'Please ensure GCP authentication is configured. Run: gcloud auth application-default login'
          : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Get content type based on file extension
 */
function getContentType(extension: string): string {
  const contentTypeMap: Record<string, string> = {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    csv: 'text/csv',
    parquet: 'application/parquet',
  };
  return contentTypeMap[extension] || 'application/octet-stream';
}

