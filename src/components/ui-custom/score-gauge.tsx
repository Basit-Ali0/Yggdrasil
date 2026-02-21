'use client';

import { cn } from '@/lib/utils';

interface ScoreGaugeProps {
    score: number; // 0-100
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

function getScoreColor(score: number): string {
    if (score >= 80) return 'text-emerald';
    if (score >= 50) return 'text-amber';
    return 'text-ruby';
}

function getStrokeColor(score: number): string {
    if (score >= 80) return 'var(--emerald)';
    if (score >= 50) return 'var(--amber)';
    return 'var(--ruby)';
}

function getScoreLabel(score: number): string {
    if (score >= 80) return 'Good';
    if (score >= 50) return 'Warning';
    return 'Critical';
}

const sizeConfig = {
    sm: { viewBox: 80, strokeWidth: 6, radius: 34, fontSize: 'text-lg' },
    md: { viewBox: 120, strokeWidth: 8, radius: 50, fontSize: 'text-3xl' },
    lg: { viewBox: 160, strokeWidth: 10, radius: 68, fontSize: 'text-5xl' },
};

export function ScoreGauge({ score, size = 'md', className }: ScoreGaugeProps) {
    const config = sizeConfig[size];
    const circumference = 2 * Math.PI * config.radius;
    const safeScore = Math.max(0, Math.min(100, score));
    const offset = circumference - (safeScore / 100) * circumference;
    const center = config.viewBox / 2;

    return (
        <div className={cn('relative inline-flex flex-col items-center', className)}>
            <svg
                viewBox={`0 0 ${config.viewBox} ${config.viewBox}`}
                className={cn(
                    size === 'sm' && 'h-20 w-20',
                    size === 'md' && 'h-32 w-32',
                    size === 'lg' && 'h-44 w-44',
                )}
            >
                {/* Background circle */}
                <circle
                    cx={center}
                    cy={center}
                    r={config.radius}
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth={config.strokeWidth}
                />
                {/* Score arc */}
                <circle
                    cx={center}
                    cy={center}
                    r={config.radius}
                    fill="none"
                    stroke={getStrokeColor(safeScore)}
                    strokeWidth={config.strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    transform={`rotate(-90 ${center} ${center})`}
                    style={{ transition: 'stroke-dashoffset 500ms ease-out' }}
                />
            </svg>
            {/* Score number */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn('font-display font-bold', config.fontSize, getScoreColor(safeScore))}>
                    {Math.round(safeScore)}%
                </span>
                {size !== 'sm' && (
                    <span className="text-xs text-muted-foreground">{getScoreLabel(safeScore)}</span>
                )}
            </div>
        </div>
    );
}
