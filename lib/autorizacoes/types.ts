export interface AutorizacaoOpcao {
  id: string
  texto: string
  tipo: 'aprova' | 'recusa' | 'neutro'
  cor?: string
  emoji?: string
  respostasCount?: number
}

export interface AutorizacaoAssinaturaDigital {
  token: string
  dataHoraFormatada: string
  responsavelNome: string
  responsavelDoc?: string
  responsavelCpf?: string
  alunoNome?: string
}

export interface AutorizacaoResposta {
  usuarioId: string
  usuarioNome: string
  usuarioFoto?: string | null
  usuarioTipo?: 'responsavel' | 'aluno' | 'colaborador' | 'admin'
  alunoId?: string
  alunoNome?: string
  alunoTurma?: string
  opcaoId: string
  opcaoTexto: string
  tipoDecisao: 'aprova' | 'recusa' | 'neutro'
  observacoes?: string
  documentoResponsavel?: string
  cpfResponsavel?: string
  respondidoEm: string
  assinaturaDigital?: AutorizacaoAssinaturaDigital
}

export interface AutorizacaoData {
  id: string
  titulo: string
  tipoAutorizacao?: 'passeio' | 'saida_desacompanhada' | 'uso_imagem' | 'medicamento' | 'evento' | 'personalizado'
  descricao?: string
  termoTexto: string
  dataEvento?: string | null
  localEvento?: string
  valor?: string
  dataLimite?: string | null
  encerrada?: boolean
  permitirAlterarResposta: boolean
  exigirObservacoes: boolean
  observacoesLabel?: string
  exigirCpfResponsavel?: boolean
  exigirDocumentoResponsavel?: boolean
  opcoes: AutorizacaoOpcao[]
  respostas?: Record<string, AutorizacaoResposta>
  totalRespostas?: number
  criadoEm?: string
  atualizadoEm?: string
  criadoPor?: {
    id: string
    nome: string
    cargo?: string
  }
}

export interface AutorizacaoOpcaoStat extends AutorizacaoOpcao {
  count: number
  percent: number
}

export interface AutorizacaoStats {
  totalRespostas: number
  totalAprovados: number
  totalRecusados: number
  totalNeutros: number
  percentAprovados: number
  percentRecusados: number
  opcoes: AutorizacaoOpcaoStat[]
  respostasList: AutorizacaoResposta[]
  respostasComObservacoes: AutorizacaoResposta[]
}
