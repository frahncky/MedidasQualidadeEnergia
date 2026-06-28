function dt = timeStepHours(d)
t = energia.getTimeVector(d);
if isdatetime(t) && numel(t) > 1
    dt = median(hours(diff(t)), 'omitnan');
else
    dt = 1/60;
end

if isempty(dt) || isnan(dt) || dt <= 0
    dt = 1/60;
end
end

