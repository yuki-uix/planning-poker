import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用standalone输出，优化部署
  output: 'standalone',
  
  webpack: (config, { isServer }) => {
    // 添加路径解析配置
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, './'),
    };
    
    if (!isServer) {
      // 在客户端构建中排除服务器端模块
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        dns: false,
        fs: false,
        // 移除 path: false，避免影响路径解析
        os: false,
        crypto: false,
        stream: false,
        util: false,
        buffer: false,
        events: false,
        assert: false,
        constants: false,
        domain: false,
        http: false,
        https: false,
        punycode: false,
        querystring: false,
        string_decoder: false,
        timers: false,
        tty: false,
        url: false,
        vm: false,
        zlib: false,
      };
    }
    return config;
  },
  serverExternalPackages: ['ioredis']
};

export default nextConfig;

