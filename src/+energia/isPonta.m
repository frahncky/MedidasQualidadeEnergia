function flag = isPonta(d)
t = energia.getTimeVector(d);
if isdatetime(t)
    h = hour(t);
    flag = h >= 18 & h < 21;
else
    flag = false(height(d),1);
end
end

