import { create } from 'zustand'
import { User } from '../types'
import { authService } from '../lib/auth'

interface AuthState {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string, companyId?: string) => Promise<void>
  signUp: (email: string, password: string, userData: Omit<User, 'id' | 'email' | 'createdAt' | 'updatedAt'>) => Promise<void>
  signOut: () => Promise<void>
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  signIn: async (email: string, password: string, companyId?: string) => {
    try {
      set({ loading: true })
      const user = await authService.signIn(email, password, companyId)
      if (user) {
        set({ user, loading: false })
      } else {
        set({ loading: false })
        throw new Error('Login failed. User not found.')
      }
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  signUp: async (email: string, password: string, userData: Omit<User, 'id' | 'email' | 'createdAt' | 'updatedAt'>) => {
    try {
      set({ loading: true })
      const user = await authService.signUp(email, password, userData)
      if (user) {
        set({ user, loading: false })
      } else {
        set({ loading: false })
        throw new Error('Signup failed.')
      }
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  signOut: async () => {
    try {
      set({ loading: true })
      await authService.signOut()
      set({ user: null, loading: false })
    } catch (error) {
      set({ loading: false })
      throw error
    }
  },

  setUser: (user: User | null) => set({ user }),
  setLoading: (loading: boolean) => set({ loading })
}))
