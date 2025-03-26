// src/types/auth.ts

export interface FileObject {
  key: string
  size: number
  uploaded: string
  url: string
}

export interface User {
  userId: string
  email: string
  createdAt: string
}

export interface Session {
  token: string
  expires: string
}

export interface AuthResponse {
  token?: string
  error?: string
  success?: boolean
}

export interface RegisterRequest {
  email: string
  password: string
  code: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface BucketOwner {
  bucketName: string
  userId: string
  createdAt: string
}

export type AuthState = {
  isAuthenticated: boolean
  user: User | null
  loading: boolean
  error: string | null
}