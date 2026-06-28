function T = loadStatsTable(d)
[d,~] = energia.prepararDados(d);
P = d.P_kW;
tipo = repmat("Resistiva", height(d), 1);
tipo(d.FP < 0.88) = "Motor/indutiva";
tipo(d.THD_I_pct > 12) = "Eletronica";
tipo(d.FP > 0.98 & d.Q_kvar < 0) = "Capacitiva";
tipo(d.P_kW > mean(d.P_kW,'omitnan') + std(d.P_kW,'omitnan')) = "Mista/pico";

cats = unique(tipo);
Pm = zeros(numel(cats),1);
Ps = Pm;
Cv = Pm;
P95 = Pm;
Out = Pm;
for i = 1:numel(cats)
    x = P(tipo == cats(i));
    Pm(i) = mean(x,'omitnan');
    Ps(i) = std(x,'omitnan');
    Cv(i) = 100 * Ps(i) / max(Pm(i), eps);
    P95(i) = percentileValue(x, 95);
    Out(i) = sum(abs(x - median(x,'omitnan')) > 3*max(Ps(i),eps));
end
T = table(cats, Pm, Ps, Cv, P95, Out, ...
    'VariableNames', {'Tipo','P_media_kW','P_desvio_kW','CV_pct','P95_kW','Outliers'});
end

function p = percentileValue(x, q)
x = sort(x(~isnan(x)));
if isempty(x)
    p = NaN;
    return;
end
idx = max(1, min(numel(x), round((q/100) * numel(x))));
p = x(idx);
end

