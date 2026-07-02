# SMQE - Simulador de Medição e Qualidade de Energia

<img src="assets/smqe_icon.svg" alt="SMQE" width="96">

Aplicativo MATLAB programatico no estilo App Designer para estudos de medidas eletricas, medicao, metrologia e qualidade de energia.

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
- `docs/`: especificacao, mapa de abas, bases reais de referencia e material de apoio.
- `assets/`: imagens da interface e icone visual do SMQE.

## Observacao

O editor e o simulador de circuitos sao didaticos. Eles ajudam a montar, validar e analisar casos principais, mas nao substituem SPICE, Simscape Electrical ou ferramentas equivalentes para topologias arbitrarias.

## Bases reais

A base local em `dados/` e demonstrativa. Para estudos com dados reais, consulte `docs/bases_reais_referencias.md`; a versao web cataloga bases abertas e referencias IEEE, importa CSV, XLSX e COMTRADE ASCII, e tambem baixa CSV/XLSX por URL direta para salvar no banco local do navegador.
