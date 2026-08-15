import { Component } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export default class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, retry: 0 };
  }

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error, info) {
    console.error('[SOLID page error]', error, info);
  }

  componentDidUpdate(previousProps) {
    if (this.state.error && previousProps.routeKey !== this.props.routeKey) this.setState({ error: null });
  }

  retry = () => this.setState(current => ({ error: null, retry: current.retry + 1 }));

  render() {
    if (!this.state.error) return <div key={this.state.retry} className="page-boundary-content">{this.props.children}</div>;
    return <main className="page page-error" role="alert">
      <section className="card page-error-card">
        <span><AlertTriangle size={25}/></span>
        <div><p className="eyebrow">NAVEGAÇÃO</p><h1>Não foi possível abrir esta página</h1><p>O painel continua funcionando. Tente carregar o módulo novamente ou volte à visão geral.</p></div>
        <div className="page-error-actions"><button className="secondary" type="button" onClick={this.retry}><RefreshCw size={17}/> Tentar novamente</button><button className="primary" type="button" onClick={this.props.onHome}><Home size={17}/> Visão geral</button></div>
      </section>
    </main>;
  }
}
