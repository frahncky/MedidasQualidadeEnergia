function thd = calcTHD(H)
if isempty(H) || height(H) < 2
    thd = 0;
    return;
end
thd = sqrt(sum(H.Magnitude_pct(2:end).^2)) / max(H.Magnitude_pct(1), eps) * 100;
end

