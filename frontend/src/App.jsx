import { useState, useRef, useCallback, useEffect } from 'react'

// ── Auth helpers ──────────────────────────────────────────────────────────────

function getToken() { try { return localStorage.getItem('ap_token') } catch { return null } }
function setToken(t) { try { localStorage.setItem('ap_token', t) } catch {} }
function clearToken() { try { localStorage.removeItem('ap_token') } catch {} }

function parseToken() {
  try {
    const t = getToken()
    if (!t) return null
    return JSON.parse(atob(t.split('.')[1]))
  } catch { return null }
}

function authFetch(url, opts = {}) {
  const token = getToken()
  return fetch(url, {
    ...opts,
    headers: { ...(opts.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
}

function handle401(res) {
  if (res.status === 401) { clearToken(); window.location.reload() }
  return res
}

// ── Brand ─────────────────────────────────────────────────────────────────────

const NAVY = '#1B3A6B'
const ORANGE = '#F47B20'
const RED = '#CC1122'

function BrandLogo({ large = false }) {
  const size = large ? '28px' : '18px'
  const dotSize = large ? '8px' : '5px'
  const dotTop = large ? '-6px' : '-4px'
  const chineseSize = large ? '24px' : '15px'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: large ? 'center' : 'flex-start' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: large ? '4px' : '2px' }}>
        <span style={{ color: NAVY, fontWeight: 800, fontSize: size, lineHeight: 1, letterSpacing: '-0.3px', position: 'relative', display: 'inline-block' }}>
          AscendP
          <span style={{ position: 'relative', display: 'inline-block' }}>
            o
            <span style={{ position: 'absolute', top: dotTop, left: '50%', transform: 'translateX(-50%)', width: dotSize, height: dotSize, backgroundColor: ORANGE, borderRadius: '50%', display: 'block' }} />
          </span>
          int
        </span>
        <span style={{ color: NAVY, fontWeight: 700, fontSize: chineseSize, lineHeight: 1 }}>恒升</span>
      </div>
      {large && (
        <span style={{ color: RED, fontStyle: 'italic', fontWeight: 700, fontSize: '12px', letterSpacing: '0.4px', marginTop: '3px' }}>
          Enriching Your Business
        </span>
      )}
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconUpload = () => (
  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
      d="M12 16v-8m0 0-3 3m3-3 3 3M6 20h12a2 2 0 002-2V8l-6-6H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
  </svg>
)

const IconCheck = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
)

const IconDownload = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)

const IconSpinner = ({ small } = {}) => (
  <svg className={`animate-spin ${small ? 'w-3.5 h-3.5' : 'w-5 h-5'}`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

const IconReset = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

const IconTrash = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const IconPlus = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)

const IconClose = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

function makeFilename(docType, clientName) {
  const type = (docType || 'Other').replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_')
  const client = (clientName || 'Unknown').replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_').slice(0, 40)
  return `${type}_${client}_${todayStr()}.pdf`
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Auth screens ──────────────────────────────────────────────────────────────

function AuthCard({ title, children }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <BrandLogo large />
          <p className="text-sm text-slate-400 mt-3">Document Processor</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          <h2 className="font-semibold text-slate-700 mb-6 text-center">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  )
}

function LoginPage({ onLogin, onGoSignup, onGoForgot }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Login failed')
      setToken(data.token)
      onLogin(data.is_admin)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <AuthCard title="Sign in">
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus required
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent" />
        </div>
        <div className="mb-1">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent" />
        </div>
        <div className="mb-6 text-right">
          <button type="button" onClick={onGoForgot}
            className="text-xs text-[#1B3A6B] hover:text-[#152E57]">Forgot password?</button>
        </div>
        {error && <p className="mb-4 text-xs text-red-500 text-center">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full py-2.5 rounded-xl bg-[#1B3A6B] hover:bg-[#152E57] text-white font-semibold text-sm transition-all disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-2">
          {loading ? <><IconSpinner small /> Signing in...</> : 'Sign in'}
        </button>
      </form>
      <p className="mt-5 text-center text-xs text-slate-400">
        No account?{' '}
        <button onClick={onGoSignup} className="text-[#1B3A6B] hover:text-[#152E57] font-medium">Sign up</button>
      </p>
    </AuthCard>
  )
}

function SignUpPage({ onLogin, onGoLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Registration failed')
      setToken(data.token)
      onLogin(data.is_admin)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <AuthCard title="Create account">
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Work email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus required
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent" />
        </div>
        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Password <span className="text-slate-300">(min 8 characters)</span></label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent" />
        </div>
        <div className="mb-6">
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Confirm password</label>
          <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent" />
        </div>
        {error && <p className="mb-4 text-xs text-red-500 text-center">{error}</p>}
        <button type="submit" disabled={loading}
          className="w-full py-2.5 rounded-xl bg-[#1B3A6B] hover:bg-[#152E57] text-white font-semibold text-sm transition-all disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-2">
          {loading ? <><IconSpinner small /> Creating account...</> : 'Create account'}
        </button>
      </form>
      <p className="mt-5 text-center text-xs text-slate-400">
        Already have an account?{' '}
        <button onClick={onGoLogin} className="text-[#1B3A6B] hover:text-[#152E57] font-medium">Sign in</button>
      </p>
    </AuthCard>
  )
}

function ForgotPasswordPage({ onGoLogin }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Request failed')
      setSent(true)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <AuthCard title="Reset password">
      {sent ? (
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <IconCheck />
          </div>
          <p className="text-sm text-slate-600 mb-6">If that email is registered, a reset link has been sent. Check your inbox.</p>
          <button onClick={onGoLogin} className="text-sm text-[#1B3A6B] hover:text-[#152E57] font-medium">Back to sign in</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <p className="text-xs text-slate-500 mb-5">Enter your email and we'll send you a reset link — or ask your admin to generate one for you directly.</p>
          <div className="mb-6">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus required
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent" />
          </div>
          {error && <p className="mb-4 text-xs text-red-500 text-center">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-xl bg-[#1B3A6B] hover:bg-[#152E57] text-white font-semibold text-sm transition-all disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-2">
            {loading ? <><IconSpinner small /> Sending...</> : 'Send reset link'}
          </button>
          <p className="mt-5 text-center text-xs text-slate-400">
            <button type="button" onClick={onGoLogin} className="text-[#1B3A6B] hover:text-[#152E57] font-medium">Back to sign in</button>
          </p>
        </form>
      )}
    </AuthCard>
  )
}

function ResetPasswordPage({ token, onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Reset failed')
      setToken(data.token)
      setDone(true)
      // Clean URL
      window.history.replaceState({}, '', '/')
      setTimeout(() => onDone(data.is_admin), 1200)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  return (
    <AuthCard title="Set new password">
      {done ? (
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <IconCheck />
          </div>
          <p className="text-sm text-slate-600">Password updated! Signing you in…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">New password <span className="text-slate-300">(min 8 characters)</span></label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoFocus required minLength={8}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent" />
          </div>
          <div className="mb-6">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Confirm password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent" />
          </div>
          {error && <p className="mb-4 text-xs text-red-500 text-center">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-xl bg-[#1B3A6B] hover:bg-[#152E57] text-white font-semibold text-sm transition-all disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-2">
            {loading ? <><IconSpinner small /> Saving...</> : 'Set new password'}
          </button>
        </form>
      )}
    </AuthCard>
  )
}

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS = ['Upload', 'Configure', 'Processing', 'Review']

function StepBar({ current }) {
  const idx = STEPS.indexOf(current)
  return (
    <div className="flex items-center justify-center mb-10">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all
              ${i < idx ? 'bg-[#1B3A6B] text-white' : i === idx ? 'bg-[#1B3A6B] text-white ring-4 ring-[#d0e0f5]' : 'bg-white text-slate-400 border-2 border-slate-200'}`}>
              {i < idx ? <IconCheck /> : i + 1}
            </div>
            <span className={`mt-1.5 text-xs font-medium ${i <= idx ? 'text-[#1B3A6B]' : 'text-slate-400'}`}>{s}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-16 h-0.5 mb-5 mx-1 transition-all ${i < idx ? 'bg-[#1B3A6B]' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Upload step ───────────────────────────────────────────────────────────────

function UploadStep({ onUploaded }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef()

  const uploadFiles = useCallback(async (files) => {
    const pdfs = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'))
    if (!pdfs.length) { setError('Please upload PDF files only.'); return }
    setError('')
    setUploading(true)
    try {
      const results = await Promise.all(pdfs.map(async (file) => {
        const form = new FormData()
        form.append('file', file)
        const res = await authFetch('/api/upload', { method: 'POST', body: form })
        handle401(res)
        if (!res.ok) throw new Error(`Failed to upload ${file.name}`)
        return res.json()
      }))
      onUploaded(results)
    } catch (e) {
      setError(e.message || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }, [onUploaded])

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files)
  }, [uploadFiles])

  return (
    <div>
      <div onClick={() => !uploading && inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`w-full border-2 border-dashed rounded-2xl p-16 flex flex-col items-center justify-center cursor-pointer transition-all
          ${dragging ? 'border-blue-500 bg-[#eef3fb]' : 'border-slate-200 bg-white hover:border-[#4a7ab5] hover:bg-slate-50'}`}>
        <div className={`mb-4 transition-colors ${dragging ? 'text-[#1B3A6B]' : 'text-slate-300'}`}>
          <IconUpload />
        </div>
        {uploading ? (
          <div className="flex items-center gap-2 text-[#1B3A6B] font-medium"><IconSpinner /> Uploading...</div>
        ) : (
          <>
            <p className="text-slate-700 font-semibold text-lg mb-1">Drop your scanned PDFs here</p>
            <p className="text-slate-400 text-sm">Multiple files supported — or click to browse</p>
          </>
        )}
        <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden"
          onChange={(e) => uploadFiles(e.target.files)} />
      </div>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
  )
}

// ── Configure step ────────────────────────────────────────────────────────────

function ConfigureStep({ sessions, onProcess, onAddMore }) {
  const [pageCounts, setPageCounts] = useState(() => Object.fromEntries(sessions.map(s => [s.session_id, ''])))
  const [removed, setRemoved] = useState([])
  const inputRef = useRef()

  const active = sessions.filter(s => !removed.includes(s.session_id))
  const setCount = (id, val) => setPageCounts(p => ({ ...p, [id]: val }))
  const remove = (id) => setRemoved(r => [...r, id])

  const rows = active.map(s => {
    const n = parseInt(pageCounts[s.session_id], 10)
    const valid = !isNaN(n) && n > 0 && n <= s.total_pages && s.total_pages % n === 0
    return { ...s, n, valid, docCount: valid ? s.total_pages / n : null }
  })

  const allValid = rows.length > 0 && rows.every(r => r.valid)
  const totalDocs = rows.reduce((a, r) => a + (r.docCount || 0), 0)

  const handleAddMore = (files) => {
    const pdfs = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf'))
    if (!pdfs.length) return
    Promise.all(pdfs.map(async (file) => {
      const form = new FormData()
      form.append('file', file)
      const res = await authFetch('/api/upload', { method: 'POST', body: form })
      return res.json()
    })).then(results => {
      onAddMore(results)
      results.forEach(r => setPageCounts(p => ({ ...p, [r.session_id]: '' })))
    })
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-800">Configure splits</h2>
          <p className="text-xs text-slate-400 mt-0.5">Enter how many pages each document has per file</p>
        </div>
        <button onClick={() => inputRef.current.click()}
          className="flex items-center gap-1.5 text-sm text-[#1B3A6B] hover:text-[#0f2040] font-medium">
          <IconPlus /> Add more files
        </button>
        <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden"
          onChange={(e) => handleAddMore(e.target.files)} />
      </div>

      <table className="w-full">
        <thead>
          <tr className="text-xs font-medium text-slate-400 uppercase tracking-wide bg-slate-50">
            <th className="text-left px-6 py-3">File</th>
            <th className="text-center px-4 py-3">Total pages</th>
            <th className="text-center px-4 py-3 w-36">Pages per doc</th>
            <th className="text-center px-4 py-3 w-28">Documents</th>
            <th className="px-4 py-3 w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((row) => (
            <tr key={row.session_id} className="hover:bg-slate-50 transition-colors">
              <td className="px-6 py-4">
                <p className="text-sm font-medium text-slate-700 truncate max-w-xs">{row.filename}</p>
              </td>
              <td className="px-4 py-4 text-center text-sm text-slate-500">{row.total_pages}</td>
              <td className="px-4 py-4">
                <input type="number" min="1" value={pageCounts[row.session_id]}
                  onChange={(e) => setCount(row.session_id, e.target.value)} placeholder="1"
                  className={`w-full border rounded-lg px-3 py-1.5 text-sm text-center font-mono focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent
                    ${pageCounts[row.session_id] && !row.valid ? 'border-red-300 bg-red-50' : 'border-slate-200'}`} />
              </td>
              <td className="px-4 py-4 text-center">
                {row.valid ? <span className="text-sm font-semibold text-emerald-600">{row.docCount}</span>
                  : pageCounts[row.session_id] ? <span className="text-xs text-red-500">not divisible</span>
                  : <span className="text-slate-300">—</span>}
              </td>
              <td className="px-4 py-4 text-center">
                <button onClick={() => remove(row.session_id)}
                  className="text-slate-300 hover:text-red-400 transition-colors"><IconTrash /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
        <p className="text-sm text-slate-400">
          {allValid && <span className="text-emerald-600 font-medium">{totalDocs} total documents across {rows.length} file{rows.length !== 1 ? 's' : ''}</span>}
        </p>
        <button onClick={() => onProcess(rows.map(r => ({ session_id: r.session_id, page_count: r.n })))}
          disabled={!allValid}
          className="px-6 py-2.5 rounded-xl font-semibold text-white text-sm transition-all
            bg-[#1B3A6B] hover:bg-[#152E57] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed">
          {allValid ? `Split & Name ${totalDocs} Documents` : 'Split & Name Documents'}
        </button>
      </div>
    </div>
  )
}

// ── Processing step ───────────────────────────────────────────────────────────

function ProcessingStep({ fileCount }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-16 flex flex-col items-center">
      <div className="w-16 h-16 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin mb-6" />
      <p className="text-slate-800 font-semibold text-lg mb-1">Analysing documents</p>
      <p className="text-slate-400 text-sm">Reading {fileCount} file{fileCount !== 1 ? 's' : ''} with Gemini AI...</p>
    </div>
  )
}

// ── Review step ───────────────────────────────────────────────────────────────

function ReviewStep({ documents: initialDocs, onReset }) {
  const [docs, setDocs] = useState(initialDocs)
  const [downloading, setDownloading] = useState(false)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [downloadingRow, setDownloadingRow] = useState(null)

  const update = (i, field, value) => {
    setDocs(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      next[i].suggested_name = makeFilename(next[i].doc_type, next[i].client_name)
      return next
    })
  }

  const handleDownloadAll = async () => {
    setDownloading(true)
    try {
      const sessionMap = {}
      docs.forEach(doc => {
        if (!sessionMap[doc.session_id]) sessionMap[doc.session_id] = []
        sessionMap[doc.session_id].push(doc)
      })
      const sessions = Object.entries(sessionMap).map(([session_id, documents]) => ({ session_id, documents }))
      const res = await authFetch('/api/download-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions }),
      })
      handle401(res)
      if (!res.ok) throw new Error('Download failed')
      triggerDownload(await res.blob(), 'processed_documents.zip')
    } catch (e) { alert(e.message) } finally { setDownloading(false) }
  }

  const handleDownloadAllPdfs = async () => {
    setDownloadingAll(true)
    try {
      for (const doc of docs) {
        const res = await authFetch(`/api/download/${doc.session_id}/${doc.index}?filename=${encodeURIComponent(doc.suggested_name)}`)
        if (!res.ok) continue
        triggerDownload(await res.blob(), doc.suggested_name)
        await new Promise(r => setTimeout(r, 400))
      }
    } finally { setDownloadingAll(false) }
  }

  const handleDownloadOne = async (doc) => {
    setDownloadingRow(`${doc.session_id}-${doc.index}`)
    try {
      const res = await authFetch(`/api/download/${doc.session_id}/${doc.index}?filename=${encodeURIComponent(doc.suggested_name)}`)
      handle401(res)
      if (!res.ok) throw new Error('Download failed')
      triggerDownload(await res.blob(), doc.suggested_name)
    } catch (e) { alert(e.message) } finally { setDownloadingRow(null) }
  }

  const grouped = docs.reduce((acc, doc) => {
    const key = doc.source_filename
    if (!acc[key]) acc[key] = []
    acc[key].push(doc)
    return acc
  }, {})

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-800">Review & confirm</h2>
            <p className="text-xs text-slate-400 mt-0.5">Edit any field before downloading</p>
          </div>
          <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {docs.length} document{docs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {Object.entries(grouped).map(([filename, groupDocs]) => (
          <div key={filename}>
            <div className="px-6 py-2 bg-slate-50 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide truncate">{filename}</p>
            </div>
            <div className="divide-y divide-slate-50">
              {groupDocs.map((doc) => {
                const globalIdx = docs.findIndex(d => d.session_id === doc.session_id && d.index === doc.index)
                const rowKey = `${doc.session_id}-${doc.index}`
                return (
                  <div key={rowKey} className={`px-6 py-5 transition-colors ${doc.error ? 'bg-amber-50 hover:bg-amber-50' : 'hover:bg-slate-50'}`}>
                    {doc.error && (
                      <div className="mb-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-100 border border-amber-200 rounded-lg px-3 py-2">
                        <svg className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        {doc.error} — please fill in manually below.
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${doc.error ? 'bg-amber-100 text-amber-600' : 'bg-[#eef3fb] text-[#1B3A6B]'}`}>
                        {globalIdx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="grid grid-cols-2 gap-3 mb-2">
                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Document Type</label>
                            <input value={doc.doc_type} onChange={(e) => update(globalIdx, 'doc_type', e.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent min-w-0" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Client Name</label>
                            <input value={doc.client_name} onChange={(e) => update(globalIdx, 'client_name', e.target.value)}
                              className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent min-w-0" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-slate-400">Folder:</span>
                          <span className="text-xs font-medium text-[#1B3A6B] bg-[#eef3fb] px-2 py-0.5 rounded">
                            {(doc.doc_type || 'Other').replace(/\s+/g, '_')}/
                          </span>
                          <span className="text-xs text-slate-400">File:</span>
                          <span className="text-xs font-mono text-slate-600 truncate">{doc.suggested_name}</span>
                          <span className="text-xs text-slate-300">{doc.page_count}p</span>
                          <button onClick={() => handleDownloadOne(doc)} disabled={downloadingRow === rowKey}
                            className="ml-auto flex-shrink-0 text-xs text-[#1B3A6B] hover:text-[#0f2040] disabled:text-slate-300 font-medium flex items-center gap-1">
                            {downloadingRow === rowKey ? <IconSpinner small /> : <IconDownload />}
                            {downloadingRow === rowKey ? '' : 'Download'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-3 flex-wrap">
        <button onClick={onReset}
          className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-sm transition-all">
          <IconReset /> Process another batch
        </button>
        <button onClick={handleDownloadAllPdfs} disabled={downloadingAll || downloading}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#b8cfe8] text-[#1B3A6B] hover:bg-[#eef3fb] font-semibold text-sm transition-all disabled:border-slate-200 disabled:text-slate-400">
          {downloadingAll ? <><IconSpinner /> Downloading...</> : <><IconDownload /> Download All as PDF</>}
        </button>
        <button onClick={handleDownloadAll} disabled={downloading || downloadingAll}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1B3A6B] hover:bg-[#152E57] text-white font-semibold transition-all disabled:bg-slate-200 disabled:text-slate-400">
          {downloading ? <><IconSpinner /> Preparing...</> : <><IconDownload /> Download All as ZIP</>}
        </button>
      </div>
    </div>
  )
}

// ── Admin logs panel ──────────────────────────────────────────────────────────

const LEVEL_STYLES = {
  ERROR:   'bg-red-100 text-red-700',
  WARNING: 'bg-amber-100 text-amber-700',
  INFO:    'bg-slate-100 text-slate-600',
}

function LogsPanel({ onClose }) {
  const [entries, setEntries] = useState([])
  const [filter, setFilter] = useState('ALL')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [loading, setLoading] = useState(false)
  const [lastFetched, setLastFetched] = useState(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = filter !== 'ALL' ? `?level=${filter}` : ''
      const res = await authFetch(`/api/admin/logs${params}`)
      handle401(res)
      const data = await res.json()
      setEntries(data.entries || [])
      setLastFetched(new Date().toLocaleTimeString())
    } catch (e) {} finally { setLoading(false) }
  }, [filter])

  useEffect(() => { fetchLogs() }, [fetchLogs])
  useEffect(() => {
    if (!autoRefresh) return
    const id = setInterval(fetchLogs, 10000)
    return () => clearInterval(id)
  }, [autoRefresh, fetchLogs])

  const counts = entries.reduce((a, e) => { a[e.level] = (a[e.level] || 0) + 1; return a }, {})

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-slate-800">Activity Log</h2>
            {lastFetched && <p className="text-xs text-slate-400 mt-0.5">Last updated {lastFetched}</p>}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
              <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="rounded" />
              Auto-refresh
            </label>
            <button onClick={fetchLogs} disabled={loading}
              className="text-xs text-[#1B3A6B] hover:text-[#0f2040] font-medium disabled:text-slate-300">
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><IconClose /></button>
          </div>
        </div>
        <div className="flex gap-2 px-5 py-3 border-b border-slate-100 flex-wrap">
          {['ALL', 'ERROR', 'WARNING', 'INFO'].map(lvl => (
            <button key={lvl} onClick={() => setFilter(lvl)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all
                ${filter === lvl ? 'bg-[#1B3A6B] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {lvl}{lvl !== 'ALL' && counts[lvl] ? <span className="ml-1 opacity-70">{counts[lvl]}</span> : null}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-400 self-center">{entries.length} entries</span>
        </div>
        <div className="flex-1 overflow-y-auto font-mono text-xs">
          {entries.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-slate-300">No entries</div>
          ) : entries.map((e, i) => (
            <div key={i} className={`px-5 py-2.5 border-b border-slate-50
              ${e.level === 'ERROR' ? 'bg-red-50' : e.level === 'WARNING' ? 'bg-amber-50' : ''}`}>
              <div className="flex gap-3 items-start">
                <span className="text-slate-300 flex-shrink-0 w-36">{e.ts}</span>
                <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${LEVEL_STYLES[e.level] || LEVEL_STYLES.INFO}`}>
                  {e.level}
                </span>
                <span className={`break-all leading-relaxed ${e.level === 'ERROR' ? 'text-red-700' : e.level === 'WARNING' ? 'text-amber-700' : 'text-slate-600'}`}>
                  {e.message}
                </span>
              </div>
              {e.meta && (
                <div className="ml-[10.5rem] mt-1.5 flex gap-1.5 flex-wrap">
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono">
                    {e.meta.input_tokens}in + {e.meta.output_tokens}out tokens
                  </span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-mono">
                    ${e.meta.cost_usd.toFixed(6)}
                  </span>
                  <span className="text-[10px] bg-[#eef3fb] text-[#1B3A6B] px-2 py-0.5 rounded-full font-mono">
                    {e.meta.latency_ms}ms
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Admin users panel ─────────────────────────────────────────────────────────

function UsersPanel({ onClose }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [resetLink, setResetLink] = useState(null) // {email, url}
  const [copied, setCopied] = useState(false)

  const fetchUsers = useCallback(async () => {
    const res = await authFetch('/api/admin/users')
    handle401(res)
    const data = await res.json()
    setUsers(data.users || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const toggle = async (user, field) => {
    const newVal = user[field] ? 0 : 1
    await authFetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: newVal }),
    })
    setUsers(u => u.map(x => x.id === user.id ? { ...x, [field]: newVal } : x))
  }

  const remove = async (user) => {
    if (!confirm(`Delete ${user.email}? This cannot be undone.`)) return
    await authFetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
    setUsers(u => u.filter(x => x.id !== user.id))
  }

  const getResetLink = async (user) => {
    const res = await authFetch(`/api/admin/users/${user.id}/reset-link`, { method: 'POST' })
    const data = await res.json()
    setResetLink({ email: data.email, url: data.url })
    setCopied(false)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(resetLink.url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Staff accounts</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><IconClose /></button>
        </div>

        {/* Reset link modal */}
        {resetLink && (
          <div className="mx-5 mt-4 p-4 bg-[#eef3fb] border border-[#b8cfe8] rounded-xl">
            <p className="text-xs font-semibold text-blue-700 mb-1">Reset link for {resetLink.email}</p>
            <p className="text-xs text-[#1B3A6B] mb-3">Expires in 1 hour. Send this via Teams or WhatsApp.</p>
            <div className="flex gap-2">
              <input readOnly value={resetLink.url}
                className="flex-1 text-xs font-mono bg-white border border-[#b8cfe8] rounded-lg px-3 py-2 text-slate-600 focus:outline-none" />
              <button onClick={copyLink}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex-shrink-0
                  ${copied ? 'bg-emerald-500 text-white' : 'bg-[#1B3A6B] text-white hover:bg-[#152E57]'}`}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button onClick={() => setResetLink(null)}
                className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-600">✕</button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto mt-2">
          {loading ? (
            <div className="flex items-center justify-center h-32 gap-2 text-slate-400"><IconSpinner /> Loading...</div>
          ) : users.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-slate-300">No users</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-medium text-slate-400 uppercase tracking-wide bg-slate-50">
                  <th className="text-left px-5 py-3">Email</th>
                  <th className="text-center px-3 py-3">Active</th>
                  <th className="text-center px-3 py-3">Admin</th>
                  <th className="text-center px-3 py-3">Joined</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-700 font-medium truncate max-w-[180px]">{u.email}</td>
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => toggle(u, 'is_active')}
                        className={`w-10 h-5 rounded-full transition-colors relative ${u.is_active ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${u.is_active ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => toggle(u, 'is_admin')}
                        className={`w-10 h-5 rounded-full transition-colors relative ${u.is_admin ? 'bg-[#eef3fb]0' : 'bg-slate-200'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${u.is_admin ? 'left-5' : 'left-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-3 py-3 text-center text-slate-400 text-xs">{u.created_at?.slice(0, 10)}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => getResetLink(u)}
                          className="text-xs text-[#1B3A6B] hover:text-[#152E57] font-medium whitespace-nowrap">
                          Reset link
                        </button>
                        <button onClick={() => remove(u)} className="text-slate-200 hover:text-red-400 transition-colors">
                          <IconTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

const IDLE_TIMEOUT_MS = 30 * 60 * 1000

export default function App() {
  // Check URL for password reset token
  const resetToken = new URLSearchParams(window.location.search).get('token')

  const [authed, setAuthed] = useState(() => !!getToken())
  const [isAdmin, setIsAdmin] = useState(() => !!parseToken()?.is_admin)
  const [authPage, setAuthPage] = useState('login') // 'login' | 'signup' | 'forgot'
  const [logsOpen, setLogsOpen] = useState(false)
  const [usersOpen, setUsersOpen] = useState(false)
  const [step, setStep] = useState('Upload')
  const [sessions, setSessions] = useState([])
  const [documents, setDocuments] = useState([])

  const logout = useCallback(() => { clearToken(); setAuthed(false); setIsAdmin(false) }, [])

  const handleLogin = useCallback((adminFlag) => {
    setIsAdmin(!!adminFlag)
    setAuthed(true)
  }, [])

  useEffect(() => {
    if (!authed) return
    let timer = setTimeout(logout, IDLE_TIMEOUT_MS)
    const reset = () => { clearTimeout(timer); timer = setTimeout(logout, IDLE_TIMEOUT_MS) }
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    return () => { clearTimeout(timer); events.forEach(e => window.removeEventListener(e, reset)) }
  }, [authed, logout])

  // Reset password flow (arrived via email link)
  if (resetToken) {
    return <ResetPasswordPage token={resetToken} onDone={handleLogin} />
  }

  if (!authed) {
    if (authPage === 'signup') return <SignUpPage onLogin={handleLogin} onGoLogin={() => setAuthPage('login')} />
    if (authPage === 'forgot') return <ForgotPasswordPage onGoLogin={() => setAuthPage('login')} />
    return <LoginPage onLogin={handleLogin} onGoSignup={() => setAuthPage('signup')} onGoForgot={() => setAuthPage('forgot')} />
  }

  const handleUploaded = (results) => { setSessions(results); setStep('Configure') }
  const handleAddMore = (results) => setSessions(prev => [...prev, ...results])

  const handleProcess = async (configs) => {
    setStep('Processing')
    try {
      const allDocs = []
      await Promise.all(configs.map(async ({ session_id, page_count }) => {
        const session = sessions.find(s => s.session_id === session_id)
        const res = await authFetch(`/api/process/${session_id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page_count }),
        })
        handle401(res)
        if (!res.ok) throw new Error((await res.json()).detail)
        const data = await res.json()
        data.documents.forEach(doc => {
          allDocs.push({ ...doc, session_id, source_filename: session?.filename || session_id })
        })
      }))
      allDocs.sort((a, b) => {
        const ai = configs.findIndex(c => c.session_id === a.session_id)
        const bi = configs.findIndex(c => c.session_id === b.session_id)
        return ai !== bi ? ai - bi : a.index - b.index
      })
      setDocuments(allDocs)
      setStep('Review')
    } catch (e) {
      alert(e.message || 'Processing failed.')
      setStep('Configure')
    }
  }

  const reset = () => { setStep('Upload'); setSessions([]); setDocuments([]) }

  return (
    <div className="min-h-screen bg-slate-50">
      {logsOpen && <LogsPanel onClose={() => setLogsOpen(false)} />}
      {usersOpen && <UsersPanel onClose={() => setUsersOpen(false)} />}

      <header className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="flex-1">
            <BrandLogo />
          </div>
          {isAdmin && (
            <>
              <button onClick={() => setUsersOpen(true)}
                className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors">Users</button>
              <span className="text-slate-200">|</span>
            </>
          )}
          <button onClick={() => setLogsOpen(true)}
            className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors">Logs</button>
          <span className="text-slate-200">|</span>
          <button onClick={logout}
            className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors">Sign out</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <StepBar current={step} />
        {step === 'Upload' && <UploadStep onUploaded={handleUploaded} />}
        {step === 'Configure' && <ConfigureStep sessions={sessions} onProcess={handleProcess} onAddMore={handleAddMore} />}
        {step === 'Processing' && <ProcessingStep fileCount={sessions.length} />}
        {step === 'Review' && <ReviewStep documents={documents} onReset={reset} />}
      </main>
    </div>
  )
}
