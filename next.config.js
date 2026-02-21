/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    serverExternalPackages: ['unpdf'],
};

module.exports = nextConfig;
