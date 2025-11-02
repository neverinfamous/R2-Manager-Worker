/**
 * AuthService - Minimal implementation for Cloudflare Zero Trust
 * 
 * Authentication is now handled by Cloudflare Access at the edge.
 * This service provides minimal functionality for logout only.
 */
class AuthService {
  /**
   * Logout - Redirects to Cloudflare Access logout endpoint
   */
  async logout(): Promise<void> {
    try {
      // Clear any local storage/session storage first
      localStorage.clear();
      sessionStorage.clear();
      
      // For Cloudflare Access logout, we need to use a simple navigation
      // instead of fetch() to avoid CORS preflight issues.
      // The /cdn-cgi/access/logout endpoint doesn't support CORS preflight requests.
      
      // Direct navigation to logout endpoint - Cloudflare Access will handle the logout
      // and redirect back to the login page
      window.location.replace('/cdn-cgi/access/logout');
      
    } catch (error) {
      console.error('Logout failed:', error);
      // Clear storage and force redirect anyway
      localStorage.clear();
      sessionStorage.clear();
      // Fallback: just redirect to home which will trigger re-authentication
      window.location.replace('/');
    }
  }

  /**
   * Check if user is authenticated
   * Note: With Cloudflare Access, unauthenticated users never reach this page
   */
  isAuthenticated(): boolean {
    // If we're here, we're already authenticated by Cloudflare Access
    return true;
  }

  initialize(): void {
    // No initialization needed - Cloudflare Access handles everything
    console.log('[Auth] Cloudflare Access authentication initialized');
  }
}

export const auth = new AuthService()

// Initialize auth service
auth.initialize()

