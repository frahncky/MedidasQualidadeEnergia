% Atalho para abrir a Plataforma de Medidas, Medicao e Qualidade de Energia.
root = fileparts(mfilename('fullpath'));
addpath(fullfile(root,'app'));
addpath(fullfile(root,'src'));
run(fullfile(root,'app','executar_app.m'));
