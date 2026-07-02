import axios from 'axios'

// Point this at your Django server. If you're using Vite env vars,
// set VITE_API_BASE_URL in a .env file instead of hardcoding it.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/auth'

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

export default apiClient