function T = energySummary(d)
[d,~] = energia.prepararDados(d);
dt = energia.timeStepHours(d);
E = sum(d.P_kW) * dt;
Eq = sum(abs(d.Q_kvar)) * dt;
D15 = max(energia.demandSeries(d, 15));
Dmed = mean(d.P_kW, 'omitnan');
fc = Dmed / max(D15, eps);
ponta = d.P_kW(energia.isPonta(d));
fora = d.P_kW(~energia.isPonta(d));
if isempty(ponta), ponta = NaN; end
if isempty(fora), fora = NaN; end

T = table({'Energia ativa';'Energia reativa';'Demanda max 15 min';'Demanda media';'Fator de carga';'Ponta media';'Fora ponta media'}, ...
    [E; Eq; D15; Dmed; fc; mean(ponta,'omitnan'); mean(fora,'omitnan')], ...
    {'kWh';'kvarh';'kW';'kW';'pu';'kW';'kW'}, ...
    'VariableNames', {'Indicador','Valor','Unidade'});
end

