function [T, phasors] = fasorTable(d)
[d,~] = energia.prepararDados(d);
fp = mean(d.FP, 'omitnan');
phi = acos(max(-1,min(1,fp)));
a = exp(1j*2*pi/3);

Va = mean(d.Va_V,'omitnan') * exp(1j*0);
Vb = mean(d.Vb_V,'omitnan') * exp(-1j*2*pi/3);
Vc = mean(d.Vc_V,'omitnan') * exp(1j*2*pi/3);
Ia = mean(d.Ia_A,'omitnan') * exp(-1j*phi);
Ib = mean(d.Ib_A,'omitnan') * exp(-1j*(2*pi/3 + phi));
Ic = mean(d.Ic_A,'omitnan') * exp(1j*(2*pi/3 - phi));
In = -(Ia + Ib + Ic);
V0 = (Va + Vb + Vc) / 3;
V1 = (Va + a*Vb + a^2*Vc) / 3;
V2 = (Va + a^2*Vb + a*Vc) / 3;
phasors = [Va Vb Vc Ia Ib Ic In V0 V1 V2];

names = {'Va';'Vb';'Vc';'Ia';'Ib';'Ic';'In';'V0';'V1';'V2'};
unidade = {'V';'V';'V';'A';'A';'A';'A';'V';'V';'V'};
T = table(names, abs(phasors(:)), rad2deg(angle(phasors(:))), unidade, ...
    'VariableNames', {'Fasor','Modulo','Angulo_graus','Unidade'});
end

