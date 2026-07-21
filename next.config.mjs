/** @type {import('next').NextConfig} */
const nextConfig = {
  // Off intentionally: React StrictMode double-invokes effects in dev, which makes
  // GSAP SplitText / useGSAP re-split and flicker. Production is unaffected either way.
  reactStrictMode: false,
};

export default nextConfig;
