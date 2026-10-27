import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <section className="schedule-state schedule-error" style={{ maxWidth: '650px', margin: '4rem auto', padding: '2rem' }}>
          <p className="kicker">Application Error</p>
          <h2 style={{ color: 'var(--danger, #a43f2e)' }}>Something went wrong rendering this page.</h2>
          <p style={{ marginTop: '0.75rem', color: '#555e6d' }}>
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="button" onClick={this.handleReset}>
              Reload Page
            </button>
            <a href="/" className="button button--secondary">
              Go to Home
            </a>
          </div>
        </section>
      )
    }

    return this.props.children
  }
}
