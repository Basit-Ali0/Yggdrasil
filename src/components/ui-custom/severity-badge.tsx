import { cn } from '@/lib/utils';

interface SeverityBadgeProps {
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    className?: string;
}

const severityConfig = {
    CRITICAL: {
        label: 'Critical',
        className: 'bg-ruby/10 text-ruby border-ruby/20',
    },
    HIGH: {
        label: 'High',
        className: 'bg-amber/10 text-amber border-amber/20',
    },
    MEDIUM: {
        label: 'Medium',
        className: 'bg-muted text-muted-foreground border-border',
    },
};

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
    const config = severityConfig[severity];
    return (
        <span
            className={cn(
                'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
                config.className,
                className,
            )}
        >
            {config.label}
        </span>
    );
}
