import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    }
  },
  images: {
    remotePatterns: [
      new URL('https://bwvfmsuklmtpakpmvxoz.supabase.co/storage/v1/object/public/**'),
      new URL('https://cgfxwzdosgzvbaqxndlp.supabase.co/storage/v1/object/public/**'),
    ],
  }
};

export default nextConfig;
