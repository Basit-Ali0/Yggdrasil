'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useScanStore } from '@/stores/scan-store';
import { ErrorState } from '@/components/ui-custom/error-state';
import { Shield } from 'lucide-react';

export default function ScanRunningPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const scanId = searchParams.get('scan');

    const { currentScan, isPolling, error, pollScanStatus, stopPolling } = useScanStore();

    useEffect(() => {
        if (!scanId) return;

        pollScanStatus(scanId, (scan) => {
            if (scan.status === 'completed') {
                router.push(`/dashboard/${scanId}`);
            }
        });

        return () => stopPolling();
    }, [scanId, pollScanStatus, stopPolling, router]);

    if (error) {
        return (
            <ErrorState
                message={error}
                onRetry={() => {
                    if (scanId) {
                        pollScanStatus(scanId, (scan) => {
                            if (scan.status === 'completed') {
                                router.push(`/dashboard/${scanId}`);
                            }
                        });
                    }
                }}
            />
        );
    }

    const rulesProcessed = currentScan?.rules_processed ?? 0;
    const rulesTotal = currentScan?.rules_total ?? 10;
    const violationsFound = currentScan?.violation_count ?? 0;
    const progress = rulesTotal > 0 ? (rulesProcessed / rulesTotal) * 100 : 0;

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
            {/* Progress Ring */}
            <div className="relative mb-8">
                <svg viewBox="0 0 160 160" className="h-44 w-44">
                    {/* Background */}
                    <circle
                        cx="80" cy="80" r="68"
                        fill="none" stroke="var(--border)" strokeWidth="10"
                    />
                    {/* Progress */}
                    <circle
                        cx="80" cy="80" r="68"
                        fill="none" stroke="var(--azure)" strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 68}
                        strokeDashoffset={2 * Math.PI * 68 * (1 - progress / 100)}
                        transform="rotate(-90 80 80)"
                        style={{ transition: 'stroke-dashoffset 500ms ease-out' }}
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-pulse-ring">
                        <Shield className="h-12 w-12 text-azure" />
                    </div>
                </div>
            </div>

            {/* Status Text */}
            <h2 className="text-xl font-semibold">Scanning in progress...</h2>
            <p className="mt-2 text-muted-foreground">Analyzing your data against compliance rules</p>

            {/* Counters */}
            <div className="mt-8 grid grid-cols-3 gap-8">
                <div className="animate-counter-up">
                    <p className="font-display text-3xl font-bold">{rulesProcessed}</p>
                    <p className="text-xs text-muted-foreground">of {rulesTotal} rules</p>
                </div>
                <div className="animate-counter-up" style={{ animationDelay: '100ms' }}>
                    <p className="font-display text-3xl font-bold text-ruby">{violationsFound}</p>
                    <p className="text-xs text-muted-foreground">violations found</p>
                </div>
                <div className="animate-counter-up" style={{ animationDelay: '200ms' }}>
                    <p className="font-display text-3xl font-bold">{Math.round(progress)}%</p>
                    <p className="text-xs text-muted-foreground">complete</p>
                </div>
            </div>
        </div>
    );
}
