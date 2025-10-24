-- ============================================
-- R2 Bucket Manager - Database Schema
-- ============================================
-- Authentication: Cloudflare Zero Trust (Cloudflare Access)
-- No user/session tables needed - authentication handled at edge
-- ============================================

-- Bucket ownership tracking (for future multi-tenant features)
-- Currently not actively used due to Zero Trust authentication
-- All authenticated users can access all buckets
DROP TABLE IF EXISTS bucket_owners;
CREATE TABLE bucket_owners (
  bucket_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (bucket_name, user_email)
);

-- ============================================
-- MIGRATION NOTE:
-- ============================================
-- If you previously had 'users' and 'sessions' tables from an earlier
-- version, they are no longer needed with Cloudflare Zero Trust.
-- The above DROP statements are kept for backward compatibility.
-- 
-- Legacy tables (no longer used):
-- - users: Replaced by Cloudflare Access identity
-- - sessions: Replaced by Cloudflare Access JWT tokens
-- ============================================
