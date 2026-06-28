function tf = hasColumn(T, name)
tf = istable(T) && any(strcmp(T.Properties.VariableNames, name));
end
