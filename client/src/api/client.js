import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    // skipAuthRedirect: the caller handles 401 itself (auto-save warns instead of leaving the page and losing edits)
    if (err.response?.status === 401 && !err.config.url.includes('/auth/login') && !err.config.skipAuthRedirect) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
