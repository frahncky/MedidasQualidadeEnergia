function D = demandSeries(d, minutesWindow)
[d,~] = energia.prepararDados(d);
dt = energia.timeStepHours(d);
n = max(1, round((minutesWindow/60) / dt));
D = movmean(d.P_kW, n, 'omitnan');
end

