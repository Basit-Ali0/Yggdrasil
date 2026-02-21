'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useScanStore } from '@/stores/scan-store';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Upload, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type {
    ScanStatusResponse,
    StartScanResponse,
    UploadDataResponse,
    ConfirmMappingResponse,
} from '@/lib/contracts';

interface RescanDialogProps {
    scanId: string;
    policyId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type RescanStep = 'checking' | 'ready' | 'reupload' | 'uploading' | 'scanning' | 'error';

export function RescanDialog({ scanId, policyId, open, onOpenChange }: RescanDialogProps) {
    const router = useRouter();
    const { currentScan } = useScanStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<RescanStep>('checking');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [scanDetails, setScanDetails] = useState<ScanStatusResponse | null>(null);

    // Fetch scan details and check data availability when dialog opens
    useEffect(() => {
        if (!open) return;

        setStep('checking');
        setErrorMsg(null);

        const checkAvailability = async () => {
            try {
                // Fetch scan details to get upload_id, mapping_id, etc.
                const scan = await api.get<ScanStatusResponse>(`/scan/${scanId}`);
                setScanDetails(scan);

                if (!scan.upload_id) {
                    setStep('reupload');
                    return;
                }

                // Check if upload data is still cached
                const check = await api.get<{ available: boolean }>(
                    `/data/check/${scan.upload_id}`,
                );

                if (check.available) {
                    setStep('ready');
                } else {
                    setStep('reupload');
                }
            } catch (err) {
                setErrorMsg(err instanceof Error ? err.message : 'Failed to check data availability');
                setStep('error');
            }
        };

        checkAvailability();
    }, [open, scanId]);

    const handleRescan = async () => {
        if (!scanDetails) return;

        setStep('scanning');

        try {
            const result = await api.post<StartScanResponse>('/scan/run', {
                audit_id: scanDetails.audit_id || scanId,
                policy_id: policyId,
                upload_id: scanDetails.upload_id,
                mapping_id: scanDetails.mapping_id,
                audit_name: scanDetails.audit_name || undefined,
            });

            toast.success('Rescan started', {
                description: 'Navigating to the new scan results.',
            });

            onOpenChange(false);
            router.push(`/dashboard/${result.scan_id}`);
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Failed to start rescan');
            setStep('error');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setStep('uploading');

        try {
            // 1. Upload the file
            const formData = new FormData();
            formData.append('file', file);
            const uploadData = await api.upload<UploadDataResponse>('/data/upload', formData);

            // 2. Auto-confirm mapping using previous scan's mapping config
            const mappingConfig = scanDetails?.mapping_config ?? {};
            const temporalScale = scanDetails?.temporal_scale ?? 1;

            const mapping = await api.post<ConfirmMappingResponse>('/data/mapping/confirm', {
                upload_id: uploadData.upload_id,
                mapping_config:
                    Object.keys(mappingConfig).length > 0
                        ? mappingConfig
                        : uploadData.suggested_mapping,
                temporal_scale: temporalScale,
                clarification_answers: [],
            });

            // 3. Run the scan
            setStep('scanning');

            const result = await api.post<StartScanResponse>('/scan/run', {
                audit_id: scanDetails?.audit_id || scanId,
                policy_id: policyId,
                upload_id: uploadData.upload_id,
                mapping_id: mapping.mapping_id,
                audit_name: scanDetails?.audit_name || undefined,
            });

            toast.success('Rescan started', {
                description: 'Navigating to the new scan results.',
            });

            onOpenChange(false);
            router.push(`/dashboard/${result.scan_id}`);
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Failed to upload and rescan');
            setStep('error');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Rescan with Updated Policies</DialogTitle>
                    <DialogDescription>
                        {step === 'checking' && 'Checking data availability...'}
                        {step === 'ready' && 'Re-run the scan with your updated policy rules?'}
                        {step === 'reupload' &&
                            'Your dataset is no longer cached. Please re-upload to rescan.'}
                        {step === 'uploading' && 'Uploading and mapping your data...'}
                        {step === 'scanning' && 'Running compliance scan...'}
                        {step === 'error' && 'Something went wrong.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {/* Checking state */}
                    {step === 'checking' && (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    )}

                    {/* Ready state */}
                    {step === 'ready' && (
                        <div className="text-center space-y-2">
                            <RefreshCw className="mx-auto h-10 w-10 text-primary" />
                            <p className="text-sm text-muted-foreground">
                                Your previous dataset is still available. The scan will use
                                your current policy rules against the same data.
                            </p>
                        </div>
                    )}

                    {/* Reupload state */}
                    {step === 'reupload' && (
                        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6">
                            <Upload className="h-8 w-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground text-center">
                                Upload your CSV dataset to run a new scan with the updated policies.
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="mr-2 h-4 w-4" />
                                Select CSV File
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </div>
                    )}

                    {/* Uploading state */}
                    {step === 'uploading' && (
                        <div className="flex flex-col items-center gap-3 py-6">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">
                                Uploading and mapping your data...
                            </p>
                        </div>
                    )}

                    {/* Scanning state */}
                    {step === 'scanning' && (
                        <div className="flex flex-col items-center gap-3 py-6">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">
                                Running compliance scan with updated policies...
                            </p>
                        </div>
                    )}

                    {/* Error state */}
                    {step === 'error' && (
                        <div className="flex flex-col items-center gap-3 py-4">
                            <AlertCircle className="h-8 w-8 text-destructive" />
                            <p className="text-sm text-destructive text-center">
                                {errorMsg || 'An unexpected error occurred.'}
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {step === 'ready' && (
                        <div className="flex w-full gap-2">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => onOpenChange(false)}
                            >
                                Cancel
                            </Button>
                            <Button className="flex-1" onClick={handleRescan}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Rescan
                            </Button>
                        </div>
                    )}

                    {step === 'error' && (
                        <div className="flex w-full gap-2">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => onOpenChange(false)}
                            >
                                Close
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={() => {
                                    setStep('checking');
                                    setErrorMsg(null);
                                }}
                            >
                                Retry
                            </Button>
                        </div>
                    )}

                    {(step === 'checking' || step === 'uploading' || step === 'scanning') && (
                        <Button variant="outline" className="w-full" disabled>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Please wait...
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
