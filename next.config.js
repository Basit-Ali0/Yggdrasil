/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    serverExternalPackages: ['unpdf'],
    env: {
        NEXT_PUBLIC_SUPABASE_URL: 'https://wfcxaekocpfwkydphbtq.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_bYoGnnymUJmLekgnCov3DA_yMh740th',
        NEXT_PUBLIC_DEMO_MODE: 'false',
    },
};

module.exports = nextConfig;
