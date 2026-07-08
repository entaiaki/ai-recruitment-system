import http from './http'
import type { Application, ApplicationStatus } from '@/types'

export const applicationsApi = {
  list: async (params?: {
    job_id?: number; status?: ApplicationStatus;
    min_score?: number; skip?: number; limit?: number
  }) => {
    const res = await http.get<Application[]>('/applications/', { params })
    return res.data
  },
  get: async (id: number) => {
    const res = await http.get<Application>(`/applications/${id}`)
    return res.data
  },
  create: async (data: { job_id: number; candidate_id: number; resume_id: number }) => {
    const res = await http.post<Application>('/applications/', data)
    return res.data
  },
  updateStatus: async (id: number, data: { new_status: ApplicationStatus; notes?: string }) => {
    const res = await http.patch<Application>(`/applications/${id}/status`, data)
    return res.data
  },
  triggerScoring: async (id: number) => {
    const res = await http.post<Application>(`/applications/${id}/score`)
    return res.data
  },
  retryScoring: async (id: number) => {
    const res = await http.post<Application>(`/applications/${id}/retry-scoring`)
    return res.data
  },
}
