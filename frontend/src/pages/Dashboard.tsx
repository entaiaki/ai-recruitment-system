import { useQuery } from '@tanstack/react-query'
import { Row, Col, Card, Statistic, Table, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip,
} from 'recharts'
import { applicationsApi } from '@/services/applications'
import { STATUS_LABELS, STATUS_COLORS, DIMENSION_NAMES, DIMENSION_MAX } from '@/constants/status'
import type { Application } from '@/types'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { data: apps = [], isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: () => applicationsApi.list({ limit: 200 }),
  })

  const statusCounts: Record<string, number> = {}
  let totalScore = 0
  let scoredCount = 0
  const dimSums: Record<string, number> = {}

  apps.forEach((a: Application) => {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1
    if (a.ai_total_score != null) {
      totalScore += a.ai_total_score
      scoredCount++
      for (const dim of Object.keys(DIMENSION_NAMES)) {
        const val = (a as any)[dim]
        if (val != null) dimSums[dim] = (dimSums[dim] || 0) + val
      }
    }
  })

  const radarData = Object.entries(DIMENSION_NAMES).map(([key, name]) => ({
    subject: name,
    value: scoredCount > 0 ? ((dimSums[key] || 0) / scoredCount / (DIMENSION_MAX[key] || 1)) * 100 : 0,
  }))

  const recentColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '状态', dataIndex: 'status', render: (s: string) =>
        <Tag color={(STATUS_COLORS as Record<string, string>)[s]}>{(STATUS_LABELS as Record<string, string>)[s]}</Tag>,
    },
    { title: '评分', dataIndex: 'ai_total_score', render: (v: number | null) =>
        v != null ? v.toFixed(1) : '-' },
    {
      title: '操作', render: (_: any, r: Application) =>
        <a onClick={() => navigate(`/applications/${r.id}`)}>详情</a>,
    },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>数据看板</h2>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}><Card><Statistic title="总申请" value={apps.length} /></Card></Col>
        <Col span={6}><Card><Statistic title="AI 已打分" value={scoredCount} /></Card></Col>
        <Col span={6}><Card><Statistic title="已录用" value={statusCounts['hired'] ?? 0} /></Card></Col>
        <Col span={6}><Card><Statistic title="平均分" value={scoredCount > 0 ? (totalScore / scoredCount).toFixed(1) : '-'} /></Card></Col>
      </Row>
      <Row gutter={16}>
        <Col span={10}>
          <Card title="AI 打分维度均值">
            {radarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <Radar dataKey="value" stroke="#667eea" fill="#667eea" fillOpacity={0.3} />
                  <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                </RadarChart>
              </ResponsiveContainer>
            ) : <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>暂无打分数据</div>}
          </Card>
        </Col>
        <Col span={14}>
          <Card title="最近申请">
            <Table dataSource={apps.slice(0, 8)} columns={recentColumns}
              rowKey="id" pagination={false} size="small" loading={isLoading} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}
