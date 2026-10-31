/** @type {import('next').NextConfig} */
export default {
  images: { unoptimized: true },
  trailingSlash: true,
  // The isolated Better Auth experiment is NodeNext TypeScript: local imports
  // intentionally name their eventual .js output. Next's server-only bundler
  // must map that extension to the checked-in .ts sources in this draft PR.
  // Do not modify the browser/client resolution pipeline.
  // Invitation bearers arrive in URL fragments and must not be exposed to
  // external scripts, referrers, iframe embeds, service workers or indexing.
  // Next.js hydration currently needs inline script execution; remove the
  // unsafe-inline exception when per-request nonces are independently tested.
  async headers() {
    // Next dev uses eval-based HMR and a localhost websocket. Permit those
    // only for local development; staging retains the stricter policy.
    const localExperiment = process.env.NODE_ENV !== "production";
    const inviteCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'" + (localExperiment ? " 'unsafe-eval'" : ""),
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self'" + (localExperiment ? " ws://localhost:3000 ws://127.0.0.1:3000" : ""),
      "img-src 'self' data:",
      "font-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      ...(!localExperiment ? ["upgrade-insecure-requests"] : []),
    ].join("; ");
    const privateWorkspaceHeaders = [
      { key: "Cache-Control", value: "private, no-store, no-cache, max-age=0, must-revalidate" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
    ];
    return [{
      source: "/workspace/:path*",
      headers: privateWorkspaceHeaders,
    }, {
      source: "/api/workspace/:path*",
      headers: privateWorkspaceHeaders,
    }, {
      source: "/workspace/invite/:path*",
      headers: [
        { key: "Cache-Control", value: "private, no-store, max-age=0" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        { key: "Content-Security-Policy",
          value: inviteCsp },
      ],
    }];
  },
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
