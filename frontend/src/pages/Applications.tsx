import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Tag, Select, Button, Space, message, Tooltip } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { applicationsApi } from '@/services/applications'
import { STATUS_LABELS, STATUS_COLORS } from '@/constants/status'
import type { Application, ApplicationStatus } from '@/types'

export default function ApplicationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | undefined>()

  const { data = [], isLoading } = useQuery({
    queryKey: ['applications', statusFilter],
    queryFn: () => applicationsApi.list({ status: statusFilter, limit: 100 }),
  })

  const retryMutation = useMutation({
    mutationFn: (id: number) => applicationsApi.retryScoring(id),
    onSuccess: () => { message.success('重试已触发'); queryClient.invalidateQueries({ queryKey: ['applications'] }) },
    onError: () => message.error('重试失败'),
  })

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '部门', dataIndex: 'department' },
    {
      title: '状态', dataIndex: 'status',
      render: (s: ApplicationStatus) => <Tag color={STATUS_COLORS[s]}>{STATUS_LABELS[s]}</Tag>,
    },
    {
      title: '评分', dataIndex: 'ai_total_score',
      render: (v: number | null, r: Application) => {
        if (r.status === 'scoring_failed') return <Tag color="error">失败</Tag>
        if (v != null) {
          const color = v >= 75 ? '#52c41a' : v >= 50 ? '#faad14' : '#ff4d4f'
          return <span style={{ color, fontWeight: 700 }}>{v.toFixed(1)}</span>
        }
        return '-'
      },
    },
    {
      title: '推荐', dataIndex: 'ai_recommendation',
      render: (v: string | null) => v ?? '-',
    },
    {
      title: '操作',
      render: (_: any, r: Application) => (
        <Space>
          <a onClick={() => navigate(`/applications/${r.id}`)}>详情</a>
          {r.status === 'scoring_failed' && (
            <Tooltip title="重试 AI 打分">
              <Button size="small" icon={<ReloadOutlined />}
                onClick={() => retryMutation.mutate(r.id)} loading={retryMutation.isPending} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>投递管理</h2>
      <Space style={{ marginBottom: 16 }}>
        <Select allowClear placeholder="状态筛选" style={{ width: 150 }}
          value={statusFilter} onChange={setStatusFilter}
          options={Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
      </Space>
      <Table dataSource={data} columns={columns} rowKey="id"
        loading={isLoading} pagination={{ pageSize: 20 }} />
    </div>
  )
}
