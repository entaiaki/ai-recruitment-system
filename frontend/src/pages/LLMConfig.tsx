import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Button, Modal, Form, Input, InputNumber, Tag, Switch, Space, message, Popconfirm, Alert } from 'antd'
import { PlusOutlined, ApiOutlined, SettingOutlined } from '@ant-design/icons'
import http from '@/services/http'
import type { LLMConfig } from '@/types/llm'

export default function LLMConfigPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; latency_ms?: number } | null>(null)
  const [testing, setTesting] = useState(false)
  const [form] = Form.useForm()

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['llm-configs'],
    queryFn: async () => {
      const res = await http.get<LLMConfig[]>('/llm-configs/')
      return res.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: Partial<LLMConfig>) => (await http.post<LLMConfig>('/llm-configs/', data)).data,
    onSuccess: () => {
      message.success('配置已保存'); queryClient.invalidateQueries({ queryKey: ['llm-configs'] })
      setModalOpen(false); form.resetFields(); setTestResult(null)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? '保存失败'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<LLMConfig> }) =>
      (await http.put<LLMConfig>(`/llm-configs/${id}`, data)).data,
    onSuccess: () => {
      message.success('配置已更新'); queryClient.invalidateQueries({ queryKey: ['llm-configs'] })
      setModalOpen(false); form.resetFields(); setEditingId(null); setTestResult(null)
    },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? '更新失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await http.delete(`/llm-configs/${id}`) },
    onSuccess: () => { message.success('已删除'); queryClient.invalidateQueries({ queryKey: ['llm-configs'] }) },
    onError: (e: any) => message.error(e?.response?.data?.detail ?? '删除失败'),
  })

  const activateMutation = useMutation({
    mutationFn: async (id: number) => { await http.post(`/llm-configs/${id}/activate`) },
    onSuccess: () => { message.success('已切换激活配置'); queryClient.invalidateQueries({ queryKey: ['llm-configs'] }) },
  })

  const handleTest = async () => {
    const values = form.getFieldsValue()
    if (!values.base_url || !values.model_name) { message.warning('请先填写 API 地址和模型名称'); return }
    setTesting(true); setTestResult(null)
    try {
      const res = await http.post('/llm-configs/test', {
        base_url: values.base_url,
        api_key: values.api_key || 'lm-studio',
        model_name: values.model_name,
      })
      setTestResult(res.data)
    } catch (err: any) {
      setTestResult({ success: false, message: err.response?.data?.detail ?? '请求失败' })
    } finally { setTesting(false) }
  }

  const handleEdit = (record: LLMConfig) => {
    setEditingId(record.id)
    form.setFieldsValue({
      name: record.name, base_url: record.base_url, api_key: '',
      model_name: record.model_name, timeout: record.timeout, max_retries: record.max_retries,
    })
    setTestResult(null); setModalOpen(true)
  }

  const handleSubmit = (values: any) => {
    const data = { ...values }
    if (editingId && !data.api_key) delete data.api_key
    if (editingId) updateMutation.mutate({ id: editingId, data })
    else createMutation.mutate(data)
  }

  const columns = [
    { title: '名称', dataIndex: 'name' },
    { title: 'API 地址', dataIndex: 'base_url', ellipsis: true },
    { title: '模型', dataIndex: 'model_name', ellipsis: true },
    { title: 'Key', dataIndex: 'api_key' },
    {
      title: '激活', dataIndex: 'is_active',
      render: (v: boolean, r: LLMConfig) => (
        <Space>
          <Tag color={v ? 'success' : 'default'}>{v ? '已激活' : '未激活'}</Tag>
          {!v && <Button size="small" onClick={() => activateMutation.mutate(r.id)}>启用</Button>}
        </Space>
      ),
    },
    {
      title: '操作', render: (_: any, r: LLMConfig) => (
        <Space>
          <a onClick={() => handleEdit(r)}>编辑</a>
          <Popconfirm title="确定删除？" onConfirm={() => deleteMutation.mutate(r.id)}>
            <a style={{ color: 'red' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>LLM 配置管理</h2>
          <p style={{ color: '#888', margin: '4px 0 0' }}>
            配置 AI 打分所使用的大模型接口，支持 OpenAI 兼容格式
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          setEditingId(null); form.resetFields(); setTestResult(null); setModalOpen(true)
        }}>新增配置</Button>
      </div>

      <Table dataSource={configs} columns={columns} rowKey="id" loading={isLoading} pagination={false} />

      <Modal title={editingId ? '编辑 LLM 配置' : '新增 LLM 配置'} open={modalOpen}
        onOk={() => form.submit()} onCancel={() => { setModalOpen(false); setEditingId(null); setTestResult(null); form.resetFields() }}
        confirmLoading={createMutation.isPending || updateMutation.isPending} width={560}
        footer={(_, { OkBtn, CancelBtn }) => (
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Button icon={<ApiOutlined />} onClick={handleTest} loading={testing}>测试连接</Button>
            <Space><CancelBtn /><OkBtn /></Space>
          </Space>
        )}>
        {testResult && (
          <Alert type={testResult.success ? 'success' : 'error'} message={testResult.message}
            description={testResult.latency_ms ? `响应延迟：${testResult.latency_ms}ms` : undefined}
            style={{ marginBottom: 16 }} showIcon />
        )}
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="name" label="配置名称" rules={[{ required: true }]}>
            <Input placeholder="如：本地 LM Studio" />
          </Form.Item>
          <Form.Item name="base_url" label="API 地址" rules={[{ required: true }]}>
            <Input placeholder="如：http://192.168.2.66:1235/v1" />
          </Form.Item>
          <Form.Item name="api_key" label="API Key"
            extra={editingId ? '留空则保持原有 Key 不变' : '本地 LM Studio 可填任意字符'}>
            <Input.Password placeholder={editingId ? '留空保持不变' : 'lm-studio'} />
          </Form.Item>
          <Form.Item name="model_name" label="模型名称" rules={[{ required: true }]}
            extra="需与 API 平台中的模型名称完全一致">
            <Input placeholder="如：qwen3vl-8b-instruct" />
          </Form.Item>
          <Form.Item name="timeout" label="超时（秒）" initialValue={120}>
            <InputNumber min={10} max={600} style={{ width: '100%' }} addonAfter="秒" />
          </Form.Item>
          <Form.Item name="max_retries" label="最大重试" initialValue={3}>
            <InputNumber min={1} max={10} style={{ width: '100%' }} addonAfter="次" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
