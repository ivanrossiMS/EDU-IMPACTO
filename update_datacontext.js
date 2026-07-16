const fs = require('fs');

const path = 'lib/dataContext.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add Context Definitions before DataContext
const newContexts = `
export interface GlobalDataState {
  perfis: Perfil[]; setPerfis: Setter<Perfil[]>
  perfisLoading: boolean
  loading?: boolean
  logSystemAction: (modulo: string, acao: string, descricao: string, payload?: any) => void
  wipeAll: () => void
}

export interface PedagogicoDataState {
  turmas: Turma[]; setTurmas: Setter<Turma[]>
  cfgTurnos: ConfigTurno[]; setCfgTurnos: Setter<ConfigTurno[]>
  cfgSituacaoAluno: ConfigSituacaoAluno[]; setCfgSituacaoAluno: Setter<ConfigSituacaoAluno[]>
  cfgGruposAlunos: ConfigGrupoAluno[]; setCfgGruposAlunos: Setter<ConfigGrupoAluno[]>
  cfgDisciplinas: ConfigDisciplina[]; setCfgDisciplinas: Setter<ConfigDisciplina[]>
  cfgNiveisEnsino: ConfigNivelEnsino[]; setCfgNiveisEnsino: Setter<ConfigNivelEnsino[]>
  cfgSeries: ConfigSerie[]; setCfgSeries: Setter<ConfigSerie[]>
  cfgTiposOcorrencia: ConfigTipoOcorrencia[]; setCfgTiposOcorrencia: Setter<ConfigTipoOcorrencia[]>
  cfgGruposAvaliacao: ConfigGrupoAvaliacao[]; setCfgGruposAvaliacao: Setter<ConfigGrupoAvaliacao[]>
  cfgArredondamentos: ConfigArredondamento[]; setCfgArredondamentos: Setter<ConfigArredondamento[]>
  cfgEsquemasAvaliacao: ConfigEsquemaAvaliacao[]; setCfgEsquemasAvaliacao: Setter<ConfigEsquemaAvaliacao[]>
  esquemaNota: EsquemaNota[]; setEsquemaNota: Setter<EsquemaNota[]>
  cfgFormulasNotas: FormulaNotas[]; setCfgFormulasNotas: Setter<FormulaNotas[]>
  cfgCalendarioLetivo: ConfigCalendarioLetivo[]; setCfgCalendarioLetivo: Setter<ConfigCalendarioLetivo[]>
}

export interface FinanceiroDataState {
  mantenedores: Mantenedor[]; setMantenedores: Setter<Mantenedor[]>
  cfgMetodosPagamento: MetodoPagamento[]; setCfgMetodosPagamento: Setter<MetodoPagamento[]>
  cfgCartoes: ConfigCartao[]; setCfgCartoes: Setter<ConfigCartao[]>
  cfgEventos: ConfigEvento[]; setCfgEventos: Setter<ConfigEvento[]>
  cfgGruposDesconto: ConfigGrupoDesconto[]; setCfgGruposDesconto: Setter<ConfigGrupoDesconto[]>
  cfgPadroesPagamento: ConfigPadraoPagamento[]; setCfgPadroesPagamento: Setter<ConfigPadraoPagamento[]>
  cfgPlanoContas: ConfigPlanoContas[]; setCfgPlanoContas: Setter<ConfigPlanoContas[]>
  cfgTiposDocumento: ConfigTipoDocumento[]; setCfgTiposDocumento: Setter<ConfigTipoDocumento[]>
  cfgConvenios: ConfigConvenio[]; setCfgConvenios: Setter<ConfigConvenio[]>
  movimentacoesManuais: MovimentacaoManual[]; setMovimentacoesManuais: Setter<MovimentacaoManual[]>
}

export interface OperacionalDataState {
  eventosAgenda: EventoAgenda[]; setEventosAgenda: Setter<EventoAgenda[]>; setLocalEventosAgenda?: Setter<EventoAgenda[]>
  ocorrencias: Ocorrencia[]; setOcorrencias: Setter<Ocorrencia[]>
  transferencias: Transferencia[]; setTransferencias: Setter<Transferencia[]>
  frequencias: RegistroFrequencia[]; setFrequencias: Setter<RegistroFrequencia[]>
  lancamentosNota: LancamentoNota[]; setLancamentosNota: Setter<LancamentoNota[]>
  tarefas: Tarefa[]; setTarefas: Setter<Tarefa[]>
  advertencias: Advertencia[]; setAdvertencias: Setter<Advertencia[]>
  adiantamentos: Adiantamento[]; setAdiantamentos: Setter<Adiantamento[]>
  leads: Lead[]; setLeads: Setter<Lead[]>
  comunicados: Comunicado[]; setComunicados: Setter<Comunicado[]>
}

const GlobalContext = createContext<GlobalDataState>({} as GlobalDataState)
const PedagogicoContext = createContext<PedagogicoDataState>({} as PedagogicoDataState)
const FinanceiroContext = createContext<FinanceiroDataState>({} as FinanceiroDataState)
const OperacionalContext = createContext<OperacionalDataState>({} as OperacionalDataState)

export function useGlobalData() { return useContext(GlobalContext) }
export function usePedagogicoData() { return useContext(PedagogicoContext) }
export function useFinanceiroData() { return useContext(FinanceiroContext) }
export function useOperacionalData() { return useContext(OperacionalContext) }

const DataContext = createContext<DataState>({
`;

content = content.replace('const DataContext = createContext<DataState>({', newContexts);

// 2. Replace contextValue with 4 separate values + legacy value
const legacyContextValueStart = '  const contextValue = useMemo(() => ({';

// We'll write a regex or just indexOf to find where contextValue starts and where the return statement is.
const contextValueIndex = content.indexOf(legacyContextValueStart);
if (contextValueIndex === -1) {
    console.error("Could not find contextValue");
    process.exit(1);
}

const returnStatementIndex = content.indexOf('  return <DataContext.Provider value={contextValue}>{children}</DataContext.Provider>');

const newValues = `
  const globalValue = useMemo(() => ({
    perfis, setPerfis, perfisLoading, wipeAll, logSystemAction
  }), [perfis, perfisLoading, wipeAll, logSystemAction]);

  const pedagogicoValue = useMemo(() => ({
    turmas, setTurmas: trackedSetters.setTurmas,
    cfgTurnos, setCfgTurnos: trackedSetters.setCfgTurnos,
    cfgSituacaoAluno, setCfgSituacaoAluno: trackedSetters.setCfgSituacaoAluno,
    cfgGruposAlunos, setCfgGruposAlunos: trackedSetters.setCfgGruposAlunos,
    cfgDisciplinas, setCfgDisciplinas: trackedSetters.setCfgDisciplinas,
    cfgNiveisEnsino, setCfgNiveisEnsino: trackedSetters.setCfgNiveisEnsino,
    cfgSeries, setCfgSeries: trackedSetters.setCfgSeries,
    cfgTiposOcorrencia, setCfgTiposOcorrencia: trackedSetters.setCfgTiposOcorrencia,
    cfgGruposAvaliacao, setCfgGruposAvaliacao: trackedSetters.setCfgGruposAvaliacao,
    cfgArredondamentos, setCfgArredondamentos: trackedSetters.setCfgArredondamentos,
    cfgEsquemasAvaliacao, setCfgEsquemasAvaliacao: trackedSetters.setCfgEsquemasAvaliacao,
    esquemaNota, setEsquemaNota: trackedSetters.setEsquemaNota,
    cfgFormulasNotas, setCfgFormulasNotas: trackedSetters.setCfgFormulasNotas,
    cfgCalendarioLetivo, setCfgCalendarioLetivo: trackedSetters.setCfgCalendarioLetivo,
  }), [turmas, cfgTurnos, cfgSituacaoAluno, cfgGruposAlunos, cfgDisciplinas, cfgNiveisEnsino, cfgSeries, cfgTiposOcorrencia, cfgGruposAvaliacao, cfgArredondamentos, cfgEsquemasAvaliacao, esquemaNota, cfgFormulasNotas, cfgCalendarioLetivo, trackedSetters]);

  const financeiroValue = useMemo(() => ({
    mantenedores, setMantenedores: trackedSetters.setMantenedores,
    cfgMetodosPagamento, setCfgMetodosPagamento: trackedSetters.setCfgMetodosPagamento,
    cfgCartoes, setCfgCartoes: trackedSetters.setCfgCartoes,
    cfgEventos, setCfgEventos: trackedSetters.setCfgEventos,
    cfgGruposDesconto, setCfgGruposDesconto: trackedSetters.setCfgGruposDesconto,
    cfgPadroesPagamento, setCfgPadroesPagamento: trackedSetters.setCfgPadroesPagamento,
    cfgPlanoContas, setCfgPlanoContas: trackedSetters.setCfgPlanoContas,
    cfgTiposDocumento, setCfgTiposDocumento: trackedSetters.setCfgTiposDocumento,
    cfgConvenios, setCfgConvenios: trackedSetters.setCfgConvenios,
    movimentacoesManuais, setMovimentacoesManuais: trackedSetters.setMovimentacoesManuais,
  }), [mantenedores, cfgMetodosPagamento, cfgCartoes, cfgEventos, cfgGruposDesconto, cfgPadroesPagamento, cfgPlanoContas, cfgTiposDocumento, cfgConvenios, movimentacoesManuais, trackedSetters]);

  const operacionalValue = useMemo(() => ({
    eventosAgenda, setEventosAgenda: trackedSetters.setEventosAgenda, setLocalEventosAgenda,
    ocorrencias, setOcorrencias: trackedSetters.setOcorrencias,
    transferencias, setTransferencias: trackedSetters.setTransferencias,
    frequencias, setFrequencias: trackedSetters.setFrequencias,
    lancamentosNota, setLancamentosNota: trackedSetters.setLancamentosNota,
    tarefas, setTarefas: trackedSetters.setTarefas,
    advertencias, setAdvertencias: trackedSetters.setAdvertencias,
    adiantamentos, setAdiantamentos: trackedSetters.setAdiantamentos,
    leads, setLeads: trackedSetters.setLeads,
    comunicados, setComunicados: trackedSetters.setComunicados,
  }), [eventosAgenda, ocorrencias, transferencias, frequencias, lancamentosNota, tarefas, advertencias, adiantamentos, leads, comunicados, trackedSetters, setLocalEventosAgenda]);

  const contextValue = useMemo(() => ({
    ...globalValue,
    ...pedagogicoValue,
    ...financeiroValue,
    ...operacionalValue,
    // Add explicitly any fields that were left out but required by DataState (alunos, contasPagar, etc)
    alunos: [], setAlunos: NOOP,
    funcionarios: [], setFuncionarios: NOOP,
    titulos: [], setTitulos: NOOP,
    contasPagar: [], setContasPagar: NOOP,
    caixasAbertos: [], setCaixasAbertos: NOOP,
    notasFiscais: [], setNotasFiscais: NOOP,
  }), [globalValue, pedagogicoValue, financeiroValue, operacionalValue]);

  return (
    <GlobalContext.Provider value={globalValue}>
      <PedagogicoContext.Provider value={pedagogicoValue}>
        <FinanceiroContext.Provider value={financeiroValue}>
          <OperacionalContext.Provider value={operacionalValue}>
            <DataContext.Provider value={contextValue}>
              {children}
            </DataContext.Provider>
          </OperacionalContext.Provider>
        </FinanceiroContext.Provider>
      </PedagogicoContext.Provider>
    </GlobalContext.Provider>
  )
}
`;

const part1 = content.slice(0, contextValueIndex);
const part2 = content.slice(returnStatementIndex + '  return <DataContext.Provider value={contextValue}>{children}</DataContext.Provider>\n}'.length);

const finalContent = part1 + newValues + part2;
fs.writeFileSync(path, finalContent);
console.log('dataContext.tsx updated');
