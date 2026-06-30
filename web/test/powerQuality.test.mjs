import test from 'node:test'
import assert from 'node:assert/strict'
import {
  analyzePowerQuality,
  buildDemoPowerQualityDataset,
  calcTHD,
  generateHarmonics,
} from '../src/utils/powerQuality.js'

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
