% Executar o SMQE - Simulador de Medicao e Qualidade de Energia
% Requer MATLAB R2020b ou superior. Recomendado R2022b+.
clear; clc;
appDir = fileparts(mfilename('fullpath'));
root = fileparts(appDir);
addpath(appDir);
addpath(fullfile(root,'src'));
app = PlataformaMedidasQualidadeEnergiaApp();
