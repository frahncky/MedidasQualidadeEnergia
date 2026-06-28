function [W,I] = scopeWaveform(d)
[d,~] = energia.prepararDados(d);
fs = 10000;
f0 = energia.nominalFrequency(d);
t = (0:1/fs:3/f0)';
Vrms = mean(d.Va_V,'omitnan');
Irms = mean(d.Ia_A,'omitnan');
fp = mean(d.FP,'omitnan');
phi = acos(max(-1,min(1,fp)));
v = sqrt(2) * Vrms * sin(2*pi*f0*t);
i = sqrt(2) * Irms * sin(2*pi*f0*t - phi);
W = table(t, v, i, 'VariableNames', {'tempo_s','v_V','i_A'});
I = table({'Taxa de amostragem';'Nyquist';'Frequencia';'Vrms';'Irms';'Defasagem';'Periodo'}, ...
    [fs; fs/2; f0; Vrms; Irms; rad2deg(phi); 1/f0], ...
    {'Hz';'Hz';'Hz';'V';'A';'graus';'s'}, ...
    'VariableNames', {'Grandeza','Valor','Unidade'});
end

