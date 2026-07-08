import http from './http'
import type { Candidate, Resume } from '@/types'

export const candidatesApi = {
  list: async (params?: { skip?: number; limit?: number }) => {
    const res = await http.get<Candidate[]>('/candidates/', { params })
    return res.data
  },
  get: async (id: number) => {
    const res = await http.get<Candidate>(`/candidates/${id}`)
    return res.data
  },
  create: async (data: Partial<Candidate>) => {
    const res = await http.post<Candidate>('/candidates/', data)
    return res.data
  },
  uploadResume: async (file: File, candidateId?: number): Promise<Resume> => {
    const form = new FormData()
    form.append('file', file)
    if (candidateId) form.append('candidate_id', String(candidateId))
    const res = await http.post<Resume>('/resumes/upload', form)
    return res.data
  },
}
