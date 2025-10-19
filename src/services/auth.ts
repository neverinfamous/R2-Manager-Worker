import { api } from './api'

/**
 * AuthService - Deprecated Session Storage Approach
 * 
 * SECURITY UPDATE (Issue #9): Auth tokens are now stored in HTTP-only cookies
 * instead of sessionStorage. This service is maintained for backward compatibility
 * during the migration period.
 * 
 * MIGRATION STATUS:
 * ✅ Backend: HTTP-only cookies set on login response
 * ✅ API Client: credentials: 'include' on all requests
 * ⚠️ Frontend: Still reading sessionStorage for fallback
 * 
 * Timeline:
 * - Phase 1 (Current): Both methods work (dual support)
 * - Phase 2 (v2.0): Remove sessionStorage completely
 * 
 * The browser automatically sends cookies with fetch requests
 * when credentials: 'include' is set, so token management
 * is now handled server-side.
 */
class AuthService {
  private TOKEN_KEY = 'r2manager_token'

  getToken(): string | null {
    // Tokens are now in HTTP-only cookies, but fallback to sessionStorage
    // for backward compatibility during migration
    return sessionStorage.getItem(this.TOKEN_KEY)
  }

  setToken(token: string) {
    // Keep in sessionStorage for backward compatibility
    // but primary auth is now via HTTP-only cookies
    sessionStorage.setItem(this.TOKEN_KEY, token)
    api.setToken(token)
  }

  clearToken() {
    // Clear sessionStorage (for backward compatibility)
    sessionStorage.removeItem(this.TOKEN_KEY)
    api.clearToken()
  }

  isAuthenticated(): boolean {
    // Note: Relies on sessionStorage for now.
    // In production, the server validates via cookie + Authorization header
    return !!this.getToken()
  }

  initialize() {
    const token = this.getToken()
    if (token) {
      api.setToken(token)
    }
  }
}

export const auth = new AuthService()

// Initialize auth service
auth.initialize()
