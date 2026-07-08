import http from './http'
import type { Job } from '@/types'

export const jobsApi = {
  list: async (params?: { status?: string; department?: string; skip?: number; limit?: number }) => {
    const res = await http.get<Job[]>('/jobs/', { params })
    return res.data
  },
  get: async (id: number) => {
    const res = await http.get<Job>(`/jobs/${id}`)
    return res.data
  },
  create: async (data: Partial<Job>) => {
    const res = await http.post<Job>('/jobs/', data)
    return res.data
  },
  update: async (id: number, data: Partial<Job>) => {
    const res = await http.patch<Job>(`/jobs/${id}`, data)
    return res.data
  },
}
