import { Component } from 'react'
import type { ReactNode } from 'react'
import { QueryErrorPanel } from '#/components/ui/query-error-panel.tsx'
import { getConvexErrorData } from '#/lib/guest-participant-session.ts'
import { GUEST_FLOW_MESSAGES } from '../../../shared/guest-flow-messages.ts'

const DEFINITE_REASONS = new Set<string>([
  GUEST_FLOW_MESSAGES.invalidShareLink,
  GUEST_FLOW_MESSAGES.billNotFound,
])

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
      const definite = reason !== null && DEFINITE_REASONS.has(reason)
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
