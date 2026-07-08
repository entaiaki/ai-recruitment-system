import type { ApplicationStatus } from '@/types'

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted:      '已投递',
  ai_scoring:     'AI 打分中',
  scoring_failed: '打分失败',
  ai_scored:      '已打分',
  hr_review:      'HR 审核',
  dept_review:    '部门审核',
  interview:      '面试中',
  offered:        '已发 Offer',
  hired:          '已入职',
  rejected:       '已淘汰',
}

export const STATUS_COLORS: Record<ApplicationStatus, string> = {
  submitted:      'blue',
  ai_scoring:     'processing',
  scoring_failed: 'error',
  ai_scored:      'cyan',
  hr_review:      'geekblue',
  dept_review:    'purple',
  interview:      'orange',
  offered:        'lime',
  hired:          'success',
  rejected:       'default',
}

export const JOB_STATUS_LABELS: Record<string, string> = {
  draft: '草稿', active: '招聘中', paused: '已暂停', closed: '已关闭',
}

export const JOB_STATUS_COLORS: Record<string, string> = {
  draft: 'default', active: 'success', paused: 'warning', closed: 'error',
}

export const EDU_LABELS: Record<string, string> = {
  any: '不限', junior_college: '大专', bachelor: '本科', master: '硕士', phd: '博士',
}

export const DIMENSION_NAMES: Record<string, string> = {
  score_skills: '技能匹配',
  score_experience: '经验匹配',
  score_education: '教育匹配',
  score_potential: '发展潜力',
  score_stability: '稳定性',
}

export const DIMENSION_MAX: Record<string, number> = {
  score_skills: 25,
  score_experience: 25,
  score_education: 20,
  score_potential: 15,
  score_stability: 15,
}
