import { createContext, useContext, useMemo, useState, useEffect } from 'react'
import { analyzePowerQuality } from '../utils/powerQuality'

const AppCtx = createContext(null)

export function useAppContext() {
  return useContext(AppCtx)
}

function ls(key, def) {
  try { return JSON.parse(localStorage.getItem(key)) ?? def } catch { return def }
}

const DEFAULT_INSTRUMENTS = [
  { id: 'CLP-001', name: 'Alicate Amperimétrico', type: 'Amperímetro', serial: '12345678', accuracyClass: '0,5', range: '200', unit: 'A', resolution: '0,1', certNumber: 'CAL-2024-0456', certDate: '31/05/2024', certExpiry: '31/05/2025' },
  { id: 'VAT-002', name: 'Voltímetro CA', type: 'Voltímetro', serial: '87654321', accuracyClass: '0,5', range: '600', unit: 'V', resolution: '0,1', certNumber: 'CAL-2024-0312', certDate: '15/05/2024', certExpiry: '15/05/2025' },
  { id: 'WAT-003', name: 'Wattímetro', type: 'Wattímetro', serial: 'A1B2C3D4', accuracyClass: '0,5', range: '100', unit: 'kW', resolution: '0,01', certNumber: 'CAL-2024-0288', certDate: '10/05/2024', certExpiry: '10/05/2025' },
  { id: 'TC-005', name: 'TC 600/5 A', type: 'TC', serial: 'TC6005-01', accuracyClass: '0,5', range: '600', unit: 'A', resolution: '0,1', certNumber: 'CAL-2024-0180', certDate: '28/04/2024', certExpiry: '28/04/2025' },
  { id: 'TP-006', name: 'TP 13,8 kV/115 V', type: 'TP', serial: 'TP138-01', accuracyClass: '0,5', range: '13800', unit: 'V', resolution: '1', certNumber: 'CAL-2024-0155', certDate: '25/04/2024', certExpiry: '25/04/2025' },
]

export function AppProvider({ children }) {
  const [installation, setInstallation] = useState(() => ls('smqe_installation', 'Subestação Principal'))
  const [period, setPeriod] = useState(() => ls('smqe_period', 'Mês'))
  const [dateFrom, setDateFrom] = useState(() => ls('smqe_dateFrom', '01/05/2024'))
  const [dateTo, setDateTo] = useState(() => ls('smqe_dateTo', '31/05/2024'))
  const [instruments, setInstruments] = useState(() => ls('smqe_instruments', DEFAULT_INSTRUMENTS))
  const [importedDataset, setImportedDataset] = useState(null)
  const pqAnalysis = useMemo(() => analyzePowerQuality(importedDataset), [importedDataset])

  useEffect(() => { localStorage.setItem('smqe_installation', JSON.stringify(installation)) }, [installation])
  useEffect(() => { localStorage.setItem('smqe_period', JSON.stringify(period)) }, [period])
  useEffect(() => { localStorage.setItem('smqe_dateFrom', JSON.stringify(dateFrom)) }, [dateFrom])
  useEffect(() => { localStorage.setItem('smqe_dateTo', JSON.stringify(dateTo)) }, [dateTo])
  useEffect(() => { localStorage.setItem('smqe_instruments', JSON.stringify(instruments)) }, [instruments])

  function addInstrument(inst) {
    setInstruments(prev => [...prev, inst])
  }

  function updateInstrument(id, data) {
    setInstruments(prev => prev.map(i => i.id === id ? { ...i, ...data } : i))
  }

  function removeInstrument(id) {
    setInstruments(prev => prev.filter(i => i.id !== id))
  }

  return (
    <AppCtx.Provider value={{
      installation, setInstallation,
      period, setPeriod,
      dateFrom, setDateFrom,
      dateTo, setDateTo,
      instruments, addInstrument, updateInstrument, removeInstrument,
      importedDataset, setImportedDataset,
      pqAnalysis,
      hasImportedDataset: Boolean(importedDataset?.rows?.length),
    }}>
      {children}
    </AppCtx.Provider>
  )
}
