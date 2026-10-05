import { Component } from 'react'
import type { ReactNode } from 'react'
import { QueryErrorPanel } from '#/components/ui/query-error-panel.tsx'
import { getConvexErrorData } from '#/lib/convex-error.ts'
import { isDefiniteErrorReason } from '#/lib/definite-error-reason.ts'

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
      // An invalid link or a bill that is gone does not come back on retry;
      // anything else (including other server reasons) still offers one.
      const reason = getConvexErrorData(this.state.error)
      const definite = isDefiniteErrorReason(reason)
      return (
        <div className="page-container py-10">
          <QueryErrorPanel
            message={reason ?? undefined}
            onRetry={
              definite ? undefined : () => this.setState({ error: null })
            }
          />
        </div>
      )
    }

    return this.props.children
  }
}
