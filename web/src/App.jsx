import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  CircuitBoard,
  Database,
  FileText,
  Gauge,
  Keyboard,
  LayoutDashboard,
  Moon,
  Ruler,
  Search,
  Settings,
  Sun,
  Upload,
  X,
  Zap,
} from 'lucide-react'
import { AppProvider } from './context/AppContext'
import { ToastProvider } from './components/Toast'

const Dashboard = lazy(() => import('./tabs/Dashboard'))
const Dados = lazy(() => import('./tabs/Dados'))
const Medidas = lazy(() => import('./tabs/Medidas'))
const Circuitos = lazy(() => import('./tabs/Circuitos'))
const Simulacao = lazy(() => import('./tabs/Simulacao'))
const Fasores = lazy(() => import('./tabs/Fasores'))
const QualidadeEnergia = lazy(() => import('./tabs/QualidadeEnergia'))
const EnergiaDemandaFP = lazy(() => import('./tabs/EnergiaDemandaFP'))
const Metrologia = lazy(() => import('./tabs/Metrologia'))
const Relatorios = lazy(() => import('./tabs/Relatorios'))

const TABS = [
  {
    id: 'dashboard',
    Icon: LayoutDashboard,
    label: 'Dashboard',
    area: 'Visão executiva',
    description: 'Síntese técnica dos indicadores de energia e qualidade',
    keywords: 'inicio indicadores alarmes kpi monitoramento resumo tecnico',
    Component: Dashboard,
  },
  {
    id: 'dados',
    Icon: Database,
    label: 'Dados',
    area: 'Aquisição e preparo',
    description: 'Importação, validação e preparação de bases de medição',
    keywords: 'csv xlsx importar arquivo fonte limpeza qualidade preparo',
    Component: Dados,
  },
  {
    id: 'medidas',
    Icon: Gauge,
    label: 'Medidas',
    area: 'Instrumentação',
    description: 'Instrumentos, grandezas elétricas e formas de onda',
    keywords: 'instrumentos tensao corrente potencia calibracao medicao',
    Component: Medidas,
  },
  {
    id: 'circuitos',
    Icon: CircuitBoard,
    label: 'Circuitos',
    area: 'Modelagem didática',
    description: 'Editor técnico-didático de montagem e análise de circuitos',
    keywords: 'editor circuito simulacao netlist rlc montagem analise',
    Component: Circuitos,
  },
  {
    id: 'simulacao',
    Icon: CircuitBoard,
    label: 'Simulação',
    area: 'Estudo aplicado',
    description: 'Estudos orientados com cargas CC, CA e circuitos RLC',
    keywords: 'simulacao carga rlc cc ca ressonancia correcao fp estudo',
    Component: Simulacao,
  },
  {
    id: 'fasores',
    Icon: BarChart3,
    label: 'Fasores',
    area: 'Análise trifásica',
    description: 'Diagrama fasorial, sequência de fases e componentes simétricas',
    keywords: 'fasores trifasico componentes simetricas sequencia angulos fortescue',
    Component: Fasores,
  },
  {
    id: 'qualidade',
    Icon: Activity,
    label: 'Qualidade',
    area: 'Conformidade elétrica',
    description: 'THD, eventos, flicker e conformidade de qualidade de energia',
    keywords: 'qualidade energia thd flicker prodist ieee conformidade',
    Component: QualidadeEnergia,
  },
  {
    id: 'energia',
    Icon: Zap,
    label: 'Energia e FP',
    area: 'Desempenho energético',
    description: 'Energia, demanda, fator de potência e custos elétricos',
    keywords: 'energia demanda fp custo tarifa economia fator potencia',
    Component: EnergiaDemandaFP,
  },
  {
    id: 'metrologia',
    Icon: Ruler,
    label: 'Metrologia',
    area: 'Calibração e segurança',
    description: 'TC/TP, incerteza de medição, calibração e segurança',
    keywords: 'metrologia seguranca tctp incerteza calibracao rastreabilidade',
    Component: Metrologia,
  },
  {
    id: 'relatorios',
    Icon: FileText,
    label: 'Relatórios',
    area: 'Documentação técnica',
    description: 'Modelos, prévia e exportações',
    keywords: 'relatorio exportar pdf docx html laudo',
    Component: Relatorios,
  },
]

function buildCommands(setActive, toggleTheme, theme) {
  return [
    ...TABS.map(tab => ({
      id: `tab-${tab.id}`,
      label: tab.label,
      detail: tab.description,
      Icon: tab.Icon,
      keywords: `${tab.label} ${tab.description} ${tab.keywords}`,
      run: () => setActive(tab.id),
    })),
    {
      id: 'action-import',
      label: 'Importar dados',
      detail: 'Abrir a área de fontes e arquivos',
      Icon: Upload,
      keywords: 'importar carregar csv xlsx xls dados arquivo',
      run: () => setActive('dados'),
    },
    {
      id: 'action-report',
      label: 'Gerar relatório',
      detail: 'Montar prévia e exportação',
      Icon: FileText,
      keywords: 'gerar relatorio exportar pdf',
      run: () => setActive('relatorios'),
    },
    {
      id: 'action-theme',
      label: theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro',
      detail: 'Alternar aparência da interface',
      Icon: theme === 'light' ? Moon : Sun,
      keywords: 'tema modo claro escuro aparencia',
      run: toggleTheme,
    },
  ]
}

export default function App() {
  const [active, setActive] = useState('dashboard')
  const [theme, setTheme] = useState(() => localStorage.getItem('smqe_theme') ?? 'light')
  const [commandOpen, setCommandOpen] = useState(false)
  const [query, setQuery] = useState('')
  const activeTab = TABS.find(t => t.id === active) ?? TABS[0]
  const ActiveComponent = activeTab.Component

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('smqe_theme', theme)
  }, [theme])

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(true)
      }
      if (event.key === 'Escape') setCommandOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function toggleTheme() {
    setTheme(t => t === 'light' ? 'dark' : 'light')
  }

  const commands = useMemo(() => buildCommands(setActive, toggleTheme, theme), [theme])
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(command => command.keywords.toLowerCase().includes(q))
  }, [commands, query])

  function runCommand(command) {
    command.run()
    setCommandOpen(false)
    setQuery('')
  }

  return (
    <AppProvider>
      <ToastProvider>
        <div className="app">
          <header className="header">
            <div className="header__brand">
              <img className="header__icon" src="/favicon.svg" alt="" />
              <div className="header__brand-copy">
                <span className="header__logo">SMQE</span>
                <span className="header__subtitle">Medição e qualidade de energia</span>
              </div>
            </div>

            <button className="command-search" onClick={() => setCommandOpen(true)}>
              <Search size={15} />
              <span>Buscar módulo ou ação</span>
              <kbd>Ctrl K</kbd>
            </button>

            <div className="header__actions">
              <button
                className="icon-btn"
                onClick={toggleTheme}
                title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
                aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
              >
                {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
              </button>
              <button className="header__btn" onClick={() => setActive('dados')}>
                <Upload size={15} /> Importar
              </button>
              <button className="header__btn header__btn--primary" onClick={() => setActive('relatorios')}>
                <FileText size={15} /> Relatório
              </button>
              <button className="icon-btn" title="Configurações" aria-label="Configurações">
                <Settings size={16} />
              </button>
            </div>
          </header>

          <div className="app-main">
            <nav className="tab-nav" aria-label="Módulos principais">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  className={`tab-btn${active === tab.id ? ' active' : ''}`}
                  onClick={() => setActive(tab.id)}
                  title={tab.description}
                >
                  <tab.Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>

            <div className="workspace-title">
              <div className="workspace-title__copy">
                <span className="workspace-title__eyebrow">Módulo ativo</span>
                <h1><activeTab.Icon size={18} /> {activeTab.label}</h1>
                <div className="workspace-title__meta">
                  <span>{activeTab.area}</span>
                  <span>{activeTab.id.toUpperCase()}</span>
                </div>
              </div>
              <p>{activeTab.description}</p>
              <div className="workspace-title__metrics">
                <span><Activity size={14} /> Pronto para análise</span>
                <span><BarChart3 size={14} /> Visão técnica consolidada</span>
                <span><Keyboard size={14} /> Atalhos de navegação</span>
              </div>
            </div>

            <div key={active} className="tab-content tab-enter">
              <Suspense fallback={<div className="panel" style={{ padding: 24, textAlign: 'center' }}>Carregando módulo…</div>}>
                <ActiveComponent onNavigate={setActive} />
              </Suspense>
            </div>
          </div>

          <footer className="statusbar">
            <span className="statusbar__item"><span className="statusbar__dot" /> Conectado</span>
            <span className="statusbar__item">Fonte: PQA-5000 #12345</span>
            <span className="statusbar__item">Base: QE_DB_Local</span>
            <span className="statusbar__item statusbar__item--grow">Módulo: {activeTab.label}</span>
            <span className="statusbar__item">Usuário: engenheiro</span>
            <span className="statusbar__item">v1.2.0</span>
          </footer>

          {commandOpen && (
            <div className="command-overlay" onMouseDown={() => setCommandOpen(false)}>
              <div className="command-palette" onMouseDown={event => event.stopPropagation()}>
                <div className="command-palette__search">
                  <Search size={17} />
                  <input
                    autoFocus
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder="Buscar por módulo, relatório, importação..."
                  />
                  <button className="icon-btn icon-btn--flat" onClick={() => setCommandOpen(false)} aria-label="Fechar">
                    <X size={16} />
                  </button>
                </div>
                <div className="command-palette__list">
                  {filteredCommands.length === 0 ? (
                    <div className="command-palette__empty">Nenhum resultado encontrado</div>
                  ) : filteredCommands.map(command => (
                    <button key={command.id} className="command-item" onClick={() => runCommand(command)}>
                      <span className="command-item__icon"><command.Icon size={17} /></span>
                      <span>
                        <strong>{command.label}</strong>
                        <small>{command.detail}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </ToastProvider>
    </AppProvider>
  )
}
