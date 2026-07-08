import http from './http'
import type { User, Token } from '@/types'

export const authApi = {
  login: async (email: string, password: string): Promise<Token> => {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    const res = await http.post<Token>('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    return res.data
  },
  register: async (data: { email: string; password: string; full_name: string; role: string }) => {
    const res = await http.post<User>('/auth/register', data)
    return res.data
  },
  getMe: async () => {
    const res = await http.get<User>('/users/me')
    return res.data
  },
}
