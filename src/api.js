import axios from 'axios'

// Adjust if your Django API runs elsewhere (e.g. via a Vite proxy)
const API_BASE = 'http://localhost:8000/'

// Endpoints that don't need — and shouldn't send — an auth token.
// NOTE: 'onboarding' is intentionally NOT a plain substring here anymore.
// Only the public self-registration submission route is public; everything
// else under onboarding/ (pending list, detail, approve, reject) is admin-only
// and must carry the JWT.
const PUBLIC_ENDPOINTS = ['login', 'detect-role', 'signup', 'register']

// Matches ONLY the public onboarding submission route, e.g.:
//   POST onboarding/            -> public
//   POST onboarding/register/   -> public (if that's the path you use)
// Does NOT match:
//   onboarding/pending/         -> admin
//   onboarding/123/             -> admin
//   onboarding/123/approve/     -> admin
//   onboarding/123/reject/      -> admin
const PUBLIC_ONBOARDING_PATTERN = /^\/?onboarding\/?(register\/?)?$/

function isPublicEndpoint(url) {
  if (!url) return false

  // Strip any leading slash and querystring for matching purposes
  const path = url.split('?')[0]

  if (PUBLIC_ONBOARDING_PATTERN.test(path)) {
    return true
  }

  // Substring match is fine for the other, unambiguous public routes —
  // none of them collide with admin-only paths.
  return PUBLIC_ENDPOINTS.some((p) => path.includes(p))
}

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

// Attach the JWT access token to every outgoing request, if we have one —
// but skip public endpoints, since an expired/stale token would otherwise
// get validated (and rejected) before the view's own logic even runs.
api.interceptors.request.use((config) => {
  if (!isPublicEndpoint(config.url)) {
    const token = localStorage.getItem('access')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// If a request fails with 401 (expired access token), try refreshing it
// once using the refresh token, then retry the original request.
let isRefreshing = false
let pendingQueue = []

function resolvePending(token) {
  pendingQueue.forEach((cb) => cb(token))
  pendingQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const status = error.response?.status

    // Don't try to refresh on the login/refresh/detect-role endpoints themselves
    const isAuthEndpoint = isPublicEndpoint(originalRequest.url)

    if (status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      const refreshToken = localStorage.getItem('refresh')
      if (!refreshToken) {
        clearSession()
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // Queue this request until the in-flight refresh finishes
        return new Promise((resolve, reject) => {
          pendingQueue.push((newToken) => {
            if (!newToken) return reject(error)
            originalRequest.headers.Authorization = `Bearer ${newToken}`
            resolve(api(originalRequest))
          })
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const { data } = await axios.post(`${API_BASE}login/refresh/`, {
          refresh: refreshToken,
        })
        localStorage.setItem('access', data.access)
        resolvePending(data.access)
        originalRequest.headers.Authorization = `Bearer ${data.access}`
        return api(originalRequest)
      } catch (refreshError) {
        resolvePending(null)
        clearSession()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

function clearSession() {
  localStorage.removeItem('access')
  localStorage.removeItem('refresh')
  localStorage.removeItem('role')
  window.location.href = '/login/'
}

export default api