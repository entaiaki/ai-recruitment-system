// ── 用户 ──
export type UserRole = 'admin' | 'hr' | 'dept_leader' | 'analyst'

export interface User {
  id: number
  email: string
  full_name: string
  role: UserRole
  department?: string | null
  is_active: boolean
  created_at: string
}

// ── 岗位 ──
export type JobStatus = 'draft' | 'active' | 'paused' | 'closed'
export type EducationLevel = 'any' | 'junior_college' | 'bachelor' | 'master' | 'phd'

export interface Job {
  id: number
  created_by: number
  title: string
  department: string
  location?: string | null
  salary_min?: number | null
  salary_max?: number | null
  required_education: EducationLevel
  required_experience_years?: number | null
  required_skills?: string[] | null
  jd_body: string
  status: JobStatus
  created_at: string
  updated_at: string
}

// ── 候选人 ──
export interface Candidate {
  id: number
  name: string
  email?: string | null
  phone?: string | null
  source?: string | null
  created_at: string
}

// ── 简历 ──
export interface Resume {
  id: number
  candidate_id?: number | null
  original_filename: string
  file_size?: number | null
  parse_status: string
  parse_error?: string | null
  parsed_text_preview?: string | null
  created_at: string
}

// ── 投递状态 ──
export type ApplicationStatus =
  | 'submitted' | 'ai_scoring' | 'scoring_failed' | 'ai_scored'
  | 'hr_review' | 'dept_review' | 'interview' | 'offered' | 'hired' | 'rejected'

export interface Application {
  id: number
  job_id: number
  candidate_id: number
  resume_id: number
  department?: string | null
  status: ApplicationStatus
  ai_total_score?: number | null
  ai_recommendation?: string | null
  ai_summary?: string | null
  ai_strengths?: string | null
  ai_weaknesses?: string | null
  scoring_error?: string | null
  scoring_attempts: number
  hr_notes?: string | null
  dept_notes?: string | null
  reject_reason?: string | null
  interview_date?: string | null
  applied_at: string
  updated_at: string
  // 5 维度分数（对齐任务书）
  score_skills?: number | null
  score_experience?: number | null
  score_education?: number | null
  score_potential?: number | null
  score_stability?: number | null
}

// ── 认证 ──
export interface Token {
  access_token: string
  token_type: string
}
