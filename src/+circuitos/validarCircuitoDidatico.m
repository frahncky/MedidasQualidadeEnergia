function T = validarCircuitoDidatico(components, wires)
items = strings(0,1);
status = strings(0,1);
msg = strings(0,1);

if isempty(components) || ~istable(components)
    tipos = strings(0,1);
else
    tipos = string(components.tipo);
end

if isempty(tipos)
    items(end+1) = "Circuito"; status(end+1) = "Erro"; msg(end+1) = "Nao ha componentes.";
end
if ~any(ismember(tipos, ["Fonte CA","Fonte CC"]))
    items(end+1) = "Fonte"; status(end+1) = "Erro"; msg(end+1) = "Inclua uma fonte CA ou CC.";
end
if ~any(ismember(tipos, ["Resistor","Indutor","Capacitor","Motor","Carga nao linear","Carga não linear"]))
    items(end+1) = "Carga"; status(end+1) = "Erro"; msg(end+1) = "Inclua ao menos uma carga ou elemento R/L/C.";
end
if any(tipos == "TC") && ~any(ismember(tipos, ["Amperimetro","Amperímetro","Wattimetro","Wattímetro","Medidor kWh"]))
    items(end+1) = "TC"; status(end+1) = "Alerta"; msg(end+1) = "TC sem instrumento/fechamento explicito: nunca deixar secundario aberto.";
end
if any(tipos == "Amperímetro" | tipos == "Amperimetro") && isempty(wires)
    items(end+1) = "Amperimetro"; status(end+1) = "Alerta"; msg(end+1) = "Sem fios cadastrados; confirme ligacao em serie.";
end
if any(tipos == "Voltímetro" | tipos == "Voltimetro") && isempty(wires)
    items(end+1) = "Voltimetro"; status(end+1) = "Alerta"; msg(end+1) = "Sem fios cadastrados; confirme ligacao em paralelo.";
end

if isempty(items)
    items = "OK"; status = "OK"; msg = "Circuito didatico pronto para simulacao simplificada.";
end
T = table(items(:), status(:), msg(:), 'VariableNames', {'Item','Status','Mensagem'});
end

