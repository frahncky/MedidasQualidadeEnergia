import { useState, useEffect } from 'react'
import { AppProvider } from './context/AppContext'
import { ToastProvider } from './components/Toast'
import Dashboard from './tabs/Dashboard'
import Dados from './tabs/Dados'
import Medidas from './tabs/Medidas'
import Circuitos from './tabs/Circuitos'
import QualidadeEnergia from './tabs/QualidadeEnergia'
import EnergiaDemandaFP from './tabs/EnergiaDemandaFP'
import Metrologia from './tabs/Metrologia'
import Relatorios from './tabs/Relatorios'

/* SVG tab icons */
const IC = {
  dashboard: (
    <svg viewBox="0 0 14 14" width="13" height="13" fill="currentColor">
      <rect x="1" y="1" width="5" height="5" rx="1"/><rect x="8" y="1" width="5" height="5" rx="1"/>
      <rect x="1" y="8" width="5" height="5" rx="1"/><rect x="8" y="8" width="5" height="5" rx="1"/>
    </svg>
  ),
  dados: (
    <svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4">
      <ellipse cx="7" cy="3.5" rx="5" ry="2"/>
      <path d="M2 3.5v3.5c0 1.1 2.2 2 5 2s5-.9 5-2V3.5"/>
      <path d="M2 7v3.5c0 1.1 2.2 2 5 2s5-.9 5-2V7"/>
    </svg>
  ),
  medidas: (
    <svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"/>
      <path d="M7 7 4.5 4.5" strokeLinecap="round"/>
      <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none"/>
    </svg>
  ),
  circuitos: (
    <svg viewBox="0 0 14 14" width="13" height="13" fill="currentColor">
      <path d="M8 1 4 7h4L6 13 12 7H8L10 1z"/>
    </svg>
  ),
  qualidade: (
    <svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <polyline points="1,7 3,4 5,10 7,4 9,10 11,7 13,7"/>
    </svg>
  ),
  energia: (
    <svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="7" cy="7" r="5.5"/>
      <path d="M7 4v3l2 2" strokeLinecap="round"/>
    </svg>
  ),
  metrologia: (
    <svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1" y="6" width="12" height="2.5" rx="1"/>
      <line x1="3" y1="4.5" x2="3" y2="6" strokeWidth="1.2"/>
      <line x1="5.5" y1="3.5" x2="5.5" y2="6" strokeWidth="1.2"/>
      <line x1="8" y1="4.5" x2="8" y2="6" strokeWidth="1.2"/>
      <line x1="10.5" y1="3" x2="10.5" y2="6" strokeWidth="1.2"/>
    </svg>
  ),
  relatorios: (
    <svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M3 1h5.5L11 3.5V13H3V1z"/>
      <path d="M8.5 1v3H11" strokeLinejoin="round"/>
      <line x1="5" y1="6.5" x2="9" y2="6.5"/>
      <line x1="5" y1="9" x2="8" y2="9"/>
    </svg>
  ),
}

const TABS = [
  { id: 'dashboard',  icon: IC.dashboard,  label: 'Dashboard',              Component: Dashboard },
  { id: 'dados',      icon: IC.dados,      label: 'Dados',                  Component: Dados },
  { id: 'medidas',    icon: IC.medidas,    label: 'Medidas',                Component: Medidas },
  { id: 'circuitos',  icon: IC.circuitos,  label: 'Circuitos e Simulação',  Component: Circuitos },
  { id: 'qualidade',  icon: IC.qualidade,  label: 'Qualidade de Energia',   Component: QualidadeEnergia },
  { id: 'energia',    icon: IC.energia,    label: 'Energia e Demanda',      Component: EnergiaDemandaFP },
  { id: 'metrologia', icon: IC.metrologia, label: 'Metrologia e Segurança', Component: Metrologia },
  { id: 'relatorios', icon: IC.relatorios, label: 'Relatórios',             Component: Relatorios },
]

function SunIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="3"/><line x1="8" y1="1" x2="8" y2="3"/><line x1="8" y1="13" x2="8" y2="15"/>
      <line x1="1" y1="8" x2="3" y2="8"/><line x1="13" y1="8" x2="15" y2="8"/>
      <line x1="3" y1="3" x2="4.5" y2="4.5"/><line x1="11.5" y1="11.5" x2="13" y2="13"/>
      <line x1="13" y1="3" x2="11.5" y2="4.5"/><line x1="4.5" y1="11.5" x2="3" y2="13"/>
    </svg>
  )
}
function MoonIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
      <path d="M6 2a7 7 0 1 0 8 8 5 5 0 0 1-8-8z"/>
    </svg>
  )
}

export default function App() {
  const [active, setActive] = useState('dashboard')
  const [theme, setTheme] = useState(() => localStorage.getItem('smqe_theme') ?? 'light')
  const ActiveComponent = TABS.find(t => t.id === active)?.Component ?? Dashboard

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('smqe_theme', theme)
  }, [theme])

  function toggleTheme() {
    setTheme(t => t === 'light' ? 'dark' : 'light')
  }

  return (
    <AppProvider>
      <ToastProvider>
        <div className="app">
          <header className="header">
            <div className="header__brand">
              <img className="header__icon" src="/favicon.svg" alt="" />
              <span className="header__logo">SMQE</span>
              <span className="header__subtitle">Simulador de Medição e Qualidade de Energia</span>
            </div>
            <div className="header__sep" />
            <span className="header__title">PLATAFORMA DE MEDIDAS, MEDIÇÃO E QUALIDADE DE ENERGIA</span>
            <div className="header__spacer" />
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
            >
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
            <button className="header__btn" onClick={() => setActive('dados')}>Importar Dados</button>
            <button className="header__btn" onClick={() => setActive('relatorios')}>Gerar Relatório</button>
            <button className="header__btn">Configurações</button>
          </header>

          <div className="app-main">
            <nav className="tab-nav">
              {TABS.map(t => (
                <button
                  key={t.id}
                  className={`tab-btn${active === t.id ? ' active' : ''}`}
                  onClick={() => setActive(t.id)}
                >
                  {t.icon}{t.label}
                </button>
              ))}
            </nav>

            <div key={active} className="tab-content tab-enter" style={{ flex: 1 }}>
              <ActiveComponent onNavigate={setActive} />
            </div>
          </div>

          <footer className="statusbar">
            <span className="statusbar__item"><span className="statusbar__dot">●</span> Conectado</span>
            <span className="statusbar__item">Fonte: PQA-5000 #12345</span>
            <span className="statusbar__item">Base: QE_DB_Local</span>
            <span className="statusbar__item" style={{ marginLeft: 'auto' }}>Usuário: engenheiro</span>
            <span className="statusbar__item">Versão: 1.2.0</span>
            <span className="statusbar__help">?</span>
          </footer>
        </div>
      </ToastProvider>
    </AppProvider>
  )
}
