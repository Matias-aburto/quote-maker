import { useState } from 'react'
import { supabase } from './supabaseClient'
import GoogleIcon from './assets/icons8-google.svg'

function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })
        if (signUpError) throw signUpError
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword(
        {
          email,
          password,
        },
      )
      if (signInError) throw signInError
      if (data.user && onAuthenticated) onAuthenticated(data.user)
    } catch (err) {
      setError(err.message ?? 'Error de autenticación')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      })
      if (error) throw error
      // La sesión se detectará en App.jsx mediante onAuthStateChange
    } catch (err) {
      setError(err.message ?? 'Error al iniciar sesión con Google')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h1 className="auth-title">Quote Maker</h1>
        <p className="auth-subtitle">
          Inicia sesión para guardar tus datos de empresa y clientes.
        </p>

        <button
          type="button"
          className="btn auth-google"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <span className="auth-google-icon">
            <img src={GoogleIcon} alt="Google" />
          </span>
          <span>Continuar con Google</span>
        </button>

        <div className="auth-or">
          <span />
          <span>o</span>
          <span />
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-label" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label className="auth-label" htmlFor="auth-password">
            Contraseña
          </label>
          <input
            id="auth-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <p className="auth-error">{error}</p>}

          <button className="btn btn-accent auth-submit" type="submit" disabled={loading}>
            {loading
              ? 'Enviando...'
              : mode === 'signin'
                ? 'Ingresar'
                : 'Crear cuenta'}
          </button>
        </form>
        <button
          type="button"
          className="auth-toggle"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin'
            ? '¿No tienes cuenta? Crear una'
            : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </div>
    </div>
  )
}

export default Auth

