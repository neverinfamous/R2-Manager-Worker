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
      // Call our logout endpoint which clears the Cloudflare Access session
      const response = await fetch('/cdn-cgi/access/logout', {
        method: 'GET',
        credentials: 'include'
      });
      
      if (response.ok) {
        // Redirect to home or login page
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Logout failed:', error);
      // Force redirect anyway
      window.location.href = '/';
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

