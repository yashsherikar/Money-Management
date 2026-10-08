import { Component } from 'react'

/**
 * Stops one broken screen/popup from white-screening the whole app.
 * - Default: shows the error with Retry / Home, so a crash is visible and reportable.
 * - `silent`: renders nothing (for background popups — they just disappear).
 * Pass a changing `resetKey` (e.g. the route) to recover automatically on navigation.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', this.props.name || '', error, info?.componentStack)
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.silent) return null
    return (
      <div className="m-4 p-4 rounded-xl border border-red-200 bg-red-50 text-sm">
        <div className="font-semibold text-red-800 mb-1">Something went wrong on this screen.</div>
        <div className="text-red-700 break-words mb-3" style={{ overflowWrap: 'anywhere' }}>
          {String(error?.message || error)}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="px-3 py-2 rounded-md bg-red-600 text-white font-medium"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={() => window.location.assign('/')}
            className="px-3 py-2 rounded-md border border-red-300 text-red-800"
          >
            Home
          </button>
        </div>
      </div>
    )
  }
}
