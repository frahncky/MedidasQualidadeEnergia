import { useState } from 'react'
import Dashboard from './tabs/Dashboard'
import Dados from './tabs/Dados'
import Medidas from './tabs/Medidas'
import Circuitos from './tabs/Circuitos'
import Simulacao from './tabs/Simulacao'
import Fasores from './tabs/Fasores'
import QualidadeEnergia from './tabs/QualidadeEnergia'
import EnergiaDemandaFP from './tabs/EnergiaDemandaFP'
import Metrologia from './tabs/Metrologia'
import Relatorios from './tabs/Relatorios'

const TABS = [
  { id: 'dashboard',   label: 'Dashboard',                  Component: Dashboard },
  { id: 'dados',       label: 'Dados',                       Component: Dados },
  { id: 'medidas',     label: 'Medidas e Instrumentos',      Component: Medidas },
  { id: 'circuitos',   label: 'Circuitos e Editor',          Component: Circuitos },
  { id: 'simulacao',   label: 'Simulação',                   Component: Simulacao },
  { id: 'fasores',     label: 'Fasores / Trifásico',         Component: Fasores },
  { id: 'qualidade',   label: 'Qualidade de Energia',        Component: QualidadeEnergia },
  { id: 'energia',     label: 'Energia, Demanda e FP',       Component: EnergiaDemandaFP },
  { id: 'metrologia',  label: 'Metrologia, TC/TP e Seg.',    Component: Metrologia },
  { id: 'relatorios',  label: 'Relatórios',                  Component: Relatorios },
]

export default function App() {
  const [active, setActive] = useState('dashboard')
  const ActiveComponent = TABS.find(t => t.id === active)?.Component ?? Dashboard

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <span className="header__logo">⚡ SMQE</span>
        <div className="header__sep" />
        <span className="header__title">Plataforma de Medidas e Qualidade de Energia</span>
        <div className="header__spacer" />
        <button className="header__btn">Importar Dados</button>
        <button className="header__btn">Exportar</button>
        <button className="header__btn">Configurações</button>
      </header>

      {/* Tab navigation */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <nav className="tab-nav">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`tab-btn${active === t.id ? ' active' : ''}`}
              onClick={() => setActive(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="tab-content" style={{ flex: 1, overflow: 'hidden' }}>
          <ActiveComponent />
        </div>
      </div>

      {/* Status bar */}
      <footer className="statusbar">
        <span className="statusbar__item"><span className="statusbar__dot">●</span> Conectado</span>
        <span className="statusbar__item">Subestação Principal · 13,8 kV</span>
        <span className="statusbar__item">60,00 Hz · 2 kS/s</span>
        <span className="statusbar__item" style={{ marginLeft: 'auto' }}>Usuário: Eng. Responsável</span>
        <span className="statusbar__item">SMQE v2.0.0</span>
      </footer>
    </div>
  )
}
