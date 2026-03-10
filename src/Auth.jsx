import { useState } from 'react'
import { supabase } from './supabaseClient'
import GoogleIcon from './assets/icons8-google.svg'

function Auth({ onAuthenticated }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const getFriendlyErrorMessage = (err, context) => {
    const message = err?.message?.toLowerCase() ?? ''

    if (context === 'password-signin') {
      if (message.includes('invalid login credentials')) {
        return 'Email o contraseña incorrectos.'
      }
      if (message.includes('email not confirmed')) {
        return 'Debes confirmar tu email antes de ingresar.'
      }
      if (message.includes('new row violates unique constraint')) {
        return 'Ya existe una cuenta con este email.'
      }
      if (message.includes('password should be at least')) {
        return 'La contraseña es demasiado débil.'
      }
      return 'No se pudo iniciar sesión. Revisa tus datos e inténtalo nuevamente.'
    }

    if (context === 'password-signup') {
      if (message.includes('new row violates unique constraint')) {
        return 'Ya existe una cuenta con este email. Intenta iniciar sesión.'
      }
      if (message.includes('password should be at least')) {
        return 'La contraseña es demasiado débil. Usa al menos 6 caracteres.'
      }
      return 'No se pudo crear la cuenta. Revisa los datos e inténtalo nuevamente.'
    }

    if (context === 'google') {
      if (message.includes('cancelled')) {
        return 'Inicio de sesión con Google cancelado.'
      }
      return 'No se pudo iniciar sesión con Google. Intenta nuevamente más tarde.'
    }

    return 'Ocurrió un error. Intenta nuevamente.'
  }

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
        if (signUpError) {
          throw { ...signUpError, _context: 'password-signup' }
        }
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword(
        {
          email,
          password,
        },
      )
      if (signInError) {
        throw { ...signInError, _context: 'password-signin' }
      }
      if (data.user && onAuthenticated) onAuthenticated(data.user)
    } catch (err) {
      const friendly = getFriendlyErrorMessage(err, err._context || (mode === 'signup' ? 'password-signup' : 'password-signin'))
      setError(friendly)
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
      if (error) {
        throw { ...error, _context: 'google' }
      }
      // La sesión se detectará en App.jsx mediante onAuthStateChange
    } catch (err) {
      const friendly = getFriendlyErrorMessage(err, err._context || 'google')
      setError(friendly)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h1 className="auth-title">Quote Maker</h1>

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
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <p className="auth-error" role="alert" aria-live="polite">
              {error}
            </p>
          )}

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

