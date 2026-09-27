export interface EnqueteOpcao {
  id: string
  texto: string
  emoji?: string
  cor?: string
  votosCount?: number
}

export interface EnqueteVoto {
  usuarioId: string
  usuarioNome?: string
  usuarioFoto?: string
  usuarioTipo?: 'aluno' | 'responsavel' | 'colaborador' | 'admin'
  alunoId?: string
  alunoNome?: string
  opcoesIds: string[]
  votadoEm: string
}

export interface EnqueteData {
  id: string
  titulo?: string
  pergunta: string
  descricao?: string
  tipo: 'unica' | 'multipla'
  maxEscolhas?: number
  permitirAlterarVoto: boolean
  anonima: boolean
  visibilidadeResultados: 'imediato' | 'apos_votar' | 'somente_admin'
  dataExpiracao?: string | null
  encerrada?: boolean
  opcoes: EnqueteOpcao[]
  votos?: Record<string, EnqueteVoto>
  totalVotos?: number
  criadoEm?: string
  atualizadoEm?: string
  criadoPor?: {
    id: string
    nome: string
    cargo?: string
  }
}

export interface EnqueteOpcaoStat extends EnqueteOpcao {
  count: number
  percent: number
  isWinner: boolean
}

export interface EnqueteStats {
  totalVotantes: number
  totalVotos: number
  opcoes: EnqueteOpcaoStat[]
  hasWinningOption: boolean
}
