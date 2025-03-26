import { api } from './api'

class AuthService {
  private TOKEN_KEY = 'r2manager_token'

  getToken(): string | null {
    return sessionStorage.getItem(this.TOKEN_KEY)
  }

  setToken(token: string) {
    sessionStorage.setItem(this.TOKEN_KEY, token)
    api.setToken(token) // Make sure API service gets token immediately
  }

  clearToken() {
    sessionStorage.removeItem(this.TOKEN_KEY)
    api.clearToken()
  }

  isAuthenticated(): boolean {
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