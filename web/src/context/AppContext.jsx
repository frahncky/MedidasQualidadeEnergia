import { createContext, useContext, useState, useEffect } from 'react'

const AppCtx = createContext(null)

export function useAppContext() {
  return useContext(AppCtx)
}

function ls(key, def) {
  try { return JSON.parse(localStorage.getItem(key)) ?? def } catch { return def }
}

export function AppProvider({ children }) {
  const [installation, setInstallation] = useState(() => ls('smqe_installation', 'Subestação Principal'))
  const [period, setPeriod] = useState(() => ls('smqe_period', 'Mês'))
  const [dateFrom, setDateFrom] = useState(() => ls('smqe_dateFrom', '01/05/2024'))
  const [dateTo, setDateTo] = useState(() => ls('smqe_dateTo', '31/05/2024'))

  useEffect(() => { localStorage.setItem('smqe_installation', JSON.stringify(installation)) }, [installation])
  useEffect(() => { localStorage.setItem('smqe_period', JSON.stringify(period)) }, [period])
  useEffect(() => { localStorage.setItem('smqe_dateFrom', JSON.stringify(dateFrom)) }, [dateFrom])
  useEffect(() => { localStorage.setItem('smqe_dateTo', JSON.stringify(dateTo)) }, [dateTo])

  return (
    <AppCtx.Provider value={{ installation, setInstallation, period, setPeriod, dateFrom, setDateFrom, dateTo, setDateTo }}>
      {children}
    </AppCtx.Provider>
  )
}
