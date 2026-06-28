classdef PlataformaMedidasQualidadeEnergiaApp < handle
    % SMQE - Simulador de Medicao e Qualidade de Energia
    % Interface programatica no estilo App Designer.
    % Autor: Francisco S. Viana / gerado para disciplina de Medidas e Qualidade de Energia.

    properties
        UIFigure matlab.ui.Figure
        MainGrid matlab.ui.container.GridLayout
        Ribbon matlab.ui.container.Panel
        BodyGrid matlab.ui.container.GridLayout
        LeftPanel matlab.ui.container.Panel
        RightPanel matlab.ui.container.Panel
        CenterPanel matlab.ui.container.Panel
        BottomPanel matlab.ui.container.Panel
        TabGroup matlab.ui.container.TabGroup
        StatusLabel matlab.ui.control.Label
        LogText matlab.ui.control.TextArea
        ProjectTree matlab.ui.container.Tree
        MetaText matlab.ui.control.TextArea
        ParamPanel matlab.ui.container.Panel

        % Dados
        Data table
        Components table
        Wires table
        Events table
        LastFolder char = ''
        CurrentAxes matlab.graphics.axis.Axes
        ExportFormatDrop matlab.ui.control.DropDown

        % Dashboard axes
        AxTempo matlab.ui.control.UIAxes
        AxHarmonicos matlab.ui.control.UIAxes
        AxEnergia matlab.ui.control.UIAxes
        AxScatter matlab.ui.control.UIAxes
        AxDiagrama matlab.ui.control.UIAxes
        AxCargaStats matlab.ui.control.UIAxes
        TabelaResumo matlab.ui.control.Table
        TabelaEventos matlab.ui.control.Table
        DashboardCardValueLabels cell = {}
        DashboardCardSubLabels cell = {}
        DashboardIndicatorsPanel matlab.ui.container.Panel

        % Editor de circuitos
        CircuitAxes matlab.ui.control.UIAxes
        ComponentDrop matlab.ui.control.DropDown
        ComponentTable matlab.ui.control.Table
        SelectedGraphic
        DragData struct
        NextComponentId double = 1
        PendingWireId double = NaN
        SimModeDrop matlab.ui.control.DropDown
        SimResultTable matlab.ui.control.Table
        AxSimTempo matlab.ui.control.UIAxes
        AxSimFasor matlab.ui.control.UIAxes
        AxSimPot matlab.ui.control.UIAxes

        % Fasores
        AxFasores matlab.ui.control.UIAxes
        FasorTable matlab.ui.control.Table

        % Outras abas
        ImportTable matlab.ui.control.Table
        BasicMeasureTable matlab.ui.control.Table
        BasicInputFields cell = {}
        AnalysisAxes cell = {}
        AnalysisTables cell = {}
        InstrumentsTable matlab.ui.control.Table
        MetrologyTable matlab.ui.control.Table
        SafetyTable matlab.ui.control.Table
    end

    methods
        function app = PlataformaMedidasQualidadeEnergiaApp()
            app.ensureProjectPath();
            app.createDemoData();
            app.createUI();
            app.refreshAll();
            app.log('Aplicativo iniciado. Dados demonstrativos carregados.');
        end

        function delete(app)
            try
                delete(app.UIFigure);
            catch
            end
        end
    end

    methods (Access = private)
        function createDemoData(app)
            baseFile = app.dataFile('dados_demo_energia.csv');
            compFile = app.dataFile('componentes_circuito_demo.csv');
            if exist(baseFile,'file')
                app.Data = readtable(baseFile);
                try, app.Data.timestamp = datetime(app.Data.timestamp); end %#ok<TRYNC>
            else
                n=1440; t=(0:n-1)'/60; ts=datetime(2026,1,1)+minutes(0:n-1)';
                P=55+20*sin(2*pi*(t-8)/24)+8*sin(2*pi*t/6);
                fp=max(0.75,min(0.98,0.92-0.08*exp(-((t-19)/2).^2)));
                S=P./fp; Q=sqrt(max(S.^2-P.^2,0));
                Va=220+3*sin(2*pi*t/24); Vb=219+2*sin(2*pi*(t+0.3)/24); Vc=221+2*sin(2*pi*(t-0.1)/24);
                I=P*1000./(sqrt(3)*380.*fp);
                app.Data=table(ts,Va,Vb,Vc,(Va+Vb+Vc)/3*sqrt(3),I,I,I,P,Q,S,fp,60+0*t,2+0*t,8+0*t,1+0*t,repmat("normal",n,1), ...
                    'VariableNames',{'timestamp','Va_V','Vb_V','Vc_V','Vll_V','Ia_A','Ib_A','Ic_A','P_kW','Q_kvar','S_kVA','FP','freq_Hz','THD_V_pct','THD_I_pct','deseq_V_pct','evento'});
            end
            if exist(compFile,'file')
                app.Components = readtable(compFile);
            else
                app.Components = table([],{}, {}, [], {}, [], [], 'VariableNames',{'id','tipo','nome','valor','unidade','x','y'});
            end
            if isempty(app.Components)
                app.NextComponentId = 1;
            else
                app.NextComponentId = max(app.Components.id)+1;
            end
            app.Wires = table([], [], 'VariableNames', {'from_id','to_id'});
            app.Events = table();
        end

        function ensureProjectPath(app)
            root = app.projectRoot();
            addpath(fullfile(root,'app'));
            addpath(fullfile(root,'src'));
        end

        function root = projectRoot(app)
            classDir = fileparts(mfilename('fullpath'));
            [~, folderName] = fileparts(classDir);
            if strcmpi(folderName,'app')
                root = fileparts(classDir);
            else
                root = classDir;
            end
        end

        function file = dataFile(app,name)
            root = app.projectRoot();
            file = fullfile(root,'dados',name);
            if ~exist(file,'file')
                file = fullfile(root,name);
            end
        end

        function file = assetFile(app,name)
            root = app.projectRoot();
            file = fullfile(root,'assets',name);
            if ~exist(file,'file')
                file = fullfile(root,name);
            end
        end

        function file = iconFile(app)
            file = app.assetFile('smqe_icon.png');
            if ~exist(file,'file')
                file = app.assetFile('smqe_icon.svg');
            end
        end

        function createUI(app)
            app.UIFigure = uifigure('Name','SMQE - Simulador de Medição e Qualidade de Energia', ...
                'Position',[80 60 1550 860], 'Color',[0.97 0.98 0.99]);
            iconFile = app.iconFile();
            if exist(iconFile,'file')
                try
                    app.UIFigure.Icon = iconFile;
                catch
                end
            end
            app.UIFigure.CloseRequestFcn = @(src,evt) delete(app);

            app.MainGrid = uigridlayout(app.UIFigure,[3 1]);
            app.MainGrid.RowHeight = {84,'1x',34};
            app.MainGrid.ColumnWidth = {'1x'};
            app.MainGrid.Padding = [4 4 4 4];
            app.MainGrid.RowSpacing = 4;

            app.createRibbon();

            app.BodyGrid = uigridlayout(app.MainGrid,[1 3]);
            app.BodyGrid.ColumnWidth = {230,'1x',250};
            app.BodyGrid.RowHeight = {'1x'};
            app.BodyGrid.Padding = [0 0 0 0];
            app.BodyGrid.ColumnSpacing = 4;

            app.LeftPanel = uipanel(app.BodyGrid,'Title','Projeto / Bases','FontWeight','bold');
            app.CenterPanel = uipanel(app.BodyGrid,'Title','','BorderType','none');
            app.RightPanel = uipanel(app.BodyGrid,'Title','Parâmetros, notas e checklist','FontWeight','bold');
            app.BottomPanel = uipanel(app.MainGrid,'Title','','BorderType','none');

            app.createLeftPanel();
            app.createRightPanel();
            app.createTabs();
            app.createBottomPanel();
        end

        function createRibbon(app)
            app.Ribbon = uipanel(app.MainGrid,'Title','','BackgroundColor',[0.96 0.975 0.995]);
            g = uigridlayout(app.Ribbon,[2 14]);
            g.RowHeight = {24,'1x'};
            g.ColumnWidth = {76,76,76,70,70,70,70,70,70,76,76,76,76,'1x'};
            g.Padding = [6 4 6 4]; g.ColumnSpacing = 6;
            brand = uilabel(g,'Text','SMQE  |  Simulador de Medição e Qualidade de Energia', ...
                'FontSize',13,'FontWeight','bold','FontColor',[0.03 0.20 0.38]);
            brand.Layout.Row = 1; brand.Layout.Column = [1 5];
            grupos = {'DADOS','ANÁLISES','RELATÓRIOS','EXPORTAR','AJUDA'};
            groupCols = [6 7 10 12 13];
            for k=1:numel(grupos)
                lbl = uilabel(g,'Text',grupos{k},'FontSize',10,'FontWeight','bold','FontColor',[0.10 0.25 0.45]);
                lbl.Layout.Row = 1; lbl.Layout.Column = groupCols(k);
            end
            names = {'Novo','Abrir','Salvar','CSV','MAT','Tudo','FFT','THD','RMS','Relatório','Checklist','Figura','Manual',''};
            callbacks = {@(~,~)app.novoProjeto(), @(~,~)app.importarDados(), @(~,~)app.salvarProjeto(), @(~,~)app.importarCSV(), @(~,~)app.importarMAT(), @(~,~)app.refreshAll(), @(~,~)app.plotFFT(), @(~,~)app.plotTHD(), @(~,~)app.plotRMS(), @(~,~)app.gerarRelatorio(), @(~,~)app.mostrarChecklist(), @(~,~)app.exportarGraficoAtual(), @(~,~)app.abrirAjuda(), []};
            for k=1:13
                b = uibutton(g,'push','Text',names{k},'FontSize',10,'ButtonPushedFcn',callbacks{k});
                b.Layout.Row = 2; b.Layout.Column = k;
            end
            app.ExportFormatDrop = uidropdown(g,'Items',{'png','jpg','pdf','eps','svg'},'Value','png');
            app.ExportFormatDrop.Layout.Row = 2; app.ExportFormatDrop.Layout.Column = 14;
        end

        function createLeftPanel(app)
            g = uigridlayout(app.LeftPanel,[2 1]);
            g.RowHeight = {'1x',235}; g.Padding = [6 6 6 6];
            app.ProjectTree = uitree(g);
            iconFile = app.iconFile();
            if exist(iconFile,'file')
                base = uitreenode(app.ProjectTree,'Text','SMQE - Base do Projeto','Icon',iconFile);
            else
                base = uitreenode(app.ProjectTree,'Text','SMQE - Base do Projeto');
            end
            cats = {'Tarifação','Harmônicos','Flicker','Cargas','Calibração','TC-TP','Instrumentos','Resultados','Figuras','Relatórios'};
            for i=1:numel(cats)
                n = uitreenode(base,'Text',cats{i});
                if strcmp(cats{i},'Cargas')
                    uitreenode(n,'Text','Cargas Resistivas'); uitreenode(n,'Text','Motor'); uitreenode(n,'Text','Fonte Chaveada'); uitreenode(n,'Text','Carga Mista');
                end
            end
            expand(base);
            metaPanel = uipanel(g,'Title','Metadados do SMQE','FontWeight','bold');
            mg = uigridlayout(metaPanel,[2 1]); mg.RowHeight = {'1x',32}; mg.Padding=[6 6 6 6];
            app.MetaText = uitextarea(mg,'Editable','off','FontSize',11,'Value',{...
                'Sistema: SMQE', ...
                'Nome: Simulador de Medição e Qualidade de Energia', ...
                'Amostragem: 1 min / sinais: 10 kHz', ...
                'Período: base demonstrativa', ...
                'Tensão nominal: 220/380 V', ...
                'Frequência nominal: 60 Hz', ...
                'Instrumentos: analisador PQ, osciloscópio, multímetro', ...
                'Responsável: Prof. Francisco S. Viana'});
            uibutton(mg,'Text','Editar Metadados','ButtonPushedFcn',@(~,~)app.editarMetadados());
        end

        function createRightPanel(app)
            g = uigridlayout(app.RightPanel,[6 1]);
            g.RowHeight = {230,110,130,105,80,'1x'}; g.Padding=[6 6 6 6];

            p = uipanel(g,'Title','SMQE - Parâmetros da Análise','FontWeight','bold');
            pg = uigridlayout(p,[8 2]); pg.ColumnWidth={95,'1x'}; pg.RowHeight=repmat({24},1,8); pg.Padding=[6 6 6 6];
            labels={'Fase','Intervalo','Início','Fim','Tipo de carga','f0 (Hz)','Janela FFT','Posto tarifário'};
            vals={{'Todas','L1','L2','L3'},{'Completo','Personalizado'},{'00:00'},{'23:59'},{'Todas','Resistiva','Motor','Fonte chaveada','Mista'},{'60'},{'Hanning','Retangular','Flat-top'},{'Fora ponta','Ponta'}};
            for i=1:numel(labels)
                uilabel(pg,'Text',labels{i},'FontSize',10);
                if numel(vals{i})>1
                    uidropdown(pg,'Items',vals{i},'FontSize',10);
                else
                    uieditfield(pg,'text','Value',vals{i}{1},'FontSize',10);
                end
            end

            notes = uipanel(g,'Title','Roteiro didático','FontWeight','bold');
            uitextarea(notes,'Position',[8 8 225 70],'Editable','off','Value',{...
                '1. Importe ou valide a base de dados.', ...
                '2. Confira ligação, medição, harmônicos e eventos.', ...
                '3. Gere relatório com tabelas e gráficos.'});

            ck = uipanel(g,'Title','Checklist de Ensaio','FontWeight','bold');
            cg = uigridlayout(ck,[5 1]); cg.RowHeight = {20,20,20,20,20}; cg.Padding=[8 6 6 6];
            checks={'Dados importados/preparados','Instrumentos e ligações conferidos','Janela de análise definida','Calibração TC/TP verificada','Relatório revisado'};
            for i=1:5, uicheckbox(cg,'Text',checks{i},'Value',i<5); end

            sup = uipanel(g,'Title','Ensaios e grandezas suportadas','FontWeight','bold');
            sg = uigridlayout(sup,[3 3]); sg.Padding=[6 6 6 6];
            tags={'Tensão','Corrente','Potência','Energia','FP','Harmônicos','Flicker','RMS','Fasores'};
            for i=1:numel(tags), uilabel(sg,'Text',tags{i},'BackgroundColor',[0.93 0.96 0.99],'HorizontalAlignment','center'); end

            q = uipanel(g,'Title','Ações rápidas','FontWeight','bold');
            qg = uigridlayout(q,[2 2]); qg.Padding=[6 6 6 6];
            uibutton(qg,'Text','Importar Dados','ButtonPushedFcn',@(~,~)app.importarDados());
            uibutton(qg,'Text','Exportar Gráficos','ButtonPushedFcn',@(~,~)app.exportarTodosGraficos());
            uibutton(qg,'Text','Gerar Relatório','ButtonPushedFcn',@(~,~)app.gerarRelatorio());
            uibutton(qg,'Text','Ajuda','ButtonPushedFcn',@(~,~)app.abrirAjuda());

            app.StatusLabel = uilabel(g,'Text','SMQE pronto para análise','FontWeight','bold','FontColor',[0.0 0.45 0.15]);
        end

        function createBottomPanel(app)
            g = uigridlayout(app.BottomPanel,[1 2]); g.ColumnWidth = {'1x',170}; g.Padding=[4 0 4 0];
            app.LogText = uitextarea(g,'Editable','off','FontSize',10,'Value',{'Log de processamento:'});
            uibutton(g,'Text','Limpar Log','ButtonPushedFcn',@(~,~)set(app.LogText,'Value',{'Log de processamento:'}));
        end

        function createTabs(app)
            g = uigridlayout(app.CenterPanel,[1 1]); g.Padding=[0 0 0 0];
            app.TabGroup = uitabgroup(g);
            app.createDashboardTab();
            app.createImportTab();
            app.createMedidasInstrumentosTab();
            app.createCircuitosEditorTab();
            app.createSimulacaoTab();
            app.createFasoresTab();
            app.createQualidadeEnergiaTab();
            app.createEnergiaFPTab();
            app.createMetrologiaTCTPSegurancaTab();
            app.createRelatoriosTab();
        end

        function createDashboardTab(app)
            tab = uitab(app.TabGroup,'Title','1 Dashboard');
            g = uigridlayout(tab,[5 5]);
            g.RowHeight = {78,'1.25x','1x',150,94};
            g.ColumnWidth = {'1x','1x','1x','1x','1x'};
            g.Padding = [8 8 8 8];
            g.RowSpacing = 8;
            g.ColumnSpacing = 8;

            cards = {'Energia do Dia (kWh)','Demanda Máxima (kW)','FP Médio','THD-I Máx (%)','THD-V Máx (%)'};
            colors = {[0.05 0.40 0.80],[0.90 0.32 0.10],[0.10 0.55 0.26],[0.42 0.14 0.76],[0.03 0.45 0.82]};
            app.DashboardCardValueLabels = cell(1,numel(cards));
            app.DashboardCardSubLabels = cell(1,numel(cards));
            for i=1:numel(cards)
                p = uipanel(g,'Title',cards{i},'FontWeight','bold','BackgroundColor',[0.985 0.99 1]);
                p.Layout.Row = 1; p.Layout.Column = i;
                cg = uigridlayout(p,[2 1]);
                cg.RowHeight = {'1x',22};
                cg.Padding = [8 2 8 2];
                app.DashboardCardValueLabels{i} = uilabel(cg,'Text','--','FontSize',22,'FontWeight','bold','FontColor',colors{i},'HorizontalAlignment','center');
                app.DashboardCardSubLabels{i} = uilabel(cg,'Text','Aguardando dados','FontSize',10,'FontColor',[0.20 0.28 0.36],'HorizontalAlignment','center');
            end

            app.AxTempo = uiaxes(g); app.AxTempo.Layout.Row=2; app.AxTempo.Layout.Column=[1 3]; title(app.AxTempo,'Tensões e correntes no tempo');
            app.AxHarmonicos = uiaxes(g); app.AxHarmonicos.Layout.Row=2; app.AxHarmonicos.Layout.Column=[4 5]; title(app.AxHarmonicos,'Espectro harmônico de corrente');
            app.AxEnergia = uiaxes(g); app.AxEnergia.Layout.Row=3; app.AxEnergia.Layout.Column=[1 2]; title(app.AxEnergia,'Tendência de energia e demanda');
            app.AxCargaStats = uiaxes(g); app.AxCargaStats.Layout.Row=3; app.AxCargaStats.Layout.Column=3; title(app.AxCargaStats,'Comparação por tipo de carga');
            app.AxScatter = uiaxes(g); app.AxScatter.Layout.Row=3; app.AxScatter.Layout.Column=[4 5]; title(app.AxScatter,'Dispersão: FP × THD-I');
            app.TabelaResumo = uitable(g); app.TabelaResumo.Layout.Row=4; app.TabelaResumo.Layout.Column=[1 2];
            app.TabelaEventos = uitable(g); app.TabelaEventos.Layout.Row=4; app.TabelaEventos.Layout.Column=3;
            app.AxDiagrama = uiaxes(g); app.AxDiagrama.Layout.Row=4; app.AxDiagrama.Layout.Column=[4 5]; title(app.AxDiagrama,'Diagrama de medição');
            app.DashboardIndicatorsPanel = uipanel(g,'Title','Metrologia e Qualidade - Indicadores de Ensaio','FontWeight','bold','BackgroundColor',[0.98 0.985 0.99]);
            app.DashboardIndicatorsPanel.Layout.Row=5; app.DashboardIndicatorsPanel.Layout.Column=[1 5];
            app.createDashboardIndicators();
        end

        function createDashboardIndicators(app)
            if isempty(app.DashboardIndicatorsPanel), return; end
            ig = uigridlayout(app.DashboardIndicatorsPanel,[2 8]);
            ig.RowHeight = {'1x','1x'};
            ig.ColumnWidth = repmat({'1x'},1,8);
            ig.Padding = [8 4 8 6];
            ig.RowSpacing = 5;
            ig.ColumnSpacing = 6;
            items = { ...
                'Medição de Tensão','220,1 V'; ...
                'Medição de Corrente','125,3 A'; ...
                'Resistência','10,24 ohm'; ...
                'Continuidade','OK'; ...
                'Aterramento','> 1000 Mohm'; ...
                'Erro Absoluto','0,35 %'; ...
                'Exatidão','+/-0,50 %'; ...
                'Precisão','+/-0,25 %'; ...
                'Incerteza Tipo A','0,15 %'; ...
                'Incerteza Tipo B','0,20 %'; ...
                'Incerteza Expandida','0,50 %'; ...
                'Categorias','CAT II/III/IV'; ...
                'TC Aberto: Risco','Detectado'; ...
                'Calibração','Válida'; ...
                'Rastreabilidade','Rastreável'; ...
                'Resolução','0,01'};
            for i=1:size(items,1)
                p = uipanel(ig,'BackgroundColor',[1 1 1],'BorderType','line');
                pg = uigridlayout(p,[2 1]);
                pg.RowHeight = {18,'1x'};
                pg.Padding = [4 2 4 2];
                uilabel(pg,'Text',items{i,1},'FontSize',9,'FontWeight','bold','FontColor',[0.12 0.25 0.42],'HorizontalAlignment','center');
                uilabel(pg,'Text',items{i,2},'FontSize',11,'FontWeight','bold','FontColor',[0.08 0.33 0.58],'HorizontalAlignment','center');
            end
        end

        function createImportTab(app)
            tab = uitab(app.TabGroup,'Title','2 Dados');
            g = uigridlayout(tab,[2 4]); g.RowHeight={55,'1x'}; g.ColumnWidth={130,130,130,'1x'}; g.Padding=[8 8 8 8];
            uibutton(g,'Text','Importar CSV','ButtonPushedFcn',@(~,~)app.importarCSV());
            uibutton(g,'Text','Importar MAT','ButtonPushedFcn',@(~,~)app.importarMAT());
            uibutton(g,'Text','Importar Excel','ButtonPushedFcn',@(~,~)app.importarExcel());
            uibutton(g,'Text','Validar Dados','ButtonPushedFcn',@(~,~)app.validarDados());
            app.ImportTable = uitable(g); app.ImportTable.Layout.Row=2; app.ImportTable.Layout.Column=[1 4];
        end

        function ensureAnalysisStorage(app)
            if isempty(app.AnalysisAxes) || numel(app.AnalysisAxes)<7
                oldAxes=app.AnalysisAxes; oldTables=app.AnalysisTables;
                app.AnalysisAxes=cell(1,7); app.AnalysisTables=cell(1,7);
                if ~isempty(oldAxes), app.AnalysisAxes(1:numel(oldAxes))=oldAxes; end
                if ~isempty(oldTables), app.AnalysisTables(1:numel(oldTables))=oldTables; end
            end
        end

        function createMedidasInstrumentosTab(app)
            tab = uitab(app.TabGroup,'Title','3 Medidas e Instrumentos');
            g = uigridlayout(tab,[2 2]); g.RowHeight={280,'1x'}; g.ColumnWidth={360,'1x'}; g.Padding=[8 8 8 8];

            p = uipanel(g,'Title','Calculadora de medidas elétricas','FontWeight','bold'); p.Layout.Row=1; p.Layout.Column=1;
            pg = uigridlayout(p,[8 2]); pg.RowHeight=repmat({28},1,8); pg.Padding=[8 8 8 8];
            uilabel(pg,'Text','Tipo'); tipo=uidropdown(pg,'Items',{'Lei de Ohm','Potência CC','Potência CA 1F','Potência CA 3F','Resistência por V/I'});
            vals={'V','I','R','FP','VLL','IL'}; defaults=[220 10 22 0.92 380 10]; app.BasicInputFields = cell(1,6);
            for i=1:6
                uilabel(pg,'Text',vals{i}); app.BasicInputFields{i}=uieditfield(pg,'numeric','Value',defaults(i));
            end
            uibutton(pg,'Text','Calcular','ButtonPushedFcn',@(~,~)app.calcularMedidaBasica(tipo.Value));

            app.BasicMeasureTable = uitable(g); app.BasicMeasureTable.Layout.Row=1; app.BasicMeasureTable.Layout.Column=2;
            ax = uiaxes(g); ax.Layout.Row=2; ax.Layout.Column=1; title(ax,'Ligações básicas de medição'); app.desenharCircuitosBasicos(ax);
            app.InstrumentsTable = uitable(g,'Data',app.instrumentosData()); app.InstrumentsTable.Layout.Row=2; app.InstrumentsTable.Layout.Column=2;
        end

        function createCircuitosEditorTab(app)
            tab = uitab(app.TabGroup,'Title','4 Circuitos e Editor');
            shell = uigridlayout(tab,[1 1]); shell.Padding=[0 0 0 0];
            sub = uitabgroup(shell);

            esquemas = uitab(sub,'Title','Esquemas de medição');
            g1 = uigridlayout(esquemas,[2 2]); g1.RowHeight={'1x','1x'}; g1.ColumnWidth={'1x','1x'}; g1.Padding=[8 8 8 8];
            titles={'Medição monofásica','Medição trifásica','TC / TP','Analisador de qualidade'};
            for i=1:4
                ax = uiaxes(g1); title(ax,titles{i}); axis(ax,'off');
                switch i
                    case 1, app.desenharMonofasico(ax);
                    case 2, app.desenharTrifasico(ax);
                    case 3, app.desenharTCTP(ax);
                    case 4, app.desenharAnalisador(ax);
                end
            end

            editor = uitab(sub,'Title','Editor didático');
            g = uigridlayout(editor,[1 3]); g.ColumnWidth={210,'1x',330}; g.Padding=[8 8 8 8];
            tools = uipanel(g,'Title','Componentes','FontWeight','bold');
            tg = uigridlayout(tools,[12 1]); tg.RowHeight = {28,30,30,30,30,30,30,30,30,30,30,'1x'}; tg.Padding=[8 8 8 8];
            app.ComponentDrop = uidropdown(tg,'Items',{'Fonte CA','Fonte CC','Resistor','Indutor','Capacitor','Motor','Carga não linear','Voltímetro','Amperímetro','Wattímetro','Medidor kWh','TC','TP','Terra'});
            uibutton(tg,'Text','Adicionar','ButtonPushedFcn',@(~,~)app.addComponent());
            uibutton(tg,'Text','Ligar selecionados','ButtonPushedFcn',@(~,~)app.addWire());
            uibutton(tg,'Text','Excluir selecionado','ButtonPushedFcn',@(~,~)app.deleteSelectedComponent());
            uibutton(tg,'Text','Limpar desenho','ButtonPushedFcn',@(~,~)app.clearCircuit());
            uibutton(tg,'Text','Carregar demo','ButtonPushedFcn',@(~,~)app.loadDemoCircuit());
            uibutton(tg,'Text','Salvar circuito CSV','ButtonPushedFcn',@(~,~)app.saveCircuitCSV());
            uibutton(tg,'Text','Abrir circuito CSV','ButtonPushedFcn',@(~,~)app.loadCircuitCSV());
            uibutton(tg,'Text','Simular','ButtonPushedFcn',@(~,~)app.simularCircuito());
            uibutton(tg,'Text','Exportar desenho','ButtonPushedFcn',@(~,~)app.exportarGrafico(app.CircuitAxes));
            uilabel(tg,'Text','Arraste os blocos dentro da área. Edite valores na tabela.','WordWrap','on');

            app.CircuitAxes = uiaxes(g); title(app.CircuitAxes,'Área de desenho do circuito');
            axis(app.CircuitAxes,[0 10 0 6]); grid(app.CircuitAxes,'on'); app.CircuitAxes.XTick=0:1:10; app.CircuitAxes.YTick=0:1:6; hold(app.CircuitAxes,'on');
            app.CircuitAxes.ButtonDownFcn = @(src,evt) app.stopSelect();

            right = uipanel(g,'Title','Valores dos componentes','FontWeight','bold');
            rg = uigridlayout(right,[3 1]); rg.RowHeight={'1x',36,36}; rg.Padding=[6 6 6 6];
            app.ComponentTable = uitable(rg,'ColumnEditable',[false false true true false true true], 'CellEditCallback',@(~,~)app.redrawCircuit());
            uibutton(rg,'Text','Atualizar desenho','ButtonPushedFcn',@(~,~)app.redrawCircuit());
            uibutton(rg,'Text','Enviar para Simulação','ButtonPushedFcn',@(~,~)app.simularCircuito());
        end

        function createAnalysisPane(app,parent,k,titleText,buttonText)
            app.ensureAnalysisStorage();
            g=uigridlayout(parent,[2 2]); g.RowHeight={38,'1x'}; g.ColumnWidth={'1x',390}; g.Padding=[8 8 8 8];
            uilabel(g,'Text',titleText,'FontWeight','bold','FontSize',13,'FontColor',[0.05 0.22 0.38]);
            btn=uibutton(g,'Text',buttonText,'ButtonPushedFcn',@(src,evt)app.plotAnalise(k)); btn.Layout.Row=1; btn.Layout.Column=2;
            ax=uiaxes(g); ax.Layout.Row=2; ax.Layout.Column=1;
            tbl=uitable(g); tbl.Layout.Row=2; tbl.Layout.Column=2;
            app.AnalysisAxes{k}=ax; app.AnalysisTables{k}=tbl;
            app.plotAnalise(k);
        end

        function createQualidadeEnergiaTab(app)
            tab=uitab(app.TabGroup,'Title','7 Qualidade de Energia');
            shell=uigridlayout(tab,[1 1]); shell.Padding=[0 0 0 0]; sub=uitabgroup(shell);
            app.createAnalysisPane(uitab(sub,'Title','Harmônicos / FFT'),1,'Harmônicos, FFT e THD','Atualizar FFT/THD');
            app.createAnalysisPane(uitab(sub,'Title','Eventos'),4,'Eventos RMS: sag, swell, interrupção e frequência','Detectar eventos');
            app.createAnalysisPane(uitab(sub,'Title','Estatística de Cargas'),5,'Comparação estatística por tipo de carga','Atualizar estatística');
        end

        function createEnergiaFPTab(app)
            tab=uitab(app.TabGroup,'Title','8 Energia, Demanda e FP');
            shell=uigridlayout(tab,[1 1]); shell.Padding=[0 0 0 0]; sub=uitabgroup(shell);
            app.createAnalysisPane(uitab(sub,'Title','Energia e Demanda'),2,'Energia acumulada, curva de carga e demanda','Calcular energia');
            app.createAnalysisPane(uitab(sub,'Title','Fator de Potência'),3,'Fator de potência e banco de capacitores','Calcular FP');
        end

        function createMetrologiaTCTPSegurancaTab(app)
            tab=uitab(app.TabGroup,'Title','9 Metrologia, TC/TP e Segurança');
            shell=uigridlayout(tab,[1 1]); shell.Padding=[0 0 0 0]; sub=uitabgroup(shell);

            met=uitab(sub,'Title','Metrologia');
            gm=uigridlayout(met,[1 2]); gm.ColumnWidth={'1x',450}; gm.Padding=[8 8 8 8];
            ax=uiaxes(gm); title(ax,'Incerteza, erro e repetibilidade');
            app.MetrologyTable=uitable(gm,'Data',app.metrologiaData());
            app.plotMetrologia(ax);

            app.createAnalysisPane(uitab(sub,'Title','TC / TP'),6,'Relação, erro e calibração de TC/TP','Analisar TC/TP');
            app.createAnalysisPane(uitab(sub,'Title','Osciloscópio'),7,'Osciloscópio virtual e aquisição','Gerar aquisição');

            seg=uitab(sub,'Title','Segurança');
            gs=uigridlayout(seg,[1 2]); gs.ColumnWidth={'1x',450}; gs.Padding=[8 8 8 8];
            ax2=uiaxes(gs); axis(ax2,'off'); title(ax2,'Segurança em medições'); app.desenharSeguranca(ax2);
            app.SafetyTable=uitable(gs,'Data',app.segurancaData());
        end

        function createRelatoriosTab(app)
            tab=uitab(app.TabGroup,'Title','10 Relatórios');
            g=uigridlayout(tab,[2 3]); g.RowHeight={50,'1x'}; g.ColumnWidth={170,180,'1x'}; g.Padding=[8 8 8 8];
            uibutton(g,'Text','Gerar Relatório','ButtonPushedFcn',@(~,~)app.gerarRelatorio());
            uibutton(g,'Text','Exportar Todas Figuras','ButtonPushedFcn',@(~,~)app.exportarTodosGraficos());
            uibutton(g,'Text','Exportar CSV/XLSX/MAT','ButtonPushedFcn',@(~,~)app.exportarTabelas());
            relArea = uitextarea(g,'Value',{'Relatórios incluem metodologia, indicadores, eventos, harmônicos, energia, FP, TC/TP, segurança e conclusões. A exportação de tabelas salva CSV, XLSX e MAT.'},'Editable','off');
            relArea.Layout.Row=2; relArea.Layout.Column=[1 3];
        end
        function createSimulacaoTab(app)
            tab = uitab(app.TabGroup,'Title','5 Simulação');
            g = uigridlayout(tab,[3 3]); g.RowHeight={44,'1x','1x'}; g.ColumnWidth={260,'1x','1x'}; g.Padding=[8 8 8 8];
            p = uipanel(g,'Title','Modo de simulação','FontWeight','bold'); p.Layout.Row=1; p.Layout.Column=1;
            pg = uigridlayout(p,[1 2]); pg.Padding=[4 4 4 4];
            app.SimModeDrop = uidropdown(pg,'Items',{'CC resistivo','RLC série CA','RLC paralelo CA','Trifásico equilibrado Y','Correção de FP','Ressonância RLC'});
            uibutton(pg,'Text','Executar','ButtonPushedFcn',@(~,~)app.simularCircuito());
            app.SimResultTable = uitable(g); app.SimResultTable.Layout.Row=[2 3]; app.SimResultTable.Layout.Column=1;
            app.AxSimTempo = uiaxes(g); app.AxSimTempo.Layout.Row=2; app.AxSimTempo.Layout.Column=2; title(app.AxSimTempo,'Sinais simulados');
            app.AxSimFasor = uiaxes(g); app.AxSimFasor.Layout.Row=2; app.AxSimFasor.Layout.Column=3; title(app.AxSimFasor,'Fasores');
            app.AxSimPot = uiaxes(g); app.AxSimPot.Layout.Row=3; app.AxSimPot.Layout.Column=[2 3]; title(app.AxSimPot,'Potência / resposta');
        end

        function createFasoresTab(app)
            tab = uitab(app.TabGroup,'Title','6 Fasores / Trifásico');
            g = uigridlayout(tab,[1 2]); g.ColumnWidth={'1x',360}; g.Padding=[8 8 8 8];
            app.AxFasores = uiaxes(g); title(app.AxFasores,'Diagrama fasorial');
            app.FasorTable = uitable(g);
        end

        function refreshAll(app)
            app.prepararDados(false);
            app.updateCards();
            app.plotDashboard();
            app.redrawCircuit();
            app.plotFasores();
            app.updateAnalysisTabs();
            if ~isempty(app.ImportTable), app.ImportTable.Data = app.Data(1:min(100,height(app.Data)),:); end
        end

        function updateCards(app)
            try
                if isempty(app.DashboardCardValueLabels), return; end
                d=app.Data;
                [E,~]=app.energySeries();
                if isempty(E), energiaDia=0; else, energiaDia=E(end); end
                demanda=app.demandSeries(15);
                D=max(demanda,[],'omitnan');
                FP=mean(d.FP,'omitnan');
                THDI=max(d.THD_I_pct,[],'omitnan');
                THDV=max(d.THD_V_pct,[],'omitnan');
                vals={sprintf('%.2f',energiaDia),sprintf('%.1f',D),sprintf('%.3f',FP),sprintf('%.2f',THDI),sprintf('%.2f',THDV)};
                subs={sprintf('Max: %.1f kWh | Media: %.1f kW',max(E,[],'omitnan'),mean(d.P_kW,'omitnan')), ...
                    sprintf('Registrada as %s',app.peakTimeText(demanda)), ...
                    sprintf('Min: %.3f | Max: %.3f',min(d.FP,[],'omitnan'),max(d.FP,[],'omitnan')), ...
                    sprintf('Media: %.2f %%',mean(d.THD_I_pct,'omitnan')), ...
                    sprintf('Media: %.2f %%',mean(d.THD_V_pct,'omitnan'))};
                for i=1:min(numel(vals),numel(app.DashboardCardValueLabels))
                    if ~isempty(app.DashboardCardValueLabels{i}) && isvalid(app.DashboardCardValueLabels{i})
                        app.DashboardCardValueLabels{i}.Text=vals{i};
                    end
                    if ~isempty(app.DashboardCardSubLabels{i}) && isvalid(app.DashboardCardSubLabels{i})
                        app.DashboardCardSubLabels{i}.Text=subs{i};
                    end
                end
            catch ME
                app.log(['Erro ao atualizar cards: ' ME.message]);
            end
        end

        function s=peakTimeText(app,series)
            try
                t=app.getTimeVector();
                [~,idx]=max(series);
                if isdatetime(t)
                    ti=t(idx);
                    ti.Format='HH:mm';
                    s=char(ti);
                else
                    s=sprintf('amostra %d',idx);
                end
            catch
                s='--';
            end
        end

        function plotDashboard(app)
            d=app.Data;
            if isempty(d), return; end
            t = app.getTimeVector();
            cla(app.AxTempo); hold(app.AxTempo,'on');
            yyaxis(app.AxTempo,'left');
            plot(app.AxTempo,t,d.Va_V,'LineWidth',0.9,'DisplayName','VL1');
            plot(app.AxTempo,t,d.Vb_V,'LineWidth',0.9,'DisplayName','VL2');
            plot(app.AxTempo,t,d.Vc_V,'LineWidth',0.9,'DisplayName','VL3');
            ylabel(app.AxTempo,'Tensão (V)');
            yyaxis(app.AxTempo,'right');
            plot(app.AxTempo,t,d.Ia_A,'LineWidth',0.9,'DisplayName','IL1');
            plot(app.AxTempo,t,d.Ib_A,'LineWidth',0.9,'DisplayName','IL2');
            plot(app.AxTempo,t,d.Ic_A,'LineWidth',0.9,'DisplayName','IL3');
            ylabel(app.AxTempo,'Corrente (A)');
            grid(app.AxTempo,'on'); legend(app.AxTempo,'Location','northoutside','Orientation','horizontal');
            title(app.AxTempo,'Tensões e correntes no tempo');
            app.CurrentAxes = app.AxTempo;

            H=app.harmonicTable('Ia_A',25);
            cla(app.AxHarmonicos); bar(app.AxHarmonicos,H.Ordem,H.Magnitude_pct,'FaceColor',[0.10 0.42 0.72]); hold(app.AxHarmonicos,'on'); plot(app.AxHarmonicos,H.Ordem,H.Limite_pct,'--r','DisplayName','Limite ref.'); xlabel(app.AxHarmonicos,'Ordem harmônica'); ylabel(app.AxHarmonicos,'% fundamental'); title(app.AxHarmonicos,sprintf('Espectro harmônico - THD %.2f %%',app.calcTHD(H))); grid(app.AxHarmonicos,'on'); set(app.AxHarmonicos,'YScale','log');
            [energia,tEnergia]=app.energySeries(); cla(app.AxEnergia); yyaxis(app.AxEnergia,'left'); plot(app.AxEnergia,t,energia,'LineWidth',1.5,'Color',[0.05 0.34 0.78]); ylabel(app.AxEnergia,'kWh'); yyaxis(app.AxEnergia,'right'); plot(app.AxEnergia,t,d.P_kW,'Color',[0.95 0.36 0.12]); if ~isempty(tEnergia), hold(app.AxEnergia,'on'); plot(app.AxEnergia,t,app.demandSeries(15),'LineWidth',1.2,'Color',[0.18 0.58 0.20]); end; ylabel(app.AxEnergia,'kW'); grid(app.AxEnergia,'on'); title(app.AxEnergia,'Tendência de energia e demanda');
            S=app.loadStatsTable(); cla(app.AxCargaStats); bar(app.AxCargaStats,categorical(S.Tipo),S.P_media_kW,'FaceColor',[0.36 0.59 0.78]); hold(app.AxCargaStats,'on'); errorbar(app.AxCargaStats,categorical(S.Tipo),S.P_media_kW,S.P_desvio_kW,'.k'); ylabel(app.AxCargaStats,'kW'); title(app.AxCargaStats,'Comparação por tipo de carga'); grid(app.AxCargaStats,'on');
            cla(app.AxScatter); scatter(app.AxScatter,d.FP,d.THD_I_pct,14,d.P_kW,'filled'); xlabel(app.AxScatter,'Fator de Potência'); ylabel(app.AxScatter,'THD-I (%)'); title(app.AxScatter,'Dispersão: FP × THD-I'); grid(app.AxScatter,'on'); colorbar(app.AxScatter);
            cla(app.AxDiagrama); axis(app.AxDiagrama,'off'); app.desenharAnalisador(app.AxDiagrama);
            app.TabelaResumo.Data = app.resumoTable();
            app.TabelaEventos.Data = app.detectEventsTable();
        end

        function t = getTimeVector(app)
            t=energia.getTimeVector(app.Data);
        end

        function T=resumoTable(app)
            T=energia.resumoTable(app.Data);
        end

        function T=eventosTable(app)
            T=energia.eventosTable(app.Data);
        end

        function plotFFT(app)
            ax=app.CurrentAxes; if isempty(ax) || ~isvalid(ax), ax=app.AxHarmonicos; end
            H=app.harmonicTable('Ia_A',25);
            cla(ax); bar(ax,H.Ordem,H.Magnitude_pct); hold(ax,'on'); plot(ax,H.Ordem,H.Limite_pct,'--r','DisplayName','Limite ref.');
            title(ax,sprintf('FFT / espectro harmônico - THD %.2f %%',app.calcTHD(H))); xlabel(ax,'Ordem harmônica'); ylabel(ax,'% fundamental'); grid(ax,'on'); app.CurrentAxes=ax;
            if numel(app.AnalysisTables)>=1 && ~isempty(app.AnalysisTables{1}), app.AnalysisTables{1}.Data=H; end
            app.log('FFT e tabela de harmônicos atualizadas.');
        end

        function plotTHD(app)
            ax=app.AxHarmonicos; if isempty(ax) || ~isvalid(ax), return; end
            H=app.harmonicTable('Ia_A',25);
            cla(ax); bar(ax,H.Ordem,H.Magnitude_pct); hold(ax,'on'); plot(ax,H.Ordem,H.Limite_pct,'--r','DisplayName','Limite ref.');
            title(ax,sprintf('THD e espectro harmônico - %.2f %%',app.calcTHD(H))); xlabel(ax,'Ordem'); ylabel(ax,'% fundamental'); grid(ax,'on'); app.CurrentAxes=ax; app.log('THD atualizado com base nos dados.');
        end

        function plotRMS(app)
            ax=app.AxTempo; d=app.Data; t=app.getTimeVector();
            cla(ax); yyaxis(ax,'left'); plot(ax,t,d.Va_V,'DisplayName','Va RMS'); ylabel(ax,'V RMS'); yyaxis(ax,'right'); plot(ax,t,d.Ia_A,'DisplayName','Ia RMS'); ylabel(ax,'A RMS');
            title(ax,'RMS por janela: tensão e corrente'); grid(ax,'on'); app.CurrentAxes=ax;
        end

        function plotFasores(app)
            ax=app.AxFasores; if isempty(ax), return; end
            [T,phasors]=app.fasorTable();
            cla(ax); hold(ax,'on'); axis(ax,'equal'); grid(ax,'on');
            names={'Va','Vb','Vc','Ia','Ib','Ic','In'};
            colors=[0 0.2 0.8; 0.8 0.1 0.1; 0 0.5 0.2; 0.9 0.5 0; 0.6 0.2 0.8; 0.1 0.55 0.55; 0.2 0.2 0.2];
            mags=abs(phasors(1:7)); scale=max(mags); if scale==0, scale=1; end
            for i=1:7
                z=phasors(i)/scale;
                quiver(ax,0,0,real(z),imag(z),0,'LineWidth',2,'Color',colors(i,:));
                text(ax,1.1*real(z),1.1*imag(z),names{i},'Parent',ax,'FontWeight','bold');
            end
            xlim(ax,[-1.3 1.3]); ylim(ax,[-1.3 1.3]); title(ax,'Fasores trifásicos, neutro e componentes simétricas');
            app.FasorTable.Data=T;
        end

        function plotMetrologia(app,ax)
            d=app.Data; x=d.Va_V(:); x=x(~isnan(x)); if numel(x)>120, x=x(1:120); end
            ref=mean(x,'omitnan'); erro=x-ref; ua=std(x,'omitnan')/sqrt(max(numel(x),1)); ub=0.5/sqrt(3); uc=sqrt(ua^2+ub^2); U=2*uc;
            cla(ax); histogram(ax,x,10,'Normalization','pdf'); hold(ax,'on'); xline(ax,ref,'r','Média'); title(ax,sprintf('Repetibilidade e incerteza expandida U=%.3g V',U)); xlabel(ax,'Tensão medida (V)'); ylabel(ax,'Densidade'); grid(ax,'on');
            if ~isempty(app.MetrologyTable)
                app.MetrologyTable.Data=table({'Média';'Erro médio';'Incerteza tipo A';'Incerteza tipo B';'Incerteza combinada';'Incerteza expandida k=2'},[ref;mean(erro,'omitnan');ua;ub;uc;U],{'V';'V';'V';'V';'V';'V'},'VariableNames',{'Grandeza','Valor','Unidade'});
            end
        end

        function addComponent(app)
            tipo=app.ComponentDrop.Value; id=app.NextComponentId; app.NextComponentId=id+1;
            unidade=''; valor=0;
            switch tipo
                case 'Fonte CA', valor=220; unidade='V';
                case 'Fonte CC', valor=24; unidade='V';
                case 'Resistor', valor=10; unidade='ohm';
                case 'Indutor', valor=0.05; unidade='H';
                case 'Capacitor', valor=100; unidade='uF';
                case 'Motor', valor=2.2; unidade='kW';
                case 'Carga não linear', valor=500; unidade='W';
                case 'TC', valor=100; unidade='A/5A';
                case 'TP', valor=13800; unidade='V/115V';
                otherwise, unidade=''; valor=0;
            end
            x=1+mod(id-1,6)*1.4; y=5-floor((id-1)/6)*1.0;
            prefix = upper(tipo(1));
            row=table(id,{tipo},{sprintf('%s%d',prefix,id)},valor,{unidade},x,y,'VariableNames',{'id','tipo','nome','valor','unidade','x','y'});
            app.Components=[app.Components; row];
            app.redrawCircuit();
        end

        function redrawCircuit(app)
            if isempty(app.CircuitAxes), return; end
            try
                if ~isempty(app.ComponentTable) && ~isempty(app.ComponentTable.Data)
                    app.Components=app.ComponentTable.Data;
                end
            catch
            end
            ax=app.CircuitAxes; cla(ax); hold(ax,'on'); grid(ax,'on'); axis(ax,[0 10 0 6]);
            title(ax,'Área de desenho do circuito: clique no bloco e arraste');
            app.drawWires(ax);
            for i=1:height(app.Components)
                app.drawComponent(ax,app.Components(i,:));
            end
            app.ComponentTable.Data=app.Components;
        end

        function drawWires(app,ax)
            if isempty(app.Wires) || isempty(app.Components), return; end
            for i=1:height(app.Wires)
                a=find(app.Components.id==app.Wires.from_id(i),1);
                b=find(app.Components.id==app.Wires.to_id(i),1);
                if isempty(a) || isempty(b), continue; end
                xa=app.Components.x(a); ya=app.Components.y(a); xb=app.Components.x(b); yb=app.Components.y(b);
                line(ax,[xa xb],[ya yb],'Color',[0.15 0.15 0.15],'LineWidth',1.5);
                plot(ax,[xa xb],[ya yb],'k.','MarkerSize',12);
            end
        end
        function drawComponent(app,ax,row)
            x=row.x; y=row.y; tipo=char(row.tipo); nome=char(row.nome);
            c=[0.84 0.91 0.97]; edge=[0.05 0.25 0.45];
            switch tipo
                case {'Fonte CA','Fonte CC'}, c=[0.95 0.98 1];
                case {'Resistor','Indutor','Capacitor'}, c=[1 0.96 0.88];
                case {'Voltímetro','Amperímetro','Wattímetro','Medidor kWh'}, c=[0.92 1 0.92];
                case {'TC','TP'}, c=[0.94 0.91 1];
                case {'Motor','Carga não linear'}, c=[1 0.92 0.92];
            end
            r=rectangle(ax,'Position',[x-0.45 y-0.25 0.9 0.5],'Curvature',0.12,'FaceColor',c,'EdgeColor',edge,'LineWidth',1.4,'ButtonDownFcn',@(src,evt)app.startDrag(src,row.id));
            txt=text(ax,x,y,sprintf('%s\n%s=%.3g %s',nome,tipo,row.valor,char(row.unidade)),'HorizontalAlignment','center','FontSize',8,'ButtonDownFcn',@(src,evt)app.startDrag(r,row.id));
            r.UserData=row.id; txt.UserData=row.id;
        end

        function startDrag(app,src,id)
            app.SelectedGraphic=src;
            app.DragData.id=id;
            cp=app.CircuitAxes.CurrentPoint; app.DragData.offset=[cp(1,1) cp(1,2)];
            app.UIFigure.WindowButtonMotionFcn=@(~,~)app.dragComponent();
            app.UIFigure.WindowButtonUpFcn=@(~,~)app.stopDrag();
        end

        function dragComponent(app)
            if isempty(app.DragData) || ~isfield(app.DragData,'id'), return; end
            cp=app.CircuitAxes.CurrentPoint; x=max(0.5,min(9.5,cp(1,1))); y=max(0.5,min(5.5,cp(1,2)));
            idx=find(app.Components.id==app.DragData.id,1);
            if ~isempty(idx)
                app.Components.x(idx)=x; app.Components.y(idx)=y;
                app.redrawCircuit(); drawnow limitrate;
            end
        end

        function stopDrag(app)
            app.UIFigure.WindowButtonMotionFcn=''; app.UIFigure.WindowButtonUpFcn=''; app.DragData=struct();
        end
        function stopSelect(app), app.SelectedGraphic=[]; end
        function deleteSelectedComponent(app)
            if isempty(app.SelectedGraphic), return; end
            id=app.SelectedGraphic.UserData; app.Components(app.Components.id==id,:)=[];
            if ~isempty(app.Wires), app.Wires(app.Wires.from_id==id | app.Wires.to_id==id,:)=[]; end
            if app.PendingWireId==id, app.PendingWireId=NaN; end
            app.redrawCircuit();
        end
        function clearCircuit(app)
            app.Components=app.Components([],:); app.Wires=app.Wires([],:); app.PendingWireId=NaN; app.redrawCircuit();
        end
        function loadDemoCircuit(app)
            compFile=app.dataFile('componentes_circuito_demo.csv');
            if exist(compFile,'file')
                app.Components=readtable(compFile); app.NextComponentId=max(app.Components.id)+1;
                if height(app.Components)>1
                    ids=app.Components.id(:); app.Wires=table(ids(1:end-1),ids(2:end),'VariableNames',{'from_id','to_id'});
                else
                    app.Wires=table([],[],'VariableNames',{'from_id','to_id'});
                end
                app.redrawCircuit();
            end
        end
        function addWire(app)
            if isempty(app.SelectedGraphic) || ~isfield(app.SelectedGraphic,'UserData')
                uialert(app.UIFigure,'Clique em um componente, depois use Ligar selecionados. Repita em outro componente para criar o fio.','Ligação');
                return;
            end
            id=app.SelectedGraphic.UserData;
            if isnan(app.PendingWireId)
                app.PendingWireId=id; app.log(sprintf('Primeiro terminal selecionado: componente %d. Selecione o segundo componente.',id)); return;
            end
            if app.PendingWireId==id
                app.log('Selecione um componente diferente para fechar a ligação.'); return;
            end
            pair=sort([app.PendingWireId id]);
            exists=false;
            if ~isempty(app.Wires)
                exists=any((app.Wires.from_id==pair(1) & app.Wires.to_id==pair(2)) | (app.Wires.from_id==pair(2) & app.Wires.to_id==pair(1)));
            end
            if ~exists
                app.Wires=[app.Wires; table(pair(1),pair(2),'VariableNames',{'from_id','to_id'})];
                app.log(sprintf('Ligação criada entre %d e %d.',pair(1),pair(2)));
            end
            app.PendingWireId=NaN; app.redrawCircuit();
        end

        function simularCircuito(app)
            if isempty(app.Components), app.loadDemoCircuit(); end
            checks=app.validarCircuitoDidatico(false);
            if any(strcmp(checks.Status,'Erro'))
                app.SimResultTable.Data=checks;
                uialert(app.UIFigure,'Há erros didáticos de ligação/composição antes da simulação. Veja a tabela de resultados.','Validação do circuito');
                return;
            end
            f=60; w=2*pi*f; V=app.componentValue('Fonte CA',220);
            Vdc=app.componentValue('Fonte CC',24);
            R=sum(app.Components.valor(strcmp(app.Components.tipo,'Resistor')));
            L=sum(app.Components.valor(strcmp(app.Components.tipo,'Indutor')));
            C=sum(app.Components.valor(strcmp(app.Components.tipo,'Capacitor')))*1e-6;
            if R==0, R=10; end
            if L==0, L=0.001; end
            if C==0, C=1e-6; end
            mode=app.SimModeDrop.Value; Qc_kvar=0;
            switch mode
                case 'CC resistivo'
                    I=Vdc/R; Z=R; P=Vdc*I; Q=0; S=P; fp=1; phi=0; Vplot=Vdc;
                case 'RLC série CA'
                    Z=R+1j*(w*L-1/(w*C)); I=V/Z; P=V*abs(I)*cos(angle(Z)); Q=V*abs(I)*sin(angle(Z)); S=V*abs(I); fp=P/S; phi=angle(Z); Vplot=V;
                case 'RLC paralelo CA'
                    Y=1/R+1/(1j*w*L)+1j*w*C; I=V*Y; Z=1/Y; P=V*abs(I)*cos(angle(Z)); Q=V*abs(I)*sin(angle(Z)); S=V*abs(I); fp=P/S; phi=angle(Z); Vplot=V;
                case 'Trifásico equilibrado Y'
                    Z=R+1j*w*L; Vll=380; I=Vll/sqrt(3)/Z; S=sqrt(3)*Vll*abs(I); P=S*cos(angle(Z)); Q=S*sin(angle(Z)); fp=P/S; phi=angle(Z); Vplot=Vll/sqrt(3);
                case 'Correção de FP'
                    P=40e3; fp1=0.78; fp2=0.95; Q=P*tan(acos(fp2)); Qc=P*(tan(acos(fp1))-tan(acos(fp2))); S=P/fp2; I=S/V; Z=V/max(I,eps); fp=fp2; phi=acos(fp); Qc_kvar=Qc/1000; Vplot=V;
                otherwise
                    fvec=1:2:500; Zmag=abs(R+1j*(2*pi*fvec*L-1./(2*pi*fvec*C))); cla(app.AxSimPot); plot(app.AxSimPot,fvec,Zmag); xlabel(app.AxSimPot,'Hz'); ylabel(app.AxSimPot,'|Z|'); grid(app.AxSimPot,'on'); title(app.AxSimPot,'Ressonância RLC');
                    [~,ii]=min(Zmag); app.SimResultTable.Data=table(R,L,C,fvec(ii)',Zmag(ii)','VariableNames',{'R_ohm','L_H','C_F','f0_Hz','Zmin_ohm'}); return;
            end
            if ~exist('fp','var') || isnan(fp), fp=P/max(S,eps); end
            fp=max(-1,min(1,fp));
            if ~exist('phi','var') || isnan(phi), phi=acos(fp); end
            t=linspace(0,0.1,1000);
            if strcmp(mode,'CC resistivo')
                v=Vplot+0*t; i=abs(I)+0*t;
            else
                v=sqrt(2)*Vplot*sin(w*t); i=sqrt(2)*abs(I)*sin(w*t-phi);
            end
            cla(app.AxSimTempo); plot(app.AxSimTempo,t,v,t,i); grid(app.AxSimTempo,'on'); legend(app.AxSimTempo,{'v(t)','i(t)'},'Location','best'); title(app.AxSimTempo,'Tensão e corrente simuladas');
            cla(app.AxSimFasor); hold(app.AxSimFasor,'on'); axis(app.AxSimFasor,'equal'); grid(app.AxSimFasor,'on'); quiver(app.AxSimFasor,0,0,1,0,0,'LineWidth',2); quiver(app.AxSimFasor,0,0,0.8*cos(-phi),0.8*sin(-phi),0,'LineWidth',2); text(app.AxSimFasor,1.05,0,'V'); text(app.AxSimFasor,0.9*cos(-phi),0.9*sin(-phi),'I'); xlim(app.AxSimFasor,[-1.2 1.2]); ylim(app.AxSimFasor,[-1.2 1.2]); title(app.AxSimFasor,'Fasores V e I');
            cla(app.AxSimPot); bar(app.AxSimPot,categorical({'P','Q','S','Qc'}),[P/1000 Q/1000 S/1000 Qc_kvar]); ylabel(app.AxSimPot,'kW/kvar/kVA'); grid(app.AxSimPot,'on'); title(app.AxSimPot,'Potências e correção');
            app.SimResultTable.Data=table(R,L,C,Vplot,abs(I),P/1000,Q/1000,S/1000,fp,rad2deg(phi),Qc_kvar,'VariableNames',{'R_ohm','L_H','C_F','V_V','I_A','P_kW','Q_kvar','S_kVA','FP','phi_graus','Qc_kvar'});
            app.plotFasores(); app.log(['Simulação executada: ' mode]);
        end

        function importarDados(app)
            app.importarCSV();
        end
        function importarCSV(app)
            [f,p]=uigetfile({'*.csv','CSV (*.csv)'},'Importar CSV'); if isequal(f,0), return; end
            app.Data=readtable(fullfile(p,f)); app.prepararDados(true);
            app.LastFolder=p; app.refreshAll(); app.log(['CSV importado: ' f]);
        end
        function importarMAT(app)
            [f,p]=uigetfile({'*.mat','MAT (*.mat)'},'Importar MAT'); if isequal(f,0), return; end
            S=load(fullfile(p,f)); names=fieldnames(S); idx=find(structfun(@istable,S),1);
            if isempty(idx), uialert(app.UIFigure,'O arquivo MAT precisa conter ao menos uma tabela de dados.','Importar MAT'); return; end
            app.Data=S.(names{idx}); app.prepararDados(true); app.refreshAll(); app.log(['MAT importado: ' f]);
        end
        function importarExcel(app)
            [f,p]=uigetfile({'*.xlsx;*.xls','Excel'},'Importar Excel'); if isequal(f,0), return; end
            app.Data=readtable(fullfile(p,f)); app.prepararDados(true); app.refreshAll(); app.log(['Excel importado: ' f]);
        end
        function validarDados(app)
            issues=app.prepararDados(true);
            req={'timestamp','Va_V','Vb_V','Vc_V','Vll_V','Ia_A','Ib_A','Ic_A','P_kW','Q_kvar','S_kVA','FP','freq_Hz','THD_V_pct','THD_I_pct','deseq_V_pct','evento'};
            missing=setdiff(req,app.Data.Properties.VariableNames);
            if isempty(missing) && isempty(issues)
                msg='Dados validados. Colunas, campos derivados e valores ausentes estão consistentes para as análises do app.';
            else
                lines=["Resultado da validação:"; ""; issues(:); ""; "Colunas ainda ausentes: " + strjoin(missing,', ')];
                msg=char(strjoin(lines,newline));
            end
            uialert(app.UIFigure,msg,'Validação de dados');
            app.refreshAll();
        end

        function exportarGraficoAtual(app)
            if isempty(app.CurrentAxes) || ~isvalid(app.CurrentAxes), app.CurrentAxes=app.AxTempo; end
            app.exportarGrafico(app.CurrentAxes);
        end
        function exportarGrafico(app,ax)
            fmt=app.ExportFormatDrop.Value; [f,p]=uiputfile(['grafico.' fmt],'Exportar gráfico'); if isequal(f,0), return; end
            try
                exportgraphics(ax,fullfile(p,f),'Resolution',300);
                app.log(['Gráfico exportado: ' fullfile(p,f)]);
            catch ME
                uialert(app.UIFigure,ME.message,'Erro ao exportar');
            end
        end
        function exportarTodosGraficos(app)
            p=uigetdir(pwd,'Escolha a pasta de saída'); if isequal(p,0), return; end
            axesList=findall(app.UIFigure,'Type','uiaxes'); fmt=app.ExportFormatDrop.Value;
            for i=1:numel(axesList)
                try
                    exportgraphics(axesList(i),fullfile(p,sprintf('grafico_%02d.%s',i,fmt)),'Resolution',300);
                catch
                end
            end
            app.log(sprintf('%d gráficos exportados para %s',numel(axesList),p));
        end
        function exportarTabelas(app)
            p=uigetdir(pwd,'Escolha a pasta de saída'); if isequal(p,0), return; end
            try
                relatorios.exportarTabelas(p,app.Data,app.Components,app.Wires);
                app.log('Tabelas exportadas em CSV, XLSX e MAT.');
            catch ME
                uialert(app.UIFigure,ME.message,'Erro');
            end
        end
        function gerarRelatorio(app)
            [f,p]=uiputfile({'*.html','Relatório HTML (*.html)';'*.txt','Texto (*.txt)';'*.doc','Word compatível (*.doc)'},'Salvar relatório','relatorio_medidas_qualidade.html'); if isequal(f,0), return; end
            [~,~,ext]=fileparts(f); file=fullfile(p,f);
            if strcmpi(ext,'.txt')
                app.writeTextReport(file);
            else
                app.writeHtmlReport(file);
            end
            app.log(['Relatório gerado: ' file]);
        end

        function salvarProjeto(app)
            [f,p]=uiputfile('projeto_medidas_qualidade.mat','Salvar projeto'); if isequal(f,0), return; end
            Data=app.Data; Components=app.Components; Wires=app.Wires; Events=app.eventosTable(); Metadata=app.MetaText.Value;
            save(fullfile(p,f),'Data','Components','Wires','Events','Metadata');
            app.log(['Projeto salvo: ' fullfile(p,f)]);
        end
        function novoProjeto(app), app.createDemoData(); app.refreshAll(); app.log('Novo projeto demonstrativo criado.'); end
        function abrirAjuda(app), uialert(app.UIFigure,'SMQE: importe ou valide os dados, confira o roteiro de ensaio, analise medições e qualidade de energia, monte circuitos didáticos quando necessário e gere o relatório final.','Ajuda do SMQE'); end
        function mostrarChecklist(app), app.TabGroup.SelectedTab = app.TabGroup.Children(strcmp({app.TabGroup.Children.Title},'9 Metrologia, TC/TP e Segurança')); end
        function editarMetadados(app), app.MetaText.Editable='on'; app.log('Metadados liberados para edição.'); end
        function saveCircuitCSV(app)
            [f,p]=uiputfile('circuito.csv','Salvar circuito'); if isequal(f,0), return; end
            writetable(app.Components,fullfile(p,f));
            [~,name,~]=fileparts(f);
            writetable(app.Wires,fullfile(p,[name '_ligacoes.csv']));
            app.log('Circuito e ligações salvos.');
        end
        function loadCircuitCSV(app)
            [f,p]=uigetfile('*.csv','Abrir circuito'); if isequal(f,0), return; end
            app.Components=readtable(fullfile(p,f)); app.NextComponentId=max(app.Components.id)+1;
            [~,name,~]=fileparts(f); wf=fullfile(p,[name '_ligacoes.csv']);
            if exist(wf,'file'), app.Wires=readtable(wf); else, app.Wires=table([],[],'VariableNames',{'from_id','to_id'}); end
            app.redrawCircuit(); app.log('Circuito carregado.');
        end

        function calcularMedidaBasica(app,tipo)
            vals=zeros(1,6);
            for i=1:min(6,numel(app.BasicInputFields))
                vals(i)=app.BasicInputFields{i}.Value;
            end
            V=vals(1); I=vals(2); R=vals(3); fp=max(0.01,min(1,vals(4))); Vll=vals(5); Il=vals(6);
            switch tipo
                case 'Lei de Ohm'
                    T=table({'I=V/R';'V=R*I';'R=V/I'},[V/max(R,eps);R*I;V/max(I,eps)],{'A';'V';'ohm'},'VariableNames',{'Equacao','Resultado','Unidade'});
                case 'Potência CC'
                    T=table({'P=V*I';'R=V/I'},[V*I;V/max(I,eps)],{'W';'ohm'},'VariableNames',{'Equacao','Resultado','Unidade'});
                case 'Potência CA 1F'
                    S=V*I; P=S*fp; Q=sqrt(max(S^2-P^2,0));
                    T=table({'S=V*I';'P=S*FP';'Q=sqrt(S^2-P^2)'},[S;P;Q],{'VA';'W';'var'},'VariableNames',{'Equacao','Resultado','Unidade'});
                case 'Potência CA 3F'
                    S=sqrt(3)*Vll*Il; P=S*fp; Q=sqrt(max(S^2-P^2,0));
                    T=table({'S=sqrt(3)*VLL*IL';'P=S*FP';'Q=sqrt(S^2-P^2)'},[S;P;Q],{'VA';'W';'var'},'VariableNames',{'Equacao','Resultado','Unidade'});
                otherwise
                    T=table({'R=V/I';'P=V*I'},[V/max(I,eps);V*I],{'ohm';'W'},'VariableNames',{'Equacao','Resultado','Unidade'});
            end
            app.BasicMeasureTable.Data=T;
        end

        function issues=prepararDados(app,doLog)
            if nargin<2, doLog=false; end
            [app.Data,issues]=energia.prepararDados(app.Data);
            if doLog && ~isempty(issues), app.log(sprintf('Validação/preparo: %d ajuste(s).',numel(issues))); end
        end

        function tf=hasColumn(app,T,name)
            tf=energia.hasColumn(T,name);
        end

        function updateAnalysisTabs(app)
            if isempty(app.AnalysisAxes), return; end
            for k=1:numel(app.AnalysisAxes)
                try
                    if ~isempty(app.AnalysisAxes{k}) && isvalid(app.AnalysisAxes{k}), app.plotAnalise(k); end
                catch ME
                    app.log(['Erro ao atualizar análise ' num2str(k) ': ' ME.message]);
                end
            end
        end

        function plotAnalise(app,k)
            if isempty(app.AnalysisAxes) || numel(app.AnalysisAxes)<k || isempty(app.AnalysisAxes{k}), return; end
            ax=app.AnalysisAxes{k}; tbl=app.AnalysisTables{k}; d=app.Data; t=app.getTimeVector();
            switch k
                case 1
                    H=app.harmonicTable('Ia_A',25); cla(ax); bar(ax,H.Ordem,H.Magnitude_pct); hold(ax,'on'); plot(ax,H.Ordem,H.Limite_pct,'--r'); grid(ax,'on'); xlabel(ax,'Ordem'); ylabel(ax,'% fundamental'); title(ax,sprintf('FFT, harmônicos individuais e THD %.2f %%',app.calcTHD(H))); tbl.Data=H;
                case 2
                    [E,~]=app.energySeries(); D=app.demandSeries(15); cla(ax); yyaxis(ax,'left'); plot(ax,t,E,'LineWidth',1.5); ylabel(ax,'kWh'); yyaxis(ax,'right'); plot(ax,t,d.P_kW,t,D,'LineWidth',1.1); ylabel(ax,'kW'); title(ax,'Energia acumulada, carga e demanda 15 min'); grid(ax,'on'); tbl.Data=app.energySummary();
                case 3
                    cla(ax); plot(ax,t,d.FP,'LineWidth',1.2); hold(ax,'on'); yline(ax,0.92,'--r','Referência 0,92'); ylim(ax,[0 1.05]); grid(ax,'on'); title(ax,'Fator de potência e correção capacitiva'); ylabel(ax,'FP'); tbl.Data=app.fpSummary();
                case 4
                    E=app.detectEventsTable(); cla(ax); pct=100*d.Va_V/220; plot(ax,t,pct,'LineWidth',1.1); hold(ax,'on'); yline(ax,90,'--r','Sag'); yline(ax,110,'--r','Swell'); yline(ax,10,':k','Interrupção'); grid(ax,'on'); title(ax,'Eventos de qualidade por tensão RMS'); ylabel(ax,'% nominal'); tbl.Data=E;
                case 5
                    S=app.loadStatsTable(); cla(ax); bar(ax,categorical(S.Tipo),S.P_media_kW); hold(ax,'on'); errorbar(ax,categorical(S.Tipo),S.P_media_kW,S.P_desvio_kW,'.k'); ylabel(ax,'kW'); title(ax,'Comparação estatística por tipo de carga'); grid(ax,'on'); tbl.Data=S;
                case 6
                    T=app.tctpTable(); cla(ax); scatter(ax,T.Carga_pct,T.Erro_rel_pct,45,'filled'); hold(ax,'on'); yline(ax,0,'-k'); yline(ax,1,'--r','+1 %'); yline(ax,-1,'--r','-1 %'); xlabel(ax,'Carga (%)'); ylabel(ax,'Erro de relação (%)'); title(ax,'Curva didática de erro TC/TP'); grid(ax,'on'); tbl.Data=T;
                case 7
                    [W,I]=app.scopeWaveform(); cla(ax); yyaxis(ax,'left'); plot(ax,W.tempo_s,W.v_V); ylabel(ax,'V'); yyaxis(ax,'right'); plot(ax,W.tempo_s,W.i_A); ylabel(ax,'A'); xlabel(ax,'s'); title(ax,'Osciloscópio virtual: forma de onda, fase e amostragem'); grid(ax,'on'); tbl.Data=I;
            end
            app.CurrentAxes=ax;
        end

        function [E,t]=energySeries(app)
            [E,t]=energia.energySeries(app.Data);
        end

        function dt=timeStepHours(app)
            dt=energia.timeStepHours(app.Data);
        end

        function D=demandSeries(app,minutesWindow)
            D=energia.demandSeries(app.Data,minutesWindow);
        end

        function H=harmonicTable(app,signalName,maxOrder)
            H=energia.harmonicTable(app.Data,signalName,maxOrder);
        end

        function thd=calcTHD(app,H)
            thd=energia.calcTHD(H);
        end

        function f0=nominalFrequency(app)
            f0=energia.nominalFrequency(app.Data);
        end

        function fs=estimateSampleRate(app)
            fs=energia.estimateSampleRate(app.Data);
        end

        function T=energySummary(app)
            T=energia.energySummary(app.Data);
        end

        function flag=isPonta(app)
            flag=energia.isPonta(app.Data);
        end

        function T=fpSummary(app)
            T=energia.fpSummary(app.Data);
        end

        function s=fpDiagnosis(app,fp,thd)
            if fp<0.92 && thd>10, s='Corrigir FP com estudo de ressonância/harmônicos.'; elseif fp<0.92, s='Carga predominantemente indutiva: dimensionar banco capacitivo.'; elseif thd>10, s='FP adequado, mas harmônicos merecem filtro/diagnóstico.'; else, s='Condição geral adequada.'; end
        end

        function T=detectEventsTable(app)
            T=energia.detectEventsTable(app.Data);
        end

        function T=loadStatsTable(app)
            T=energia.loadStatsTable(app.Data);
        end

        function p=percentileValue(app,x,q)
            x=sort(x(~isnan(x))); if isempty(x), p=NaN; return; end; idx=max(1,min(numel(x),round((q/100)*numel(x)))); p=x(idx);
        end

        function T=tctpTable(app)
            T=circuitos.tctpTable(app.Components);
        end

        function [W,I]=scopeWaveform(app)
            [W,I]=energia.scopeWaveform(app.Data);
        end

        function [T,phasors]=fasorTable(app)
            [T,phasors]=energia.fasorTable(app.Data);
        end

        function v=componentValue(app,tipo,defaultValue)
            v=circuitos.componentValue(app.Components,tipo,defaultValue);
        end

        function T=validarCircuitoDidatico(app,showAlert)
            if nargin<2, showAlert=true; end
            T=circuitos.validarCircuitoDidatico(app.Components,app.Wires);
            if showAlert, uialert(app.UIFigure,char(strjoin(T.Mensagem,newline)),'Validação do circuito'); end
        end

        function writeTextReport(app,file)
            relatorios.writeTextReport(file,app.Data,app.Components);
        end

        function writeTableText(app,fid,titleText,T)
            fprintf(fid,'\n%s\n',upper(titleText));
            if isempty(T), fprintf(fid,'(sem dados)\n'); return; end
            for i=1:height(T)
                parts=strings(1,width(T));
                for j=1:width(T), parts(j)=string(T.Properties.VariableNames{j}) + '=' + string(app.valueToText(T{i,j})); end
                fprintf(fid,'- %s\n',char(strjoin(parts,' | ')));
            end
        end

        function writeHtmlReport(app,file)
            relatorios.writeHtmlReport(file,app.Data,app.Components);
        end

        function html=tableToHtml(app,titleText,T)
            html=['<h2>' app.htmlEscape(titleText) '</h2>'];
            if isempty(T), html=[html '<p>Sem dados.</p>']; return; end
            html=[html '<table><thead><tr>'];
            for j=1:width(T), html=[html '<th>' app.htmlEscape(T.Properties.VariableNames{j}) '</th>']; end %#ok<AGROW>
            html=[html '</tr></thead><tbody>'];
            for i=1:height(T)
                html=[html '<tr>']; %#ok<AGROW>
                for j=1:width(T), html=[html '<td>' app.htmlEscape(app.valueToText(T{i,j})) '</td>']; end %#ok<AGROW>
                html=[html '</tr>']; %#ok<AGROW>
            end
            html=[html '</tbody></table>'];
        end

        function s=valueToText(app,v)
            if iscell(v), if isempty(v), s=''; else, s=app.valueToText(v{1}); end
            elseif isstring(v), s=char(strjoin(v,', '));
            elseif ischar(v), s=v;
            elseif isnumeric(v), if isscalar(v), s=sprintf('%.5g',v); else, s=mat2str(v); end
            elseif isdatetime(v) || isduration(v), s=char(string(v));
            else, try, s=char(string(v)); catch, s=''; end
            end
        end

        function s=htmlEscape(app,s)
            s=char(s); s=strrep(s,'&','&amp;'); s=strrep(s,'<','&lt;'); s=strrep(s,'>','&gt;'); s=strrep(s,'"','&quot;');
        end
        function log(app,msg)
            try
                old=app.LogText.Value; app.LogText.Value=[old; {sprintf('%s  %s',datestr(now,'HH:MM:SS'),msg)}];
            catch
            end
        end

        % ==== Desenhos didáticos ====
        function desenharCircuitosBasicos(app,ax)
            cla(ax); axis(ax,[0 10 0 5]); axis(ax,'off'); hold(ax,'on');
            text(ax,0.5,4.5,'V em paralelo','FontWeight','bold'); line(ax,[0.7 3],[4 4]); line(ax,[0.7 3],[3 3]); rectangle(ax,'Position',[1.8 3.25 .5 .5],'Curvature',[1 1]); text(ax,2.05,3.5,'V','HorizontalAlignment','center'); rectangle(ax,'Position',[2.6 3.1 .4 .8]); text(ax,2.8,3.5,'R','HorizontalAlignment','center');
            text(ax,3.8,4.5,'A em série','FontWeight','bold'); line(ax,[4 6.5],[3.5 3.5]); rectangle(ax,'Position',[4.7 3.25 .5 .5],'Curvature',[1 1]); text(ax,4.95,3.5,'A','HorizontalAlignment','center'); rectangle(ax,'Position',[5.8 3.1 .4 .8]);
            text(ax,7,4.5,'Wattímetro','FontWeight','bold'); rectangle(ax,'Position',[7.2 3.2 .8 .6]); text(ax,7.6,3.5,'W','HorizontalAlignment','center'); line(ax,[6.9 9.4],[3.5 3.5]); rectangle(ax,'Position',[8.8 3.1 .4 .8]);
        end
        function desenharInstrumentos(app,ax)
            cla(ax); axis(ax,[0 10 0 6]); axis(ax,'off'); hold(ax,'on');
            nomes={'Multímetro','Alicate','Wattímetro','Medidor kWh','Analisador PQ','Osciloscópio','Megômetro','Terrômetro','TC','TP'};
            for i=1:10
                x=mod(i-1,5)*2+1; y=5-floor((i-1)/5)*2.5;
                rectangle(ax,'Position',[x-.55 y-.45 1.1 .9],'Curvature',0.15,'FaceColor',[0.92 0.96 1]); text(ax,x,y,nomes{i},'HorizontalAlignment','center','FontWeight','bold','FontSize',8);
            end
        end
        function desenharMonofasico(app,ax), cla(ax); axis(ax,[0 10 0 5]); axis(ax,'off'); hold(ax,'on'); line(ax,[1 9],[4 4],'Color','r'); line(ax,[1 9],[1 1],'Color','k'); rectangle(ax,'Position',[7 2.5 1 1]); text(ax,7.5,3,'Carga','HorizontalAlignment','center'); rectangle(ax,'Position',[3.5 3.6 .8 .6]); text(ax,3.9,3.9,'kWh','HorizontalAlignment','center'); text(ax,1,4.2,'L'); text(ax,1,0.8,'N'); end
        function desenharTrifasico(app,ax), cla(ax); axis(ax,[0 10 0 6]); axis(ax,'off'); hold(ax,'on'); cols={'r','b',[0 0.5 0],'k'}; ys=[5 4 3 2]; labs={'A','B','C','N'}; for i=1:4, line(ax,[1 9],[ys(i) ys(i)],'Color',cols{i},'LineWidth',1.5); text(ax,.7,ys(i),labs{i}); end; rectangle(ax,'Position',[7 2.6 1.2 2]); text(ax,7.6,3.6,'Carga 3F','HorizontalAlignment','center'); rectangle(ax,'Position',[3.5 2.4 1.2 2.4]); text(ax,4.1,3.6,'Medidor\n3F','HorizontalAlignment','center'); end
        function desenharTCTP(app,ax), cla(ax); axis(ax,[0 10 0 5]); axis(ax,'off'); hold(ax,'on'); line(ax,[1 9],[4 4]); rectangle(ax,'Position',[2.5 3.65 .5 .7],'Curvature',[1 1]); text(ax,2.75,4.45,'TC','HorizontalAlignment','center'); rectangle(ax,'Position',[5 3.2 1 1.2]); text(ax,5.5,3.8,'TP','HorizontalAlignment','center'); rectangle(ax,'Position',[7 2 1.2 1]); text(ax,7.6,2.5,'Medidor','HorizontalAlignment','center'); text(ax,1,4.3,'Fase'); text(ax,2.3,3.2,'Nunca abrir S1/S2','Color','r','FontWeight','bold'); end
        function desenharAnalisador(app,ax), cla(ax); axis(ax,[0 10 0 5]); axis(ax,'off'); hold(ax,'on'); for i=1:3, line(ax,[1 8],[4.5-i*.8 4.5-i*.8],'LineWidth',1.2); end; rectangle(ax,'Position',[4 1.2 2 2]); text(ax,5,2.2,'Analisador\nPQ','HorizontalAlignment','center','FontWeight','bold'); for i=1:3, plot(ax,3,4.5-i*.8,'o','MarkerFaceColor','r'); line(ax,[3 4],[4.5-i*.8 2.8-i*.35],'LineStyle','--'); end; rectangle(ax,'Position',[8 2.2 1 1]); text(ax,8.5,2.7,'Carga','HorizontalAlignment','center'); end
        function desenharSeguranca(app,ax), cla(ax); axis(ax,[0 10 0 6]); axis(ax,'off'); hold(ax,'on'); txt={'CAT II/III/IV','EPI obrigatório','TC nunca aberto','Bloqueio/etiquetagem','Terra do osciloscópio','Conferir escala'}; for i=1:numel(txt), rectangle(ax,'Position',[1+mod(i-1,3)*3 4-floor((i-1)/3)*2 2.3 1],'FaceColor',[1 0.95 0.9],'EdgeColor',[0.7 0.1 0.1]); text(ax,2.15+mod(i-1,3)*3,4.5-floor((i-1)/3)*2,txt{i},'HorizontalAlignment','center','FontWeight','bold'); end; end

        function T=instrumentosData(app)
            T=table({'Multímetro';'Alicate amperímetro';'Wattímetro';'Medidor de energia';'Analisador PQ';'Osciloscópio';'Megômetro';'Terrômetro';'TC';'TP'}, ...
                {'V/I/R/continuidade';'Corrente sem abrir circuito';'Potência ativa';'kWh/kvarh';'THD/eventos/flicker';'Forma de onda/FFT';'Isolação';'Aterramento';'Corrente reduzida';'Tensão reduzida'}, ...
                'VariableNames',{'Instrumento','Uso'});
        end
        function T=metrologiaData(app)
            T=table({'Erro absoluto';'Erro relativo';'Resolução';'Sensibilidade';'Incerteza tipo A';'Incerteza tipo B';'Incerteza combinada';'Incerteza expandida';'Rastreabilidade'}, ...
                {'xmed-xref';'erro/xref*100';'menor degrau';'delta saída/delta entrada';'estatística';'certificado/fabricante';'quadratura';'k*uc';'cadeia SI'}, ...
                'VariableNames',{'Conceito','Definição'});
        end
        function T=segurancaData(app)
            T=table({'TC';'TP';'Osciloscópio';'Multímetro';'Aterramento';'Painel energizado'}, ...
                {'Nunca abrir secundário';'Aterrar secundário conforme norma';'Cuidado com GND';'Usar categoria CAT correta';'Conferir continuidade PE';'Usar EPI e bloqueio'}, ...
                'VariableNames',{'Item','Cuidados'});
        end
    end
end
