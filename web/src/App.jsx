import { Component, Suspense, lazy, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BarChart3,
  CircuitBoard,
  Database,
  FileText,
  Gauge,
  Info,
  Keyboard,
  LayoutDashboard,
  Moon,
  RotateCcw,
  Ruler,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Upload,
  X,
  Zap,
} from 'lucide-react'
import { AppProvider, useAppContext } from './context/AppContext'
import { ToastProvider, useToast } from './components/Toast'
import { clearStorageByPrefix, readStorage, writeStorage } from './utils/storage'

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

const APP_VERSION = 'v1.3.0'

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

function getPreferredTheme() {
  const stored = readStorage('smqe_theme')
  if (stored === 'light' || stored === 'dark') return stored
  try {
    return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function getInitialActiveTab() {
  const stored = readStorage('smqe_active_tab', 'dashboard')
  return TABS.some(tab => tab.id === stored) ? stored : 'dashboard'
}

function buildCommands(setActive, toggleTheme, theme, openSettings) {
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
      keywords: 'gerar relatorio exportar pdf docx html laudo',
      run: () => setActive('relatorios'),
    },
    {
      id: 'action-settings',
      label: 'Configurações',
      detail: 'Aparência, fluxo de trabalho e diagnóstico',
      Icon: Settings,
      keywords: 'configuracoes preferencias ajuste tema diagnostico atalhos',
      run: openSettings,
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

class ModuleErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="module-error panel">
        <div className="module-error__icon"><Info size={20} /></div>
        <div className="module-error__copy">
          <strong>Este módulo encontrou um erro ao renderizar.</strong>
          <span>{this.state.error?.message ?? 'Falha inesperada na interface.'}</span>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            this.setState({ error: null })
            this.props.onRecover?.()
          }}
        >
          Voltar ao Dashboard
        </button>
      </div>
    )
  }
}

function fmtCount(value) {
  return Number.isFinite(value) ? value.toLocaleString('pt-BR') : '-'
}

function SettingsPanel({ open, onClose, theme, setTheme, activeTab, setActive, onClearPreferences }) {
  const {
    pqAnalysis,
    analysisStatus,
    hasImportedDataset,
    resolvedInstallation,
    resolvedLoadType,
  } = useAppContext()

  if (!open) return null

  const engineLabel = analysisStatus.running
    ? 'Analisando'
    : analysisStatus.source === 'worker'
      ? 'Web Worker'
      : 'Thread principal'

  return (
    <div className="settings-overlay" onMouseDown={onClose}>
      <aside
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="settings-panel__header">
          <div>
            <span className="settings-panel__eyebrow">SMQE</span>
            <h2 id="settings-title"><Settings size={18} /> Configurações</h2>
          </div>
          <button className="icon-btn icon-btn--flat" onClick={onClose} aria-label="Fechar configurações">
            <X size={17} />
          </button>
        </header>

        <section className="settings-section">
          <div className="settings-section__title"><SlidersHorizontal size={16} /> Aparência</div>
          <div className="settings-choice-group" role="group" aria-label="Tema da interface">
            <button className={`settings-choice${theme === 'light' ? ' active' : ''}`} onClick={() => setTheme('light')}>
              <Sun size={16} /> Claro
            </button>
            <button className={`settings-choice${theme === 'dark' ? ' active' : ''}`} onClick={() => setTheme('dark')}>
              <Moon size={16} /> Escuro
            </button>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section__title"><Database size={16} /> Dados Ativos</div>
          <div className="settings-grid">
            <span>Fonte</span><strong>{hasImportedDataset ? pqAnalysis.sourceName : 'Demonstração calculada'}</strong>
            <span>Tipo</span><strong>{pqAnalysis.sourceType}</strong>
            <span>Amostras</span><strong>{fmtCount(pqAnalysis.sampleCount)}</strong>
            <span>Instalação</span><strong>{resolvedInstallation || '-'}</strong>
            <span>Carga</span><strong>{resolvedLoadType || '-'}</strong>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section__title"><ShieldCheck size={16} /> Diagnóstico</div>
          <div className="settings-stats">
            <div><span>Motor PQ</span><strong>{engineLabel}</strong></div>
            <div><span>Tempo</span><strong>{analysisStatus.elapsedMs ? `${analysisStatus.elapsedMs} ms` : '-'}</strong></div>
            <div><span>Módulo</span><strong>{activeTab.label}</strong></div>
            <div><span>Versão</span><strong>{APP_VERSION}</strong></div>
          </div>
          {analysisStatus.error && <p className="settings-note">{analysisStatus.error}</p>}
        </section>

        <section className="settings-section">
          <div className="settings-section__title"><Keyboard size={16} /> Atalhos</div>
          <div className="settings-grid">
            <span>Buscar</span><strong>Ctrl K</strong>
            <span>Configurações</span><strong>Ctrl ,</strong>
            <span>Módulos</span><strong>Alt 1-9</strong>
          </div>
        </section>

        <footer className="settings-panel__footer">
          <button className="btn btn-ghost" onClick={onClearPreferences}>
            <RotateCcw size={15} /> Limpar preferências
          </button>
          <button className="btn btn-subtle" onClick={() => { setActive('dados'); onClose() }}>
            <Database size={15} /> Dados
          </button>
          <button className="btn btn-primary" onClick={() => { setActive('relatorios'); onClose() }}>
            <FileText size={15} /> Relatório
          </button>
        </footer>
      </aside>
    </div>
  )
}

function AppShell() {
  const toast = useToast()
  const { pqAnalysis, analysisStatus, hasImportedDataset } = useAppContext()
  const [active, setActiveState] = useState(getInitialActiveTab)
  const [theme, setTheme] = useState(getPreferredTheme)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedCommand, setSelectedCommand] = useState(0)
  const activeTab = TABS.find(t => t.id === active) ?? TABS[0]
  const ActiveComponent = activeTab.Component

  function setActive(tabId) {
    setActiveState(TABS.some(tab => tab.id === tabId) ? tabId : 'dashboard')
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    writeStorage('smqe_theme', theme)
  }, [theme])

  useEffect(() => {
    writeStorage('smqe_active_tab', active)
    document.title = `${activeTab.label} | SMQE`
  }, [active, activeTab.label])

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(true)
      }
      if ((event.ctrlKey || event.metaKey) && event.key === ',') {
        event.preventDefault()
        setSettingsOpen(true)
      }
      if (event.altKey && /^[1-9]$/.test(event.key)) {
        const tab = TABS[Number(event.key) - 1]
        if (tab) {
          event.preventDefault()
          setActiveState(tab.id)
        }
      }
      if (event.key === 'Escape') {
        setCommandOpen(false)
        setSettingsOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (commandOpen) setSelectedCommand(0)
    else setQuery('')
  }, [commandOpen])

  useEffect(() => {
    setSelectedCommand(0)
  }, [query])

  function toggleTheme() {
    setTheme(t => t === 'light' ? 'dark' : 'light')
  }

  const commands = useMemo(() => buildCommands(setActive, toggleTheme, theme, () => setSettingsOpen(true)), [theme])
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter(command => `${command.label} ${command.detail} ${command.keywords}`.toLowerCase().includes(q))
  }, [commands, query])

  useEffect(() => {
    if (selectedCommand >= filteredCommands.length) setSelectedCommand(0)
  }, [filteredCommands.length, selectedCommand])

  function runCommand(command) {
    if (!command) return
    command.run()
    setCommandOpen(false)
    setQuery('')
  }

  function handleCommandKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedCommand(index => filteredCommands.length ? (index + 1) % filteredCommands.length : 0)
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedCommand(index => filteredCommands.length ? (index - 1 + filteredCommands.length) % filteredCommands.length : 0)
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      runCommand(filteredCommands[selectedCommand])
    }
  }

  function handleClearPreferences() {
    const removed = clearStorageByPrefix('smqe_')
    const nextTheme = getPreferredTheme()
    setTheme(nextTheme)
    setActive('dashboard')
    setSettingsOpen(false)
    toast(
      removed
        ? `Preferências locais removidas (${removed} itens).`
        : 'Não havia preferências locais para limpar.',
      'success'
    )
  }

  const sourceLabel = hasImportedDataset ? pqAnalysis.sourceName : 'Demonstração'
  const engineLabel = analysisStatus.running
    ? 'Analisando'
    : analysisStatus.source === 'worker'
      ? 'Worker'
      : 'Thread principal'

  return (
    <div className="app">
      <header className="header">
        <div className="header__brand">
          <img className="header__icon" src="/favicon.svg" alt="" />
          <div className="header__brand-copy">
            <span className="header__logo">SMQE</span>
            <span className="header__subtitle">Medição e qualidade de energia</span>
          </div>
        </div>

        <button
          className="command-search"
          onClick={() => setCommandOpen(true)}
          aria-label="Buscar módulo ou ação"
          aria-haspopup="dialog"
          aria-expanded={commandOpen}
        >
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
          <button
            className="icon-btn"
            title="Configurações"
            aria-label="Abrir configurações"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      <div className="app-main">
        <nav className="tab-nav" aria-label="Módulos principais">
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              className={`tab-btn${active === tab.id ? ' active' : ''}`}
              onClick={() => setActive(tab.id)}
              title={`${tab.description} - Alt ${index + 1}`}
              aria-current={active === tab.id ? 'page' : undefined}
            >
              <tab.Icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <main key={active} className="tab-content tab-enter">
          <ModuleErrorBoundary resetKey={active} onRecover={() => setActive('dashboard')}>
            <Suspense fallback={<div className="panel module-loading">Carregando módulo...</div>}>
              <ActiveComponent onNavigate={setActive} />
            </Suspense>
          </ModuleErrorBoundary>
        </main>
      </div>

      <footer className="statusbar">
        <span className="statusbar__item"><span className="statusbar__dot" /> {engineLabel}</span>
        <span className="statusbar__item">Fonte: {sourceLabel}</span>
        <span className="statusbar__item">Amostras: {fmtCount(pqAnalysis.sampleCount)}</span>
        <span className="statusbar__item statusbar__item--grow">Módulo: {activeTab.label}</span>
        <span className="statusbar__item">Área: {activeTab.area}</span>
        <span className="statusbar__item">{APP_VERSION}</span>
      </footer>

      {commandOpen && (
        <div className="command-overlay" onMouseDown={() => setCommandOpen(false)}>
          <div
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Paleta de comandos"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="command-palette__search">
              <Search size={17} />
              <input
                autoFocus
                value={query}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={handleCommandKeyDown}
                placeholder="Buscar por módulo, relatório, importação..."
                aria-controls="command-list"
                aria-activedescendant={filteredCommands[selectedCommand] ? `command-${filteredCommands[selectedCommand].id}` : undefined}
              />
              <button className="icon-btn icon-btn--flat" onClick={() => setCommandOpen(false)} aria-label="Fechar">
                <X size={16} />
              </button>
            </div>
            <div id="command-list" className="command-palette__list" role="listbox">
              {filteredCommands.length === 0 ? (
                <div className="command-palette__empty">Nenhum resultado encontrado</div>
              ) : filteredCommands.map((command, index) => (
                <button
                  id={`command-${command.id}`}
                  key={command.id}
                  className={`command-item${selectedCommand === index ? ' active' : ''}`}
                  onClick={() => runCommand(command)}
                  onMouseEnter={() => setSelectedCommand(index)}
                  role="option"
                  aria-selected={selectedCommand === index}
                >
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

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        setTheme={setTheme}
        activeTab={activeTab}
        setActive={setActive}
        onClearPreferences={handleClearPreferences}
      />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </AppProvider>
  )
}
