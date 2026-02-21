export const metadata = {
    title: 'PolicyGuard AI',
    description: 'Autonomous policy-to-data compliance engine',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
