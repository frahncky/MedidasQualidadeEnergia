function [d, issues] = prepararDados(d)
issues = strings(0,1);
if isempty(d) || ~istable(d)
    return;
end

n = height(d);
if n == 0
    return;
end

if energia.hasColumn(d, 'timestamp')
    try
        if ~isdatetime(d.timestamp)
            d.timestamp = datetime(d.timestamp);
            issues(end+1) = "timestamp convertido para datetime.";
        end
    catch
        d.timestamp = (datetime(2026,1,1) + minutes(0:n-1))';
        issues(end+1) = "timestamp invalido substituido por serie regular.";
    end
else
    d.timestamp = (datetime(2026,1,1) + minutes(0:n-1))';
    issues(end+1) = "timestamp criado automaticamente.";
end

if ~energia.hasColumn(d,'Va_V'), d.Va_V = 220 + zeros(n,1); issues(end+1) = "Va_V ausente preenchido com 220 V."; end
if ~energia.hasColumn(d,'Vb_V'), d.Vb_V = d.Va_V; issues(end+1) = "Vb_V ausente copiado de Va_V."; end
if ~energia.hasColumn(d,'Vc_V'), d.Vc_V = d.Va_V; issues(end+1) = "Vc_V ausente copiado de Va_V."; end
if ~energia.hasColumn(d,'Vll_V'), d.Vll_V = mean([d.Va_V d.Vb_V d.Vc_V],2) * sqrt(3); issues(end+1) = "Vll_V derivado das tensoes de fase."; end
if ~energia.hasColumn(d,'Ia_A'), d.Ia_A = 10 + zeros(n,1); issues(end+1) = "Ia_A ausente preenchido com 10 A."; end
if ~energia.hasColumn(d,'Ib_A'), d.Ib_A = d.Ia_A; issues(end+1) = "Ib_A ausente copiado de Ia_A."; end
if ~energia.hasColumn(d,'Ic_A'), d.Ic_A = d.Ia_A; issues(end+1) = "Ic_A ausente copiado de Ia_A."; end
if ~energia.hasColumn(d,'FP'), d.FP = 0.92 + zeros(n,1); issues(end+1) = "FP ausente preenchido com 0,92."; end

d.FP = max(0.01, min(1, d.FP));
if ~energia.hasColumn(d,'P_kW'), d.P_kW = sqrt(3) .* d.Vll_V .* d.Ia_A .* d.FP / 1000; issues(end+1) = "P_kW derivado de Vll, I e FP."; end
if ~energia.hasColumn(d,'S_kVA'), d.S_kVA = abs(d.P_kW) ./ max(abs(d.FP), 0.01); issues(end+1) = "S_kVA derivado de P e FP."; end
if ~energia.hasColumn(d,'Q_kvar'), d.Q_kvar = sqrt(max(d.S_kVA.^2 - d.P_kW.^2, 0)); issues(end+1) = "Q_kvar derivado de P e S."; end
if ~energia.hasColumn(d,'freq_Hz'), d.freq_Hz = 60 + zeros(n,1); issues(end+1) = "freq_Hz ausente preenchido com 60 Hz."; end
if ~energia.hasColumn(d,'THD_V_pct'), d.THD_V_pct = zeros(n,1); issues(end+1) = "THD_V_pct ausente preenchido com 0 %."; end
if ~energia.hasColumn(d,'THD_I_pct'), d.THD_I_pct = zeros(n,1); issues(end+1) = "THD_I_pct ausente preenchido com 0 %."; end
if ~energia.hasColumn(d,'deseq_V_pct')
    d.deseq_V_pct = 100 * std([d.Va_V d.Vb_V d.Vc_V],0,2) ./ max(mean([d.Va_V d.Vb_V d.Vc_V],2), eps);
    issues(end+1) = "deseq_V_pct calculado pelas tensoes de fase.";
end
if ~energia.hasColumn(d,'evento'), d.evento = repmat("normal", n, 1); issues(end+1) = "evento ausente preenchido como normal."; end

vars = d.Properties.VariableNames;
for i = 1:numel(vars)
    v = d.(vars{i});
    if isnumeric(v)
        miss = ismissing(v);
        if any(miss(:))
            try
                d.(vars{i}) = fillmissing(v, 'linear', 'EndValues', 'nearest');
            catch
                vv = v;
                base = mean(vv(~miss), 'omitnan');
                if isnan(base), base = 0; end
                vv(miss) = base;
                d.(vars{i}) = vv;
            end
            issues(end+1) = sprintf('%s tinha valores ausentes e foi preenchido.', vars{i});
        end
    end
end
end

