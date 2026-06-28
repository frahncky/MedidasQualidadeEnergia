PLATAFORMA DE MEDIDAS, MEDICAO E QUALIDADE DE ENERGIA - MATLAB APP

Arquivos principais:
1. executar_app.m
   Atalho na raiz para abrir a interface.

2. app/PlataformaMedidasQualidadeEnergiaApp.m
   Aplicativo MATLAB programatico no estilo App Designer, com abas, botoes,
   graficos, tabelas, editor de circuitos didatico, simulacao, diagramas
   fasoriais, harmônicos, estatistica, metrologia, seguranca e relatorios.

3. dados/dados_demo_energia.csv
   Base demonstrativa para testar o app.

4. dados/componentes_circuito_demo.csv
   Lista de componentes de exemplo para o editor/simulador.

5. src/+energia, src/+circuitos e src/+relatorios
   Funcoes separadas de calculo, circuitos e exportacao/relatorios.

COMO USAR:
1. Abra o MATLAB.
2. Coloque esta pasta como Current Folder.
3. Execute:
      executar_app

RECURSOS IMPLEMENTADOS:
- Interface com 10 abas principais no estilo App Designer, com subtelas internas para os conteúdos didáticos.
- Dashboard com indicadores.
- Importacao CSV/MAT/Excel.
- Medidas basicas: tensao, corrente, resistencia, potencia.
- Editor de circuitos didatico com componentes eletricos.
- Arraste de componentes dentro da area de desenho.
- Edicao de valores por tabela.
- Simulacao didatica de circuitos CC, RLC serie/paralelo, trifasico equilibrado, correcao de FP e ressonancia.
- Diagramas fasoriais de tensoes/correntes.
- Triangulo de potencias.
- FFT, THD e espectro harmonico.
- Energia, demanda, fator de potencia.
- Deteccao didatica de eventos de qualidade de energia por RMS/frequencia e marcadores importados.
- Estatistica por tipo de carga.
- Metrologia, incerteza e calibracao.
- TC/TP e relacao de transformacao.
- Osciloscopio/aquisicao.
- Checklist de seguranca.
- Exportacao de graficos em PNG, JPG, PDF, EPS e SVG.
- Exportacao de tabelas em CSV, XLSX e MAT.
- Geracao de relatorio HTML, TXT e DOC compativel com Word.

OBSERVACAO IMPORTANTE:
O editor de circuitos e um simulador DIDATICO. Ele permite montar componentes,
editar valores e calcular grandezas principais. Ele nao substitui Multisim,
Simscape Electrical ou SPICE para qualquer topologia arbitraria. Para simular
qualquer circuito livremente, o ideal e integrar este app ao Simscape Electrical
ou a um solver SPICE externo.

ORGANIZACAO ATUAL DAS ABAS:
1. Dashboard
2. Dados
3. Medidas e Instrumentos
4. Circuitos e Editor
5. Simulacao
6. Fasores / Trifasico
7. Qualidade de Energia
8. Energia, Demanda e FP
9. Metrologia, TC/TP e Seguranca
10. Relatorios
