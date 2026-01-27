/**
 * Lifecycle Types for R2 Manager Frontend
 *
 * Types for managing R2 bucket object lifecycle rules including
 * expiration and transition to Infrequent Access storage.
 *
 * Based on Cloudflare REST API format:
 * https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/lifecycle/
 */

/**
 * Condition for lifecycle transitions (matches Cloudflare API)
 */
export interface LifecycleTransitionCondition {
  /** Maximum age in days before transition is triggered */
  maxAge: number;
  /** Type of condition - currently only 'Age' is supported */
  type: "Age";
}

/**
 * Storage class transition entry
 */
export interface StorageClassTransition {
  condition: LifecycleTransitionCondition;
  storageClass: "InfrequentAccess";
}

/**
 * Object transition (for delete or abort multipart)
 */
export interface ObjectTransition {
  condition: LifecycleTransitionCondition;
}

/**
 * Conditions that filter which objects the rule applies to
 */
export interface LifecycleRuleConditions {
  /** Only apply to objects with this prefix */
  prefix?: string;
}

/**
 * Single lifecycle rule (matches Cloudflare REST API format)
 */
export interface LifecycleRule {
  /** Unique rule identifier */
  id: string;
  /** Whether the rule is active */
  enabled: boolean;
  /** Conditions that filter which objects the rule applies to */
  conditions?: LifecycleRuleConditions;
  /** Delete objects after specified age */
  deleteObjectsTransition?: ObjectTransition;
  /** Transition objects to different storage class */
  storageClassTransitions?: StorageClassTransition[];
  /** Abort incomplete multipart uploads after specified age */
  abortMultipartUploadsTransition?: ObjectTransition;
}

/**
 * API response for lifecycle rules
 */
export interface LifecycleRulesResponse {
  success: boolean;
  result?: {
    rules: LifecycleRule[];
  };
  error?: string;
}

/**
 * Helper to get expiration days from a rule (if configured)
 */
export function getExpirationDays(rule: LifecycleRule): number | null {
  return rule.deleteObjectsTransition?.condition?.maxAge ?? null;
}

/**
 * Helper to get IA transition days from a rule (if configured)
 */
export function getTransitionDays(rule: LifecycleRule): number | null {
  const transition = rule.storageClassTransitions?.[0];
  return transition?.condition?.maxAge ?? null;
}
