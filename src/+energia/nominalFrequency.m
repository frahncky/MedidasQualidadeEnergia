function f0 = nominalFrequency(d)
if energia.hasColumn(d,'freq_Hz')
    f0 = median(d.freq_Hz, 'omitnan');
else
    f0 = 60;
end

if isempty(f0) || isnan(f0) || f0 <= 0
    f0 = 60;
end
end

