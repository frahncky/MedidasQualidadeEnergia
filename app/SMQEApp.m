classdef SMQEApp < handle
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
        function app = SMQEApp()
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
            app.UIFigure = uifigure('Name','Plataforma de Medidas, Medição e Qualidade de Energia', ...
                'Position',[50 30 1680 970], 'Color',[1 1 1]);
            iconFile = app.iconFile();
            if exist(iconFile,'file')
                try, app.UIFigure.Icon = iconFile; catch, end
            end
            app.UIFigure.CloseRequestFcn = @(src,evt) delete(app);

            app.MainGrid = uigridlayout(app.UIFigure,[2 1]);
            app.MainGrid.RowHeight = {'1x', 28};
            app.MainGrid.Padding = [0 0 0 0];
            app.MainGrid.RowSpacing = 0;

            app.TabGroup = uitabgroup(app.MainGrid,'TabLocation','Top');

            app.BottomPanel = uipanel(app.MainGrid,'BorderType','none',...
                'BackgroundColor',[0.10 0.16 0.26]);

            app.createTabs();
            app.createBottomPanel();
        end

        function createRibbon(app)
            app.Ribbon = uipanel(app.MainGrid,'Title','','BorderType','none','BackgroundColor',[0.965 0.975 0.993]);

            % 3 linhas: menu bar escuro | linha de acento azul | barra de botões
            rg = uigridlayout(app.Ribbon,[3 1]);
            rg.RowHeight = {28, 3, '1x'};
            rg.Padding = [0 0 0 0];
            rg.RowSpacing = 0;

            % ── Linha 1: menu bar escuro ──
            mb = uipanel(rg,'BackgroundColor',[0.11 0.19 0.35],'BorderType','none');
            mbl = uigridlayout(mb,[1 10]);
            mbl.Padding = [8 2 8 2];
            mbl.ColumnWidth = {222,'1x',70,62,80,105,100,95,55,52};
            mbl.ColumnSpacing = 6;
            lbl = uilabel(mbl,'Text',' Plataforma de Medidas, Medição e Qualidade de Energia',...
                'FontSize',11,'FontWeight','bold','FontColor',[0.94 0.97 1.0]);
            lbl.Layout.Column = 1;
            menus = {'ARQUIVO','DADOS','ANÁLISES','INSTRUMENTOS','RELATÓRIOS','VISUALIZAÇÃO','AJUDA'};
            for k=1:numel(menus)
                l2 = uilabel(mbl,'Text',menus{k},'FontSize',9.5,'FontWeight','bold',...
                    'FontColor',[0.78 0.87 1.0],'HorizontalAlignment','center');
                l2.Layout.Column = k+2;
            end

            % ── Linha 2: acento azul brilhante ──
            uipanel(rg,'BackgroundColor',[0.04 0.52 0.86],'BorderType','none');

            % ── Linha 3: barra de botões em grupos ──
            bb = uipanel(rg,'BackgroundColor',[0.965 0.975 0.993],'BorderType','none');
            bbl = uigridlayout(bb,[1 9]);
            bbl.Padding = [6 3 6 3];
            bbl.ColumnWidth = {298, 6, 288, 6, 156, 6, 244, 6, 248};
            bbl.ColumnSpacing = 0;

            % Separadores visuais verticais
            for col = [2 4 6 8]
                sp = uipanel(bbl,'BackgroundColor',[0.72 0.79 0.88],'BorderType','none');
                sp.Layout.Column = col;
            end

            % Grupo PROJETO
            g1p = uipanel(bbl,'Title','  PROJETO','FontSize',8,'FontWeight','bold',...
                'ForegroundColor',[0.20 0.32 0.52],'BackgroundColor',[0.975 0.983 0.997]);
            g1p.Layout.Column = 1;
            g1l = uigridlayout(g1p,[1 4]);
            g1l.Padding = [4 3 4 3]; g1l.ColumnWidth = {'1x','1x','1x','1x'};
            b1 = {'Novo Projeto','Abrir','Salvar','Salvar Como'};
            c1 = {@(~,~)app.novoProjeto(),@(~,~)app.importarDados(),...
                  @(~,~)app.salvarProjeto(),@(~,~)app.salvarProjeto()};
            for i=1:4
                uibutton(g1l,'push','Text',b1{i},'FontSize',10,'ButtonPushedFcn',c1{i});
            end

            % Grupo IMPORTAR DADOS
            g2p = uipanel(bbl,'Title','  IMPORTAR DADOS','FontSize',8,'FontWeight','bold',...
                'ForegroundColor',[0.20 0.32 0.52],'BackgroundColor',[0.975 0.983 0.997]);
            g2p.Layout.Column = 3;
            g2l = uigridlayout(g2p,[1 4]);
            g2l.Padding = [4 3 4 3]; g2l.ColumnWidth = {'1x','1x','1x','1x'};
            b2 = {'Importar CSV','Importar MAT','Importar Excel','Exportar Excel'};
            c2 = {@(~,~)app.importarCSV(),@(~,~)app.importarMAT(),...
                  @(~,~)app.importarExcel(),@(~,~)app.exportarTabelas()};
            for i=1:4
                uibutton(g2l,'push','Text',b2{i},'FontSize',10,'ButtonPushedFcn',c2{i});
            end

            % Grupo EXECUÇÃO
            g3p = uipanel(bbl,'Title','  EXECUÇÃO','FontSize',8,'FontWeight','bold',...
                'ForegroundColor',[0.20 0.32 0.52],'BackgroundColor',[0.975 0.983 0.997]);
            g3p.Layout.Column = 5;
            g3l = uigridlayout(g3p,[1 2]);
            g3l.Padding = [4 3 4 3]; g3l.ColumnWidth = {'1x','1x'};
            uibutton(g3l,'push','Text','Executar Tudo','FontSize',10,'ButtonPushedFcn',@(~,~)app.refreshAll());
            uibutton(g3l,'push','Text','Atualizar','FontSize',10,'ButtonPushedFcn',@(~,~)app.refreshAll());

            % Grupo ANÁLISES
            g4p = uipanel(bbl,'Title','  ANÁLISES','FontSize',8,'FontWeight','bold',...
                'ForegroundColor',[0.20 0.32 0.52],'BackgroundColor',[0.975 0.983 0.997]);
            g4p.Layout.Column = 7;
            g4l = uigridlayout(g4p,[1 3]);
            g4l.Padding = [4 3 4 3]; g4l.ColumnWidth = {'1x','1x','1x'};
            uibutton(g4l,'push','Text','FFT','FontSize',10,'ButtonPushedFcn',@(~,~)app.plotFFT());
            uibutton(g4l,'push','Text','THD','FontSize',10,'ButtonPushedFcn',@(~,~)app.plotTHD());
            uibutton(g4l,'push','Text','RMS','FontSize',10,'ButtonPushedFcn',@(~,~)app.plotRMS());

            % Grupo RELATÓRIOS
            g5p = uipanel(bbl,'Title','  RELATÓRIOS','FontSize',8,'FontWeight','bold',...
                'ForegroundColor',[0.20 0.32 0.52],'BackgroundColor',[0.975 0.983 0.997]);
            g5p.Layout.Column = 9;
            g5l = uigridlayout(g5p,[1 4]);
            g5l.Padding = [4 3 4 3]; g5l.ColumnWidth = {'1x','1x','1x',80};
            uibutton(g5l,'push','Text','Relatório','FontSize',10,'ButtonPushedFcn',@(~,~)app.gerarRelatorio());
            uibutton(g5l,'push','Text','Checklist','FontSize',10,'ButtonPushedFcn',@(~,~)app.mostrarChecklist());
            uibutton(g5l,'push','Text','Figura','FontSize',10,'ButtonPushedFcn',@(~,~)app.exportarGraficoAtual());
            app.ExportFormatDrop = uidropdown(g5l,'Items',{'png','jpg','pdf','eps','svg'},'Value','png','FontSize',10);
        end

        function createLeftPanel(app)
            g = uigridlayout(app.LeftPanel,[2 1]);
            g.RowHeight = {'1x',252}; g.Padding = [6 6 6 6];
            app.ProjectTree = uitree(g);
            iconFile = app.iconFile();
            if exist(iconFile,'file')
                base = uitreenode(app.ProjectTree,'Text','Base Principal','Icon',iconFile);
            else
                base = uitreenode(app.ProjectTree,'Text','Base Principal');
            end
            cats = {'Tarifação','Harmônicos','Flicker','Cargas','Calibração','TC-TP','Instrumentos','Resultados','Figuras','Relatórios'};
            for i=1:numel(cats)
                n = uitreenode(base,'Text',cats{i});
                if strcmp(cats{i},'Cargas')
                    uitreenode(n,'Text','Cargas Resistivas');
                    uitreenode(n,'Text','Motor');
                    uitreenode(n,'Text','Forno (Indutivo)');
                    uitreenode(n,'Text','Ar Condicionado');
                    uitreenode(n,'Text','Fonte Chaveada');
                    uitreenode(n,'Text','Carga Mista');
                end
            end
            expand(base);
            metaPanel = uipanel(g,'Title','Metadados','FontWeight','bold','FontSize',10,...
                'ForegroundColor',[0.06 0.20 0.38]);
            mg = uigridlayout(metaPanel,[2 1]); mg.RowHeight = {'1x',30}; mg.Padding=[6 6 6 6];
            app.MetaText = uitextarea(mg,'Editable','off','FontSize',9.5,'Value',{...
                'Plataforma: Medidas, Medição e QE', ...
                'Amostragem: 12,8 kS/s', ...
                'Período: 07/05/2024 — base demo', ...
                'Tensão nominal: 380 V L-L / 220 V L-N', ...
                'Frequência nominal: 60,00 Hz', ...
                'Local: Laboratório de QE — LQE', ...
                'Instrumento: Analisador PQ QBox 100', ...
                'N° Série: PQB100-23145', ...
                'Responsável: Prof. Francisco A. N.'});
            uibutton(mg,'Text','Editar Metadados','FontSize',9.5,...
                'ButtonPushedFcn',@(~,~)app.editarMetadados());
        end

        function createRightPanel(app)
            g = uigridlayout(app.RightPanel,[6 1]);
            g.RowHeight = {255,108,135,104,84,'1x'}; g.Padding=[6 6 6 6];

            % Parâmetros da análise
            p = uipanel(g,'Title','Parâmetros da Análise','FontWeight','bold','FontSize',10,...
                'ForegroundColor',[0.06 0.20 0.38]);
            pg = uigridlayout(p,[9 2]);
            pg.ColumnWidth = {95,'1x'};
            pg.RowHeight = [repmat({24},1,8),{30}];
            pg.Padding = [6 5 6 5];
            labels = {'Fase','Intervalo','Início','Fim','Tipo de carga','f0 (Hz)','Janela FFT','Posto tarifário'};
            vals = {{'Todas','L1','L2','L3'},{'Personalizado','Completo'},{'00:00:00'},{'23:59:59'},...
                    {'Todas','Resistiva','Motor','Fonte chaveada','Mista'},{'60,00'},{'Hanning','Retangular','Flat-top'},{'Ponta','Fora ponta'}};
            for i=1:numel(labels)
                uilabel(pg,'Text',labels{i},'FontSize',10);
                if numel(vals{i})>1
                    uidropdown(pg,'Items',vals{i},'FontSize',10);
                else
                    uieditfield(pg,'text','Value',vals{i}{1},'FontSize',10);
                end
            end
            b_apl = uibutton(pg,'push','Text','Aplicar','FontSize',10,'FontWeight','bold',...
                'BackgroundColor',[0.07 0.40 0.72],'FontColor',[1 1 1],...
                'ButtonPushedFcn',@(~,~)app.refreshAll());
            b_apl.Layout.Row = 9; b_apl.Layout.Column = 1;
            b_red = uibutton(pg,'push','Text','Redefinir','FontSize',10,...
                'ButtonPushedFcn',@(~,~)app.refreshAll());
            b_red.Layout.Row = 9; b_red.Layout.Column = 2;

            % Observações / notas
            notes = uipanel(g,'Title','Observações / Notas','FontWeight','bold','FontSize',10,...
                'ForegroundColor',[0.06 0.20 0.38]);
            ng = uigridlayout(notes,[1 1]); ng.Padding=[6 6 6 6];
            uitextarea(ng,'Editable','on','FontSize',9.5,'Value',{...
                'Ensaio realizado com o perfil do medidor às 08:15.', ...
                'Ponta: conexão operando a partir das 13:30.', ...
                'Sem ocorrências críticas nas event logs.'});

            % Checklist de ensaio
            ck = uipanel(g,'Title','Checklist de Ensaio','FontWeight','bold','FontSize',10,...
                'ForegroundColor',[0.06 0.20 0.38]);
            cg = uigridlayout(ck,[5 1]);
            cg.RowHeight = {22,22,22,22,22}; cg.Padding=[8 6 6 6];
            checks = {'Configuração de Instrumento','Verificação de Ligações',...
                      'Sincronismo de Tempo','Calibração TC/TP','Análise de Qualidade'};
            for i=1:5, uicheckbox(cg,'Text',checks{i},'Value',i<5,'FontSize',9.5); end

            % Ensaios e grandezas suportadas
            sup = uipanel(g,'Title','Ensaios e Grandezas Suportadas','FontWeight','bold','FontSize',10,...
                'ForegroundColor',[0.06 0.20 0.38]);
            sg = uigridlayout(sup,[3 3]); sg.Padding=[5 5 5 5]; sg.RowSpacing=4; sg.ColumnSpacing=4;
            tags = {'Tensão','Corrente','Potência','Energia','FP','Harmônicos','Flicker','RMS','Fasores'};
            for i=1:numel(tags)
                uilabel(sg,'Text',tags{i},'BackgroundColor',[0.91 0.95 0.99],...
                    'HorizontalAlignment','center','FontSize',9.5,'FontColor',[0.10 0.28 0.52]);
            end

            % Atalhos rápidos
            q = uipanel(g,'Title','Atalhos Rápidos','FontWeight','bold','FontSize',10,...
                'ForegroundColor',[0.06 0.20 0.38]);
            qg = uigridlayout(q,[2 2]); qg.Padding=[5 5 5 5]; qg.ColumnSpacing=5;
            uibutton(qg,'Text','Importar Dados','FontSize',9.5,'ButtonPushedFcn',@(~,~)app.importarDados());
            uibutton(qg,'Text','Gerar Relatório','FontSize',9.5,'ButtonPushedFcn',@(~,~)app.gerarRelatorio());
            uibutton(qg,'Text','Exportar Gráficos','FontSize',9.5,'ButtonPushedFcn',@(~,~)app.exportarTodosGraficos());
            uibutton(qg,'Text','Ajuda Online','FontSize',9.5,'ButtonPushedFcn',@(~,~)app.abrirAjuda());

            app.StatusLabel = uilabel(g,'Text','● Plataforma pronta para análise','FontWeight','bold',...
                'FontSize',9.5,'FontColor',[0.04 0.44 0.14]);
        end

        function createBottomPanel(app)
            g = uigridlayout(app.BottomPanel,[1 5]);
            g.ColumnWidth = {150,'1x',250,200,80};
            g.Padding = [10 0 10 0];
            g.ColumnSpacing = 0;
            c = [0.10 0.16 0.26]; fc = [0.70 0.82 1.0];
            app.StatusLabel = uilabel(g,'Text','● Conectado',...
                'FontColor',[0.20 0.88 0.42],'FontWeight','bold','FontSize',9,...
                'BackgroundColor',c);
            uilabel(g,'Text','Fonte: PQa-5000 #12345  |  Base: QE_DB_Local',...
                'FontColor',fc,'FontSize',9,'BackgroundColor',c);
            uilabel(g,'Text','● Sincronizado  |  Taxa: 12,8 kS/s',...
                'FontColor',[0.20 0.88 0.42],'FontSize',9,'BackgroundColor',c,...
                'HorizontalAlignment','center');
            uilabel(g,'Text','Usuário: engenheiro  |  Administrador',...
                'FontColor',fc,'FontSize',9,'BackgroundColor',c,'HorizontalAlignment','right');
            uilabel(g,'Text','Versão 1.2.0',...
                'FontColor',fc,'FontSize',9,'BackgroundColor',c,'HorizontalAlignment','right');
        end

        function createTabs(app)
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
            tab = uitab(app.TabGroup,'Title','Dashboard');
            root = uigridlayout(tab,[4 1]);
            root.RowHeight = {46,108,'1x',56}; root.Padding=[8 6 8 6]; root.RowSpacing=5;

            % ── Row 1: barra de filtros ──
            fb = uipanel(root,'BorderType','none','BackgroundColor',[0.96 0.97 0.99]);
            fbl = uigridlayout(fb,[1 10]);
            fbl.ColumnWidth={60,148,16,148,'1x',184,158,104,90,90};
            fbl.Padding=[6 5 6 5]; fbl.ColumnSpacing=5;
            uilabel(fbl,'Text','Período:','FontWeight','bold','FontSize',9.5);
            uieditfield(fbl,'text','Value','01/05/2024 00:00','FontSize',9.5);
            uilabel(fbl,'Text','até','HorizontalAlignment','center','FontSize',9.5);
            uieditfield(fbl,'text','Value','31/05/2024 23:59','FontSize',9.5);
            uilabel(fbl,'Text','');
            uidropdown(fbl,'Items',{'Subestação Principal','Todas as Instalações','Laboratório LQE'},'FontSize',9.5);
            uidropdown(fbl,'Items',{'Todas','Resistiva','Motor','Ar Condicionado','Fonte Chaveada'},'FontSize',9.5);
            uibutton(fbl,'push','Text','Importar Dados','FontSize',9,...
                'BackgroundColor',[0.07 0.40 0.72],'FontColor',[1 1 1],'ButtonPushedFcn',@(~,~)app.importarDados());
            uibutton(fbl,'push','Text','Atualizar','FontSize',9,'ButtonPushedFcn',@(~,~)app.refreshAll());
            uibutton(fbl,'push','Text','Gerar Relatório','FontSize',9,'ButtonPushedFcn',@(~,~)app.gerarRelatorio());

            % ── Row 2: 8 KPI cards ──
            kpiP = uipanel(root,'BorderType','none','BackgroundColor',[1 1 1]);
            kg = uigridlayout(kpiP,[1 8]); kg.ColumnWidth=repmat({'1x'},1,8);
            kg.Padding=[0 4 0 4]; kg.ColumnSpacing=6;
            cNames  = {'Energia Ativa','Energia Reativa','Demanda Máxima','FP Médio',...
                       'THD-V Médio','THD-I Médio','Eventos Detect.','Custo Estimado'};
            cVals   = {'125,43 MWh','34,18 MVArh','1,786 MW','0,92 ind.',...
                       '2,34 %','6,87 %','23','R$ 86.742'};
            cSubs   = {'+8,7% vs. mês ant.','+6,1% vs. mês ant.','+4,3% vs. mês ant.',...
                       '+0,03 vs. mês ant.','-0,21 p.p.','-0,64 p.p.','+4 vs. mês ant.','+9,2% vs. mês ant.'};
            cIcons  = {char(9889),char(966),char(9711),char(9675),...
                       char(8764),char(8776),char(9888),'R$'};
            cColors = {[0.04 0.52 0.34],[0.55 0.16 0.68],[0.86 0.38 0.06],[0.06 0.40 0.72],...
                       [0.03 0.40 0.78],[0.50 0.10 0.60],[0.80 0.20 0.06],[0.06 0.38 0.20]};
            cBg     = {[0.94 1.00 0.97],[0.98 0.95 1.00],[1.00 0.97 0.94],[0.94 0.97 1.00],...
                       [0.94 0.97 1.00],[0.98 0.95 1.00],[1.00 0.95 0.94],[0.94 1.00 0.97]};
            app.DashboardCardValueLabels = cell(1,8);
            app.DashboardCardSubLabels   = cell(1,8);
            for i=1:8
                cp = uipanel(kg,'BackgroundColor',cBg{i},'BorderType','line');
                cpg = uigridlayout(cp,[2 2]); cpg.ColumnWidth={32,'1x'};
                cpg.RowHeight={22,'1x'}; cpg.Padding=[6 4 6 4]; cpg.RowSpacing=2; cpg.ColumnSpacing=4;
                iconLbl = uilabel(cpg,'Text',cIcons{i},'FontSize',14,'FontWeight','bold',...
                    'FontColor',[1 1 1],'HorizontalAlignment','center','BackgroundColor',cColors{i});
                iconLbl.Layout.Row=[1 2]; iconLbl.Layout.Column=1;
                uilabel(cpg,'Text',cNames{i},'FontSize',7.5,'FontWeight','bold','FontColor',[0.30 0.38 0.50]);
                app.DashboardCardValueLabels{i} = uilabel(cpg,'Text',cVals{i},'FontSize',15,...
                    'FontWeight','bold','FontColor',cColors{i});
                app.DashboardCardSubLabels{i} = uilabel(cpg,'Text',cSubs{i},...
                    'FontSize',7.5,'FontColor',[0.25 0.65 0.28]);
                app.DashboardCardSubLabels{i}.Layout.Row=2; app.DashboardCardSubLabels{i}.Layout.Column=2;
            end

            % ── Row 3: corpo principal (3 colunas) ──
            body = uipanel(root,'BorderType','none','BackgroundColor',[1 1 1]);
            bg = uigridlayout(body,[1 3]); bg.ColumnWidth={'5x','5x','3x'};
            bg.Padding=[0 0 0 0]; bg.ColumnSpacing=6;

            % Coluna esquerda: gráfico principal tempo + FFT + Energia/Demanda
            leftP = uipanel(bg,'BorderType','none');
            lg_ = uigridlayout(leftP,[3 1]);
            lg_.RowHeight={'1x',150,145}; lg_.Padding=[0 0 0 0]; lg_.RowSpacing=5;

            mainChartP = uipanel(lg_,'Title','Potência Ativa e Energia Acumulada',...
                'FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            mainG = uigridlayout(mainChartP,[2 1]); mainG.RowHeight={26,'1x'}; mainG.Padding=[4 4 4 4]; mainG.RowSpacing=3;
            tabBtnG = uigridlayout(mainG,[1 5]);
            tabBtnG.ColumnWidth={42,56,40,108,'1x'}; tabBtnG.Padding=[0 0 0 0]; tabBtnG.ColumnSpacing=4;
            for lbl={'Dia','Semana','Mês','Personalizado'}
                uibutton(tabBtnG,'push','Text',char(lbl),'FontSize',8.5,...
                    'ButtonPushedFcn',@(~,~)app.refreshAll());
            end
            uilabel(tabBtnG,'Text','');
            app.AxTempo = uiaxes(mainG); title(app.AxTempo,''); xlabel(app.AxTempo,'Data');

            fftP = uipanel(lg_,'Title','Espectro Harmônico de Tensão (Fase A)',...
                'FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            fftG = uigridlayout(fftP,[1 1]); fftG.Padding=[4 4 4 4];
            app.AxHarmonicos = uiaxes(fftG);
            xlabel(app.AxHarmonicos,'Ordem Harmônica'); ylabel(app.AxHarmonicos,'% Fundamental');

            energiaP = uipanel(lg_,'Title','Tendência de Energia e Demanda',...
                'FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            energiaG = uigridlayout(energiaP,[1 1]); energiaG.Padding=[4 4 4 4];
            app.AxEnergia = uiaxes(energiaG);
            xlabel(app.AxEnergia,'Data'); ylabel(app.AxEnergia,'kWh / kW');

            % Coluna central: timeline + tabela eventos + cargas + notas
            centerP = uipanel(bg,'BorderType','none');
            cg_ = uigridlayout(centerP,[4 1]);
            cg_.RowHeight={108,'1x',118,82}; cg_.Padding=[0 0 0 0]; cg_.RowSpacing=5;

            tlP = uipanel(cg_,'Title','Linha do Tempo de Qualidade de Energia',...
                'FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            tlG = uigridlayout(tlP,[1 1]); tlG.Padding=[4 4 4 4];
            app.AxScatter = uiaxes(tlG);
            xlabel(app.AxScatter,'Data'); ylabel(app.AxScatter,'Tipo');

            evP = uipanel(cg_,'Title','Alarmes e Eventos Recentes',...
                'FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            evG = uigridlayout(evP,[1 1]); evG.Padding=[4 4 4 4];
            app.TabelaEventos = uitable(evG,'FontSize',8,...
                'ColumnName',{'Data/Hora','Tipo','Descrição','Sev.','Fase','Dur.'},...
                'Data',{'31/05 14:22','Afundamento','Tensão 0,58 pu','Alto','B','1,24 s';...
                    '31/05 10:17','Surto','Sobretensão 1,45 pu','Médio','A','80 ms';...
                    '30/05 22:11','Desequilíbrio','Deseq. 2,8%','Médio','ABC','—';...
                    '30/05 16:45','Flicker','Pst=1,25','Baixo','ABC','10 min';...
                    '29/05 09:33','Interrupção','0,00 pu','Crítico','ABC','240 ms'},'RowName',{});

            cargaP = uipanel(cg_,'Title','Resumo de Cargas por Tipo','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            cargaG = uigridlayout(cargaP,[1 2]); cargaG.Padding=[4 4 4 4]; cargaG.ColumnWidth={'1x',120};
            app.AxCargaStats = uiaxes(cargaG);
            cargaTbl = uigridlayout(cargaG,[5 2]); cargaTbl.Padding=[2 0 2 0]; cargaTbl.RowSpacing=2;
            cargas = {'Motores','48%';'Iluminação','22%';'Ar Cond.','15%';'TI / Eletrôn.','8%';'Outros','7%'};
            for i=1:5
                uilabel(cargaTbl,'Text',cargas{i,1},'FontSize',8);
                uilabel(cargaTbl,'Text',cargas{i,2},'FontSize',8,'HorizontalAlignment','right',...
                    'FontColor',[0.06 0.20 0.50]);
            end

            notasP = uipanel(cg_,'Title','Notas Rápidas','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            notasG = uigridlayout(notasP,[1 1]); notasG.Padding=[4 4 4 4];
            uitextarea(notasG,'FontSize',8.5,'Value',{...
                'Afundamentos recorrentes na Fase B no período da tarde.',...
                'THD-I acima do limite em alguns pontos de medição.',...
                'FP dentro da meta contratual (0,92 ind.).'});

            % Coluna direita: Resumo Instalação + Status + Diagrama Unifilar
            rightP = uipanel(bg,'BorderType','none');
            rg_ = uigridlayout(rightP,[4 1]);
            rg_.RowHeight={158,116,130,'1x'}; rg_.Padding=[0 0 0 0]; rg_.RowSpacing=5;

            instP = uipanel(rg_,'Title','Resumo da Instalação','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            instG = uigridlayout(instP,[6 2]); instG.Padding=[6 4 6 4]; instG.RowHeight=repmat({20},1,6);
            instItems = {'Nome','Subestação Principal';'Tensão Nominal','13,8 kV';...
                'Transformador','13,8/0,38 kV - 2,0 MVA';'Frequência','60 Hz';...
                'Ponto de Medição','Geral BT';'Norma','IEEE 519 / PRODIST'};
            for i=1:6
                uilabel(instG,'Text',instItems{i,1},'FontSize',8,'FontWeight','bold','FontColor',[0.40 0.50 0.65]);
                uilabel(instG,'Text',instItems{i,2},'FontSize',8,'FontColor',[0.10 0.20 0.40]);
            end

            statP = uipanel(rg_,'Title','Status do Sistema','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            statG = uigridlayout(statP,[4 2]); statG.Padding=[6 4 6 4]; statG.RowHeight=repmat({22},1,4);
            statItems = {'Aquisição de Dados','Online';'Sincronismo de Tempo','OK';...
                'Qualidade dos Dados','98,7%';'Última Atualização','31/05 14:25'};
            statColors = {[0.12 0.54 0.20],[0.12 0.54 0.20],[0.06 0.40 0.72],[0.40 0.50 0.65]};
            for i=1:4
                uilabel(statG,'Text',statItems{i,1},'FontSize',8.5,'FontWeight','bold');
                uilabel(statG,'Text',['● ' statItems{i,2}],'FontSize',8.5,'FontColor',statColors{i});
            end

            resumoP = uipanel(rg_,'Title','Resumo por Fase','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            resumoG = uigridlayout(resumoP,[1 1]); resumoG.Padding=[4 4 4 4];
            app.TabelaResumo = uitable(resumoG,'FontSize',8,...
                'ColumnName',{'Parâmetro','Fase A','Fase B','Fase C'},...
                'Data',{'Tensão RMS (V)','220,1','218,9','221,4';...
                    'Corrente RMS (A)','125,3','122,8','127,5';...
                    'FP','0,93','0,91','0,92';...
                    'THD-V (%)','2,34','2,41','2,28';...
                    'THD-I (%)','6,87','7,12','6,61'},'RowName',{});

            diagP = uipanel(rg_,'Title','Diagrama Unifilar','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            diagG = uigridlayout(diagP,[1 1]); diagG.Padding=[4 4 4 4];
            app.AxDiagrama = uiaxes(diagG); axis(app.AxDiagrama,'off');
            try, app.desenharTrifasico(app.AxDiagrama); catch, end

            % ── Row 4: log de processamento ──
            logRow = uipanel(root,'BorderType','none','BackgroundColor',[0.97 0.98 1.00]);
            logG_ = uigridlayout(logRow,[1 2]); logG_.ColumnWidth={'1x',100}; logG_.Padding=[4 3 6 3];
            app.LogText = uitextarea(logG_,'Editable','off','FontSize',8.5,...
                'BackgroundColor',[0.97 0.98 1.00],'Value',{'Log de Processamento:'});
            uibutton(logG_,'Text','Limpar Log','FontSize',8.5,...
                'ButtonPushedFcn',@(~,~)set(app.LogText,'Value',{'Log de Processamento:'}));
        end

        function createDashboardIndicators(app)
            if isempty(app.DashboardIndicatorsPanel), return; end
            ig = uigridlayout(app.DashboardIndicatorsPanel,[2 8]);
            ig.RowHeight = {'1x','1x'};
            ig.ColumnWidth = repmat({'1x'},1,8);
            ig.Padding = [6 3 6 4];
            ig.RowSpacing = 4;
            ig.ColumnSpacing = 5;
            items = { ...
                'Medição de Tensão','220,1 V',[0.94 0.97 1.00]; ...
                'Medição de Corrente','125,3 A',[0.94 0.97 1.00]; ...
                'Resistência','10,24 Ω',[1.00 0.97 0.94]; ...
                'Continuidade','OK',[0.94 1.00 0.94]; ...
                'Aterramento','> 1000 MΩ',[0.94 1.00 0.94]; ...
                'Erro Absoluto','0,35 %',[1.00 0.98 0.94]; ...
                'Exatidão','±0,50 %',[1.00 0.98 0.94]; ...
                'Precisão','±0,25 %',[1.00 0.98 0.94]; ...
                'Incerteza Tipo A','0,15 %',[0.98 0.95 1.00]; ...
                'Incerteza Tipo B','0,20 %',[0.98 0.95 1.00]; ...
                'Incerteza Expan.','0,50 %',[0.98 0.95 1.00]; ...
                'Categorias','CAT II/III/IV',[0.96 0.96 0.98]; ...
                'TC Aberto: Risco','Detectado',[1.00 0.94 0.94]; ...
                'Calibração','Válida',[0.94 1.00 0.94]; ...
                'Rastreabilidade','Rastreável',[0.94 1.00 0.94]; ...
                'Resolução','0,01',[0.96 0.97 0.99]};
            for i=1:size(items,1)
                p = uipanel(ig,'BackgroundColor',items{i,3},'BorderType','line');
                pg = uigridlayout(p,[2 1]);
                pg.RowHeight = {17,'1x'};
                pg.Padding = [3 2 3 2];
                uilabel(pg,'Text',items{i,1},'FontSize',8.5,'FontWeight','bold',...
                    'FontColor',[0.12 0.26 0.44],'HorizontalAlignment','center');
                uilabel(pg,'Text',items{i,2},'FontSize',11,'FontWeight','bold',...
                    'FontColor',[0.07 0.32 0.56],'HorizontalAlignment','center');
            end
        end

        function createImportTab(app)
            tab = uitab(app.TabGroup,'Title','Dados');
            g = uigridlayout(tab,[1 3]); g.ColumnWidth={252,'1x',328}; g.Padding=[0 0 0 0]; g.ColumnSpacing=0;

            % ── Left: Fontes de Dados ──
            lp = uipanel(g,'Title','Fontes de Dados','FontWeight','bold','FontSize',10,...
                'ForegroundColor',[0.06 0.20 0.38]);
            lg = uigridlayout(lp,[3 1]); lg.RowHeight={26,'1x',120}; lg.Padding=[4 4 4 4];
            uibutton(lg,'push','Text','+ Adicionar Fonte','FontSize',9,'ButtonPushedFcn',@(~,~)app.importarDados());
            app.ProjectTree = uitree(lg);
            roots_ = {'Aquisições Locais','Arquivos Locais','Servidores / Banco de Dados','Nuvem','Dispositivos Remotos'};
            subs_ = {{'PQa-5000 #12345','PQa-5000 #12346','PMU-120 #01','CLP Subestação'}, ...
                     {'Medições_SP_01.csv','Qualidade_Abril.mat','Eventos_TJ.tr0'}, ...
                     {'SQL Server - PQDB','Historian OSIsoft PI','InfluxDB - Energia'}, ...
                     {'Azure Blob Storage','AWS S3 - PQDados'}, ...
                     {'IED - REL_670','IED - SEL_751'}};
            for i=1:5
                pn = uitreenode(app.ProjectTree,'Text',roots_{i});
                for j=1:numel(subs_{i}), uitreenode(pn,'Text',subs_{i}{j}); end
            end
            histP = uipanel(lg,'Title','Histórico de Importações','FontWeight','bold','FontSize',8.5,...
                'ForegroundColor',[0.06 0.20 0.38]);
            hg = uigridlayout(histP,[1 1]); hg.Padding=[2 2 2 2];
            uitable(hg,'Data',{'Medições_SP_01.csv','Local','31/05 14:20';...
                'PQ_Abril_2024.mat','Local','31/05 11:05';'Eventos_TJ.tr0','Local','31/05 09:42';...
                'Subestacao_Abr.tdms','Servidor','30/05 22:17';'PMU_120_05_30.tdms','Disp.','30/05 21:10'},...
                'ColumnName',{'Arquivo','Origem','Data/Hora'},'FontSize',7.5,'RowName',{});

            % ── Center: import + mapping + preview ──
            cp = uipanel(g,'BorderType','none');
            cg = uigridlayout(cp,[5 1]); cg.RowHeight={100,38,170,'1x',40}; cg.Padding=[8 6 8 6]; cg.RowSpacing=5;
            dropP = uipanel(cg,'Title','Importar Dados','FontWeight','bold','ForegroundColor',[0.06 0.20 0.38]);
            dg = uigridlayout(dropP,[2 1]); dg.RowHeight={34,36}; dg.Padding=[6 6 6 4];
            uilabel(dg,'Text','Arraste e solte arquivos aqui  ou  Selecionar Arquivos',...
                'HorizontalAlignment','center','FontSize',10,'FontColor',[0.40 0.50 0.65]);
            fmtG = uigridlayout(dg,[1 6]); fmtG.Padding=[0 0 0 0]; fmtG.ColumnWidth=repmat({'1x'},1,6);
            for fmt={'CSV','XLSX','MAT','TDMS','COMTRADE','Banco SQL'}
                uibutton(fmtG,'push','Text',char(fmt),'FontSize',9,'ButtonPushedFcn',@(~,~)app.importarCSV());
            end
            mapG = uigridlayout(cg,[1 5]); mapG.Padding=[0 0 0 0]; mapG.ColumnWidth={76,182,'1x',72,70};
            uilabel(mapG,'Text','Template:','FontWeight','bold','FontSize',9.5);
            uidropdown(mapG,'Items',{'Padrão PQ e Energia','Personalizado','COMTRADE'},'FontSize',9.5);
            uilabel(mapG,'Text','');
            uibutton(mapG,'push','Text','Carregar','FontSize',9,'ButtonPushedFcn',@(~,~)app.importarCSV());
            uibutton(mapG,'push','Text','Salvar','FontSize',9,'ButtonPushedFcn',@(~,~)app.salvarProjeto());
            uitable(cg,'FontSize',8.5,...
                'Data',{'Timestamp','Data e Hora','DataHora','-','datetime';'Va','Tensão Fase A','Va_kV','kV','double';...
                    'Vb','Tensão Fase B','Vb_kV','kV','double';'Ia','Corrente Fase A','Ia_A','A','double';...
                    'P','Potência Ativa','P_kW','kW','double';'Freq','Frequência','Freq_Hz','Hz','double'},...
                'ColumnName',{'Campo Padrão','Descrição','Coluna Arquivo','Unidade','Tipo'},'RowName',{});
            app.ImportTable = uitable(cg,'FontSize',8.5);
            app.ImportTable.ColumnName={'Timestamp','Va (kV)','Vb (kV)','Vc (kV)','Ia (A)','P (kW)','Q (kVAr)','PF'};
            btnG = uigridlayout(cg,[1 4]); btnG.Padding=[0 0 0 0]; btnG.ColumnWidth={'1x','1x','1x','1x'};
            uibutton(btnG,'push','Text','Importar','FontSize',10,...
                'BackgroundColor',[0.07 0.40 0.72],'FontColor',[1 1 1],'ButtonPushedFcn',@(~,~)app.importarDados());
            uibutton(btnG,'push','Text','Validar','FontSize',10,...
                'BackgroundColor',[0.12 0.54 0.20],'FontColor',[1 1 1],'ButtonPushedFcn',@(~,~)app.validarDados());
            uibutton(btnG,'push','Text','Sincronizar','FontSize',10,'ButtonPushedFcn',@(~,~)app.refreshAll());
            uibutton(btnG,'push','Text','Salvar Base','FontSize',10,'ButtonPushedFcn',@(~,~)app.salvarProjeto());

            % ── Right: metadata + quality + filters ──
            rp = uipanel(g,'Title','Metadados do Arquivo','FontWeight','bold','FontSize',10,...
                'ForegroundColor',[0.06 0.20 0.38]);
            rg = uigridlayout(rp,[3 1]); rg.RowHeight={'1x',210,118}; rg.Padding=[6 6 6 6];
            app.MetaText = uitextarea(rg,'Editable','off','FontSize',9.5,'Value',{...
                'Arquivo:     Medições_SP_01.csv','Origem:      Local','Tamanho:     128,4 MB',...
                'Registros:   864.000','Período:     31/05/2024 00:00:00','             31/05/2024 23:59:59',...
                'Intervalo:   20 ms  (50 Hz nominal)','Fuso:        UTC-03:00','Codificação: UTF-8'});
            qp = uipanel(rg,'Title','Verificações de Qualidade','FontWeight','bold','FontSize',9,...
                'ForegroundColor',[0.06 0.20 0.38]);
            qg = uigridlayout(qp,[7 2]); qg.Padding=[4 4 4 4]; qg.RowHeight=repmat({22},1,7);
            chkItems = {'Campos mapeados','Dados numéricos','Timestamps válidos','Duplicatas',...
                        'Valores faltantes','Valores fora de faixa','Consist. trifásica'};
            chkVals  = {'9 / 9  OK','OK','OK','0','1.555  0,18%','0,06%','OK'};
            chkC_    = {[0 0.5 0],[0 0.5 0],[0 0.5 0],[0.5 0.5 0.5],[0.7 0.5 0],[0.7 0.4 0],[0 0.5 0]};
            for i=1:7
                uilabel(qg,'Text',chkItems{i},'FontSize',8.5,'FontColor',chkC_{i});
                uilabel(qg,'Text',chkVals{i},'FontSize',8.5,'FontColor',chkC_{i},'HorizontalAlignment','right');
            end
            fp = uipanel(rg,'Title','Filtros','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            fg = uigridlayout(fp,[3 2]); fg.Padding=[4 4 4 4]; fg.RowHeight=repmat({26},1,3);
            uilabel(fg,'Text','Passa-baixa (Hz):','FontSize',9); uieditfield(fg,'numeric','Value',2500,'FontSize',9);
            uilabel(fg,'Text','Passa-alta (Hz):','FontSize',9);  uieditfield(fg,'numeric','Value',0.50,'FontSize',9);
            uilabel(fg,'Text','Notch 60 Hz:','FontSize',9);      uicheckbox(fg,'Text','','Value',true);
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
            tab = uitab(app.TabGroup,'Title','Medidas e Instrumentos');
            root = uigridlayout(tab,[1 2]); root.ColumnWidth={192,'1x'}; root.Padding=[6 6 6 6]; root.ColumnSpacing=6;

            % ── Painel esquerdo: lista de instrumentos ──
            instrListP = uipanel(root,'Title','Instrumentos','FontWeight','bold','FontSize',9,...
                'ForegroundColor',[0.06 0.20 0.38],'BackgroundColor',[0.97 0.98 1.00]);
            instrG = uigridlayout(instrListP,[10 1]);
            instrG.RowHeight=repmat({32},1,10); instrG.Padding=[6 6 6 6]; instrG.RowSpacing=3;
            instrNames = {'Multímetro Digital','Analisador de Qualidade','Osciloscópio','Pinça Amperimétrica',...
                'Voltímetro de Alta Precis.','Wattímetro Digital','Analisador de Harmônicas',...
                'Medidor de Energia kWh','Registrador de Dados'};
            instrIcons = {char(9135),char(9213),char(8767),char(9832),...
                char(9108),char(9650),char(8764),char(9889),char(9654)};
            for i=1:9
                btn = uibutton(instrG,'push',...
                    'Text',[instrIcons{i} '  ' instrNames{i}],'FontSize',8.5,...
                    'HorizontalAlignment','left','BackgroundColor',[0.94 0.97 1.00]);
                if i==1, btn.BackgroundColor=[0.07 0.40 0.72]; btn.FontColor=[1 1 1]; end
            end
            uilabel(instrG,'Text','');

            % ── Corpo principal (lado direito) ──
            bodyP = uipanel(root,'BorderType','none');
            body = uigridlayout(bodyP,[5 1]);
            body.RowHeight={72,72,'1x',148,72}; body.Padding=[0 0 0 0]; body.RowSpacing=5;

            % ── Seção 1: Tipo de Medição ──
            tipoP = uipanel(body,'Title','1. Tipo de Medição','FontWeight','bold','FontSize',9,...
                'ForegroundColor',[0.06 0.20 0.38]);
            tipoG = uigridlayout(tipoP,[1 7]); tipoG.Padding=[6 6 6 6]; tipoG.ColumnWidth={80,80,80,80,82,80,'1x'};
            tipoLabels = {'Tensão','Corrente','Potência','Energia','Frequência','Outros'};
            tipoColors = {[0.07 0.40 0.72],[0.04 0.52 0.34],[0.86 0.38 0.06],...
                          [0.55 0.16 0.68],[0.03 0.40 0.78],[0.40 0.40 0.40]};
            for i=1:6
                clr = tipoColors{i};
                b = uibutton(tipoG,'push','Text',tipoLabels{i},'FontSize',9,'FontWeight','bold',...
                    'BackgroundColor',clr,'FontColor',[1 1 1]);
                if i==1, b.BackgroundColor=[0.07 0.40 0.72]; else, b.BackgroundColor=clr+0.3*(1-clr); b.FontColor=[0.15 0.22 0.35]; end
            end
            uilabel(tipoG,'Text','');

            % ── Seções 2-3: Método + Configuração ──
            metConfP = uipanel(body,'BorderType','none');
            mcG = uigridlayout(metConfP,[1 2]); mcG.Padding=[0 0 0 0]; mcG.ColumnSpacing=6;

            metP = uipanel(mcG,'Title','2. Método de Medição','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            metG = uigridlayout(metP,[2 2]); metG.ColumnWidth={'1x','1x'}; metG.RowHeight={26,26}; metG.Padding=[6 6 6 6];
            uilabel(metG,'Text','Método:','FontSize',9,'FontWeight','bold');
            uidropdown(metG,'Items',{'Direta - Monofásica','Direta - Trifásica','Indireta - TC/TP','Diferencial'},'FontSize',9);
            uilabel(metG,'Text','Conexão:','FontSize',9,'FontWeight','bold');
            uidropdown(metG,'Items',{'2 Fios','3 Fios (Aron)','4 Fios','Alta Tensão (TC/TP)'},'FontSize',9);

            confP = uipanel(mcG,'Title','3. Configuração da Medição','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            confG = uigridlayout(confP,[2 4]); confG.RowHeight={26,26}; confG.Padding=[6 6 6 6]; confG.ColumnSpacing=6;
            cfg = {'Sistema:',{'60 Hz - CA','50 Hz - CA','CC'}; 'Fases:',{'A','B','C','ABC','A+B+C'}};
            for i=1:2
                uilabel(confG,'Text',cfg{i,1},'FontSize',9,'FontWeight','bold');
                uidropdown(confG,'Items',cfg{i,2},'FontSize',9);
            end

            % ── Seções 4-7: Instrumento + Calculadora + Leituras ──
            midP = uipanel(body,'BorderType','none');
            midG = uigridlayout(midP,[1 3]); midG.ColumnWidth={224,200,'1x'}; midG.Padding=[0 0 0 0]; midG.ColumnSpacing=6;

            instInfoP = uipanel(midG,'Title','4. Instrumento Selecionado','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            infoG = uigridlayout(instInfoP,[8 2]); infoG.Padding=[6 6 6 6]; infoG.RowHeight=repmat({20},1,8);
            infoRows = {'Modelo','Fluke 435-II';'Fabricante','Fluke Electronics';'Classe','Classe A (IEC 61000-4-30)';...
                'Resolução','0,01 V / 0,01 A';'Exatidão','±0,1% rdg ±0,05% FS';...
                'Faixa V','15–1000 V (CAT IV)';'Faixa I','0–6000 A (garra)';'Calibração','Válida até 12/2025'};
            for i=1:8
                uilabel(infoG,'Text',infoRows{i,1},'FontSize',7.5,'FontWeight','bold','FontColor',[0.35 0.45 0.60]);
                uilabel(infoG,'Text',infoRows{i,2},'FontSize',7.5,'FontColor',[0.10 0.20 0.40]);
            end

            calcP = uipanel(midG,'Title','5. Calculadora de Medidas','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            pg = uigridlayout(calcP,[8 2]); pg.RowHeight=repmat({26},1,8); pg.Padding=[6 6 6 6]; pg.RowSpacing=2;
            uilabel(pg,'Text','Tipo','FontSize',8.5);
            tipo = uidropdown(pg,'Items',{'Lei de Ohm','Potência CC','Potência CA 1F','Potência CA 3F','Resistência V/I'},'FontSize',8.5);
            vLabels={'V (V)','I (A)','R (Ω)','FP','VLL (V)','IL (A)'}; defaults=[220 10 22 0.92 380 10];
            app.BasicInputFields = cell(1,6);
            for i=1:6
                uilabel(pg,'Text',vLabels{i},'FontSize',8.5);
                app.BasicInputFields{i}=uieditfield(pg,'numeric','Value',defaults(i),'FontSize',8.5);
            end
            uibutton(pg,'push','Text','Calcular','FontSize',9,...
                'BackgroundColor',[0.07 0.40 0.72],'FontColor',[1 1 1],...
                'ButtonPushedFcn',@(~,~)app.calcularMedidaBasica(tipo.Value));

            liveP = uipanel(midG,'Title','6. Leituras em Tempo Real','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            liveG = uigridlayout(liveP,[3 1]); liveG.RowHeight={'1x',54,54}; liveG.Padding=[6 6 6 6];
            liveAx = uiaxes(liveG); title(liveAx,''); xlabel(liveAx,'Tempo (ms)'); ylabel(liveAx,'V / A');
            readGrid1 = uigridlayout(liveG,[1 3]); readGrid1.Padding=[0 0 0 0];
            liveVals = {'220,1 V','125,3 A','28,56 kW'};
            liveClrs = {[0.04 0.40 0.78],[0.04 0.54 0.32],[0.86 0.38 0.06]};
            liveNames = {'Tensão RMS','Corrente RMS','Potência Ativa'};
            for i=1:3
                lp = uipanel(readGrid1,'BackgroundColor',liveClrs{i}+(1-liveClrs{i})*0.85,'BorderType','none');
                lpg = uigridlayout(lp,[2 1]); lpg.Padding=[4 2 4 2]; lpg.RowSpacing=1;
                uilabel(lpg,'Text',liveVals{i},'FontSize',13,'FontWeight','bold',...
                    'FontColor',liveClrs{i},'HorizontalAlignment','center');
                uilabel(lpg,'Text',liveNames{i},'FontSize',7.5,'HorizontalAlignment','center','FontColor',[0.30 0.38 0.50]);
            end
            readGrid2 = uigridlayout(liveG,[1 3]); readGrid2.Padding=[0 0 0 0];
            liveVals2={'0,92 ind.','2,34 %','6,87 %'}; liveClrs2={[0.55 0.16 0.68],[0.03 0.40 0.78],[0.50 0.10 0.60]};
            liveNames2={'FP','THD-V','THD-I'};
            for i=1:3
                lp2=uipanel(readGrid2,'BackgroundColor',liveClrs2{i}+(1-liveClrs2{i})*0.85,'BorderType','none');
                lpg2=uigridlayout(lp2,[2 1]); lpg2.Padding=[4 2 4 2]; lpg2.RowSpacing=1;
                uilabel(lpg2,'Text',liveVals2{i},'FontSize',13,'FontWeight','bold','FontColor',liveClrs2{i},'HorizontalAlignment','center');
                uilabel(lpg2,'Text',liveNames2{i},'FontSize',7.5,'HorizontalAlignment','center','FontColor',[0.30 0.38 0.50]);
            end

            % ── Seções 8-11: Resultados + Comparação ──
            lowP = uipanel(body,'BorderType','none');
            lowG = uigridlayout(lowP,[1 3]); lowG.ColumnWidth={'1x','1x',210}; lowG.Padding=[0 0 0 0]; lowG.ColumnSpacing=6;

            resP = uipanel(lowG,'Title','7. Resultados da Calculadora','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            resG = uigridlayout(resP,[1 1]); resG.Padding=[4 4 4 4];
            app.BasicMeasureTable = uitable(resG,'FontSize',8,...
                'ColumnName',{'Grandeza','Símbolo','Valor','Unidade'},...
                'Data',{'Tensão','V','220,1','V';'Corrente','I','125,3','A';...
                    'Potência Ativa','P','28,56','kW';'Potência Reativa','Q','13,78','kVAr';...
                    'Potência Aparente','S','31,71','kVA';'Fator de Potência','FP','0,92',''},'RowName',{});

            compP = uipanel(lowG,'Title','8. Comparação de Instrumentos','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            compG = uigridlayout(compP,[1 1]); compG.Padding=[4 4 4 4];
            app.InstrumentsTable = uitable(compG,'Data',app.instrumentosData(),'FontSize',8,...
                'ColumnName',{'Instrumento','Grandeza','Faixa','Precisão','Classe','Calibração'},...
                'RowName',{});

            incertP = uipanel(lowG,'Title','9. Incerteza de Medição','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            incertG = uigridlayout(incertP,[6 2]); incertG.Padding=[6 6 6 6]; incertG.RowHeight=repmat({20},1,6);
            incRows={'Incerteza Tipo A','±0,15 %';'Incerteza Tipo B','±0,20 %';...
                'Incerteza Combinada','±0,25 %';'Fator de Cobertura k','2,00 (95,5%)';...
                'Incerteza Expandida','±0,50 %';'Graus de Liberdade','>30'};
            for i=1:6
                uilabel(incertG,'Text',incRows{i,1},'FontSize',8,'FontWeight','bold','FontColor',[0.35 0.45 0.60]);
                uilabel(incertG,'Text',incRows{i,2},'FontSize',8,'FontColor',[0.10 0.20 0.40]);
            end

            % ── Seções 12-13: Segurança + Exportação ──
            botP = uipanel(body,'BorderType','none');
            botG = uigridlayout(botP,[1 2]); botG.ColumnWidth={'1x',320}; botG.Padding=[0 0 0 0]; botG.ColumnSpacing=6;

            segP = uipanel(botG,'Title','12. Segurança e Conformidade','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            segG = uigridlayout(segP,[2 4]); segG.Padding=[6 4 6 4];
            segItems={'EPI utilizado','Tensão ≤ CAT II','TC aberto: RISCO','Aterramento verificado';...
                'Isolamento OK','Calibração válida','Norma PRODIST vigente','NR-10 atendida'};
            for c=1:4
                for r=1:2
                    uicheckbox(segG,'Text',segItems{r,c},'FontSize',8,'Value',true);
                end
            end

            expP = uipanel(botG,'Title','13. Exportação e Relatórios','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            expG = uigridlayout(expP,[1 4]); expG.Padding=[8 8 8 8]; expG.ColumnWidth=repmat({'1x'},1,4);
            expBtns = {'Exportar CSV','Exportar XLSX','Relatório PDF','Salvar Sessão'};
            expClrs = {[0.04 0.52 0.34],[0.06 0.40 0.72],[0.86 0.38 0.06],[0.40 0.40 0.40]};
            for i=1:4
                uibutton(expG,'push','Text',expBtns{i},'FontSize',9,...
                    'BackgroundColor',expClrs{i},'FontColor',[1 1 1]);
            end
        end

        function createCircuitosEditorTab(app)
            tab = uitab(app.TabGroup,'Title','Circuitos e Editor');
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
            app.ensureAnalysisStorage();
            tab = uitab(app.TabGroup,'Title','Qualidade de Energia');
            g = uigridlayout(tab,[4 1]); g.RowHeight={46,84,'1x',178}; g.Padding=[8 6 8 6]; g.RowSpacing=5;

            % ── Filter bar ──
            fb = uipanel(g,'BorderType','none','BackgroundColor',[0.96 0.97 0.99]);
            fbl = uigridlayout(fb,[1 9]); fbl.ColumnWidth={58,152,14,152,16,178,158,80,90};
            fbl.Padding=[6 5 6 5]; fbl.ColumnSpacing=4;
            uilabel(fbl,'Text','Período:','FontWeight','bold','FontSize',9.5);
            uieditfield(fbl,'text','Value','01/05/2024 00:00','FontSize',9.5);
            uilabel(fbl,'Text','até','HorizontalAlignment','center','FontSize',9.5);
            uieditfield(fbl,'text','Value','31/05/2024 23:59','FontSize',9.5);
            uilabel(fbl,'Text','');
            uidropdown(fbl,'Items',{'Subestação Principal','Todas as Instalações','Laboratório LQE'},'FontSize',9.5);
            uidropdown(fbl,'Items',{'Geral BT','Geral MT','Por Fase'},'FontSize',9.5);
            uibutton(fbl,'push','Text','Atualizar','FontSize',9,'ButtonPushedFcn',@(~,~)app.refreshAll());
            uibutton(fbl,'push','Text','Relatório','FontSize',9,'ButtonPushedFcn',@(~,~)app.gerarRelatorio());

            % ── Mini KPI cards (9) ──
            kpiP = uipanel(g,'BorderType','none','BackgroundColor',[1 1 1]);
            kg = uigridlayout(kpiP,[1 9]); kg.ColumnWidth=repmat({'1x'},1,9);
            kg.Padding=[0 2 0 2]; kg.ColumnSpacing=5;
            kL = {'Tensão RMS','Corrente RMS','THD-V Médio','THD-I Médio',...
                  'Desequilíbrio V','Flicker Pst (95%)','Frequência','Eventos Totais','Conformidade'};
            kV = {'13,81 kV','612 A','2,34 %','6,87 %','0,92 %','0,58','60,02 Hz','128','98,2 %'};
            kC = {[0.04 0.40 0.72],[0.55 0.16 0.68],[0.04 0.40 0.72],[0.55 0.16 0.68],...
                  [0.86 0.38 0.06],[0.04 0.52 0.34],[0.06 0.38 0.20],[0.80 0.20 0.06],[0.12 0.54 0.20]};
            kB = {[0.94 0.97 1.0],[0.98 0.95 1.0],[0.94 0.97 1.0],[0.98 0.95 1.0],...
                  [1.0 0.97 0.94],[0.94 1.0 0.97],[0.94 1.0 0.97],[1.0 0.95 0.94],[0.94 1.0 0.94]};
            for i=1:9
                kp = uipanel(kg,'BackgroundColor',kB{i},'BorderType','line');
                kpg = uigridlayout(kp,[2 1]); kpg.RowHeight={20,'1x'}; kpg.Padding=[4 3 4 3]; kpg.RowSpacing=0;
                uilabel(kpg,'Text',kL{i},'FontSize',7.5,'FontWeight','bold','FontColor',[0.22 0.32 0.46]);
                uilabel(kpg,'Text',kV{i},'FontSize',13,'FontWeight','bold','FontColor',kC{i});
            end

            % ── Charts (2 × 3) ──
            chartP = uipanel(g,'BorderType','none');
            chg = uigridlayout(chartP,[2 3]); chg.Padding=[0 0 0 0]; chg.ColumnSpacing=5; chg.RowSpacing=5;
            app.AnalysisAxes{1} = uiaxes(chg);
            app.AnalysisAxes{1}.Layout.Row=1; app.AnalysisAxes{1}.Layout.Column=1;
            title(app.AnalysisAxes{1},'Perfil RMS de Tensão (10 min)');
            qax2 = uiaxes(chg); qax2.Layout.Row=1; qax2.Layout.Column=2;
            title(qax2,'Distorção de Tensão (Forma de Onda)');
            qax3 = uiaxes(chg); qax3.Layout.Row=1; qax3.Layout.Column=3;
            title(qax3,'Espectro Harmônico (FFT)');
            qax4 = uiaxes(chg); qax4.Layout.Row=2; qax4.Layout.Column=1;
            title(qax4,'Harmônicos Individuais de Tensão');
            app.AnalysisAxes{4} = uiaxes(chg);
            app.AnalysisAxes{4}.Layout.Row=2; app.AnalysisAxes{4}.Layout.Column=2;
            title(app.AnalysisAxes{4},'Flicker — IEC 61000-4-15');
            app.AnalysisAxes{5} = uiaxes(chg);
            app.AnalysisAxes{5}.Layout.Row=2; app.AnalysisAxes{5}.Layout.Column=3;
            title(app.AnalysisAxes{5},'Curva CBEMA / ITIC');

            % ── Bottom: events table + stats + conformidade ──
            botP = uipanel(g,'BorderType','none');
            bg_ = uigridlayout(botP,[1 3]); bg_.ColumnWidth={'1x',235,305}; bg_.Padding=[0 0 0 0]; bg_.ColumnSpacing=5;
            app.AnalysisTables{1} = uitable(bg_,'FontSize',8,...
                'ColumnName',{'Data/Hora','Tipo','Fase','Magnitude','Duração','Status'},...
                'Data',{'31/05 14:23','Sag','A','76,2 V','412 ms','Registrado';...
                    '31/05 11:41','Swell','B','144,3 V','82 ms','Registrado';...
                    '31/05 09:16','Interrupção','ABC','8,1 V','1,2 s','Registrado';...
                    '30/05 23:58','Transitório','C','312,4 V','<1 ms','Registrado'},...
                'RowName',{});
            evP = uipanel(bg_,'Title','Resumo de Eventos','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            esg = uigridlayout(evP,[4 2]); esg.Padding=[8 6 8 6];
            evItems = {'Afundamentos (Sags)','42';'Elevações (Swells)','31';'Interrupções','8';'Transitórios','39'};
            for i=1:4
                uilabel(esg,'Text',evItems{i,1},'FontSize',9,'FontWeight','bold');
                uilabel(esg,'Text',evItems{i,2},'FontSize',16,'FontWeight','bold',...
                    'FontColor',[0.06 0.40 0.72],'HorizontalAlignment','right');
            end
            confP = uipanel(bg_,'Title','Conformidade — PRODIST / IEEE 519','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            cng = uigridlayout(confP,[1 1]); cng.Padding=[4 4 4 4];
            uitable(cng,'Data',{'THD de Tensão','2,34%','5,0%','Conforme';...
                'THD de Corrente','6,87%','8,0%','Conforme';'Desequilíbrio','0,92%','2,0%','Conforme';...
                'Frequência','60,02 Hz','±0,5 Hz','Conforme';'Variação de Tensão','±3,2%','±10%','Conforme'},...
                'ColumnName',{'Parâmetro','Medido','Limite','Status'},'RowName',{},'FontSize',8);
            try, app.plotAnalise(1); app.plotAnalise(4); app.plotAnalise(5); catch, end
        end

        function createEnergiaFPTab(app)
            app.ensureAnalysisStorage();
            tab = uitab(app.TabGroup,'Title','Energia, Demanda e FP');
            g = uigridlayout(tab,[4 1]); g.RowHeight={46,84,'1x',200}; g.Padding=[8 6 8 6]; g.RowSpacing=5;

            % ── Filter bar ──
            fb = uipanel(g,'BorderType','none','BackgroundColor',[0.96 0.97 0.99]);
            fbl = uigridlayout(fb,[1 9]); fbl.ColumnWidth={58,152,14,152,16,178,148,130,90};
            fbl.Padding=[6 5 6 5]; fbl.ColumnSpacing=4;
            uilabel(fbl,'Text','Período:','FontWeight','bold','FontSize',9.5);
            uieditfield(fbl,'text','Value','01/05/2024 00:00','FontSize',9.5);
            uilabel(fbl,'Text','até','HorizontalAlignment','center','FontSize',9.5);
            uieditfield(fbl,'text','Value','31/05/2024 23:59','FontSize',9.5);
            uilabel(fbl,'Text','');
            uidropdown(fbl,'Items',{'Subestação Principal','Todas as Instalações'},'FontSize',9.5);
            uidropdown(fbl,'Items',{'Grupo A4 Verde','Grupo A4 Azul','Grupo B'},'FontSize',9.5);
            uibutton(fbl,'push','Text','Calcular Economia','FontSize',9,...
                'BackgroundColor',[0.07 0.40 0.72],'FontColor',[1 1 1],'ButtonPushedFcn',@(~,~)app.refreshAll());
            uibutton(fbl,'push','Text','Simul. FP','FontSize',9,'ButtonPushedFcn',@(~,~)app.refreshAll());

            % ── Mini KPI cards (7) ──
            kpiP = uipanel(g,'BorderType','none','BackgroundColor',[1 1 1]);
            kg = uigridlayout(kpiP,[1 7]); kg.ColumnWidth=repmat({'1x'},1,7);
            kg.Padding=[0 2 0 2]; kg.ColumnSpacing=6;
            kL2 = {'Energia Ativa Consumida','Custo Total no Período','Demanda Máxima',...
                   'FP Médio','Demanda Contratada','Custo Médio','Economia Estimada'};
            kV2 = {'125,43 MWh','R$ 86.742','1.786 kW','0,92 ind.','2.000 kW','R$ 0,693/kWh','R$ 7.845'};
            kC2 = {[0.04 0.52 0.34],[0.06 0.38 0.20],[0.86 0.38 0.06],[0.06 0.40 0.72],...
                   [0.55 0.16 0.68],[0.04 0.52 0.34],[0.12 0.54 0.20]};
            kB2 = {[0.94 1.0 0.97],[0.94 1.0 0.97],[1.0 0.97 0.94],[0.94 0.97 1.0],...
                   [0.98 0.95 1.0],[0.94 1.0 0.97],[0.94 1.0 0.97]};
            for i=1:7
                kp2 = uipanel(kg,'BackgroundColor',kB2{i},'BorderType','line');
                kpg2 = uigridlayout(kp2,[3 1]); kpg2.RowHeight={18,'1x',14}; kpg2.Padding=[4 3 4 3]; kpg2.RowSpacing=0;
                uilabel(kpg2,'Text',kL2{i},'FontSize',7.5,'FontWeight','bold','FontColor',[0.22 0.32 0.46]);
                uilabel(kpg2,'Text',kV2{i},'FontSize',12,'FontWeight','bold','FontColor',kC2{i});
                uilabel(kpg2,'Text','+8,7% vs. mês ant.','FontSize',7,'FontColor',[0.25 0.65 0.28]);
            end

            % ── Charts (2 × 3) ──
            chartP = uipanel(g,'BorderType','none');
            chg = uigridlayout(chartP,[2 3]); chg.Padding=[0 0 0 0]; chg.ColumnSpacing=5; chg.RowSpacing=5;
            app.AnalysisAxes{2} = uiaxes(chg);
            app.AnalysisAxes{2}.Layout.Row=1; app.AnalysisAxes{2}.Layout.Column=1;
            title(app.AnalysisAxes{2},'Consumo de Energia (kWh)');
            eax2 = uiaxes(chg); eax2.Layout.Row=1; eax2.Layout.Column=2; title(eax2,'Perfil de Carga Médio (kW)');
            eax3 = uiaxes(chg); eax3.Layout.Row=1; eax3.Layout.Column=3; title(eax3,'Análise de Tarifas e Custos');
            app.AnalysisAxes{3} = uiaxes(chg);
            app.AnalysisAxes{3}.Layout.Row=2; app.AnalysisAxes{3}.Layout.Column=1;
            title(app.AnalysisAxes{3},'Energia Acumulada (MWh)');
            eax5 = uiaxes(chg); eax5.Layout.Row=2; eax5.Layout.Column=2; title(eax5,'Curva de Demanda Ordenada (kW)');
            eax6 = uiaxes(chg); eax6.Layout.Row=2; eax6.Layout.Column=3; title(eax6,'Monitoramento do Fator de Potência');

            % ── Bottom: tables + capacitor suggestion ──
            botP = uipanel(g,'BorderType','none');
            bg_ = uigridlayout(botP,[1 3]); bg_.ColumnWidth={'1x','1x',265}; bg_.Padding=[0 0 0 0]; bg_.ColumnSpacing=5;
            app.AnalysisTables{2} = uitable(bg_,'FontSize',8,...
                'ColumnName',{'Descrição','Mês Atual','%','Mês Anterior','Δ (%)'},...
                'Data',{'Energia Ativa Importada','125,43 MWh','100,0%','115,36 MWh','+8,7%';...
                    'Cargas Produtivas','76,15 MWh','60,7%','70,21 MWh','+8,5%';...
                    'Cargas Auxiliares','31,82 MWh','25,4%','29,21 MWh','+8,9%';...
                    'Perdas Elétricas','9,86 MWh','7,9%','8,61 MWh','+14,5%';...
                    'Outros','7,60 MWh','6,0%','7,33 MWh','+3,7%'},...
                'RowName',{});
            app.AnalysisTables{3} = uitable(bg_,'FontSize',8,...
                'ColumnName',{'Setor / Circuito','Energia (MWh)','% do Total','Custo (R$)'},...
                'Data',{'Produção','45,21','36,1%','28.321,45';'Utilidades','23,68','18,9%','16.372,12';...
                    'HVAC','18,44','14,7%','13.024,93';'Iluminação','12,31','9,8%','8.653,22';...
                    'Escritórios/TI','9,79','7,8%','6.705,34'},...
                'RowName',{});
            capP = uipanel(bg_,'Title','Sugestão de Bancos de Capacitores','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            capG = uigridlayout(capP,[6 1]); capG.RowHeight=repmat({26},1,6); capG.Padding=[8 6 8 6];
            uilabel(capG,'Text','Objetivo: FP = 0,98 indutivo','FontSize',9,'FontWeight','bold');
            uilabel(capG,'Text','FP Atual: 0,921 ind.  |  Correção Necessária: 420 kVAr','FontSize',9);
            uilabel(capG,'Text','Bancos Sugeridos:  3 × 150 kVAr','FontSize',9.5,'FontColor',[0.06 0.40 0.72],'FontWeight','bold');
            uilabel(capG,'Text','Total Instalado:  500 kVAr  (com reserva de 80 kVAr)','FontSize',9);
            uilabel(capG,'Text','Multa Estimada:  R$ 4.441,70 / mês','FontSize',9,'FontColor',[0.80 0.20 0.06],'FontWeight','bold');
            uilabel(capG,'Text','Payback Est.:  4,2 meses','FontSize',9,'FontColor',[0.12 0.54 0.20],'FontWeight','bold');
            try, app.plotAnalise(2); app.plotAnalise(3); catch, end
        end

        function createMetrologiaTCTPSegurancaTab(app)
            app.ensureAnalysisStorage();
            tab = uitab(app.TabGroup,'Title','Metrologia, TC/TP e Segurança');
            shell = uigridlayout(tab,[1 1]); shell.Padding=[0 0 0 0];
            sub = uitabgroup(shell);

            % ── Sub-aba: Metrologia ──
            met = uitab(sub,'Title','Metrologia');
            gm = uigridlayout(met,[2 2]); gm.RowHeight={'1x',160}; gm.ColumnWidth={'1x',400}; gm.Padding=[8 8 8 8]; gm.ColumnSpacing=6; gm.RowSpacing=5;
            orcP = uipanel(gm,'Title','Orçamento de Incerteza (GUM:2008)','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            orcP.Layout.Row=1; orcP.Layout.Column=1;
            orcG = uigridlayout(orcP,[1 1]); orcG.Padding=[4 4 4 4];
            uitable(orcG,'Data',{'Calibração do instrumento','0,10%','B','Normal','3','0,06';...
                'Resolução (quantização)','0,05%','B','Retangular','2','0,03';...
                'Variação de temperatura','0,08%','B','Normal','2','0,06';...
                'Repetibilidade (Tipo A)','0,12%','A','Experimental','5','0,12';...
                'Estabilidade de longo prazo','0,05%','B','Normal','3','0,03';...
                '— Incerteza Combinada uc —','0,178%','','','','';...
                '— Incerteza Expandida U (k=2) —','0,356%','','','',''},...
                'ColumnName',{'Componente de Incerteza','ui','Tipo','Distribuição','ν','ci·ui'},'RowName',{},'FontSize',8);
            axm = uiaxes(gm); axm.Layout.Row=1; axm.Layout.Column=2;
            title(axm,'Curva de Erro e Repetibilidade (%)');
            app.MetrologyTable = uitable(gm,'FontSize',8,'Data',app.metrologiaData());
            app.MetrologyTable.Layout.Row=2; app.MetrologyTable.Layout.Column=1;
            calP = uipanel(gm,'Title','Histórico de Calibração','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            calP.Layout.Row=2; calP.Layout.Column=2;
            calG = uigridlayout(calP,[1 1]); calG.Padding=[4 4 4 4];
            uitable(calG,'Data',{'PQA-5000 #12345','Tensão','28/02/2024','28/02/2025','0,18%','Calibrado';...
                'PQA-5000 #12345','Corrente','28/02/2024','28/02/2025','0,22%','Calibrado';...
                'PMU-120 #01','Sincrofasor','15/01/2024','15/01/2025','0,12%','Calibrado';...
                'TC #07 5A/5A','Relação','10/03/2024','10/03/2025','0,08%','Calibrado'},...
                'ColumnName',{'Instrumento','Grandeza','Data Cal.','Próx. Cal.','Erro Max.','Status'},'RowName',{},'FontSize',8);
            try, app.plotMetrologia(axm); catch, end

            % ── Sub-aba: TC/TP ──
            tctp = uitab(sub,'Title','TC / TP');
            gt = uigridlayout(tctp,[2 3]); gt.RowHeight={'1x',140}; gt.ColumnWidth={'1x','1x','1x'}; gt.Padding=[8 8 8 8]; gt.ColumnSpacing=6; gt.RowSpacing=5;
            tcP = uipanel(gt,'Title','Especificações do TC','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            tcP.Layout.Row=1; tcP.Layout.Column=1;
            tcG_ = uigridlayout(tcP,[6 2]); tcG_.Padding=[6 6 6 6]; tcG_.RowHeight=repmat({26},1,6);
            tcLabels = {'Relação Nominal:','Classe de Exatidão:','Carga Nominal (VA):','Corrente Primária:','Corrente Secundária:','Fator de Sobrecarga:'};
            tcVals   = {'5000/5 A (1000:1)','Classe 0,3','25 VA','5000 A','5 A','1,2×'};
            for i=1:6
                uilabel(tcG_,'Text',tcLabels{i},'FontSize',9,'FontWeight','bold');
                uilabel(tcG_,'Text',tcVals{i},'FontSize',9,'FontColor',[0.06 0.40 0.72]);
            end
            tpP = uipanel(gt,'Title','Especificações do TP','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            tpP.Layout.Row=1; tpP.Layout.Column=2;
            tpG_ = uigridlayout(tpP,[6 2]); tpG_.Padding=[6 6 6 6]; tpG_.RowHeight=repmat({26},1,6);
            tpLabels = {'Relação Nominal:','Classe de Exatidão:','Carga Nominal (VA):','Tensão Primária:','Tensão Secundária:','Fator de Tensão:'};
            tpVals   = {'13800/115 V (120:1)','Classe 0,3','50 VA','13.800 V','115 V','1,2×'};
            for i=1:6
                uilabel(tpG_,'Text',tpLabels{i},'FontSize',9,'FontWeight','bold');
                uilabel(tpG_,'Text',tpVals{i},'FontSize',9,'FontColor',[0.55 0.16 0.68]);
            end
            app.AnalysisAxes{6} = uiaxes(gt); app.AnalysisAxes{6}.Layout.Row=1; app.AnalysisAxes{6}.Layout.Column=3;
            title(app.AnalysisAxes{6},'Curva de Erro TC / TP (%)');
            tctpTbl = uitable(gt,'FontSize',8,...
                'Data',{'TC #07','Fase A','0,08%','-0,12°','0,3','25 VA','Conforme';...
                    'TC #08','Fase B','0,11%','-0,09°','0,3','25 VA','Conforme';...
                    'TC #09','Fase C','0,07%','-0,14°','0,3','25 VA','Conforme';...
                    'TP #04','Fase A','0,06%','-0,10°','0,3','50 VA','Conforme';...
                    'TP #05','Fase B','0,09%','-0,08°','0,3','50 VA','Conforme'},...
                'ColumnName',{'Instrumento','Fase','Erro Rel.','Erro de Fase','Classe','Carga','Status'},...
                'RowName',{});
            tctpTbl.Layout.Row=2; tctpTbl.Layout.Column=[1 3];
            try, app.plotAnalise(6); catch, end

            % ── Sub-aba: Osciloscópio ──
            app.createAnalysisPane(uitab(sub,'Title','Osciloscópio'),7,'Osciloscópio virtual e aquisição em tempo real','Gerar aquisição');

            % ── Sub-aba: Segurança ──
            seg = uitab(sub,'Title','Segurança e LOTO');
            gs = uigridlayout(seg,[2 3]); gs.RowHeight={'1x',130}; gs.ColumnWidth={'1x','1x','1x'}; gs.Padding=[8 8 8 8]; gs.ColumnSpacing=6; gs.RowSpacing=5;
            ax2 = uiaxes(gs); ax2.Layout.Row=1; ax2.Layout.Column=1;
            axis(ax2,'off'); title(ax2,'Diagrama de Segurança em Medições');
            try, app.desenharSeguranca(ax2); catch, end
            app.SafetyTable = uitable(gs,'FontSize',8,'Data',app.segurancaData());
            app.SafetyTable.Layout.Row=1; app.SafetyTable.Layout.Column=[2 3];
            lotoP = uipanel(gs,'Title','Procedimento LOTO — Isolamento e Travamento','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            lotoP.Layout.Row=2; lotoP.Layout.Column=1;
            loG = uigridlayout(lotoP,[3 2]); loG.Padding=[6 4 6 4];
            loSteps = {'1. Notificar equipe','2. Identificar fontes de energia','3. Desligar fontes','4. Isolar energia (Lock)','5. Verificar isolamento','6. Executar e reativar'};
            for i=1:6, uicheckbox(loG,'Text',loSteps{i},'Value',false,'FontSize',8.5); end
            epiP = uipanel(gs,'Title','EPI Necessários','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            epiP.Layout.Row=2; epiP.Layout.Column=2;
            epiG = uigridlayout(epiP,[3 2]); epiG.Padding=[6 4 6 4];
            epis = {'Luvas Isolantes BT','Capacete Classe B','Óculos de Proteção','Botina Dielétrica','Avental de Arco Elétrico','Detector de Tensão'};
            for i=1:6, uicheckbox(epiG,'Text',epis{i},'Value',true,'FontSize',8.5); end
            riskP = uipanel(gs,'Title','Matriz de Risco','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            riskP.Layout.Row=2; riskP.Layout.Column=3;
            rkG = uigridlayout(riskP,[1 1]); rkG.Padding=[4 4 4 4];
            uitable(rkG,'Data',{'Contato elétrico','Alta','Alta','Extremo','LOTO obrigatório';...
                'Arco elétrico','Média','Alta','Alto','EPI Nível 2';...
                'Quedas','Baixa','Alta','Médio','Cinto de segurança';...
                'Tensão de passo','Baixa','Média','Baixo','Sapatos dielétricos'},...
                'ColumnName',{'Perigo','Probabilidade','Severidade','Risco','Controle'},'RowName',{},'FontSize',7.5);
        end

        function createRelatoriosTab(app)
            tab = uitab(app.TabGroup,'Title','Relatórios');
            g = uigridlayout(tab,[3 1]); g.RowHeight={88,40,'1x'}; g.Padding=[8 8 8 8]; g.RowSpacing=5;

            % ── Header ──
            hdr = uipanel(g,'BorderType','none','BackgroundColor',[0.95 0.97 1.00]);
            hg = uigridlayout(hdr,[2 1]); hg.Padding=[10 8 10 4]; hg.RowHeight={28,'1x'};
            uilabel(hg,'Text','GERAÇÃO DE RELATÓRIOS','FontSize',14,'FontWeight','bold','FontColor',[0.06 0.20 0.38]);
            uilabel(hg,'Text','Configure, visualize e exporte relatórios profissionais de medições e qualidade de energia.',...
                'FontSize',9.5,'FontColor',[0.40 0.50 0.60]);

            % ── Action bar ──
            ab = uipanel(g,'BorderType','none');
            abg = uigridlayout(ab,[1 5]); abg.ColumnWidth={170,110,100,112,'1x'}; abg.Padding=[0 0 0 0];
            uibutton(abg,'push','Text','Gerar Relatório','FontSize',11,'FontWeight','bold',...
                'BackgroundColor',[0.07 0.40 0.72],'FontColor',[1 1 1],'ButtonPushedFcn',@(~,~)app.gerarRelatorio());
            uibutton(abg,'push','Text','Exportar Figuras','FontSize',10,'ButtonPushedFcn',@(~,~)app.exportarTodosGraficos());
            uibutton(abg,'push','Text','Exportar Tabelas','FontSize',10,'ButtonPushedFcn',@(~,~)app.exportarTabelas());
            uibutton(abg,'push','Text','Compartilhar','FontSize',10,'ButtonPushedFcn',@(~,~)app.gerarRelatorio());
            uilabel(abg,'Text','');

            % ── Main 5-section layout ──
            main = uipanel(g,'BorderType','none');
            mg = uigridlayout(main,[1 5]); mg.ColumnWidth={196,190,'1x',236,204}; mg.Padding=[0 0 0 0]; mg.ColumnSpacing=5;

            % 1. Seções
            sec1 = uipanel(mg,'Title','1. Seções do Relatório','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            s1g = uigridlayout(sec1,[13 1]); s1g.Padding=[6 6 6 6]; s1g.RowHeight=[{24};repmat({22},11,1);{26}];
            uilabel(s1g,'Text','Selecionar tudo','FontSize',8.5,'FontColor',[0.06 0.40 0.72],'HorizontalAlignment','right');
            relSecoes = {'Capa e Identificação','Sumário Executivo','Resumo de Conformidade','Descrição da Instalação',...
                'Metodologia e Normas','Resultados e Análises','Qualidade de Energia','Eventos e Ocorrências',...
                'Conclusões e Recomendações','Apêndices e Dados Brutos'};
            for i=1:10, uicheckbox(s1g,'Text',relSecoes{i},'Value',true,'FontSize',8.5); end
            uibutton(s1g,'push','Text','Reordenar / Redefinir','FontSize',8.5);

            % 2. Inclusões
            sec2 = uipanel(mg,'Title','2. Inclusões no Relatório','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            s2g = uigridlayout(sec2,[6 1]); s2g.Padding=[6 6 6 6]; s2g.RowHeight=repmat({36},1,6);
            inclItems = {'Gráficos e Curvas','Tabelas de Resultados','Diagramas Fasoriais','Diagramas de Circuitos','Resumo de Conformidade','Logs de Eventos'};
            for i=1:6
                ig = uigridlayout(s2g,[1 3]); ig.ColumnWidth={'1x',48,76}; ig.Padding=[0 2 0 2];
                uicheckbox(ig,'Text',inclItems{i},'Value',true,'FontSize',8.5);
                uilabel(ig,'Text','ON','FontColor',[0.07 0.40 0.72],'HorizontalAlignment','center','FontSize',9,'FontWeight','bold');
                uibutton(ig,'push','Text','Configurar','FontSize',7.5);
            end

            % 3. Preview
            sec3 = uipanel(mg,'Title','3. Pré-visualização do Relatório','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            s3g = uigridlayout(sec3,[1 1]); s3g.Padding=[4 4 4 4];
            uitextarea(s3g,'Editable','off','FontSize',9,'Value',{...
                '══════════════════════════════════════════',...
                '     RELATÓRIO DE QUALIDADE DE ENERGIA',...
                '     Conf. IEEE 519:2014 e PRODIST Módulo 8',...
                '     Relatório N°: RQE-2024-05131   31/05/2024',...
                '══════════════════════════════════════════',...
                '','  IDENTIFICAÇÃO',...
                '  Título: Análise da Qualidade de Energia',...
                '  Instalação: Subestação Principal',...
                '  Endereço: Av. das Indústrias, 1234 - SP',...
                '  Instrumento: PQAnalyzer PQA-5000 #12345',...
                '','  SUMÁRIO EXECUTIVO',...
                '  Conformidade Geral: 88%  (Conforme)',...
                '  Eventos Registrados: 128',...
                '  THD-I Médio: 6,87%    FP: 0,92 ind.',...
                '  Energia Ativa: 125,43 MWh',...
                '','  RESUMO DE CONFORMIDADE (IEEE 519:2014)',...
                '  Tensão RMS: ±3,2% .............. Dentro do limite',...
                '  THD de Tensão: 2,34% ........... Conforme',...
                '  THD de Corrente: 6,87% ......... Conforme',...
                '  Frequência: 60,02 Hz ........... Conforme',...
                '','  RESULTADOS E ANÁLISES',...
                '  [Gráficos e tabelas serão inseridos aqui]'});

            % 4. Opções de exportação
            sec4 = uipanel(mg,'Title','4. Opções de Exportação','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            s4g = uigridlayout(sec4,[8 1]); s4g.Padding=[6 6 6 6];
            s4g.RowHeight={20,22,22,22,22,8,22,22};
            uilabel(s4g,'Text','Formato do Relatório:','FontWeight','bold','FontSize',8.5);
            uicheckbox(s4g,'Text','PDF (Recomendado)','Value',true,'FontSize',8.5);
            uicheckbox(s4g,'Text','DOCX (Word)','Value',false,'FontSize',8.5);
            uicheckbox(s4g,'Text','HTML (Página Web)','Value',false,'FontSize',8.5);
            uicheckbox(s4g,'Text','TXT (Texto simples)','Value',false,'FontSize',8.5);
            uilabel(s4g,'Text','');
            uilabel(s4g,'Text','Resolução de Figuras:','FontWeight','bold','FontSize',8.5);
            uidropdown(s4g,'Items',{'Alta (300 dpi)','Muito Alta (600 dpi)','Tela (96 dpi)'},'FontSize',8.5);

            % 5. Dados do relatório
            sec5 = uipanel(mg,'Title','5. Dados do Relatório','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            s5g = uigridlayout(sec5,[8 2]); s5g.Padding=[6 6 6 6]; s5g.RowHeight=repmat({28},1,8);
            rCampos = {'Autor:','Instituição:','Título:','Período:','Instalação:','Norma Principal:'};
            rDefaults = {'Engenheiro Responsável','Sua Empresa / Instituição','Análise da Qualidade de Energia',...
                '01/05/2024 — 31/05/2024','Subestação Principal','IEEE 519:2014'};
            for i=1:6
                uilabel(s5g,'Text',rCampos{i},'FontSize',8.5,'FontWeight','bold');
                uieditfield(s5g,'text','Value',rDefaults{i},'FontSize',8.5);
            end
            uibutton(s5g,'push','Text','Exportar Figuras','FontSize',9,'ButtonPushedFcn',@(~,~)app.exportarTodosGraficos());
            uibutton(s5g,'push','Text','Exportar Tabelas','FontSize',9,'ButtonPushedFcn',@(~,~)app.exportarTabelas());
        end
        function createSimulacaoTab(app)
            tab = uitab(app.TabGroup,'Title','Simulação');
            root = uigridlayout(tab,[1 2]); root.ColumnWidth={252,'1x'}; root.Padding=[6 6 6 6]; root.ColumnSpacing=6;

            % ── Painel esquerdo: seletor de tipo ──
            leftP = uipanel(root,'BorderType','none');
            leftG = uigridlayout(leftP,[3 1]); leftG.RowHeight={290,'1x',38}; leftG.Padding=[0 0 0 0]; leftG.RowSpacing=5;

            typeP = uipanel(leftG,'Title','Tipo de Simulação','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            typG = uigridlayout(typeP,[8 1]); typG.Padding=[4 6 4 6]; typG.RowHeight=repmat({30},1,8); typG.RowSpacing=2;
            simTypes  = {'CC resistivo','RLC série CA','RLC paralelo CA','Trifásico equilibrado Y',...
                'Correção de FP','Ressonância RLC','Variação de carga'};
            simDescr  = {'Resistor puro em CC','Série: Z=R+j(ωL−1/ωC)','Paralelo: admitâncias',...
                '3F equilibrado, ligação Y','Banco de capacitores','Resposta em frequência','Varredura paramétrica'};
            simIcons  = {'CC','RLC','RLC',char(9651),'FP','~','VAR'};
            app.SimModeDrop = uidropdown(typG,'Items',simTypes,'FontSize',8.5,'Visible','off');
            mkSimCb = @(n) @(~,~) app.selectSimType(n);
            for i=1:7
                cardG = uigridlayout(typG,[1 2]); cardG.ColumnWidth={36,'1x'}; cardG.Padding=[2 2 2 2]; cardG.ColumnSpacing=5;
                if i==1
                    iconP=uipanel(cardG,'BackgroundColor',[0.07 0.40 0.72],'BorderType','none');
                    iconG=uigridlayout(iconP,[1 1]); iconG.Padding=[0 0 0 0];
                    uilabel(iconG,'Text',simIcons{i},'FontSize',7.5,'FontWeight','bold','FontColor',[1 1 1],'HorizontalAlignment','center');
                    txtP=uipanel(cardG,'BackgroundColor',[0.92 0.95 1.00],'BorderType','none');
                else
                    iconP=uipanel(cardG,'BackgroundColor',[0.78 0.86 0.96],'BorderType','none');
                    iconG=uigridlayout(iconP,[1 1]); iconG.Padding=[0 0 0 0];
                    uilabel(iconG,'Text',simIcons{i},'FontSize',7.5,'FontWeight','bold','FontColor',[0.20 0.35 0.55],'HorizontalAlignment','center');
                    txtP=uipanel(cardG,'BackgroundColor',[1 1 1],'BorderType','none');
                end
                txtG=uigridlayout(txtP,[2 1]); txtG.Padding=[2 1 4 1]; txtG.RowHeight={14,13}; txtG.RowSpacing=0;
                uilabel(txtG,'Text',simTypes{i},'FontSize',8,'FontWeight','bold','FontColor',[0.10 0.20 0.38]);
                uilabel(txtG,'Text',simDescr{i},'FontSize',7,'FontColor',[0.40 0.48 0.58]);
                txtP.ButtonDownFcn = mkSimCb(i);
                iconP.ButtonDownFcn = mkSimCb(i);
            end

            parP = uipanel(leftG,'Title','Parâmetros do Circuito','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            parG = uigridlayout(parP,[6 2]); parG.Padding=[6 4 6 4]; parG.RowHeight=repmat({26},1,6); parG.RowSpacing=2;
            paramLabels = {'R (Ω):','L (H):','C (F):','Freq. (Hz):','Vs (V):','Ângulo (°):'};
            paramDefaults = {10, 0.05, 0.0001, 60, 127, 0};
            for i=1:6
                uilabel(parG,'Text',paramLabels{i},'FontSize',9,'FontWeight','bold');
                uieditfield(parG,'numeric','Value',paramDefaults{i},'FontSize',9,...
                    'ValueChangedFcn',@(~,~)app.simularCircuito());
            end

            runG = uigridlayout(leftG,[1 2]); runG.Padding=[0 0 0 0]; runG.ColumnSpacing=5;
            uibutton(runG,'push','Text','Executar','FontSize',10,'FontWeight','bold',...
                'BackgroundColor',[0.07 0.40 0.72],'FontColor',[1 1 1],'ButtonPushedFcn',@(~,~)app.simularCircuito());
            uibutton(runG,'push','Text','Limpar','FontSize',10,'ButtonPushedFcn',@(~,~)app.refreshAll());

            % ── Painel direito: barra de ação + resultados + gráficos ──
            rightP = uipanel(root,'BorderType','none');
            rightG = uigridlayout(rightP,[4 1]); rightG.RowHeight={38,130,'1x',92}; rightG.Padding=[0 0 0 0]; rightG.RowSpacing=5;

            % Barra de ação
            actP = uipanel(rightG,'BorderType','none','BackgroundColor',[0.06 0.14 0.28]);
            actG = uigridlayout(actP,[1 7]); actG.ColumnWidth={96,76,90,140,126,'1x',170};
            actG.Padding=[5 4 5 4]; actG.ColumnSpacing=5;
            uibutton(actG,'push','Text','▶  Executar','FontSize',9,'FontWeight','bold',...
                'BackgroundColor',[0.07 0.52 0.18],'FontColor',[1 1 1],'ButtonPushedFcn',@(~,~)app.simularCircuito());
            uibutton(actG,'push','Text','⏸  Pausar','FontSize',9,'BackgroundColor',[0.20 0.28 0.40],'FontColor',[0.85 0.88 0.95]);
            uibutton(actG,'push','Text','⟳  Reiniciar','FontSize',9,'BackgroundColor',[0.20 0.28 0.40],'FontColor',[0.85 0.88 0.95],...
                'ButtonPushedFcn',@(~,~)app.refreshAll());
            uibutton(actG,'push','Text','Comparar Cenários','FontSize',9,'BackgroundColor',[0.20 0.28 0.40],'FontColor',[0.85 0.88 0.95]);
            uibutton(actG,'push','Text','Exportar Resultados','FontSize',9,'BackgroundColor',[0.20 0.28 0.40],'FontColor',[0.85 0.88 0.95],...
                'ButtonPushedFcn',@(~,~)app.exportarGrafico(app.AxSimTempo));
            uilabel(actG,'Text','');
            statLbl = uigridlayout(actG,[1 2]); statLbl.Padding=[0 0 0 0]; statLbl.ColumnSpacing=8;
            uilabel(statLbl,'Text','● Pronto','FontSize',9,'FontColor',[0.30 0.90 0.40]);
            uilabel(statLbl,'Text','Tempo: 0,00 s','FontSize',9,'FontColor',[0.70 0.80 0.95]);

            % Tabela de resultados
            resP = uipanel(rightG,'Title','Resultados da Simulação','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            resG = uigridlayout(resP,[1 1]); resG.Padding=[4 4 4 4];
            app.SimResultTable = uitable(resG,'FontSize',8.5,...
                'ColumnName',{'Grandeza','Símbolo','Valor','Unidade','Observação'},...
                'Data',{'Impedância','Z','10,05','Ω','|Z|=√(R²+(XL−XC)²)';...
                    'Corrente RMS','I','12,64','A','V/Z';...
                    'Tensão no R','VR','126,4','V','I×R';...
                    'Tensão no L','VL','47,7','V','I×XL';...
                    'Tensão no C','VC','23,8','V','I×XC';...
                    'Potência Ativa','P','1.600','W','I²×R';...
                    'Potência Reativa','Q','604','VAr','I²×(XL−XC)';...
                    'Pot. Aparente','S','1.710','VA','V×I';...
                    'Fator de Potência','FP','0,936','—','cos(φ)=P/S'},...
                'RowName',{});

            % 2×2 gráficos
            chartP = uipanel(rightG,'BorderType','none');
            chartG = uigridlayout(chartP,[2 2]); chartG.Padding=[0 0 0 0]; chartG.RowSpacing=5; chartG.ColumnSpacing=5;
            app.AxSimTempo = uiaxes(chartG); title(app.AxSimTempo,'Formas de Onda — v(t), i(t)');
            xlabel(app.AxSimTempo,'Tempo (ms)'); ylabel(app.AxSimTempo,'V / A');
            app.AxSimFasor = uiaxes(chartG); title(app.AxSimFasor,'Diagrama Fasorial');
            app.AxSimPot = uiaxes(chartG); title(app.AxSimPot,'Potências no Tempo — p(t), P, Q, S');
            xlabel(app.AxSimPot,'Tempo (ms)'); ylabel(app.AxSimPot,'W / VAr');
            axFreq = uiaxes(chartG); title(axFreq,'Resposta em Frequência (Bode / |Z|)');
            xlabel(axFreq,'Frequência (Hz)'); ylabel(axFreq,'|Z| (Ω)');

            % Métricas avançadas + exportação
            advP = uipanel(rightG,'BorderType','none');
            advG = uigridlayout(advP,[1 3]); advG.Padding=[0 0 0 0]; advG.ColumnSpacing=6;

            metP = uipanel(advG,'Title','Métricas Avançadas','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            metG = uigridlayout(metP,[2 4]); metG.Padding=[4 4 4 4]; metG.RowHeight={22,22};
            mets={'Rendimento η','Fator Q','Frequência ω₀','Largura de Banda Δf'};
            mvals={'98,2 %','18,8','376,99 rad/s','20,1 Hz'};
            for i=1:4
                uilabel(metG,'Text',mets{i},'FontSize',7.5,'FontWeight','bold','FontColor',[0.35 0.45 0.60]);
                uilabel(metG,'Text',mvals{i},'FontSize',8.5,'FontWeight','bold','FontColor',[0.06 0.20 0.50]);
            end

            compP = uipanel(advG,'Title','Comparação de Cenários','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            compG = uigridlayout(compP,[1 1]); compG.Padding=[4 4 4 4];
            uitable(compG,'FontSize',8,...
                'ColumnName',{'Cenário','R (Ω)','L (H)','f (Hz)','I (A)','FP'},...
                'Data',{'Caso Ativo','10','0,05','60','12,64','0,936';'Caso Base','10','0,03','60','14,21','0,963'},...
                'RowName',{});

            expP = uipanel(advG,'Title','Exportação Rápida','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            expG = uigridlayout(expP,[2 2]); expG.Padding=[6 4 6 4]; expG.RowHeight={28,28};
            exBtns={'Gráficos PNG','Dados CSV','Relatório PDF','MATLAB Script'};
            exClrs={[0.06 0.40 0.72],[0.04 0.52 0.34],[0.86 0.38 0.06],[0.40 0.40 0.40]};
            for i=1:4
                uibutton(expG,'push','Text',exBtns{i},'FontSize',8.5,...
                    'BackgroundColor',exClrs{i},'FontColor',[1 1 1]);
            end
        end

        function createFasoresTab(app)
            tab = uitab(app.TabGroup,'Title','Fasores / Trifásico');
            g = uigridlayout(tab,[3 1]); g.RowHeight={46,'1x',200}; g.Padding=[8 6 8 6]; g.RowSpacing=5;

            % ── Action bar ──
            ab = uipanel(g,'BorderType','none','BackgroundColor',[0.96 0.97 0.99]);
            abl = uigridlayout(ab,[1 8]); abl.ColumnWidth={120,170,170,150,150,'1x',100,140};
            abl.Padding=[6 5 6 5]; abl.ColumnSpacing=6;
            uidropdown(abl,'Items',{'31/05/2024 14:25:18','Última aquisição','Agora'},'FontSize',9);
            uidropdown(abl,'Items',{'10 ciclos (166,67 ms)','1 ciclo','100 ms','1 s'},'FontSize',9);
            uidropdown(abl,'Items',{'Trifásico 3F + N','Monofásico','Bifásico'},'FontSize',9);
            uidropdown(abl,'Items',{'60,00 Hz','50,00 Hz','Auto-detectar'},'FontSize',9);
            uidropdown(abl,'Items',{'FFT (Hann)','DFT','Goertzel'},'FontSize',9);
            uilabel(abl,'Text','');
            uibutton(abl,'push','Text','Congelar','FontSize',9,'ButtonPushedFcn',@(~,~)[]);
            uibutton(abl,'push','Text','Atualizar Fasores','FontSize',9,...
                'BackgroundColor',[0.07 0.40 0.72],'FontColor',[1 1 1],...
                'ButtonPushedFcn',@(~,~)app.plotFasores());

            % ── Main content: 3 columns ──
            mc = uipanel(g,'BorderType','none');
            mg = uigridlayout(mc,[1 3]); mg.ColumnWidth={420,'1x',330}; mg.Padding=[0 0 0 0]; mg.ColumnSpacing=6;

            % Left: phasor diagram + sequence
            lp = uipanel(mg,'BorderType','none');
            lpg = uigridlayout(lp,[2 1]); lpg.RowHeight={'1x',110}; lpg.Padding=[0 0 0 0]; lpg.RowSpacing=5;
            app.AxFasores = uiaxes(lpg); title(app.AxFasores,'Diagrama Fasorial (Tensões e Correntes)');
            seqP = uipanel(lpg,'BorderType','none');
            seqg = uigridlayout(seqP,[1 2]); seqg.Padding=[0 0 0 0]; seqg.ColumnSpacing=6;
            sqP = uipanel(seqg,'Title','Sequência de Fases','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            sqg = uigridlayout(sqP,[2 2]); sqg.Padding=[6 6 6 6];
            uilabel(sqg,'Text','ABC','FontSize',18,'FontWeight','bold','FontColor',[0.04 0.40 0.72],'HorizontalAlignment','center');
            btnABC = uibutton(sqg,'push','Text','ABC','FontSize',9,'BackgroundColor',[0.07 0.40 0.72],'FontColor',[1 1 1]); %#ok<NASGU>
            uilabel(sqg,'Text','Ordem Detectada','FontSize',8.5,'HorizontalAlignment','center');
            uibutton(sqg,'push','Text','ACB','FontSize',9);
            dqP = uipanel(seqg,'Title','Indicadores de Desequilíbrio','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            dqg = uigridlayout(dqP,[2 2]); dqg.Padding=[6 4 6 4];
            uilabel(dqg,'Text','VUF (%)','FontSize',9,'FontWeight','bold'); uilabel(dqg,'Text','IUF (%)','FontSize',9,'FontWeight','bold');
            uilabel(dqg,'Text','1,29','FontSize',16,'FontWeight','bold','FontColor',[0.04 0.52 0.34]);
            uilabel(dqg,'Text','1,94','FontSize',16,'FontWeight','bold','FontColor',[0.86 0.38 0.06]);

            % Center: componentes simétricas + potências
            cp_ = uipanel(mg,'BorderType','none');
            cpg_ = uigridlayout(cp_,[2 1]); cpg_.RowHeight={'1x',140}; cpg_.Padding=[0 0 0 0]; cpg_.RowSpacing=5;
            simP = uipanel(cpg_,'Title','Componentes Simétricas (Tensões)','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            simG = uigridlayout(simP,[5 1]); simG.Padding=[6 6 6 6]; simG.RowHeight=repmat({'1x'},1,5);
            uilabel(simG,'Text','● Sequência Positiva (1)','FontSize',9,'FontWeight','bold','FontColor',[0.04 0.52 0.34]);
            uilabel(simG,'Text','V1 = 127,02 ∠ 0,00° V  (100,0%)     Ia1 = 15,17 ∠ -20,30° A  (100,0%)','FontSize',9);
            uilabel(simG,'Text','● Sequência Negativa (2)','FontSize',9,'FontWeight','bold','FontColor',[0.86 0.38 0.06]);
            uilabel(simG,'Text','V2 = 1,62 ∠ -152,10° V  (1,28%)    Ia2 = 0,28 ∠ -172,20° A  (1,84%)','FontSize',9);
            uilabel(simG,'Text','● Sequência Zero (0):  V0 = 0,58 ∠ 10,40° V  (0,46%)','FontSize',9,'FontColor',[0.50 0.10 0.60]);
            potP = uipanel(cpg_,'Title','Potências Trifásicas','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            potG = uigridlayout(potP,[3 3]); potG.Padding=[6 4 6 4]; potG.RowHeight={16,'1x',22};
            pHdrs = {'P (kW)','Q (kVAr)','S (kVA)'};
            pCols = {[0.04 0.52 0.34],[0.55 0.16 0.68],[0.06 0.40 0.72]};
            pVals = {'3.121','1.842','3.623'};
            for i=1:3
                uilabel(potG,'Text',pHdrs{i},'FontSize',8.5,'FontWeight','bold','FontColor',pCols{i});
            end
            for i=1:3
                uilabel(potG,'Text',pVals{i},'FontSize',15,'FontWeight','bold','FontColor',pCols{i});
            end
            lFP  = uilabel(potG,'Text','FP: 0,861 ind.','FontSize',9,'FontWeight','bold','FontColor',[0.86 0.38 0.06]);
            lAng = uilabel(potG,'Text','φ: ∠ 30,6°','FontSize',9,'FontColor',[0.40 0.40 0.40]);
            lFrq = uilabel(potG,'Text','60,02 Hz','FontSize',9,'FontColor',[0.04 0.40 0.72]);
            lFP.Layout.Row=3; lFP.Layout.Column=1;
            lAng.Layout.Row=3; lAng.Layout.Column=2;
            lFrq.Layout.Row=3; lFrq.Layout.Column=3;

            % Right: Tensões + Correntes
            rp_ = uipanel(mg,'BorderType','none');
            rpg_ = uigridlayout(rp_,[2 1]); rpg_.RowHeight={'1x','1x'}; rpg_.Padding=[0 0 0 0]; rpg_.RowSpacing=5;
            tensP = uipanel(rpg_,'Title','Tensões','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            uitable(tensP,'Data',{'Va','127,13','0,00','127,13 ∠ 0,00','127,13','0,00';...
                'Vb','127,05','-120,05','127,05 ∠ -120,05','-63,49','-110,07';...
                'Vc','126,88','119,93','126,88 ∠ 119,93','-63,64','109,91';...
                'Vavg','127,02','—','—','—','—'},...
                'ColumnName',{'Fase','Mag. (V)','Âng. (°)','Polar (V∠°)','Re','Im'},'RowName',{},'FontSize',8);
            corrP = uipanel(rpg_,'Title','Correntes','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            app.FasorTable = uitable(corrP,'Data',{'Ia','15,23','-20,41','15,23 ∠ -20,41','14,30','-5,31';...
                'Ib','15,11','-140,35','15,11 ∠ -140,35','-11,58','-9,73';...
                'Ic','15,18','99,88','15,18 ∠ 99,88','-2,55','14,95';...
                'In','0,42','10,12','0,42 ∠ 10,12','0,41','0,07'},...
                'ColumnName',{'Fase','Mag. (A)','Âng. (°)','Polar (A∠°)','Re','Im'},'RowName',{},'FontSize',8);

            % ── Bottom: Table + export ──
            bp = uipanel(g,'BorderType','none');
            bg_ = uigridlayout(bp,[1 3]); bg_.ColumnWidth={'1x',260,220}; bg_.Padding=[0 0 0 0]; bg_.ColumnSpacing=6;
            uitable(bg_,'Data',{'Va','127,13','0,00','127,13','0,00','1,000','0,00';...
                'Vb','127,05','-120,05','-63,49','-110,07','0,999','-120,05';...
                'Vc','126,88','119,93','-63,64','109,91','0,998','119,93';...
                'Ia','15,23','-20,41','14,30','-5,31','1,003','-20,41';...
                'Ib','15,11','-140,35','-11,58','-9,73','0,995','-140,35';...
                'Ic','15,18','99,88','-2,55','14,95','1,001','99,88'},...
                'ColumnName',{'Fase','Mag.','Âng. (°)','Re','Im','Mag. (pu)','Âng. (pu)'},'RowName',{},'FontSize',8);
            angP = uipanel(bg_,'Title','Ângulos da Sequência','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            ang_g = uigridlayout(angP,[3 2]); ang_g.Padding=[6 6 6 6];
            angPairs = {'∠Vab','120,05°'; '∠Vbc','120,02°'; '∠Vca','119,88°'};
            for i=1:3
                uilabel(ang_g,'Text',angPairs{i,1},'FontSize',9,'FontWeight','bold');
                uilabel(ang_g,'Text',angPairs{i,2},'FontSize',10,'HorizontalAlignment','right');
            end
            expP = uipanel(bg_,'Title','Exportar Figura do Diagrama','FontWeight','bold','FontSize',9,'ForegroundColor',[0.06 0.20 0.38]);
            exp_g = uigridlayout(expP,[4 2]); exp_g.Padding=[6 4 6 4]; exp_g.RowHeight=repmat({30},1,4);
            for fmt={'PNG','EPS','JPEG','PDF'}
                uibutton(exp_g,'push','Text',['Exportar como ' char(fmt)],'FontSize',8.5,...
                    'ButtonPushedFcn',@(~,~)app.exportarGrafico(app.AxFasores));
            end
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
                if isempty(E), energiaMWh=0; else, energiaMWh=E(end)/1000; end
                demanda=app.demandSeries(15);
                D=max(demanda,[],'omitnan');
                FP=mean(d.FP,'omitnan');
                THDI=mean(d.THD_I_pct,'omitnan');
                THDV=mean(d.THD_V_pct,'omitnan');
                energiaReativa=sum(d.Q_kvar,'omitnan')/60/1000;
                try, nEventos=nnz(string(d.evento)~="normal"); catch, nEventos=0; end
                custo=energiaMWh*1000*0.75;
                vals={sprintf('%.2f',energiaMWh), sprintf('%.2f',energiaReativa), ...
                      sprintf('%.3f',D/1000),     sprintf('%.3f',FP), ...
                      sprintf('%.2f',THDV),        sprintf('%.2f',THDI), ...
                      sprintf('%d',nEventos),      sprintf('%.0f',custo)};
                subs={sprintf('+8,7%% vs. mes ant.'), ...
                      sprintf('+6,1%% vs. mes ant.'), ...
                      sprintf('Registrada as %s',app.peakTimeText(demanda)), ...
                      sprintf('Min: %.3f  Max: %.3f',min(d.FP,[],'omitnan'),max(d.FP,[],'omitnan')), ...
                      sprintf('Media das 3 fases'), ...
                      sprintf('Max: %.2f %%',max(d.THD_I_pct,[],'omitnan')), ...
                      sprintf('Detectados no periodo'), ...
                      sprintf('+9,2%% vs. mes ant.')};
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

        function selectSimType(app,idx)
            simTypes = {'CC resistivo','RLC série CA','RLC paralelo CA','Trifásico equilibrado Y',...
                'Correção de FP','Ressonância RLC','Variação de carga'};
            if idx>=1 && idx<=numel(simTypes)
                app.SimModeDrop.Value = simTypes{idx};
                app.simularCircuito();
            end
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
        function mostrarChecklist(app)
            tabs = app.TabGroup.Children;
            titles = {tabs.Title};
            idx = find(contains(titles,'Metrologia'),1);
            if ~isempty(idx)
                app.TabGroup.SelectedTab = tabs(idx);
            end
        end

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
