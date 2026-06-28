# Plataforma MATLAB de Medidas e Qualidade de Energia

Aplicativo MATLAB programatico no estilo App Designer para estudos de medidas eletricas, medicao de energia e qualidade de energia.

## Como executar

No MATLAB, abra esta pasta como `Current Folder` e execute:

```matlab
executar_app
```

## Estrutura

- `app/`: interface principal e lancador interno.
- `src/+energia/`: calculos de dados, energia, demanda, FP, FFT, eventos, estatistica e fasores.
- `src/+circuitos/`: validacao e calculos didaticos de circuitos, TC e TP.
- `src/+relatorios/`: exportacao de tabelas e geracao de relatorios.
- `dados/`: bases demonstrativas.
- `docs/`: especificacao, mapa de abas e material de apoio.
- `assets/`: imagens da interface.

## Observacao

O editor e o simulador de circuitos sao didaticos. Eles ajudam a montar, validar e analisar casos principais, mas nao substituem SPICE, Simscape Electrical ou ferramentas equivalentes para topologias arbitrarias.

