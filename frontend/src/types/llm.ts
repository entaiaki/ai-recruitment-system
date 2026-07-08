export interface LLMConfig {
  id: number
  name: string
  base_url: string
  api_key: string
  model_name: string
  timeout: number
  max_retries: number
  is_active: boolean
  created_at: string
  updated_at: string
}
