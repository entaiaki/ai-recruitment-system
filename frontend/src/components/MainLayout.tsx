import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Avatar, Dropdown } from 'antd'
import {
  DashboardOutlined, ProjectOutlined, TeamOutlined,
  FileTextOutlined, SettingOutlined, LogoutOutlined,
} from '@ant-design/icons'
import { useAuthStore } from '@/store/authStore'

const { Header, Sider, Content } = Layout

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, clearAuth } = useAuthStore()

  const menuItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
    { key: '/jobs', icon: <ProjectOutlined />, label: '岗位管理' },
    { key: '/candidates', icon: <TeamOutlined />, label: '候选人' },
    { key: '/applications', icon: <FileTextOutlined />, label: '投递管理' },
    { key: '/llm-config', icon: <SettingOutlined />, label: 'LLM 配置' },
  ]

  const handleLogout = () => { clearAuth(); navigate('/login') }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={220} style={{ position: 'fixed', height: '100vh', left: 0, top: 0, zIndex: 100 }}>
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          🤖 AI 招聘系统
        </div>
        <Menu theme="dark" mode="inline" selectedKeys={[location.pathname]} items={menuItems}
          onClick={({ key }) => navigate(key)} style={{ marginTop: 8 }} />
      </Sider>
      <Layout style={{ marginLeft: 220 }}>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <Dropdown menu={{ items: [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout }] }} placement="bottomRight">
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar style={{ backgroundColor: '#667eea' }}>{user?.full_name?.[0] ?? 'U'}</Avatar>
              <span>{user?.full_name}</span>
              <span style={{ color: '#888', fontSize: 12 }}>[{user?.role}]</span>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
