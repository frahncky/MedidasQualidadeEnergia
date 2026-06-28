function H = harmonicTable(d, signalName, maxOrder)
[d,~] = energia.prepararDados(d);
f0 = energia.nominalFrequency(d);
fs = energia.estimateSampleRate(d);
orders = (1:maxOrder)';
limits = 8 * ones(maxOrder,1);
limits(1) = 100;

if energia.hasColumn(d, signalName)
    y = d.(signalName);
else
    y = d.Ia_A;
end
y = double(y(:));
y = y(~isnan(y));

if numel(y) > 16 && fs > 2*f0
    n = numel(y);
    win = 0.5 - 0.5*cos(2*pi*(0:n-1)'/max(n-1,1));
    Y = abs(fft((y - mean(y,'omitnan')) .* win));
    f = (0:n-1)' * fs / n;
    mag = zeros(maxOrder,1);
    for k = 1:maxOrder
        [~,idx] = min(abs(f - k*f0));
        mag(k) = Y(idx);
    end
    if mag(1) == 0, mag(1) = max(mag); end
    mag = 100 * mag / max(mag(1), eps);
else
    thd = mean(d.THD_I_pct, 'omitnan');
    if isnan(thd), thd = 0; end
    mag = zeros(maxOrder,1);
    mag(1) = 100;
    idx = (2:maxOrder)';
    w = 1 ./ (idx.^1.25);
    w = w / sqrt(sum(w.^2));
    mag(2:end) = thd * w;
end

H = table(orders, orders*f0, mag, limits, ...
    'VariableNames', {'Ordem','Frequencia_Hz','Magnitude_pct','Limite_pct'});
end

