import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('animate-pulse rounded-md bg-muted', className)}
            {...props}
        />
    );
}

/** Dashboard stat cards skeleton */
export function DashboardSkeleton() {
    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="space-y-1">
                <Skeleton className="h-7 w-64" />
                <Skeleton className="h-4 w-96" />
            </div>
            {/* Stat cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-xl border p-5 space-y-3">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-16" />
                    </div>
                ))}
            </div>
            {/* Table + chart */}
            <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 rounded-xl border p-6 space-y-4">
                    <Skeleton className="h-5 w-36" />
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-4">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-12" />
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 flex-1" />
                            <Skeleton className="h-4 w-20" />
                        </div>
                    ))}
                </div>
                <div className="rounded-xl border p-6 space-y-4">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-[200px] w-full" />
                </div>
            </div>
        </div>
    );
}

/** Rules list skeleton */
export function RulesListSkeleton() {
    return (
        <div className="space-y-3 animate-fade-in-up">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 rounded-xl border p-4">
                    <Skeleton className="h-5 w-10" />
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                            <Skeleton className="h-3 w-28" />
                            <Skeleton className="h-5 w-16" />
                        </div>
                        <Skeleton className="h-4 w-48" />
                    </div>
                </div>
            ))}
        </div>
    );
}

/** Cases table skeleton */
export function CasesTableSkeleton() {
    return (
        <div className="space-y-3">
            <div className="flex gap-4 px-1">
                {['Account', 'Violations', 'Severity', 'Rule', 'Amount'].map((h) => (
                    <Skeleton key={h} className="h-4" style={{ width: `${16 + h.length * 6}px` }} />
                ))}
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 rounded-lg border p-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-8" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-20 ml-auto" />
                </div>
            ))}
        </div>
    );
}

/** Generic page skeleton */
export function PageSkeleton() {
    return (
        <div className="space-y-6 py-8 animate-fade-in-up">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
            <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
            </div>
        </div>
    );
}

export { Skeleton };
