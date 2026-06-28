function [E,t] = energySeries(d)
[d,~] = energia.prepararDados(d);
dt = energia.timeStepHours(d);
E = cumsum(d.P_kW) * dt;
t = energia.getTimeVector(d);
end

