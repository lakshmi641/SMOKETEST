/**
 * Import Job Service
 * 
 * Stage 1 & 4: Client-side service for managing import jobs
 * 
 * This service handles:
 * - Creating import jobs (file upload + job doc creation)
 * - Subscribing to job status updates (real-time)
 * - Downloading validation results from GCS
 * - Triggering import execution
 */

import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    Timestamp,
    Unsubscribe
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getBytes } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../../firebase';
import { uploadFile } from '../storage/storage-service';
import {
    ImportJob,
    ImportJobStatus,
    CreateImportJobInput,
    UpdateImportJobInput,
    ValidationResultsFile,
    ImportJobQuery,
    getImportJobFilePaths,
    createDefaultStats
} from './types/import-job-types';
import { ValidatedRow } from './types/import-types';
import { companyCollectionPathSegments } from '../../firestore-paths';

// ============================================================================
// IMPORT JOB SERVICE
// ============================================================================

export class ImportJobService {

    // -------------------------------------------------------------------------
    // CREATE JOB
    // -------------------------------------------------------------------------

    /**
     * Create a new import job and upload the source file to GCS
     * 
     * @param file - The Excel file to upload
     * @param input - Job creation parameters
     * @returns The generated jobId (Processing ID)
     */
    static async createJob(
        file: File,
        input: CreateImportJobInput
    ): Promise<string> {
        console.log('[ImportJobService] createJob input:', {
            companyId: input.companyId,
            groupId: input.groupId,
            importType: input.importType
        });
        // 1. Generate a unique job ID
        const jobsCollection = input.groupId
            ? collection(db, ...companyCollectionPathSegments(input.groupId, input.companyId, 'importJobs'))
            : collection(db, `companies/${input.companyId}/importJobs`);
        const jobRef = doc(jobsCollection);
        const jobId = jobRef.id;

        // 2. Get file paths for GCS
        const paths = getImportJobFilePaths(input.companyId, jobId, file.name, input.groupId);

        try {
            await uploadFile(file, paths.sourceFile);
        } catch (uploadError: any) {
            console.error('[ImportJobService] Failed to upload file:', uploadError);
            // Re-throw the original error message to avoid "Failed to upload file: Failed to upload file"
            throw new Error(uploadError.message);
        }

        // 4. Create the ImportJob document
        const now = Timestamp.now();
        const jobDoc: ImportJob = {
            id: jobId,
            companyId: input.companyId,
            groupId: input.groupId || null,
            userId: input.userId,
            userName: input.userName,
            workspaceId: input.workspaceId || null,
            projectId: input.projectId || null,
            importType: input.importType,
            fileName: input.fileName,
            fileSize: input.fileSize,
            sourceFileUrl: paths.sourceFile,
            columnMapping: input.columnMapping || null,
            status: 'uploaded',
            stats: createDefaultStats(),
            createdAt: now,
            updatedAt: now
        };

        await setDoc(jobRef, jobDoc);

        console.log(`[ImportJobService] Created job ${jobId} for file ${input.fileName}`);

        return jobId;
    }

    // -------------------------------------------------------------------------
    // GET JOB
    // -------------------------------------------------------------------------

    /**
     * Get a single import job by ID
     */
    static async getJob(companyId: string, jobId: string, groupId?: string): Promise<ImportJob | null> {
        const jobRef = groupId
            ? doc(db, ...companyCollectionPathSegments(groupId, companyId, 'importJobs'), jobId)
            : doc(db, `companies/${companyId}/importJobs`, jobId);
        const jobSnap = await getDoc(jobRef);

        if (!jobSnap.exists()) {
            return null;
        }

        return jobSnap.data() as ImportJob;
    }

    // -------------------------------------------------------------------------
    // SUBSCRIBE TO JOB (REAL-TIME)
    // -------------------------------------------------------------------------

    /**
     * Subscribe to real-time updates for an import job
     * 
     * Use this to show live status updates in the UI as the
     * Cloud Function processes the import.
     * 
     * @param companyId - Company ID
     * @param jobId - Job ID (Processing ID)
     * @param callback - Called whenever the job document changes
     * @returns Unsubscribe function
     */
    static subscribeToJob(
        companyId: string,
        jobId: string,
        callback: (job: ImportJob | null) => void,
        groupId?: string
    ): Unsubscribe {
        const jobRef = groupId
            ? doc(db, ...companyCollectionPathSegments(groupId, companyId, 'importJobs'), jobId)
            : doc(db, `companies/${companyId}/importJobs`, jobId);

        return onSnapshot(jobRef, (snapshot) => {
            if (snapshot.exists()) {
                callback(snapshot.data() as ImportJob);
            } else {
                callback(null);
            }
        }, (error) => {
            console.error('[ImportJobService] Subscription error:', error);
            callback(null);
        });
    }

    // -------------------------------------------------------------------------
    // GET VALIDATION RESULTS
    // -------------------------------------------------------------------------

    /**
     * Download and parse the validation results from GCS
     * 
     * The validation results are stored in GCS (not Firestore) to
     * avoid the 1MB document size limit. This file can be 10MB+
     * for large imports.
     */
    static async getValidationResults(
        companyId: string,
        jobId: string,
        groupId?: string
    ): Promise<ValidatedRow[]> {
        console.log('[ImportJobService] getValidationResults called with:', { companyId, jobId, groupId });
        // 1. Get the job to find the validation result URL
        const job = await this.getJob(companyId, jobId, groupId);

        if (!job) {
            throw new Error(`Import job ${jobId} not found`);
        }

        if (!job.validationResultUrl) {
            throw new Error('Validation results not available yet');
        }

        if (!storage) {
            throw new Error('Storage service is not available');
        }

        // 2. Get data using getBytes (more reliable for CORS)
        console.log(`[ImportJobService] Fetching validation results from: ${job.validationResultUrl}`);
        const storageRef = ref(storage, job.validationResultUrl);
        const bytes = await getBytes(storageRef);

        // 3. Parse the JSON
        const text = new TextDecoder().decode(bytes);
        const data: ValidationResultsFile = JSON.parse(text);

        return data.rows;
    }

    // -------------------------------------------------------------------------
    // UPDATE JOB (Internal use)
    // -------------------------------------------------------------------------

    /**
     * Update an import job (internal use by Cloud Functions)
     */
    static async updateJob(
        companyId: string,
        jobId: string,
        updates: UpdateImportJobInput,
        groupId?: string
    ): Promise<void> {
        const jobRef = groupId
            ? doc(db, ...companyCollectionPathSegments(groupId, companyId, 'importJobs'), jobId)
            : doc(db, `companies/${companyId}/importJobs`, jobId);

        await updateDoc(jobRef, {
            ...updates,
            updatedAt: Timestamp.now()
        });
    }

    // -------------------------------------------------------------------------
    // UPLOAD CORRECTED PAYLOAD
    // -------------------------------------------------------------------------

    /**
     * Upload user-corrected payload after reviewing/editing
     * 
     * When the user edits cells in the review table, we save the
     * corrected data to GCS before executing the import.
     */
    static async uploadCorrectedPayload(
        companyId: string,
        jobId: string,
        correctedRows: ValidatedRow[],
        groupId?: string
    ): Promise<string> {
        const paths = getImportJobFilePaths(companyId, jobId, 'source.xlsx', groupId);

        // Create the payload
        const payload: ValidationResultsFile = {
            jobId,
            validatedAt: new Date().toISOString(),
            summary: {
                totalRows: correctedRows.length,
                validRows: correctedRows.filter(r => r.status === 'success').length,
                errorRows: correctedRows.filter(r => r.status === 'error').length,
                warningRows: correctedRows.filter(r => r.status === 'warning').length
            },
            rows: correctedRows
        };

        // Upload to GCS
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        const storageRef = ref(storage, paths.correctedPayload);
        await uploadBytes(storageRef, blob);

        // Update job with corrected payload URL
        await this.updateJob(companyId, jobId, {
            correctedPayloadUrl: paths.correctedPayload
        }, groupId);

        return paths.correctedPayload;
    }

    // -------------------------------------------------------------------------
    // EXECUTE IMPORT
    // -------------------------------------------------------------------------

    /**
     * Trigger the import execution Cloud Function
     * 
     * This is called after the user reviews the validation results
     * and confirms they want to proceed with the import.
     */
    static async executeImport(
        companyId: string,
        jobId: string,
        correctedRows?: ValidatedRow[],
        groupId?: string
    ): Promise<void> {
        // If user provided corrected rows, upload them first
        if (correctedRows && correctedRows.length > 0) {
            await this.uploadCorrectedPayload(companyId, jobId, correctedRows, groupId);
        }

        // Call the Cloud Function to execute the import
        const executeImportJob = httpsCallable(functions, 'executeImportJob');

        try {
            await executeImportJob({ companyId, jobId, groupId });
        } catch (error: any) {
            console.error('[ImportJobService] Execute failed:', error);
            throw new Error(`Import execution failed: ${error.message}`);
        }
    }

    // -------------------------------------------------------------------------
    // QUERY IMPORT HISTORY
    // -------------------------------------------------------------------------

    /**
     * Query import job history with filters
     * 
     * Use this for the admin dashboard to show import history,
     * filter by user, status, date range, etc.
     */
    static async queryJobs(queryParams: ImportJobQuery): Promise<ImportJob[]> {
        const { companyId, groupId, userId, projectId, status, importType, startDate, endDate, limit: limitCount = 50 } = queryParams;

        const jobsRef = groupId
            ? collection(db, ...companyCollectionPathSegments(groupId, companyId, 'importJobs'))
            : collection(db, `companies/${companyId}/importJobs`);

        let q = query(jobsRef, orderBy('createdAt', 'desc'), limit(limitCount));

        // Add filters
        if (userId) {
            q = query(q, where('userId', '==', userId));
        }

        if (projectId) {
            q = query(q, where('projectId', '==', projectId));
        }

        if (status) {
            if (Array.isArray(status)) {
                q = query(q, where('status', 'in', status));
            } else {
                q = query(q, where('status', '==', status));
            }
        }

        if (importType) {
            q = query(q, where('importType', '==', importType));
        }

        // Note: Date range filters would require a composite index
        // For now, filter client-side if needed

        const snapshot = await getDocs(q);
        const jobs: ImportJob[] = [];

        snapshot.forEach((doc) => {
            const job = doc.data() as ImportJob;

            // Client-side date filtering
            if (startDate || endDate) {
                const jobDate = job.createdAt instanceof Timestamp
                    ? job.createdAt.toDate()
                    : new Date(job.createdAt);

                if (startDate && jobDate < startDate) return;
                if (endDate && jobDate > endDate) return;
            }

            jobs.push(job);
        });

        return jobs;
    }

    // -------------------------------------------------------------------------
    // GET USER'S RECENT JOBS
    // -------------------------------------------------------------------------

    /**
     * Get the current user's recent import jobs
     * 
     * Useful for showing "Your Recent Imports" in the UI
     */
    static async getRecentJobs(companyId: string, userId: string, count: number = 10, groupId?: string): Promise<ImportJob[]> {
        return this.queryJobs({
            companyId,
            groupId,
            userId,
            limit: count
        });
    }

    // -------------------------------------------------------------------------
    // GET PENDING JOBS
    // -------------------------------------------------------------------------

    /**
     * Get jobs that are in progress (not yet completed/failed)
     */
    static async getPendingJobs(companyId: string, userId: string, groupId?: string): Promise<ImportJob[]> {
        return this.queryJobs({
            companyId,
            groupId,
            userId,
            status: ['uploaded', 'validating', 'review', 'importing']
        });
    }
}
