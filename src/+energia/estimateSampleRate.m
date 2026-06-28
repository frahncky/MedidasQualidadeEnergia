function fs = estimateSampleRate(d)
t = energia.getTimeVector(d);
if isdatetime(t) && numel(t) > 1
    dt = median(seconds(diff(t)), 'omitnan');
    fs = 1 / max(dt, eps);
else
    fs = 1 / energia.timeStepHours(d) / 3600;
end
end

