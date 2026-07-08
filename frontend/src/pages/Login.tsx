import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import http from '@/services/http'
import { authApi } from '@/services/auth'
import { useAuthStore } from '@/store/authStore'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true)
    try {
      const token = await authApi.login(values.email, values.password)
      // 先存 token，否则 getMe 的拦截器读不到
      localStorage.setItem('token', token.access_token)
      http.defaults.headers.common['Authorization'] = `Bearer ${token.access_token}`
      const user = await authApi.getMe()
      setAuth(token.access_token, user)
      message.success('登录成功')
      navigate('/dashboard')
    } catch {
      localStorage.removeItem('token')
      message.error('邮箱或密码错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card title="🤖 AI 招聘系统" style={{ width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <Form onFinish={onFinish} size="large">
          <Form.Item name="email" rules={[{ required: true, message: '请输入邮箱' }]}>
            <Input prefix={<UserOutlined />} placeholder="邮箱" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
