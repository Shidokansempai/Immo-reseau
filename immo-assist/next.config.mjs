/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Images are placeholder/remote-friendly for demo property photos.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
