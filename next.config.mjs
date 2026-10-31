/** @type {import('next').NextConfig} */
export default {
  images: { unoptimized: true },
  trailingSlash: true,
  // The isolated Better Auth experiment is NodeNext TypeScript: local imports
  // intentionally name their eventual .js output. Next's server-only bundler
  // must map that extension to the checked-in .ts sources in this draft PR.
  // Do not modify the browser/client resolution pipeline.
  webpack(config, { isServer }) {
    if (isServer) {
      config.resolve.extensionAlias = {
        ...config.resolve.extensionAlias,
        ".js": [".js", ".ts", ".tsx"],
      };
    }
    return config;
  },
};
