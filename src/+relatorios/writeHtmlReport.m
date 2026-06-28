function writeHtmlReport(file, data, components)
fid = fopen(file, 'w', 'n', 'UTF-8');
cleanup = onCleanup(@() fclose(fid));
fprintf(fid,'<!doctype html><html><head><meta charset="utf-8"><title>Relatorio de Medidas e Qualidade de Energia</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#1f2933}h1{color:#12395b}table{border-collapse:collapse;margin:12px 0 26px;width:100%%}th,td{border:1px solid #ccd6dd;padding:6px 8px;font-size:13px}th{background:#eaf2f8;text-align:left}.note{background:#fff7df;padding:10px;border-left:4px solid #d99a00}</style></head><body>');
fprintf(fid,'<h1>Relatorio - Medidas, Medicao e Qualidade de Energia</h1><p>Metodologia: importacao, validacao, analise eletrica, qualidade de energia, metrologia, seguranca e exportacao tecnica.</p>');
fprintf(fid,'%s', tableToHtml('Resumo de Indicadores', energia.resumoTable(data)));
fprintf(fid,'%s', tableToHtml('Eventos de Qualidade', energia.eventosTable(data)));
fprintf(fid,'%s', tableToHtml('Harmonicos / FFT', energia.harmonicTable(data,'Ia_A',25)));
fprintf(fid,'%s', tableToHtml('Energia e Demanda', energia.energySummary(data)));
fprintf(fid,'%s', tableToHtml('Fator de Potencia', energia.fpSummary(data)));
fprintf(fid,'%s', tableToHtml('Estatistica de Cargas', energia.loadStatsTable(data)));
fprintf(fid,'%s', tableToHtml('TC / TP e Calibracao', circuitos.tctpTable(components)));
fprintf(fid,'<div class="note"><strong>Diagnostico:</strong> revisar eventos, FP abaixo da meta, harmonicos e alertas de seguranca antes de medicoes reais.</div><h2>Conclusao</h2><p>Preencher conforme analise tecnica final.</p></body></html>');
end

function html = tableToHtml(titleText, T)
html = ['<h2>' htmlEscape(titleText) '</h2>'];
if isempty(T)
    html = [html '<p>Sem dados.</p>'];
    return;
end
html = [html '<table><thead><tr>'];
for j = 1:width(T)
    html = [html '<th>' htmlEscape(T.Properties.VariableNames{j}) '</th>']; %#ok<AGROW>
end
html = [html '</tr></thead><tbody>'];
for i = 1:height(T)
    html = [html '<tr>']; %#ok<AGROW>
    for j = 1:width(T)
        html = [html '<td>' htmlEscape(valueToText(T{i,j})) '</td>']; %#ok<AGROW>
    end
    html = [html '</tr>']; %#ok<AGROW>
end
html = [html '</tbody></table>'];
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

function s = htmlEscape(s)
s = char(s);
s = strrep(s, '&', '&amp;');
s = strrep(s, '<', '&lt;');
s = strrep(s, '>', '&gt;');
s = strrep(s, '"', '&quot;');
end

