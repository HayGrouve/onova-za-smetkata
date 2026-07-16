import { Component } from 'react'
import type { ReactNode } from 'react'
import { QueryErrorPanel } from '#/components/ui/query-error-panel.tsx'

interface QueryErrorBoundaryProps {
  children: ReactNode
  resetKey?: string | number
}

interface QueryErrorBoundaryState {
  error: Error | null
}

export class QueryErrorBoundary extends Component<
  QueryErrorBoundaryProps,
  QueryErrorBoundaryState
> {
  state: QueryErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): QueryErrorBoundaryState {
    return { error }
  }

  componentDidUpdate(prevProps: QueryErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="page-container py-10">
          <QueryErrorPanel onRetry={() => this.setState({ error: null })} />
        </div>
      )
    }

    return this.props.children
  }
}
