import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Button, Modal, Form, Input, Upload, Select, message, Space } from 'antd'
import { PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { candidatesApi } from '@/services/candidates'
import { jobsApi } from '@/services/jobs'
import { applicationsApi } from '@/services/applications'
import type { Candidate, Job } from '@/types'

export default function CandidatesPage() {
  const queryClient = useQueryClient()
  const [candModalOpen, setCandModalOpen] = useState(false)
  const [resumeModalOpen, setResumeModalOpen] = useState(false)
  const [applyModalOpen, setApplyModalOpen] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [candForm] = Form.useForm()
  const [applyForm] = Form.useForm()

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['candidates'],
    queryFn: () => candidatesApi.list({ limit: 100 }),
  })

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => jobsApi.list({ limit: 200 }),
  })

  const createCandidateMu = useMutation({
    mutationFn: (data: any) => candidatesApi.create(data),
    onSuccess: () => {
      message.success('候选人已创建')
      setCandModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
    },
  })

  const uploadResumeMu = useMutation({
    mutationFn: () => candidatesApi.uploadResume(file!, selectedCandidate?.id),
    onSuccess: () => {
      message.success('简历上传成功')
      setResumeModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['candidates'] })
    },
  })

  const applyMu = useMutation({
    mutationFn: (values: { job_id: number; resume_id: number }) =>
      applicationsApi.create({ ...values, candidate_id: selectedCandidate!.id }),
    onSuccess: () => {
      message.success('投递成功')
      setApplyModalOpen(false)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail || '投递失败'),
  })

  const handleUploadResume = (cand: Candidate) => {
    setSelectedCandidate(cand)
    setFile(null)
    setResumeModalOpen(true)
  }

  const handleApply = (cand: Candidate) => {
    setSelectedCandidate(cand)
    applyForm.resetFields()
    setApplyModalOpen(true)
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '姓名', dataIndex: 'name' },
    { title: '邮箱', dataIndex: 'email', render: (v: string | null) => v ?? '-' },
    { title: '电话', dataIndex: 'phone', render: (v: string | null) => v ?? '-' },
    { title: '来源', dataIndex: 'source', render: (v: string | null) => v ?? '-' },
    {
      title: '操作', render: (_: any, r: Candidate) => (
        <Space>
          <a onClick={() => handleUploadResume(r)}>上传简历</a>
          <a onClick={() => handleApply(r)}>投递</a>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>候选人管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          candForm.resetFields()
          setCandModalOpen(true)
        }}>
          新建候选人
        </Button>
      </div>

      <Table dataSource={candidates} columns={columns} rowKey="id"
        loading={isLoading} pagination={{ pageSize: 20 }} />

      {/* 新建候选人 */}
      <Modal title="新建候选人" open={candModalOpen}
        onOk={() => candForm.submit()} onCancel={() => setCandModalOpen(false)}
        confirmLoading={createCandidateMu.isPending}>
        <Form form={candForm} layout="vertical" onFinish={(v) => createCandidateMu.mutate(v)}>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="邮箱"><Input /></Form.Item>
          <Form.Item name="phone" label="电话"><Input /></Form.Item>
        </Form>
      </Modal>

      {/* 上传简历 */}
      <Modal title="上传简历" open={resumeModalOpen}
        onOk={() => uploadResumeMu.mutate()} onCancel={() => setResumeModalOpen(false)}
        confirmLoading={uploadResumeMu.isPending}>
        <Upload beforeUpload={(f) => { setFile(f); return false }} maxCount={1}
          fileList={file ? [{ uid: '-1', name: file.name, status: 'done' }] : []}>
          <Button icon={<UploadOutlined />}>选择 PDF/DOCX</Button>
        </Upload>
      </Modal>

      {/* 投递 */}
      <Modal title="投递申请" open={applyModalOpen}
        onOk={() => applyForm.submit()} onCancel={() => setApplyModalOpen(false)}
        confirmLoading={applyMu.isPending}>
        <Form form={applyForm} layout="vertical" onFinish={(v) => applyMu.mutate(v)}>
          <Form.Item name="job_id" label="岗位" rules={[{ required: true }]}>
            <Select options={jobs.map((j: Job) => ({ value: j.id, label: `${j.title} (${j.department})` }))} />
          </Form.Item>
          <Form.Item name="resume_id" label="简历ID" rules={[{ required: true }]}>
            <Input type="number" placeholder="输入上传后获得的简历ID" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
