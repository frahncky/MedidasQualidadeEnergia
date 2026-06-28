function writeTextReport(file, data, components)
fid = fopen(file, 'w', 'n', 'UTF-8');
cleanup = onCleanup(@() fclose(fid));
fprintf(fid,'RELATORIO - MEDIDAS, MEDICAO E QUALIDADE DE ENERGIA\n\n');
fprintf(fid,'Metodologia: importacao/validacao de dados, calculo de indicadores, eventos, harmonicos, energia, demanda, FP e verificacoes didaticas de seguranca.\n\n');
writeTableText(fid, 'Indicadores', energia.resumoTable(data));
writeTableText(fid, 'Eventos', energia.eventosTable(data));
writeTableText(fid, 'Harmonicos', energia.harmonicTable(data,'Ia_A',25));
writeTableText(fid, 'Energia e Demanda', energia.energySummary(data));
writeTableText(fid, 'Fator de Potencia', energia.fpSummary(data));
writeTableText(fid, 'TC / TP', circuitos.tctpTable(components));
fprintf(fid,'\nDiagnostico: revisar pontos fora de limite, eventos detectados, FP abaixo da meta e alertas de seguranca antes de medicoes reais.\nConclusao: preencher conforme analise tecnica final.\n');
end

function writeTableText(fid, titleText, T)
fprintf(fid,'\n%s\n', upper(titleText));
if isempty(T)
    fprintf(fid,'(sem dados)\n');
    return;
end
for i = 1:height(T)
    parts = strings(1,width(T));
    for j = 1:width(T)
        parts(j) = string(T.Properties.VariableNames{j}) + "=" + string(valueToText(T{i,j}));
    end
    fprintf(fid,'- %s\n', char(strjoin(parts,' | ')));
end
end

function s = valueToText(v)
if iscell(v)
    if isempty(v), s = ''; else, s = valueToText(v{1}); end
elseif isstring(v)
    s = char(strjoin(v, ', '));
elseif ischar(v)
    s = v;
elseif isnumeric(v)
    if isscalar(v), s = sprintf('%.5g', v); else, s = mat2str(v); end
elseif isdatetime(v) || isduration(v)
    s = char(string(v));
else
    try, s = char(string(v)); catch, s = ''; end
end
end

