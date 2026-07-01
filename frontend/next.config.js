/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  env: {
    NEXT_PUBLIC_API_URL: "http://localhost:3001",
    NEXT_PUBLIC_GAME_URL: "http://localhost:3002",
    NEXT_PUBLIC_WALLET_URL: "http://localhost:3003",
    NEXT_PUBLIC_WS_URL: "http://localhost:3005"
  }
};
module.exports = nextConfig;
