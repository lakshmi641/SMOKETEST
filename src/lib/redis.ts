import { Redis } from '@upstash/redis';

// Edge Runtime compatible Redis client
// We initialize it lazily or safely to prevent ERR_INVALID_URL if env vars are missing
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = (redisUrl && redisToken)
  ? new Redis({ url: redisUrl, token: redisToken })
  : null;

// Interface for subdomain configuration stored in Redis
export interface SubdomainConfig {
  enabled: boolean;
  subdomain: string;
  fullDomain: string;
  status: "active" | "disabled";
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

// Function to get company ID from subdomain (Edge Runtime compatible)
export async function getCompanyIdFromSubdomain(subdomain: string): Promise<string | null> {
  // Return null immediately if Redis is not configured to allow fallback to Firestore
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  try {
    // Validate subdomain format
    if (!subdomain || typeof subdomain !== 'string') {
      return null;
    }

    const subdomainKey = `subdomain:by-name:${subdomain.toLowerCase()}`;
    const companyId = redis ? await redis.get<string>(subdomainKey) : null;

    return companyId;
  } catch (error) {
    console.error(`Redis lookup failed for subdomain ${subdomain}:`, error);
    return null;
  }
}

// Function to get subdomain configuration
export async function getSubdomainConfig(companyId: string): Promise<SubdomainConfig | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  try {
    if (!companyId || typeof companyId !== 'string') {
      return null;
    }

    const cacheKey = `subdomain:${companyId}`;
    const config = redis ? await redis.get<SubdomainConfig>(cacheKey) : null;
    return config;
  } catch (error) {
    console.error(`Redis lookup failed for company ${companyId}:`, error);
    return null;
  }
}

// Batch function to get multiple company IDs (useful for performance)
export async function getMultipleCompanyIds(subdomains: string[]): Promise<Record<string, string | null>> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return {};
  }

  try {
    const keys = subdomains.map(subdomain => `subdomain:by-name:${subdomain.toLowerCase()}`);
    const results = redis ? await redis.mget(...keys) as (string | null)[] : [];

    const mapping: Record<string, string | null> = {};
    subdomains.forEach((subdomain, index) => {
      mapping[subdomain] = results[index] || null;
    });

    return mapping;
  } catch (error) {
    console.error('Batch Redis lookup failed:', error);
    return {};
  }
}
