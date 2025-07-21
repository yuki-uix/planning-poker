/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用standalone输出，优化部署
  output: 'standalone',
  
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 在客户端构建中排除服务器端模块
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        dns: false,
        fs: false,
        path: false,
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

