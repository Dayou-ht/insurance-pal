import { Component } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex items-center justify-center h-full p-8">
          <div className="bg-white rounded-xl p-8 border border-red-100 max-w-md text-center shadow-sm">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-800 mb-2">页面渲染异常</h2>
            <p className="text-sm text-gray-500 mb-1">某个组件发生了错误，但其他功能不受影响。</p>
            {this.state.error && (
              <p className="text-xs text-red-400 bg-red-50 rounded p-2 mb-4 font-mono truncate">
                {this.state.error.message}
              </p>
            )}
            <div className="flex gap-3 justify-center">
              <button onClick={this.handleRetry}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                <RefreshCw className="w-4 h-4" /> 重试
              </button>
              <a href="/"
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                <Home className="w-4 h-4" /> 回到首页
              </a>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
