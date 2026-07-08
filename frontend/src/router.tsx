import { createBrowserRouter, Navigate } from 'react-router-dom'
import MainLayout from '@/components/MainLayout'
import LoginPage from '@/pages/Login'
import DashboardPage from '@/pages/Dashboard'
import JobsPage from '@/pages/Jobs'
import JobDetailPage from '@/pages/JobDetail'
import CandidatesPage from '@/pages/Candidates'
import ApplicationsPage from '@/pages/Applications'
import ApplicationDetailPage from '@/pages/ApplicationDetail'
import LLMConfigPage from '@/pages/LLMConfig'
import { RequireRole } from '@/components/RequireRole'

function authLoader() {
  const token = localStorage.getItem('token')
  if (!token) throw new Response('', { status: 302, headers: { Location: '/login' } })
  return null
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <MainLayout />,
    loader: authLoader,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'jobs', element: <JobsPage /> },
      { path: 'jobs/:id', element: <JobDetailPage /> },
      { path: 'candidates', element: <CandidatesPage /> },
      { path: 'applications', element: <ApplicationsPage /> },
      { path: 'applications/:id', element: <ApplicationDetailPage /> },
      {
        path: 'llm-config',
        element: <RequireRole roles={['admin']}><LLMConfigPage /></RequireRole>,
      },
    ],
  },
])
