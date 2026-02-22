'use client';

import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

interface ScoreEvent {
    score: number;
    timestamp: string;
    action: string;
    violation_id?: string | null;
}

interface ScoreHistoryChartProps {
    scoreHistory: ScoreEvent[];
    initialScore?: number;
    completedAt?: string | null;
}

function formatLabel(timestamp: string): string {
    const d = new Date(timestamp);
    return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function actionLabel(action: string): string {
    switch (action) {
        case 'scan_completed':
            return 'Scan completed';
        case 'false_positive':
            return 'Marked false positive';
        case 'approved':
            return 'Confirmed violation';
        default:
            return action;
    }
}

export function ScoreHistoryChart({ scoreHistory, initialScore, completedAt }: ScoreHistoryChartProps) {
    const data = useMemo(() => {
        const points: { label: string; score: number; action: string; timestamp: number }[] = [];

        // Add initial scan score as first data point if not already in history
        if (initialScore !== undefined && completedAt) {
            const hasInitial = scoreHistory.some((e) => e.action === 'scan_completed');
            if (!hasInitial) {
                points.push({
                    label: formatLabel(completedAt),
                    score: Math.round(initialScore * 10) / 10,
                    action: 'Scan completed',
                    timestamp: new Date(completedAt).getTime(),
                });
            }
        }

        // Add all score history events
        for (const event of scoreHistory) {
            points.push({
                label: formatLabel(event.timestamp),
                score: Math.round(event.score * 10) / 10,
                action: actionLabel(event.action),
                timestamp: new Date(event.timestamp).getTime(),
            });
        }

        // Sort chronologically
        points.sort((a, b) => a.timestamp - b.timestamp);

        return points;
    }, [scoreHistory, initialScore, completedAt]);

    // Only render when there are 2+ data points
    if (data.length < 2) {
        return null;
    }

    const minScore = Math.max(0, Math.floor(Math.min(...data.map((d) => d.score)) - 5));
    const maxScore = Math.min(100, Math.ceil(Math.max(...data.map((d) => d.score)) + 5));

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4 text-emerald" />
                    Compliance Trend
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="label"
                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                domain={[minScore, maxScore]}
                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v) => `${v}%`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    padding: '8px 12px',
                                }}
                                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                                formatter={(value, _name, props) => [
                                    `${value}%`,
                                    (props.payload as any)?.action ?? '',
                                ]}
                            />
                            <Area
                                type="monotone"
                                dataKey="score"
                                stroke="hsl(var(--primary))"
                                strokeWidth={2}
                                fill="url(#scoreGradient)"
                                dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                                activeDot={{ r: 5, fill: 'hsl(var(--primary))', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
