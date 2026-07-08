import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card, Descriptions, Tag, Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { jobsApi } from '@/services/jobs'
import { JOB_STATUS_LABELS, JOB_STATUS_COLORS, EDU_LABELS } from '@/constants/status'

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: () => jobsApi.get(Number(id)),
    enabled: !!id,
  })

  if (isLoading) return <Card loading />
  if (!job) return <div>未找到岗位</div>

  return (
    <div>
      <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/jobs')}
        style={{ padding: 0, marginBottom: 16 }}>返回列表</Button>
      <Card title={job.title}>
        <Descriptions column={2}>
          <Descriptions.Item label="部门">{job.department}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={JOB_STATUS_COLORS[job.status]}>{JOB_STATUS_LABELS[job.status]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="地点">{job.location ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="学历">{EDU_LABELS[job.required_education]}</Descriptions.Item>
          <Descriptions.Item label="经验">{job.required_experience_years ?? '-'} 年</Descriptions.Item>
          <Descriptions.Item label="薪资">
            {job.salary_min ? `${job.salary_min}k - ${job.salary_max}k` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="JD" span={2}>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{job.jd_body}</pre>
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  )
}
