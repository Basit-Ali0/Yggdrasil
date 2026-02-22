// ============================================================
// POST /api/data/upload — CSV upload + schema detection + mapping
// Response per CONTRACTS.md Screen 3→4
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';
import { v4 as uuid } from 'uuid';
import { detectDataset, getTemporalScale, getDefaultMapping, getDefaultMappingWithConfidence } from '@/lib/engine/schema-adapter';
import { geminiGenerateObject } from '@/lib/gemini';
import { z } from 'zod';

import { uploadStore } from '@/lib/upload-store';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'No file provided' },
                { status: 400 }
            );
        }

        // Parse CSV
        const text = await file.text();
        const parseResult = Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
        });

        if (parseResult.errors.length > 0 && parseResult.data.length === 0) {
            return NextResponse.json(
                { error: 'VALIDATION_ERROR', message: 'Failed to parse CSV', details: parseResult.errors.slice(0, 5) },
                { status: 400 }
            );
        }

        const rows = parseResult.data as Record<string, any>[];
        const headers = parseResult.meta.fields ?? Object.keys(rows[0] ?? {});

        // Detect dataset type
        const detectedDataset = detectDataset(headers);
        const temporalScale = getTemporalScale(detectedDataset);
        const suggestedMapping = getDefaultMapping(detectedDataset);

        // Get confidence values — 100% for known datasets, Gemini for GENERIC
        let mappingConfidence: Record<string, number> = {};
        const withConfidence = getDefaultMappingWithConfidence(detectedDataset);
        for (const [field, { confidence }] of Object.entries(withConfidence)) {
            mappingConfidence[field] = confidence;
        }

        // If no default mapping, try Gemini for column mapping (graceful: empty on failure)
        let finalMapping = suggestedMapping;
        if (Object.keys(suggestedMapping).length === 0) {
            try {
                const MappingSchema = z.object({
                    dataset_type: z.enum(['IBM_AML', 'PAYSIM', 'GENERIC']),
                    suggested_scale: z.number(),
                    mappings: z.array(z.object({
                        standard_field: z.string(),
                        csv_header: z.string(),
                        confidence: z.number(),
                        reasoning: z.string(),
                    })),
                });

                const result = await geminiGenerateObject({
                    schema: MappingSchema,
                    system: 'You are a data engineer. Map raw CSV headers to the standard schema: amount, step (timestamp), account (sender_id), recipient (receiver_id), type (transaction_type).',
                    prompt: `Map these CSV headers to the standard schema.\n\nHeaders: ${headers.join(', ')}\n\nSample data (first 3 rows):\n${JSON.stringify(rows.slice(0, 3), null, 2)}`,
                });

                finalMapping = {};
                mappingConfidence = {};
                for (const m of result.mappings) {
                    finalMapping[m.standard_field] = m.csv_header;
                    mappingConfidence[m.standard_field] = Math.round(m.confidence * 100);
                }
            } catch {
                // Gemini failed — continue with empty mapping, user will configure manually
                console.warn('[upload] Gemini column mapping failed, using empty mapping');
                finalMapping = {};
            }
        }

        // Clarification questions — advisory only, return empty if Gemini fails
        let clarificationQuestions: any[] = [];
        // Per hard rules: Agent 6 (Clarification Questions) — if Gemini fails return [] silently
        // We skip calling Gemini for clarification in MVP to save API rate limits

        // Store upload in memory with basic metadata for ML scoring
        const uploadId = uuid();
        
        // Calculate basic metadata
        const metadata = {
            totalRows: rows.length,
            columnStats: {} as any
        };

        headers.forEach(h => {
            const values = rows.map(r => r[h]).filter(v => v !== null && v !== undefined);
            const isNumeric = values.every(v => typeof v === 'number');
            const uniqueValues = new Set(values);
            
            metadata.columnStats[h] = {
                type: isNumeric ? 'numeric' : 'categorical',
                cardinality: uniqueValues.size,
                ...(isNumeric && values.length > 0 ? {
                    min: Math.min(...values as number[]),
                    max: Math.max(...values as number[]),
                    mean: (values as number[]).reduce((a, b) => a + b, 0) / values.length
                } : {})
            };
        });

        uploadStore.set(uploadId, { rows, headers, fileName: file.name, metadata });

        // Response per CONTRACTS.md
        return NextResponse.json({
            upload_id: uploadId,
            row_count: rows.length,
            headers,
            sample_rows: rows.slice(0, 5),
            detected_dataset: detectedDataset,
            suggested_mapping: finalMapping,
            mapping_confidence: mappingConfidence,
            temporal_scale: temporalScale,
            clarification_questions: clarificationQuestions,
            metadata: metadata // Included for internal verification
        });

    } catch (err) {
        console.error('POST /api/data/upload error:', err);
        return NextResponse.json(
            { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}
