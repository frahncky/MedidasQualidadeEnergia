function exportarTabelas(p, data, components, wires)
Resumo = energia.resumoTable(data);
Eventos = energia.eventosTable(data);
Harmonicos = energia.harmonicTable(data, 'Ia_A', 25);
Energia = energia.energySummary(data);
FP = energia.fpSummary(data);
Estatistica = energia.loadStatsTable(data);
TCTP = circuitos.tctpTable(components);

writetable(data, fullfile(p,'dados_exportados.csv'));
writetable(components, fullfile(p,'componentes_exportados.csv'));
writetable(wires, fullfile(p,'ligacoes_exportadas.csv'));
writetable(Resumo, fullfile(p,'resumo_indicadores.csv'));
writetable(Eventos, fullfile(p,'eventos_qualidade.csv'));
writetable(Harmonicos, fullfile(p,'harmonicos_fft.csv'));
writetable(Energia, fullfile(p,'energia_demanda.csv'));
writetable(FP, fullfile(p,'fator_potencia.csv'));
writetable(Estatistica, fullfile(p,'estatistica_cargas.csv'));
writetable(TCTP, fullfile(p,'tc_tp_calibracao.csv'));

xlsx = fullfile(p,'tabelas_resultados.xlsx');
writetable(Resumo, xlsx, 'Sheet', 'Resumo');
writetable(Eventos, xlsx, 'Sheet', 'Eventos');
writetable(Harmonicos, xlsx, 'Sheet', 'Harmonicos');
writetable(Energia, xlsx, 'Sheet', 'Energia');
writetable(FP, xlsx, 'Sheet', 'FP');
writetable(Estatistica, xlsx, 'Sheet', 'Estatistica');
writetable(TCTP, xlsx, 'Sheet', 'TC_TP');

Data = data; %#ok<NASGU>
Components = components; %#ok<NASGU>
Wires = wires; %#ok<NASGU>
save(fullfile(p,'estado_analise.mat'), 'Data', 'Components', 'Wires', 'Resumo', 'Eventos', 'Harmonicos', 'Energia', 'FP', 'Estatistica', 'TCTP');
end

