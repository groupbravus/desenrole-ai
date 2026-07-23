import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Default é 1mb — prints de conversa em base64 passam disso fácil.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default withNextIntl(config);
