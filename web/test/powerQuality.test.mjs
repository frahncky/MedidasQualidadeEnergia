import test from 'node:test'
import assert from 'node:assert/strict'
import {
  analyzePowerQuality,
  buildDemoPowerQualityDataset,
  calcTHD,
  generateHarmonics,
} from '../src/utils/powerQuality.js'
import { parseComtradeFiles } from '../src/utils/comtrade.js'

test('synthetic harmonics preserve requested THD', () => {
  const harmonics = generateHarmonics(5, 100)
  assert.ok(Math.abs(calcTHD(harmonics) - 5) < 0.01)
})

test('demo dataset produces advanced PQ indicators', () => {
  const analysis = analyzePowerQuality(buildDemoPowerQualityDataset())

  assert.ok(analysis.sampleCount > 1000)
  assert.ok(analysis.summary.thdVAvg > 0)
  assert.ok(analysis.summary.thdIAvg > 0)
  assert.ok(analysis.summary.interharmonicVMax >= 0)
  assert.ok(analysis.measurement.windows.length > 0)
  assert.ok(analysis.measurement.classAReady)
  assert.ok(analysis.events.some(event => event.tipo === 'Transitório'))
  assert.ok(analysis.conformity.checks.some(check => check.name === 'Inter-harmônicas V'))
  assert.ok(analysis.recommendations.length > 0)
  assert.ok(analysis.summary.prodistVoltage.Adequada.count >= 0)
})

test('aggregated CSV-style rows are analyzed without waveform data', () => {
  const analysis = analyzePowerQuality({
    fileName: 'medicao_agregada.csv',
    sourceType: 'Arquivo CSV',
    columns: ['timestamp', 'Va', 'Vb', 'Vc', 'Ia', 'Ib', 'Ic', 'Freq_Hz', 'FP'],
    rows: [
      { timestamp: '2024-05-01 00:00:00', Va: '220,0', Vb: '219,0', Vc: '221,0', Ia: '110', Ib: '111', Ic: '109', Freq_Hz: '60,01', FP: '0,94' },
      { timestamp: '2024-05-01 00:01:00', Va: '221,0', Vb: '220,0', Vc: '222,0', Ia: '112', Ib: '111', Ic: '110', Freq_Hz: '60,00', FP: '0,95' },
      { timestamp: '2024-05-01 00:02:00', Va: '219,0', Vb: '218,0', Vc: '220,0', Ia: '109', Ib: '108', Ic: '107', Freq_Hz: '59,99', FP: '0,94' },
    ],
  })

  assert.equal(analysis.phases['Fase A'].waveformBased, false)
  assert.equal(Math.round(analysis.summary.nominalVoltage), 220)
  assert.ok(analysis.summary.voltageCompliancePct >= 99)
  assert.equal(analysis.summary.transientCount, 0)
})

test('numeric timestamp column is not mapped as active power', () => {
  const analysis = analyzePowerQuality({
    fileName: 'timestamp_unix_ms.csv',
    sourceType: 'Arquivo CSV',
    columns: ['timestamp', 'Va', 'Vb', 'Vc', 'Ia', 'Ib', 'Ic', 'Freq_Hz', 'FP'],
    rows: [
      { timestamp: 1717176002000, Va: 220, Vb: 219, Vc: 221, Ia: 110, Ib: 111, Ic: 109, Freq_Hz: 60.01, FP: 0.94 },
      { timestamp: 1717176062000, Va: 221, Vb: 220, Vc: 222, Ia: 112, Ib: 111, Ic: 110, Freq_Hz: 60.00, FP: 0.95 },
      { timestamp: 1717176122000, Va: 219, Vb: 218, Vc: 220, Ia: 109, Ib: 108, Ic: 107, Freq_Hz: 59.99, FP: 0.94 },
    ],
  })

  assert.ok(analysis.normalizedRows.every(row => row.p === null))
  assert.ok(analysis.power.pKw < 100)
})

test('ASCII COMTRADE files are converted to a PQ dataset', () => {
  const cfgText = [
    'SE TESTE,DEV01,2013',
    '6,6A,0D',
    '1,VA,A,,V,1,0,0,-400,400,1,1,P',
    '2,VB,B,,V,1,0,0,-400,400,1,1,P',
    '3,VC,C,,V,1,0,0,-400,400,1,1,P',
    '4,IA,A,,A,1,0,0,-1000,1000,1,1,P',
    '5,IB,B,,A,1,0,0,-1000,1000,1,1,P',
    '6,IC,C,,A,1,0,0,-1000,1000,1,1,P',
    '60',
    '1',
    '3840,4',
    '01/01/2024,00:00:00.000000',
    '01/01/2024,00:00:00.000000',
    'ASCII',
    '1',
  ].join('\n')
  const datText = [
    '1,0,0,-269,269,0,-122,122',
    '2,260,25,-282,257,12,-128,116',
    '3,520,50,-294,244,24,-133,109',
    '4,781,74,-304,230,35,-138,101',
  ].join('\n')

  const dataset = parseComtradeFiles({ cfgText, datText, cfgName: 'teste.cfg', datName: 'teste.dat' })
  const analysis = analyzePowerQuality(dataset)

  assert.equal(dataset.sourceType, 'COMTRADE ASCII')
  assert.equal(dataset.rows.length, 4)
  assert.equal(Math.round(dataset.rows[1].Va), 25)
  assert.ok(analysis.sampleCount >= 4)
})
