import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Row, Col, Card, Descriptions, Tag, Button, Steps, Progress,
  Modal, Select, Input, message, Space, Spin,
} from 'antd'
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip as ReTooltip,
} from 'recharts'
import { applicationsApi } from '@/services/applications'
import { STATUS_LABELS, STATUS_COLORS, DIMENSION_NAMES, DIMENSION_MAX } from '@/constants/status'
import type { Application, ApplicationStatus } from '@/types'

const STATUS_ORDER: ApplicationStatus[] = [
  'submitted', 'ai_scoring', 'ai_scored', 'hr_review', 'dept_review', 'interview', 'offered', 'hired',
]

const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  submitted:      ['ai_scoring'],
  ai_scoring:     ['ai_scored', 'scoring_failed'],
  scoring_failed: ['ai_scoring'],
  ai_scored:      ['hr_review', 'rejected'],
  hr_review:      ['dept_review', 'rejected'],
  dept_review:    ['interview', 'rejected'],
  interview:      ['offered', 'rejected'],
  offered:        ['hired', 'rejected'],
  hired:          [],
  rejected:       [],
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [nextStatus, setNextStatus] = useState<ApplicationStatus | undefined>()
  const [notes, setNotes] = useState('')

  const { data: app, isLoading } = useQuery({
    queryKey: ['application', id],
    queryFn: () => applicationsApi.get(Number(id)),
    enabled: !!id,
  })

  const statusMutation = useMutation({
    mutationFn: () => applicationsApi.updateStatus(Number(id), {
      new_status: nextStatus!, notes: notes || undefined,
    }),
    onSuccess: () => {
      message.success('状态已更新')
      setModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['application', id] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || '操作失败'),
  })

  const retryMutation = useMutation({
    mutationFn: () => applicationsApi.retryScoring(Number(id)),
    onSuccess: () => {
      message.success('重试已触发')
      queryClient.invalidateQueries({ queryKey: ['application', id] })
    },
    onError: () => message.error('重试失败'),
  })

  const scoreMutation = useMutation({
    mutationFn: () => applicationsApi.triggerScoring(Number(id)),
    onSuccess: () => {
      message.success('打分已触发')
      queryClient.invalidateQueries({ queryKey: ['application', id] })
    },
    onError: () => message.error('打分失败'),
  })

  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  if (!app) return <div>未找到申请</div>

  const currentIdx = STATUS_ORDER.indexOf(app.status)
  const allowedNext = VALID_TRANSITIONS[app.status] || []

  const radarData = Object.entries(DIMENSION_NAMES).map(([key, name]) => {
    const val = (app as any)[key]
    return {
      subject: name,
      value: val ?? 0,
      full: DIMENSION_MAX[key] || 25,
      pct: val != null ? (val / (DIMENSION_MAX[key] || 25)) * 100 : 0,
    }
  })

  return (
    <div>
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/applications')}
        style={{ padding: 0, marginBottom: 16 }}>
        返回列表
      </Button>

      {/* 状态进度 */}
      <Card style={{ marginBottom: 16 }}>
        <Steps current={currentIdx >= 0 ? currentIdx : 0} size="small"
          items={STATUS_ORDER.map((s) => ({ title: STATUS_LABELS[s] }))} />
      </Card>

      <Row gutter={16}>
        <Col span={14}>
          {/* 基本信息 */}
          <Card title="申请信息" style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="申请ID">{app.id}</Descriptions.Item>
              <Descriptions.Item label="部门">{app.department ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_COLORS[app.status]}>{STATUS_LABELS[app.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="评分">{app.ai_total_score?.toFixed(1) ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="推荐">{app.ai_recommendation ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="重试次数">{app.scoring_attempts}</Descriptions.Item>
              {app.scoring_error && (
                <Descriptions.Item label="错误" span={2}>
                  <span style={{ color: 'red' }}>{app.scoring_error}</span>
                </Descriptions.Item>
              )}
            </Descriptions>

            <Space style={{ marginTop: 16 }}>
              {(app.status === 'submitted' || app.status === 'scoring_failed') && (
                <Button type="primary" onClick={() => scoreMutation.mutate()}
                  loading={scoreMutation.isPending}>
                  触发 AI 打分
                </Button>
              )}
              {app.status === 'scoring_failed' && (
                <Button icon={<ReloadOutlined />} onClick={() => retryMutation.mutate()}
                  loading={retryMutation.isPending}>
                  重试打分
                </Button>
              )}
              {allowedNext.length > 0 && (
                <Button onClick={() => setModalOpen(true)}>推进状态</Button>
              )}
            </Space>
          </Card>

          {/* AI 总结 */}
          {app.ai_summary && (
            <Card title="AI 分析总结">
              <p>{app.ai_summary}</p>
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={12}>
                  <div style={{ fontWeight: 600, color: '#52c41a', marginBottom: 8 }}>优势</div>
                  {(() => { try { return JSON.parse(app.ai_strengths ?? '[]') } catch { return [] } })().map((s: string, i: number) => (
                    <div key={i}>✅ {s}</div>
                  ))}
                </Col>
                <Col span={12}>
                  <div style={{ fontWeight: 600, color: '#ff4d4f', marginBottom: 8 }}>不足</div>
                  {(() => { try { return JSON.parse(app.ai_weaknesses ?? '[]') } catch { return [] } })().map((s: string, i: number) => (
                    <div key={i}>⚠️ {s}</div>
                  ))}
                </Col>
              </Row>
            </Card>
          )}
        </Col>

        {/* AI 打分面板 */}
        <Col span={10}>
          <Card title="AI 打分详情">
            {app.ai_total_score != null ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{
                    fontSize: 48, fontWeight: 700,
                    color: app.ai_total_score >= 75 ? '#52c41a' : app.ai_total_score >= 50 ? '#faad14' : '#ff4d4f',
                  }}>
                    {app.ai_total_score.toFixed(1)}
                  </div>
                  <div style={{ color: '#888' }}>综合得分 / 100</div>
                </div>
                {radarData.map((d) => (
                  <div key={d.subject} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>{d.subject}</span>
                      <span>{d.value.toFixed(1)} / {d.full}</span>
                    </div>
                    <Progress percent={Math.round(d.pct)} size="small"
                      strokeColor={d.pct >= 75 ? '#52c41a' : d.pct >= 50 ? '#faad14' : '#ff4d4f'}
                      showInfo={false} />
                  </div>
                ))}
                <ResponsiveContainer width="100%" height={220} style={{ marginTop: 16 }}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" style={{ fontSize: 11 }} />
                    <Radar dataKey="pct" stroke="#667eea" fill="#667eea" fillOpacity={0.3} />
                    <ReTooltip formatter={(v: number) => `${v.toFixed(0)}%`} />
                  </RadarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
                {app.status === 'scoring_failed' ? 'AI 打分失败' : '尚未打分'}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 流转弹窗 */}
      <Modal title="推进状态" open={modalOpen}
        onOk={() => statusMutation.mutate()}
        onCancel={() => setModalOpen(false)}
        confirmLoading={statusMutation.isPending}>
        <Select style={{ width: '100%', marginBottom: 16 }}
          placeholder="选择目标状态" value={nextStatus} onChange={setNextStatus}
          options={allowedNext.map((s) => ({ value: s, label: STATUS_LABELS[s] }))} />
        <Input.TextArea placeholder="备注（拒绝时必填）" value={notes}
          onChange={(e) => setNotes(e.target.value)} rows={3} />
      </Modal>
    </div>
  )
}
