% Atalho para abrir o SMQE - Simulador de Medicao e Qualidade de Energia.
root = fileparts(mfilename('fullpath'));
addpath(fullfile(root,'app'));
addpath(fullfile(root,'src'));
run(fullfile(root,'app','executar_app.m'));
