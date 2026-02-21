import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: LucideIcon;
    variant?: 'default' | 'critical' | 'warning' | 'success';
    subtitle?: string;
    className?: string;
}

const variantStyles = {
    default: {
        icon: 'bg-primary/10 text-primary',
        value: 'text-foreground',
    },
    critical: {
        icon: 'bg-ruby/10 text-ruby',
        value: 'text-ruby',
    },
    warning: {
        icon: 'bg-amber/10 text-amber',
        value: 'text-amber',
    },
    success: {
        icon: 'bg-emerald/10 text-emerald',
        value: 'text-emerald',
    },
};

export function StatCard({
    title,
    value,
    icon: Icon,
    variant = 'default',
    subtitle,
    className,
}: StatCardProps) {
    const styles = variantStyles[variant];

    return (
        <Card className={cn('transition-shadow hover:shadow-md', className)}>
            <CardContent className="p-5">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <p className={cn('font-display text-2xl font-bold', styles.value)}>
                            {value}
                        </p>
                        {subtitle && (
                            <p className="text-xs text-muted-foreground">{subtitle}</p>
                        )}
                    </div>
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', styles.icon)}>
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
