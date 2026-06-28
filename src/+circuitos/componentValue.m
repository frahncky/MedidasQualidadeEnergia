function v = componentValue(components, tipo, defaultValue)
idx = find(strcmp(components.tipo, tipo), 1);
if isempty(idx)
    v = defaultValue;
else
    v = components.valor(idx);
end
end

