function T = eventosTable(d)
[d,~] = energia.prepararDados(d);
if ~energia.hasColumn(d,'evento')
    T = table();
    return;
end

ev = string(d.evento);
evu = unique(ev);
evu(evu == "normal" | evu == "") = [];
if isempty(evu)
    T = table({'Nenhum'}, 0, 'VariableNames', {'Evento','Ocorrencias'});
    return;
end

counts = zeros(numel(evu),1);
for i = 1:numel(evu)
    counts(i) = sum(ev == evu(i));
end
T = table(evu, counts, 'VariableNames', {'Evento','Amostras'});
end

