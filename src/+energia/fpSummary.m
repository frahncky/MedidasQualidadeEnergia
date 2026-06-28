function T = fpSummary(d)
[d,~] = energia.prepararDados(d);
P = mean(d.P_kW, 'omitnan');
fp1 = mean(d.FP, 'omitnan');
fp2 = 0.95;
Qc = P * (tan(acos(max(min(fp1,1),0.01))) - tan(acos(fp2)));
risco = energia.calcTHD(energia.harmonicTable(d, 'Ia_A', 25));
notas = {'','','','','',fpDiagnosis(fp1,risco)}';

T = table({'FP medio';'FP minimo';'Meta de FP';'Banco calculado';'THD-I usado no diagnostico';'Diagnostico'}, ...
    [fp1; min(d.FP); fp2; max(Qc,0); risco; NaN], ...
    {'pu';'pu';'pu';'kvar';'%';''}, notas, ...
    'VariableNames', {'Indicador','Valor','Unidade','Nota'});
end

function s = fpDiagnosis(fp, thd)
if fp < 0.92 && thd > 10
    s = 'Corrigir FP com estudo de ressonancia/harmonicos.';
elseif fp < 0.92
    s = 'Carga predominantemente indutiva: dimensionar banco capacitivo.';
elseif thd > 10
    s = 'FP adequado, mas harmonicos merecem filtro/diagnostico.';
else
    s = 'Condicao geral adequada.';
end
end

