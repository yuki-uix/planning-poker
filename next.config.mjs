/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  output: 'standalone',
  webpack: (config, { isServer }) => {
    // 确保路径别名正确配置
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': '.',
    };
    
    // 添加模块解析规则
    config.resolve.modules = [
      'node_modules',
      '.',
    ];
    
    // 确保在服务器端和客户端都能正确解析
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    // 添加额外的解析规则
    config.resolve.extensions = ['.js', '.jsx', '.ts', '.tsx', '.json'];
    
    // React is already resolved by Next.js, no need to manually resolve
    
    return config;
  },
}

export default nextConfig

