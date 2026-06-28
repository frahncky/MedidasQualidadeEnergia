function T = tctpTable(components)
loads = [20;50;100;120];
if isempty(components) || ~istable(components)
    comps = table();
else
    comps = components(ismember(string(components.tipo), ["TC","TP"]),:);
end

if isempty(comps)
    comps = table([1;2], ["TC";"TP"], ["TC demo";"TP demo"], [100;13800], ["A/5A";"V/115V"], [0;0], [0;0], ...
        'VariableNames', {'id','tipo','nome','valor','unidade','x','y'});
end

T = table();
for c = 1:height(comps)
    tipo = string(comps.tipo(c));
    classe = 0.5;
    sec = 5;
    if tipo == "TP"
        classe = 0.3;
        sec = 115;
    end
    rel = comps.valor(c) / sec;
    for i = 1:numel(loads)
        err = classe * 0.65 * sin(loads(i)/120*pi);
        ang = 12 * classe * cos(loads(i)/120*pi);
        status = "Aprovado";
        if abs(err) > classe
            status = "Reprovar";
        end
        row = table(string(comps.nome(c)), tipo, rel, loads(i), err, ang, classe, status, ...
            'VariableNames', {'Instrumento','Tipo','Relacao','Carga_pct','Erro_rel_pct','Erro_angular_min','Classe_pct','Status'});
        if isempty(T), T = row; else, T = [T; row]; end %#ok<AGROW>
    end
end
end

