import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Tag, Button, Modal, Form, Input, Select, InputNumber, message, Space } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { jobsApi } from '@/services/jobs'
import { JOB_STATUS_LABELS, JOB_STATUS_COLORS, EDU_LABELS } from '@/constants/status'
import type { Job } from '@/types'

export default function JobsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingJob, setEditingJob] = useState<Job | null>(null)
  const [form] = Form.useForm()

  const { data = [], isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.list({ limit: 100 }),
  })

  const createMutation = useMutation({
    mutationFn: (data: any) => editingJob ? jobsApi.update(editingJob.id, data) : jobsApi.create(data),
    onSuccess: () => {
      message.success(editingJob ? '更新成功' : '创建成功')
      setModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || '操作失败'),
  })

  const handleOpenCreate = () => {
    setEditingJob(null)
    form.resetFields()
    form.setFieldsValue({ required_education: 'any', status: 'draft' })
    setModalOpen(true)
  }

  const handleEdit = (job: Job) => {
    setEditingJob(job)
    form.setFieldsValue(job)
    setModalOpen(true)
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '岗位', dataIndex: 'title' },
    { title: '部门', dataIndex: 'department' },
    {
      title: '状态', dataIndex: 'status',
      render: (s: string) => <Tag color={JOB_STATUS_COLORS[s]}>{JOB_STATUS_LABELS[s]}</Tag>,
    },
    { title: '学历要求', dataIndex: 'required_education', render: (v: string) => EDU_LABELS[v] },
    {
      title: '薪资范围', render: (_: any, r: Job) =>
        r.salary_min ? `${r.salary_min}k - ${r.salary_max}k` : '-',
    },
    {
      title: '操作', render: (_: any, r: Job) => (
        <Space>
          <a onClick={() => handleEdit(r)}>编辑</a>
          <a onClick={() => navigate(`/jobs/${r.id}`)}>详情</a>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>岗位管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>新建岗位</Button>
      </div>

      <Table dataSource={data} columns={columns} rowKey="id"
        loading={isLoading} pagination={{ pageSize: 20 }} />

      <Modal title={editingJob ? '编辑岗位' : '新建岗位'} open={modalOpen}
        onOk={() => form.submit()} onCancel={() => setModalOpen(false)}
        width={640} confirmLoading={createMutation.isPending}>
        <Form form={form} layout="vertical" onFinish={(values) => createMutation.mutate(values)}>
          <Form.Item name="title" label="岗位名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="department" label="部门" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="location" label="工作地点">
            <Input />
          </Form.Item>
          <Space size={16}>
            <Form.Item name="salary_min" label="薪资下限(k)">
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item name="salary_max" label="薪资上限(k)">
              <InputNumber min={0} />
            </Form.Item>
          </Space>
          <Form.Item name="required_education" label="学历要求">
            <Select options={Object.entries(EDU_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
          </Form.Item>
          <Form.Item name="required_experience_years" label="经验年限">
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={Object.entries(JOB_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
          </Form.Item>
          <Form.Item name="jd_body" label="岗位描述" rules={[{ required: true, min: 100, message: 'JD 不少于 100 字' }]}>
            <Input.TextArea rows={6} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
