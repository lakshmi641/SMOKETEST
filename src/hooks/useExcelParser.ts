/**
 * useExcelParser Hook
 * 
 * React hook for parsing Excel files with state management.
 * Provides loading states, error handling, and parsed data.
 * 
 * @module hooks/useExcelParser
 */

import { useState, useCallback } from 'react'
import {
    parseExcelFile,
    validateFile,
    ParseResult,
    downloadTemplate,
} from '@/lib/utils/excel/excel-parser'
import { ImportDialogState } from '@/types/excel-import'

/**
 * Hook return type
 */
interface UseExcelParserReturn {
    /** Current dialog state */
    state: ImportDialogState
    /** Parsed data (null if not parsed yet) */
    parseResult: ParseResult | null
    /** Error message (null if no error) */
    error: string | null
    /** Currently selected file */
    file: File | null
    /** Parse a file */
    parseFile: (file: File) => Promise<void>
    /** Reset state */
    reset: () => void
    /** Download template */
    downloadTemplate: () => void
    /** Set state manually */
    setState: (state: ImportDialogState) => void
}

/**
 * React hook for Excel file parsing.
 * Manages parsing state, errors, and results.
 * 
 * @returns Hook state and functions
 * 
 * @example
 * const { state, parseResult, error, parseFile, reset } = useExcelParser()
 * 
 * const handleFileDrop = async (file: File) => {
 *   await parseFile(file)
 *   if (parseResult) {
 *     console.log('Parsed rows:', parseResult.rows)
 *   }
 * }
 */
export function useExcelParser(): UseExcelParserReturn {
    const [state, setState] = useState<ImportDialogState>('idle')
    const [parseResult, setParseResult] = useState<ParseResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [file, setFile] = useState<File | null>(null)

    /**
     * Parse an Excel file.
     */
    const parseFile = useCallback(async (selectedFile: File): Promise<void> => {
        // Validate file first
        const validation = validateFile(selectedFile)
        if (!validation.valid) {
            setError(validation.error || 'Invalid file')
            setState('error')
            return
        }

        setFile(selectedFile)
        setState('parsing')
        setError(null)
        setParseResult(null)

        try {
            const result = await parseExcelFile(selectedFile)
            setParseResult(result)
            setState('previewing')
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to parse Excel file'
            setError(message)
            setState('error')
        }
    }, [])

    /**
     * Reset all state.
     */
    const reset = useCallback((): void => {
        setState('idle')
        setParseResult(null)
        setError(null)
        setFile(null)
    }, [])

    return {
        state,
        parseResult,
        error,
        file,
        parseFile,
        reset,
        downloadTemplate,
        setState,
    }
}

export default useExcelParser
