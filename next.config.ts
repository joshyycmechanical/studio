
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  devIndicators: {
    allowedDevOrigins: [
      'https://6000-idx-studio-1746405692549.cluster-t23zgfo255e32uuvburngnfnn4.cloudworkstations.dev',
      // Add the new port to allowedDevOrigins
      'https://9003-idx-studio-1746405692549.cluster-t23zgfo255e32uuvburngnfnn4.cloudworkstations.dev',
    ],
  },
};

export default nextConfig;
