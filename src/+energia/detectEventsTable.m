function T = detectEventsTable(d)
[d,~] = energia.prepararDados(d);
t = energia.getTimeVector(d);
pct = 100 * d.Va_V / 220;
freq = d.freq_Hz;
labels = strings(height(d),1);
mag = 100 + zeros(height(d),1);

labels(pct < 10) = "interrupcao";
mag(pct < 10) = pct(pct < 10);
labels(pct >= 10 & pct < 90) = "sag";
mag(pct >= 10 & pct < 90) = pct(pct >= 10 & pct < 90);
labels(pct > 110) = "swell";
mag(pct > 110) = pct(pct > 110);
freqMask = abs(freq - 60) > 0.5 & labels == "";
labels(freqMask) = "freq_var";
mag(freqMask) = freq(freqMask);

ev = string(d.evento);
use = ev ~= "normal" & ev ~= "";
labels(use & labels == "") = ev(use & labels == "");
mask = labels ~= "";

if ~any(mask)
    T = table("Nenhum", NaT, NaT, 0, 100, "OK", ...
        'VariableNames', {'Evento','Inicio','Fim','Duracao_s','Magnitude_pct','Severidade'});
    return;
end

starts = find(diff([false; mask]) == 1);
ends = find(diff([mask; false]) == -1);
rows = table();
dt = energia.timeStepHours(d) * 3600;
for i = 1:numel(starts)
    idx = starts(i):ends(i);
    sev = "Moderada";
    if min(mag(idx)) < 70 || max(mag(idx)) > 120
        sev = "Alta";
    end
    row = table(labels(starts(i)), t(starts(i)), t(ends(i)), numel(idx)*dt, mean(mag(idx),'omitnan'), sev, ...
        'VariableNames', {'Evento','Inicio','Fim','Duracao_s','Magnitude_pct','Severidade'});
    if isempty(rows), rows = row; else, rows = [rows; row]; end %#ok<AGROW>
end
T = rows;
end

