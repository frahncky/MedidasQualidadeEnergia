# Bases reais e referências adotadas

O SMQE mantém uma base demonstrativa local para testes rápidos, mas a aba Dados agora trabalha com um catálogo de bases reais e referências normativas. A origem selecionada acompanha a importação como metadado de linhagem.

## Bases reais abertas

| Base | Uso principal no SMQE | Formato recomendado | Referência |
|---|---|---|---|
| Power Grid Frequency Database | Frequência da rede e conformidade de frequência | CSV tabular | Jumar et al., Database of Power Grid Frequency Measurements |
| UK-DALE | Energia, demanda e perfis de carga | CSV tabular | Kelly and Knottenbelt, The UK-DALE dataset |
| Open Power System Data | Séries de carga, geração e sistema | CSV tabular | Open Power System Data |
| PQube public recordings | Eventos e medições de qualidade de energia | CSV ou exportação do equipamento | Registros públicos PQube/Powerside |

## Bases reais citadas na literatura

| Base | Uso principal no SMQE | Observação |
|---|---|---|
| PQStream | Qualidade de energia em transmissão | Referência de arquitetura e base real de literatura; acesso direto aos dados pode depender dos autores ou da instituição. |

## Referências IEEE

| Referência | Papel no SMQE |
|---|---|
| IEEE 1159-2019 | Classificação e interpretação de fenômenos de qualidade de energia. |
| IEEE 519-2022 | Limites e interpretação de distorção harmônica. |
| IEEE C37.111 / COMTRADE | Formato de oscilografia e troca de dados transitórios; o app web importa COMTRADE ASCII. |
| IEEE 1159.3 / PQDIF | Formato de intercâmbio de dados de qualidade de energia; catalogado como referência, ainda sem parser web. |

## Estado de suporte

| Formato | Web | MATLAB |
|---|---|---|
| CSV | Importação real | Importação real |
| XLSX/XLS | Importação real | Importação real |
| COMTRADE ASCII | Importação real | Não integrado no app MATLAB atual |
| MAT | Catalogado no web; importar na versão MATLAB | Importação real |
| TDMS | Catalogado; requer conversão ou parser futuro | Não integrado |
| PQDIF | Catalogado; requer parser futuro | Não integrado |
| Banco SQL | Catalogado; requer conector futuro | Não integrado |

## Download web e banco local

A aba Dados aceita uma URL direta de arquivo CSV, TXT/TSV ou XLSX. Ao clicar em **Baixar da web**, o navegador baixa o arquivo, monta a prévia, envia os dados para o motor de análise e salva a importação no IndexedDB local da aplicação.

Depois que uma base real foi salva, selecionar a mesma fonte no catálogo recarrega a importação mais recente do banco local. O botão **Carregar do banco** também fica disponível para recarga manual.

Limitações importantes:

- URLs de páginas HTML, páginas de artigo, mapas interativos e portais com login não são dados tabulares diretos.
- Alguns repositórios bloqueiam download por navegador via CORS; nesses casos, baixe o arquivo manualmente e importe por CSV/XLSX/COMTRADE.
- Normas IEEE são referências técnicas e formatos, não bases de medição abertas para baixar diretamente.

## Transparência

Os dados em `dados/dados_demo_energia.csv` continuam sendo uma base demonstrativa. Para estudos com dados reais, selecione a referência na aba Dados e importe o arquivo obtido do repositório ou equipamento correspondente.
