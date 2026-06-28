function t = getTimeVector(d)
if isempty(d) || ~istable(d)
    t = [];
    return;
end

if energia.hasColumn(d,'timestamp')
    try
        t = d.timestamp;
        if ~isdatetime(t)
            t = datetime(t);
        end
    catch
        t = (1:height(d))';
    end
else
    t = (1:height(d))';
end
end

