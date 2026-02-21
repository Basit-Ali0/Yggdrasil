import type { Metadata } from 'next';
import { Inter, Playfair_Display, JetBrains_Mono } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/components/providers/auth-provider';
import './globals.css';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-sans',
    display: 'swap',
});

const playfair = Playfair_Display({
    subsets: ['latin'],
    variable: '--font-display',
    display: 'swap',
});

const jetbrains = JetBrains_Mono({
    subsets: ['latin'],
    variable: '--font-mono',
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'Yggdrasil',
    description:
        'Autonomous policy-to-data compliance engine. From policy PDF to enforcement in minutes.',
    keywords: ['compliance', 'policy', 'audit', 'AML', 'GDPR', 'SOC2'],
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html
            lang="en"
            className={`${inter.variable} ${playfair.variable} ${jetbrains.variable}`}
            suppressHydrationWarning
        >
            <body className="min-h-screen font-sans antialiased">
                <AuthProvider>
                    <TooltipProvider delayDuration={300}>
                        {children}
                    </TooltipProvider>
                </AuthProvider>
                <Toaster richColors position="bottom-right" />
            </body>
        </html>
    );
}
