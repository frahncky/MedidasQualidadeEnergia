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
  { id: 'metrologia',  label: 'Metrologia, TC/TP e Segurança', Component: Metrologia },
  { id: 'relatorios',  label: 'Relatórios',                  Component: Relatorios },
]

export default function App() {
  const [active, setActive] = useState('dashboard')
  const ActiveComponent = TABS.find(t => t.id === active)?.Component ?? Dashboard

  return (
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
        <button className="header__btn">Importar Dados</button>
        <button className="header__btn">Gerar Relatório</button>
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
              {t.label}
            </button>
          ))}
        </nav>

        <div className="tab-content" style={{ flex: 1 }}>
          <ActiveComponent />
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
  )
}
