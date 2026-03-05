/**
 * Metabase Service
 * 
 * Handles Metabase embedding and signed URL generation
 */

import jwt from 'jsonwebtoken';

interface MetabaseEmbeddingParams {
  dashboardId: number;
  userId?: string;
  params?: Record<string, any>;
}

export class MetabaseService {
  private siteUrl: string;
  private embeddingSecretKey: string;

  constructor() {
    this.siteUrl = process.env.METABASE_SITE_URL || '';
    this.embeddingSecretKey = process.env.METABASE_EMBEDDING_SECRET_KEY || '';
  }

  /**
   * Check if service is properly configured
   */
  isConfigured(): boolean {
    return !!this.siteUrl && !!this.embeddingSecretKey;
  }

  /**
   * Validate configuration before use
   */
  private validateConfig(): void {
    if (!this.siteUrl) {
      throw new Error('METABASE_SITE_URL environment variable is required');
    }

    if (!this.embeddingSecretKey) {
      throw new Error('METABASE_EMBEDDING_SECRET_KEY environment variable is required');
    }
  }

  /**
   * Generate signed JWT token for Metabase embedding
   */
  private generateEmbeddingToken(params: MetabaseEmbeddingParams): string {
    const payload = {
      resource: { dashboard: params.dashboardId },
      params: params.params || {},
      exp: Math.round(Date.now() / 1000) + (60 * 10), // 10 minutes expiry
    };

    return jwt.sign(payload, this.embeddingSecretKey);
  }

  /**
   * Generate signed embedding URL for a dashboard
   */
  generateEmbeddingUrl(params: MetabaseEmbeddingParams): string {
    this.validateConfig();
    const token = this.generateEmbeddingToken(params);
    return `${this.siteUrl}/embed/dashboard/${token}#bordered=true&titled=true`;
  }

  /**
   * Generate signed embedding URL for a question/query
   */
  generateQuestionEmbeddingUrl(questionId: number, params?: Record<string, any>): string {
    this.validateConfig();
    const payload = {
      resource: { question: questionId },
      params: params || {},
      exp: Math.round(Date.now() / 1000) + (60 * 10), // 10 minutes expiry
    };

    const token = jwt.sign(payload, this.embeddingSecretKey);
    return `${this.siteUrl}/embed/question/${token}#bordered=true&titled=true`;
  }
}

// Export singleton instance (lazy initialization to avoid errors if env vars not set)
let metabaseServiceInstance: MetabaseService | null = null;

export function getMetabaseService(): MetabaseService {
  if (!metabaseServiceInstance) {
    metabaseServiceInstance = new MetabaseService();
  }
  return metabaseServiceInstance;
}

// Export for backward compatibility
export const metabaseService = getMetabaseService();

