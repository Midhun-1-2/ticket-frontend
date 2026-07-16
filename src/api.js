import axios from 'axios'

// Adjust if your Django API runs elsewhere (e.g. via a Vite proxy)
const API_BASE = 'http://localhost:8000/'

// Endpoints that don't need — and shouldn't send — an auth token.
const PUBLIC_ENDPOINTS = ['login', 'detect-role', 'signup', 'register', 'my-ip', 'force-logout']

// Matches only the public onboarding submission route, not the admin-only onboarding/* routes.
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

// Stable per-browser id, generated once and persisted — lets the backend
// tell "this same device logging in again" apart from "a different device",
// for the single-active-session login check.
export function getDeviceId() {
  let id = localStorage.getItem('device_id')
  if (!id) {
    id = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`)
    localStorage.setItem('device_id', id)
  }
  return id
}

// Attaches the JWT access token to every outgoing request, except public endpoints.
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

    // A 401 that survives a refresh-and-retry means the new access token
    // was rejected too — e.g. this session was signed out from the login
    // screen's "logout from all devices" or superseded by a newer login
    // elsewhere (see DeviceCheckedJWTAuthentication on the backend). Not
    // recoverable by refreshing again, so just clear the session.
    if (status === 401 && originalRequest._retry && !isAuthEndpoint) {
      clearSession()
      return Promise.reject(error)
    }

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

// Clears all locally-stored session data and redirects to the landing page.
export function clearSession() {
  localStorage.removeItem('access')
  localStorage.removeItem('refresh')
  localStorage.removeItem('role')
  window.location.href = '/'
}

// Full logout: blacklists the refresh token server-side, then clears local session.
export async function logout() {
  const refresh = localStorage.getItem('refresh')
  try {
    if (refresh) {
      await api.post('logout/', { refresh })
    }
  } catch (err) {
    // Intentionally swallowed — see comment above.
  } finally {
    clearSession()
  }
}

export default api