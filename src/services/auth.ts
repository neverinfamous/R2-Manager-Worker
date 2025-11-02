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
      // Clear any local storage/session storage
      localStorage.clear();
      sessionStorage.clear();
      
      // Call Cloudflare Access logout endpoint which clears the session
      // Use a no-cache fetch to prevent stale responses
      const response = await fetch('/cdn-cgi/access/logout', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (response.ok || response.status === 302) {
        // Small delay to ensure logout is processed
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Force a full page reload to clear any cached state
        // Using replace() instead of href to prevent back button issues
        window.location.replace('/');
      } else {
        console.warn('Logout response not OK:', response.status);
        // Force redirect anyway
        window.location.replace('/');
      }
    } catch (error) {
      console.error('Logout failed:', error);
      // Clear storage and force redirect anyway
      localStorage.clear();
      sessionStorage.clear();
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

