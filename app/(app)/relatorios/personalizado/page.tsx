'use client'

import {
  useState, useMemo, useCallback, useEffect, useRef
} from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Layers, Plus, Trash2, Edit3,
  Save, FileText, FileSpreadsheet, Printer, Search,
  ChevronDown, ChevronUp, Download, RefreshCw, Eye,
  EyeOff, Filter, X, Check, Loader2, AlertCircle,
  ClipboardList, Users, Settings, BookOpen, Star,
  ArrowUpDown, ArrowUp, ArrowDown, Copy, Table2
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { useData } from '@/lib/dataContext'
import { useApp } from '@/lib/context'

// ═══════════════════════════════════════════════════════════
// FIELD CATALOG — 133 campos mapeados exatamente das imagens
// ═══════════════════════════════════════════════════════════

interface FieldDef {
  key: string
  label: string
  category: string
  type: 'text' | 'date' | 'number' | 'badge' | 'currency'
  resolve: (row: any) => unknown
  badgeColors?: Record<string, string>
}

const CATEGORIES = [
  { key: 'aluno',      label: '── DADOS DO ALUNO ──',          icon: '👤', color: '#3b82f6' },
  { key: 'curso',      label: '── DADOS DO CURSO ──',          icon: '🎓', color: '#8b5cf6' },
  { key: 'mae',        label: '── DADOS DA MÃE ──',            icon: '👩', color: '#ec4899' },
  { key: 'pai',        label: '── DADOS DO PAI ──',            icon: '👨', color: '#0891b2' },
  { key: 'respPed',    label: '── RESP. PEDAGÓGICO ──',        icon: '📚', color: '#059669' },
  { key: 'respFin',    label: '── RESP. FINANCEIRO ──',        icon: '💰', color: '#d97706' },
  { key: 'outros',     label: '── OUTROS ──',                  icon: '⭐', color: '#6b7280' },
  { key: 'saude',      label: '── SAÚDE / OBSERVAÇÕES ──',     icon: '❤️', color: '#f43f5e' },
  { key: 'academico',  label: '── DESEMPENHO ACADÊMICO ──',    icon: '📊', color: '#7c3aed' },
  { key: 'turma',      label: '── DADOS DA TURMA ──',          icon: '🏫', color: '#0284c7' },
  { key: 'finAluno',   label: '── FINANCEIRO DO ALUNO ──',     icon: '🏦', color: '#16a34a' },
  { key: 'histMat',    label: '── HISTÓRICO MATRÍCULA ──',     icon: '📋', color: '#9333ea' },
  { key: 'sistema',    label: '── DADOS DO SISTEMA ──',        icon: '🔐', color: '#475569' },
  { key: 'turmaProf',  label: '── PROFESSOR / SALA ──',        icon: '👨‍🏫', color: '#b45309' },
]

const FIELD_CATALOG: FieldDef[] = [
  // ── DADOS DO ALUNO (39)
  { key: 'aluno_bairro',          label: 'Bairro',                   category: 'aluno',   type: 'text',   resolve: r => r.dados?.bairro || r.dados?.endereco?.bairro || '' },
  { key: 'aluno_celular',         label: 'Celular',                  category: 'aluno',   type: 'text',   resolve: r => r.dados?.celular || r.dados?.celular1 || '' },
  { key: 'aluno_cep',             label: 'CEP',                      category: 'aluno',   type: 'text',   resolve: r => r.dados?.cep || r.dados?.endereco?.cep || '' },
  { key: 'aluno_cert_cartorio',   label: 'Certidão de nasc. cartório',category: 'aluno',  type: 'text',   resolve: r => r.dados?.certidaoCartorio || r.dados?.certNasc?.cartorio || '' },
  { key: 'aluno_cert_liv',        label: 'Certidão de nasc. Liv. Fls.',category: 'aluno', type: 'text',   resolve: r => r.dados?.certidaoLivro || r.dados?.certNasc?.livro || '' },
  { key: 'aluno_cert_matr',       label: 'Certidão de nasc. Matr.',  category: 'aluno',   type: 'text',   resolve: r => r.dados?.certidaoMatricula || r.dados?.certNasc?.matricula || '' },
  { key: 'aluno_cert_nasc',       label: 'Certidão de Nasc.',        category: 'aluno',   type: 'text',   resolve: r => r.dados?.certidaoNasc || r.dados?.certNasc?.numero || '' },
  { key: 'aluno_cidade',          label: 'Cidade',                   category: 'aluno',   type: 'text',   resolve: r => r.dados?.cidade || r.dados?.endereco?.cidade || '' },
  { key: 'aluno_codigo',          label: 'Código',                   category: 'aluno',   type: 'text',   resolve: r => r.dados?.codigo || r.matricula || r.id?.slice(0,8) || '' },
  { key: 'aluno_complemento',     label: 'Complemento',              category: 'aluno',   type: 'text',   resolve: r => r.dados?.complemento || r.dados?.endereco?.complemento || '' },
  { key: 'aluno_cor_raca',        label: 'Cor/Raça',                 category: 'aluno',   type: 'text',   resolve: r => r.dados?.corRaca || r.dados?.raca || '' },
  { key: 'aluno_cpf',             label: 'CPF',                      category: 'aluno',   type: 'text',   resolve: r => r.dados?.cpf || r.cpf || '' },
  { key: 'aluno_data_nasc',       label: 'Data de Nascimento',       category: 'aluno',   type: 'date',   resolve: r => r.dados?.dataNasc || r.dados?.dataNascimento || r.data_nascimento || '' },
  { key: 'aluno_ddd',             label: 'DDD',                      category: 'aluno',   type: 'text',   resolve: r => r.dados?.ddd || r.dados?.ddd1 || '' },
  { key: 'aluno_email',           label: 'E-Mail',                   category: 'aluno',   type: 'text',   resolve: r => r.dados?.email || r.email || '' },
  { key: 'aluno_endereco',        label: 'Endereço',                 category: 'aluno',   type: 'text',   resolve: r => r.dados?.endereco?.logradouro || r.dados?.logradouro || r.dados?.endereco || '' },
  { key: 'aluno_estado_civil',    label: 'Estado Civil',             category: 'aluno',   type: 'text',   resolve: r => r.dados?.estadoCivil || '' },
  { key: 'aluno_grupo_sang',      label: 'Grupo Sang+Fator',         category: 'aluno',   type: 'text',   resolve: r => r.dados?.grupoSanguineo || r.dados?.tipoSanguineo || '' },
  { key: 'aluno_id_censo',        label: 'ID CENSO',                 category: 'aluno',   type: 'text',   resolve: r => r.dados?.idCenso || r.dados?.censo || '' },
  { key: 'aluno_idade',           label: 'Idade',                    category: 'aluno',   type: 'number', resolve: r => { const d = r.dados?.dataNasc || r.dados?.dataNascimento || r.data_nascimento; if (!d) return ''; const dt = new Date(d.includes('/') ? d.split('/').reverse().join('-') + 'T12:00' : d + 'T12:00'); return isNaN(dt.getTime()) ? '' : Math.floor((Date.now() - dt.getTime()) / (365.25*24*60*60*1000)) } },
  { key: 'aluno_matricula',       label: 'Matrícula',                category: 'aluno',   type: 'text',   resolve: r => r.matricula || r.dados?.matricula || '' },
  { key: 'aluno_n_espec_comp',    label: 'N. Espec. Complemento',    category: 'aluno',   type: 'text',   resolve: r => r.dados?.nEspecComplemento || r.dados?.necessidadesComp || '' },
  { key: 'aluno_n_especiais',     label: 'N. Especiais',             category: 'aluno',   type: 'text',   resolve: r => r.dados?.nEspeciais || r.dados?.necessidades || '' },
  { key: 'aluno_nacionalidade',   label: 'Nacionalidade',            category: 'aluno',   type: 'text',   resolve: r => r.dados?.nacionalidade || '' },
  { key: 'aluno_naturalidade',    label: 'Naturalidade',             category: 'aluno',   type: 'text',   resolve: r => r.dados?.naturalidade || '' },
  { key: 'aluno_nis',             label: 'NIS',                      category: 'aluno',   type: 'text',   resolve: r => r.dados?.nis || r.dados?.pis || '' },
  { key: 'aluno_nome',            label: 'Nome',                     category: 'aluno',   type: 'text',   resolve: r => r.nome || '' },
  { key: 'aluno_observacoes',     label: 'Observações',              category: 'aluno',   type: 'text',   resolve: r => r.dados?.observacoes || r.observacoes || '' },
  { key: 'aluno_rg_data',         label: 'RG data emissão',          category: 'aluno',   type: 'date',   resolve: r => r.dados?.rgDataEmissao || r.dados?.rgData || '' },
  { key: 'aluno_rg_org',          label: 'RG org emiss',             category: 'aluno',   type: 'text',   resolve: r => r.dados?.rgOrgao || r.dados?.rgEmissor || '' },
  { key: 'aluno_rg',              label: 'RG',                       category: 'aluno',   type: 'text',   resolve: r => r.dados?.rg || r.rg || '' },
  { key: 'aluno_rga',             label: 'RGA',                      category: 'aluno',   type: 'text',   resolve: r => r.dados?.rga || '' },
  { key: 'aluno_religiao',        label: 'Religião',                 category: 'aluno',   type: 'text',   resolve: r => r.dados?.religiao || '' },
  { key: 'aluno_sexo',            label: 'Sexo',                     category: 'aluno',   type: 'text',   resolve: r => r.dados?.sexo || r.sexo || '' },
  { key: 'aluno_telefone',        label: 'Telefone',                 category: 'aluno',   type: 'text',   resolve: r => r.dados?.telefone || r.dados?.fone || r.telefone || '' },
  { key: 'aluno_escola_origem',   label: 'Escola de Origem',         category: 'aluno',   type: 'text',   resolve: r => r.dados?.escolaOrigem || r.dados?.escolaAnterior || '' },
  { key: 'aluno_dt_primeira_mat', label: 'Data primeira matrícula',  category: 'aluno',   type: 'date',   resolve: r => r.dados?.dataPrimeiraMatricula || '' },
  { key: 'aluno_dt_ultima_mat',   label: 'Data última matrícula',    category: 'aluno',   type: 'date',   resolve: r => r.dados?.dataUltimaMatricula || '' },
  { key: 'aluno_tempo_escola',    label: 'Tempo de escola',          category: 'aluno',   type: 'text',   resolve: r => r.dados?.tempoEscola || '' },

  // ── DADOS DO CURSO (19)
  { key: 'curso_codigo',          label: 'Código',                   category: 'curso',   type: 'text',   resolve: r => r._mat?.codigo || r._mat?.id || '' },
  { key: 'curso_dt_req',          label: 'Data requerimento',        category: 'curso',   type: 'date',   resolve: r => r._mat?.dataRequerimento || r._mat?.created_at?.slice(0,10) || '' },
  { key: 'curso_dt_resultado',    label: 'Data resultado',           category: 'curso',   type: 'date',   resolve: r => r._mat?.dataResultado || '' },
  { key: 'curso_descricao',       label: 'Descrição',                category: 'curso',   type: 'text',   resolve: r => r._mat?.descricao || r._mat?.curso || '' },
  { key: 'curso_fase',            label: 'Fase',                     category: 'curso',   type: 'text',   resolve: r => r._mat?.fase || '' },
  { key: 'curso_grupo_cod',       label: 'Grupo Código',             category: 'curso',   type: 'text',   resolve: r => r._mat?.grupoCodigo || '' },
  { key: 'curso_grupo_desc',      label: 'Grupo Descrição',          category: 'curso',   type: 'text',   resolve: r => r._mat?.grupoDescricao || '' },
  { key: 'curso_nivel',           label: 'Nível',                    category: 'curso',   type: 'text',   resolve: r => r._mat?.nivel || r._mat?.nivelEnsino || '' },
  { key: 'curso_nr_chamada',      label: 'Nº Chamada',               category: 'curso',   type: 'number', resolve: r => r._mat?.numeroChamada || r._mat?.nr_chamada || '' },
  { key: 'curso_obs',             label: 'Observação',               category: 'curso',   type: 'text',   resolve: r => r._mat?.observacao || '' },
  { key: 'curso_origem_mat',      label: 'Origem da Matrícula',      category: 'curso',   type: 'text',   resolve: r => r._mat?.origemMatricula || r._mat?.origem || '' },
  { key: 'curso_resultado',       label: 'Resultado',                category: 'curso',   type: 'text',   resolve: r => r._mat?.resultado || '' },
  { key: 'curso_seq',             label: 'Seq.',                     category: 'curso',   type: 'number', resolve: r => r._mat?.sequencia || r._mat?.seq || '' },
  { key: 'curso_serie_cod',       label: 'Série código',             category: 'curso',   type: 'text',   resolve: r => r._mat?.serieCodigo || '' },
  { key: 'curso_serie_desc',      label: 'Série descrição',          category: 'curso',   type: 'text',   resolve: r => r._mat?.serie || '' },
  { key: 'curso_serie_grau',      label: 'Série Grau',               category: 'curso',   type: 'text',   resolve: r => r._mat?.serieGrau || r._mat?.grau || '' },
  { key: 'curso_turma',           label: 'Turma',                    category: 'curso',   type: 'text',   resolve: r => r._mat?.turma || r.turma || '' },
  { key: 'curso_turno',           label: 'Turno',                    category: 'curso',   type: 'text',   resolve: r => r._mat?.turno || r.turno || '' },
  { key: 'curso_franquia',        label: 'Franquia/Rede',            category: 'curso',   type: 'text',   resolve: r => r._mat?.franquia || r._mat?.rede || '' },

  // ── DADOS DA MÃE (14)
  { key: 'mae_celular',           label: 'Celular',                  category: 'mae',     type: 'text',   resolve: r => r._mae?.celular || r._mae?.dados?.celular || '' },
  { key: 'mae_codigo',            label: 'Código',                   category: 'mae',     type: 'text',   resolve: r => r._mae?.id || '' },
  { key: 'mae_cpf',               label: 'CPF',                      category: 'mae',     type: 'text',   resolve: r => r._mae?.cpf || r._mae?.dados?.cpf || '' },
  { key: 'mae_dt_nasc',           label: 'Data nascimento',          category: 'mae',     type: 'date',   resolve: r => r._mae?.dados?.dataNasc || r._mae?.dados?.dataNascimento || '' },
  { key: 'mae_ddd',               label: 'DDD',                      category: 'mae',     type: 'text',   resolve: r => r._mae?.dados?.ddd || '' },
  { key: 'mae_email',             label: 'E-mail',                   category: 'mae',     type: 'text',   resolve: r => r._mae?.email || r._mae?.dados?.email || '' },
  { key: 'mae_fone_com',          label: 'Fone comercial',           category: 'mae',     type: 'text',   resolve: r => r._mae?.dados?.foneComercial || r._mae?.dados?.telefoneComercial || '' },
  { key: 'mae_fone_res',          label: 'Fone residencial',         category: 'mae',     type: 'text',   resolve: r => r._mae?.dados?.foneResidencial || r._mae?.dados?.telefoneResidencial || '' },
  { key: 'mae_nacionalidade',     label: 'Nacionalidade',            category: 'mae',     type: 'text',   resolve: r => r._mae?.dados?.nacionalidade || '' },
  { key: 'mae_nome',              label: 'Nome',                     category: 'mae',     type: 'text',   resolve: r => r._mae?.nome || r.dados?.nomeMae || r.dados?.mae || '' },
  { key: 'mae_profissao',         label: 'Profissão',                category: 'mae',     type: 'text',   resolve: r => r._mae?.dados?.profissao || '' },
  { key: 'mae_rg',                label: 'RG',                       category: 'mae',     type: 'text',   resolve: r => r._mae?.rg || r._mae?.dados?.rg || '' },
  { key: 'mae_end_res',           label: 'Endereço Residêncial',     category: 'mae',     type: 'text',   resolve: r => { const e = r._mae?.dados?.endereco; return e ? `${e.logradouro || ''} ${e.numero || ''}`.trim() : '' } },
  { key: 'mae_end_com',           label: 'Endereço Comercial',       category: 'mae',     type: 'text',   resolve: r => r._mae?.dados?.enderecoComercial || '' },

  // ── DADOS DO PAI (14)
  { key: 'pai_celular',           label: 'Celular',                  category: 'pai',     type: 'text',   resolve: r => r._pai?.celular || r._pai?.dados?.celular || '' },
  { key: 'pai_codigo',            label: 'Código',                   category: 'pai',     type: 'text',   resolve: r => r._pai?.id || '' },
  { key: 'pai_cpf',               label: 'CPF',                      category: 'pai',     type: 'text',   resolve: r => r._pai?.cpf || r._pai?.dados?.cpf || '' },
  { key: 'pai_dt_nasc',           label: 'Data nascimento',          category: 'pai',     type: 'date',   resolve: r => r._pai?.dados?.dataNasc || r._pai?.dados?.dataNascimento || '' },
  { key: 'pai_ddd',               label: 'DDD',                      category: 'pai',     type: 'text',   resolve: r => r._pai?.dados?.ddd || '' },
  { key: 'pai_email',             label: 'E-mail',                   category: 'pai',     type: 'text',   resolve: r => r._pai?.email || r._pai?.dados?.email || '' },
  { key: 'pai_fone_com',          label: 'Fone comercial',           category: 'pai',     type: 'text',   resolve: r => r._pai?.dados?.foneComercial || r._pai?.dados?.telefoneComercial || '' },
  { key: 'pai_fone_res',          label: 'Fone residencial',         category: 'pai',     type: 'text',   resolve: r => r._pai?.dados?.foneResidencial || r._pai?.dados?.telefoneResidencial || '' },
  { key: 'pai_nacionalidade',     label: 'Nacionalidade',            category: 'pai',     type: 'text',   resolve: r => r._pai?.dados?.nacionalidade || '' },
  { key: 'pai_nome',              label: 'Nome',                     category: 'pai',     type: 'text',   resolve: r => r._pai?.nome || r.dados?.nomePai || r.dados?.pai || '' },
  { key: 'pai_profissao',         label: 'Profissão',                category: 'pai',     type: 'text',   resolve: r => r._pai?.dados?.profissao || '' },
  { key: 'pai_rg',                label: 'RG',                       category: 'pai',     type: 'text',   resolve: r => r._pai?.rg || r._pai?.dados?.rg || '' },
  { key: 'pai_end_res',           label: 'Endereço Residêncial',     category: 'pai',     type: 'text',   resolve: r => { const e = r._pai?.dados?.endereco; return e ? `${e.logradouro || ''} ${e.numero || ''}`.trim() : '' } },
  { key: 'pai_end_com',           label: 'Endereço Comercial',       category: 'pai',     type: 'text',   resolve: r => r._pai?.dados?.enderecoComercial || '' },

  // ── DADOS DO RESP. PEDAGÓGICO (16)
  { key: 'rped_celular',          label: 'Celular',                  category: 'respPed', type: 'text',   resolve: r => r._rped?.celular || r._rped?.dados?.celular || '' },
  { key: 'rped_codigo',           label: 'Código',                   category: 'respPed', type: 'text',   resolve: r => r._rped?.id || '' },
  { key: 'rped_cpf',              label: 'CPF',                      category: 'respPed', type: 'text',   resolve: r => r._rped?.cpf || r._rped?.dados?.cpf || '' },
  { key: 'rped_dt_nasc',          label: 'Data nascimento',          category: 'respPed', type: 'date',   resolve: r => r._rped?.dados?.dataNasc || '' },
  { key: 'rped_ddd',              label: 'DDD',                      category: 'respPed', type: 'text',   resolve: r => r._rped?.dados?.ddd || '' },
  { key: 'rped_email',            label: 'E-mail',                   category: 'respPed', type: 'text',   resolve: r => r._rped?.email || r._rped?.dados?.email || '' },
  { key: 'rped_fone_com',         label: 'Fone comercial',           category: 'respPed', type: 'text',   resolve: r => r._rped?.dados?.foneComercial || '' },
  { key: 'rped_fone_res',         label: 'Fone residencial',         category: 'respPed', type: 'text',   resolve: r => r._rped?.dados?.foneResidencial || '' },
  { key: 'rped_nome',             label: 'Nome',                     category: 'respPed', type: 'text',   resolve: r => r._rped?.nome || '' },
  { key: 'rped_profissao',        label: 'Profissão',                category: 'respPed', type: 'text',   resolve: r => r._rped?.dados?.profissao || '' },
  { key: 'rped_rg',               label: 'RG',                       category: 'respPed', type: 'text',   resolve: r => r._rped?.rg || r._rped?.dados?.rg || '' },
  { key: 'rped_end_com',          label: 'End. comercial',           category: 'respPed', type: 'text',   resolve: r => r._rped?.dados?.enderecoComercial || '' },
  { key: 'rped_end_res_comp',     label: 'End. res. compl.',         category: 'respPed', type: 'text',   resolve: r => r._rped?.dados?.endereco?.complemento || '' },
  { key: 'rped_end_res',          label: 'End. residencial',         category: 'respPed', type: 'text',   resolve: r => { const e = r._rped?.dados?.endereco; return e ? `${e.logradouro || ''} ${e.numero || ''}`.trim() : '' } },
  { key: 'rped_parentesco',       label: 'Parentesco',               category: 'respPed', type: 'text',   resolve: r => r._rped_link?.parentesco || r._rped?.dados?.parentesco || '' },
  { key: 'rped_naturalidade',     label: 'Naturalidade',             category: 'respPed', type: 'text',   resolve: r => r._rped?.dados?.naturalidade || '' },

  // ── DADOS DO RESP. FINANCEIRO (25)
  { key: 'rfin_bairro_com',       label: 'Bairro comercial',         category: 'respFin', type: 'text',   resolve: r => r._rfin?.dados?.enderecoComercial?.bairro || '' },
  { key: 'rfin_bairro_res',       label: 'Bairro residencial',       category: 'respFin', type: 'text',   resolve: r => r._rfin?.dados?.endereco?.bairro || '' },
  { key: 'rfin_celular',          label: 'Celular',                  category: 'respFin', type: 'text',   resolve: r => r._rfin?.celular || r._rfin?.dados?.celular || '' },
  { key: 'rfin_cep_res',          label: 'CEP residencial',          category: 'respFin', type: 'text',   resolve: r => r._rfin?.dados?.endereco?.cep || '' },
  { key: 'rfin_cep',              label: 'CEP',                      category: 'respFin', type: 'text',   resolve: r => r._rfin?.dados?.cep || r._rfin?.dados?.endereco?.cep || '' },
  { key: 'rfin_cidade_com',       label: 'Cidade comercial',         category: 'respFin', type: 'text',   resolve: r => r._rfin?.dados?.enderecoComercial?.cidade || '' },
  { key: 'rfin_cidade_res',       label: 'Cidade residencial',       category: 'respFin', type: 'text',   resolve: r => r._rfin?.dados?.endereco?.cidade || '' },
  { key: 'rfin_uf_res',           label: 'UF Residencial',           category: 'respFin', type: 'text',   resolve: r => r._rfin?.dados?.endereco?.estado || r._rfin?.dados?.endereco?.uf || '' },
  { key: 'rfin_uf_com',           label: 'UF Comercial',             category: 'respFin', type: 'text',   resolve: r => r._rfin?.dados?.enderecoComercial?.estado || r._rfin?.dados?.enderecoComercial?.uf || '' },
  { key: 'rfin_codigo',           label: 'Código',                   category: 'respFin', type: 'text',   resolve: r => r._rfin?.id || '' },
  { key: 'rfin_cpf',              label: 'CPF',                      category: 'respFin', type: 'text',   resolve: r => r._rfin?.cpf || r._rfin?.dados?.cpf || '' },
  { key: 'rfin_dt_nasc',          label: 'Data de Nascimento',       category: 'respFin', type: 'date',   resolve: r => r._rfin?.dados?.dataNasc || r._rfin?.dados?.dataNascimento || '' },
  { key: 'rfin_ddd',              label: 'DDD',                      category: 'respFin', type: 'text',   resolve: r => r._rfin?.dados?.ddd || '' },
  { key: 'rfin_email',            label: 'E-mail',                   category: 'respFin', type: 'text',   resolve: r => r._rfin?.email || r._rfin?.dados?.email || '' },
  { key: 'rfin_end_com',          label: 'End. comercial',           category: 'respFin', type: 'text',   resolve: r => { const e = r._rfin?.dados?.enderecoComercial; return e ? `${e.logradouro || ''} ${e.numero || ''}`.trim() : '' } },
  { key: 'rfin_end_res_comp',     label: 'End. res. compl.',         category: 'respFin', type: 'text',   resolve: r => r._rfin?.dados?.endereco?.complemento || '' },
  { key: 'rfin_end_res',          label: 'End. residencial',         category: 'respFin', type: 'text',   resolve: r => { const e = r._rfin?.dados?.endereco; return e ? `${e.logradouro || ''} ${e.numero || ''}`.trim() : '' } },
  { key: 'rfin_tel_com',          label: 'Telefone comercial',       category: 'respFin', type: 'text',   resolve: r => r._rfin?.dados?.telefoneComercial || r._rfin?.dados?.foneComercial || '' },
  { key: 'rfin_tel_res',          label: 'Telefone residencial',     category: 'respFin', type: 'text',   resolve: r => r._rfin?.dados?.telefoneResidencial || r._rfin?.dados?.foneResidencial || '' },
  { key: 'rfin_nome',             label: 'Nome',                     category: 'respFin', type: 'text',   resolve: r => r._rfin?.nome || '' },
  { key: 'rfin_profissao',        label: 'Profissão',                category: 'respFin', type: 'text',   resolve: r => r._rfin?.dados?.profissao || '' },
  { key: 'rfin_rg',               label: 'RG',                       category: 'respFin', type: 'text',   resolve: r => r._rfin?.rg || r._rfin?.dados?.rg || '' },
  { key: 'rfin_sexo',             label: 'Sexo',                     category: 'respFin', type: 'text',   resolve: r => r._rfin?.dados?.sexo || '' },
  { key: 'rfin_parentesco',       label: 'Parentesco',               category: 'respFin', type: 'text',   resolve: r => r._rfin_link?.parentesco || r._rfin?.dados?.parentesco || '' },
  { key: 'rfin_naturalidade',     label: 'Naturalidade',             category: 'respFin', type: 'text',   resolve: r => r._rfin?.dados?.naturalidade || '' },

  // ── OUTROS (6)
  { key: 'outros_avo_materna',    label: 'Avó Materna',              category: 'outros',  type: 'text',   resolve: r => r.dados?.avoMaterna || r.dados?.avo_materna || '' },
  { key: 'outros_avo_materno',    label: 'Avô Materno',              category: 'outros',  type: 'text',   resolve: r => r.dados?.avoMaterno || r.dados?.avo_materno || '' },
  { key: 'outros_avo_paterna',    label: 'Avó Paterna',              category: 'outros',  type: 'text',   resolve: r => r.dados?.avoPaterna || r.dados?.avo_paterna || '' },
  { key: 'outros_avo_paterno',    label: 'Avô Paterno',              category: 'outros',  type: 'text',   resolve: r => r.dados?.avoPaterno || r.dados?.avo_paterno || '' },
  { key: 'outros_usuario_cod',    label: 'Usuário que cadastrou código', category: 'outros', type: 'text', resolve: r => r.dados?.usuarioCadastrou || r.dados?.usuarioCod || '' },
  { key: 'outros_usuario_data',   label: 'Usuário que cadastrou data',  category: 'outros', type: 'date', resolve: r => r.dados?.dataCadastro || r.created_at?.slice(0,10) || '' },
  { key: 'outros_filiacao_mae',   label: 'Filiação Mãe',             category: 'outros',  type: 'text',   resolve: r => r.dados?.filiacaoMae || r.dados?.nomeMae || '' },
  { key: 'outros_filiacao_pai',   label: 'Filiação Pai',             category: 'outros',  type: 'text',   resolve: r => r.dados?.filiacaoPai || r.dados?.nomePai || '' },

  // ── SAÚDE / OBSERVAÇÕES ESPECIAIS
  { key: 'saude_tipo_sang',       label: 'Tipo Sanguíneo',           category: 'saude',   type: 'text',   resolve: r => r.dados?.saude?.tipoSanguineo || r.dados?.tipoSanguineo || r.dados?.grupoSanguineo || '' },
  { key: 'saude_alergias',        label: 'Alergias / Restrições',    category: 'saude',   type: 'text',   resolve: r => r.dados?.saude?.alergias || r.dados?.alergias || '' },
  { key: 'saude_deficiencias',    label: 'Deficiências (CID)',        category: 'saude',   type: 'text',   resolve: r => r.dados?.saude?.deficiencias || r.dados?.deficiencias || '' },
  { key: 'saude_necessidades',    label: 'Necessidades Especiais/NEE',category: 'saude',   type: 'text',   resolve: r => r.dados?.saude?.necessidades || r.dados?.nEspeciais || r.dados?.necessidades || '' },
  { key: 'saude_medicamentos',    label: 'Medicamentos em Uso',      category: 'saude',   type: 'text',   resolve: r => r.dados?.saude?.medicamentos || r.dados?.medicamentos || '' },
  { key: 'saude_plano',           label: 'Plano de Saúde',           category: 'saude',   type: 'text',   resolve: r => r.dados?.saude?.planoSaude || r.dados?.planoSaude || '' },
  { key: 'saude_nr_plano',        label: 'Nº do Plano',              category: 'saude',   type: 'text',   resolve: r => r.dados?.saude?.numeroPlano || '' },
  { key: 'saude_hospital',        label: 'Hospital de Referência',   category: 'saude',   type: 'text',   resolve: r => r.dados?.saude?.hospital || '' },
  { key: 'saude_obs_medica',      label: 'Observações Médicas',      category: 'saude',   type: 'text',   resolve: r => r.dados?.saude?.obsMedica || '' },
  { key: 'saude_obs_gerais',      label: 'Observações Gerais',       category: 'saude',   type: 'text',   resolve: r => r.dados?.saude?.obs || r.obs || '' },
  { key: 'saude_autoriza_saida',  label: 'Autoriza Saída',           category: 'saude',   type: 'text',   resolve: r => { const v = r.dados?.saude?.autorizaSaida ?? r.dados?.saude?.podeSairSozinho; if (v === true) return 'Sim'; if (v === false) return 'Não'; return '' } },
  { key: 'saude_autoriza_imagem', label: 'Autoriza Uso de Imagem',   category: 'saude',   type: 'text',   resolve: r => { const v = r.dados?.saude?.autorizaImagem; if (v === true) return 'Sim'; if (v === false) return 'Não'; return '' } },
  { key: 'saude_rfid',            label: 'Cartão RFID (Resp.)',       category: 'saude',   type: 'text',   resolve: r => r._rfin?.rfid || r.dados?.saude?.rfid || '' },

  // ── DESEMPENHO ACADÊMICO (calculado)
  { key: 'acad_frequencia',       label: 'Frequência (%)',            category: 'academico', type: 'number', resolve: r => r.frequencia ?? '' },
  { key: 'acad_media_geral',      label: 'Média Geral',               category: 'academico', type: 'number', resolve: r => r.media ?? '' },
  { key: 'acad_risco_evasao',     label: 'Risco de Evasão (IA)',      category: 'academico', type: 'badge',  resolve: r => r.risco_evasao || '',
    badgeColors: { alto: '#ef4444', medio: '#f59e0b', baixo: '#10b981' } },
  { key: 'acad_inadimplente',     label: 'Situação Financeira',       category: 'academico', type: 'badge',  resolve: r => r.inadimplente ? 'Inadimplente' : 'Regular',
    badgeColors: { Inadimplente: '#ef4444', Regular: '#10b981' } },
  { key: 'acad_status_detalhado', label: 'Status Detalhado',          category: 'academico', type: 'badge',  resolve: r => r.statusMatricula || r.status || '',
    badgeColors: { matriculado: '#10b981', ativo: '#10b981', inativo: '#6b7280', transferido: '#f59e0b', cancelado: '#ef4444', formado: '#3b82f6' } },
  { key: 'acad_unidade',          label: 'Unidade',                   category: 'academico', type: 'text',   resolve: r => r.unidade || '' },
  { key: 'acad_obs',              label: 'Observações do Aluno',      category: 'academico', type: 'text',   resolve: r => r.obs || r.dados?.obs || '' },

  // ── DADOS DA TURMA (resolvida via _mat)
  { key: 'turma_nome',            label: 'Nome da Turma',             category: 'turma',   type: 'text',   resolve: r => r._mat?.turma || r.turma || '' },
  { key: 'turma_serie',           label: 'Série',                     category: 'turma',   type: 'text',   resolve: r => r._mat?.serie || r.serie || '' },
  { key: 'turma_turno',           label: 'Turno',                     category: 'turma',   type: 'text',   resolve: r => r._mat?.turno || r.turno || '' },
  { key: 'turma_unidade',         label: 'Unidade (turma)',           category: 'turma',   type: 'text',   resolve: r => r._mat?.unidade || r.unidade || '' },
  { key: 'turma_ano',             label: 'Ano Letivo',                category: 'turma',   type: 'number', resolve: r => r._mat?.ano_letivo || '' },
  { key: 'turma_status_mat',      label: 'Status Matrícula',          category: 'turma',   type: 'badge',  resolve: r => r._mat?.status || r.statusMatricula || '',
    badgeColors: { matriculado: '#10b981', ativo: '#10b981', inativo: '#6b7280', transferido: '#f59e0b', cancelado: '#ef4444' } },
  { key: 'turma_nr_chamada',      label: 'Número na Chamada',         category: 'turma',   type: 'number', resolve: r => r._mat?.numeroChamada || r._mat?.nr_chamada || '' },
  { key: 'turma_contrato',        label: 'Dados do Contrato',         category: 'turma',   type: 'text',   resolve: r => r._mat?.dados_contrato ? JSON.stringify(r._mat.dados_contrato) : '' },
  { key: 'turma_mat_id',          label: 'ID da Matrícula',           category: 'turma',   type: 'text',   resolve: r => r._mat?.id || '' },
  { key: 'turma_resp_fin_id',     label: 'Resp. Financeiro (ID)',     category: 'turma',   type: 'text',   resolve: r => r._mat?.responsavel_financeiro_id || '' },

  // ── PROFESSOR / SALA (dados da turma via turmaObj)
  { key: 'prof_nome',             label: 'Professor(a)',              category: 'turmaProf', type: 'text',  resolve: r => r._turmaObj?.professor || '' },
  { key: 'prof_sala',             label: 'Sala',                      category: 'turmaProf', type: 'text',  resolve: r => r._turmaObj?.sala || '' },
  { key: 'prof_capacidade',       label: 'Capacidade da Turma',       category: 'turmaProf', type: 'number', resolve: r => r._turmaObj?.capacidade || '' },
  { key: 'prof_matriculados',     label: 'Alunos Matriculados',       category: 'turmaProf', type: 'number', resolve: r => r._turmaObj?.matriculados || '' },
  { key: 'prof_codigo_turma',     label: 'Código da Turma',           category: 'turmaProf', type: 'text',  resolve: r => r._turmaObj?.codigo || '' },

  // ── FINANCEIRO DO ALUNO (parcelas JSONB)
  { key: 'fin_total_parcelas',    label: 'Total de Parcelas',         category: 'finAluno', type: 'number', resolve: r => { const p = r.dados?.parcelas || r.dados?.financeiro?.parcelas || []; return Array.isArray(p) ? p.length : '' } },
  { key: 'fin_pagas',             label: 'Parcelas Pagas',            category: 'finAluno', type: 'number', resolve: r => { const p = r.dados?.parcelas || r.dados?.financeiro?.parcelas || []; return Array.isArray(p) ? p.filter((x: any) => x.status === 'pago' || x.situacao === 'pago').length : '' } },
  { key: 'fin_pendentes',         label: 'Parcelas Pendentes',        category: 'finAluno', type: 'number', resolve: r => { const p = r.dados?.parcelas || r.dados?.financeiro?.parcelas || []; return Array.isArray(p) ? p.filter((x: any) => x.status === 'pendente' || (!x.status && !x.situacao)).length : '' } },
  { key: 'fin_vencidas',          label: 'Parcelas Vencidas',         category: 'finAluno', type: 'number', resolve: r => { const p = r.dados?.parcelas || r.dados?.financeiro?.parcelas || []; const today = new Date().toISOString().slice(0,10); return Array.isArray(p) ? p.filter((x: any) => x.status !== 'pago' && x.vencimento && (x.vencimento.includes('/') ? x.vencimento.split('/').reverse().join('-') : x.vencimento) < today).length : '' } },
  { key: 'fin_valor_total',       label: 'Valor Total (parcelas)',    category: 'finAluno', type: 'currency', resolve: r => { const p = r.dados?.parcelas || r.dados?.financeiro?.parcelas || []; return Array.isArray(p) ? p.reduce((s: number, x: any) => s + (Number(x.valor) || 0), 0).toFixed(2) : '' } },
  { key: 'fin_valor_pago',        label: 'Valor Pago (R$)',           category: 'finAluno', type: 'currency', resolve: r => { const p = r.dados?.parcelas || r.dados?.financeiro?.parcelas || []; return Array.isArray(p) ? p.filter((x: any) => x.status === 'pago' || x.situacao === 'pago').reduce((s: number, x: any) => s + (Number(x.valorFinal || x.valorPago || x.valor) || 0), 0).toFixed(2) : '' } },
  { key: 'fin_saldo_devedor',     label: 'Saldo Devedor (R$)',        category: 'finAluno', type: 'currency', resolve: r => { const p = r.dados?.parcelas || r.dados?.financeiro?.parcelas || []; if (!Array.isArray(p)) return ''; const today = new Date().toISOString().slice(0,10); const dev = p.filter((x: any) => x.status !== 'pago').reduce((s: number, x: any) => s + (Number(x.valor) || 0), 0); return dev.toFixed(2) } },
  { key: 'fin_inadimplente',      label: 'Inadimplente (S/N)',        category: 'finAluno', type: 'text',   resolve: r => r.inadimplente ? 'Sim' : 'Não' },
  { key: 'fin_eventos',           label: 'Nº de Eventos Financeiros', category: 'finAluno', type: 'number', resolve: r => { const ev = r.dados?.eventosFinanceiros || []; return Array.isArray(ev) ? ev.length : '' } },

  // ── HISTÓRICO DE MATRÍCULA
  { key: 'hist_total',            label: 'Total Matrículas',          category: 'histMat', type: 'number', resolve: r => { const h = r.dados?.historicoMatriculas || r.dados?.historico_matriculas || []; return Array.isArray(h) ? h.length : '' } },
  { key: 'hist_ano_atual',        label: 'Ano Letivo Atual',          category: 'histMat', type: 'number', resolve: r => r._mat?.ano_letivo || '' },
  { key: 'hist_situacao_atual',   label: 'Situação Atual',            category: 'histMat', type: 'text',   resolve: r => { const h = r.dados?.historicoMatriculas || []; const ativo = Array.isArray(h) ? h.find((x: any) => x.situacao === 'Cursando') : null; return ativo?.situacao || r._mat?.status || '' } },
  { key: 'hist_ultima_turma',     label: 'Última Turma (histórico)',  category: 'histMat', type: 'text',   resolve: r => { const h = r.dados?.historicoMatriculas || []; return Array.isArray(h) && h.length > 0 ? (h[h.length-1]?.turma || '') : '' } },
  { key: 'hist_escola_origem',    label: 'Escola de Origem',          category: 'histMat', type: 'text',   resolve: r => r.dados?.escolaOrigem || r.dados?.escolaAnterior || '' },
  { key: 'hist_transferencia',    label: 'Escola Destino (transf.)',  category: 'histMat', type: 'text',   resolve: r => r.dados?.escolaDestino || '' },
  { key: 'hist_motivo_saida',     label: 'Motivo de Saída',           category: 'histMat', type: 'text',   resolve: r => r.dados?.motivoSaida || '' },

  // ── DADOS DO SISTEMA
  { key: 'sys_id',                label: 'ID do Aluno (Sistema)',     category: 'sistema', type: 'text',   resolve: r => r.id || '' },
  { key: 'sys_created_at',        label: 'Data de Cadastro',          category: 'sistema', type: 'date',   resolve: r => r.created_at?.slice(0,10) || '' },
  { key: 'sys_updated_at',        label: 'Data de Atualização',       category: 'sistema', type: 'date',   resolve: r => r.updated_at?.slice(0,10) || '' },
  { key: 'sys_status_raw',        label: 'Status (raw)',              category: 'sistema', type: 'text',   resolve: r => r.status || '' },
  { key: 'sys_foto',              label: 'Tem Foto (S/N)',            category: 'sistema', type: 'text',   resolve: r => r.foto ? 'Sim' : 'Não' },
  { key: 'sys_risco_ia',          label: 'Risco IA (raw)',            category: 'sistema', type: 'text',   resolve: r => r.risco_evasao || '' },
  { key: 'sys_matricula_id',      label: 'Matrícula (código)',        category: 'sistema', type: 'text',   resolve: r => r.matricula || '' },
  { key: 'sys_unidade_raw',       label: 'Unidade (raw)',             category: 'sistema', type: 'text',   resolve: r => r.unidade || '' },
]

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

interface Column {
  id: string         // uuid para garantir unicidade
  fieldKey: string
  label: string       // pode ser customizado pelo usuário
  seq: number
  visible: boolean
}

interface Template {
  id: string
  nome: string
  titulo: string
  objetivo: string
  columns: Column[]
  filters: ReportFilters
  orientation: 'retrato' | 'paisagem'
  createdAt: string
}

interface ReportFilters {
  unidade: string
  turma: string
  serie: string
  turno: string
  anoLetivo: string
  status: string
  sexo: string
  busca: string
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

const ACCENT = '#3b82f6'
const GREEN  = '#059669'
const RED    = '#dc2626'
const AMBER  = '#d97706'

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function fmtDate(v: unknown): string {
  if (!v) return ''
  const s = String(v)
  if (s.includes('/')) return s.length >= 10 ? s.slice(0, 10) : s
  const [y, m, d] = (s.length > 10 ? s.slice(0, 10) : s).split('-')
  if (!y || !m || !d) return s
  return `${d}/${m}/${y}`
}

function getCatColor(cat: string) {
  return CATEGORIES.find(c => c.key === cat)?.color || '#6b7280'
}
function getCatIcon(cat: string) {
  return CATEGORIES.find(c => c.key === cat)?.icon || '•'
}
function getCatLabel(cat: string) {
  return CATEGORIES.find(c => c.key === cat)?.label.replace(/─/g, '').trim() || cat
}

function getField(key: string) {
  return FIELD_CATALOG.find(f => f.key === key)
}

const STORAGE_KEY = 'edu_relatorios_personalizados_v3'

function loadTemplates(): Template[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

function saveTemplates(tpls: Template[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tpls))
}

const DEFAULT_FILTERS: ReportFilters = {
  unidade: '', turma: '', serie: '', turno: '', anoLetivo: '',
  status: '', sexo: '', busca: ''
}

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

function CategoryBadge({ cat }: { cat: string }) {
  const color = getCatColor(cat)
  const icon  = getCatIcon(cat)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
      background: `${color}18`, color, border: `1px solid ${color}28`,
    }}>{icon} {getCatLabel(cat)}</span>
  )
}

function FieldChip({ field, onAdd, selected }: { field: FieldDef; onAdd: () => void; selected: boolean }) {
  const color = getCatColor(field.category)
  return (
    <button
      onClick={onAdd}
      title={selected ? 'Já adicionado' : `Adicionar "${field.label}"`}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
        borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: selected ? 'default' : 'pointer',
        border: `1px solid ${selected ? color + '50' : 'hsl(var(--border-subtle))'}`,
        background: selected ? `${color}12` : 'transparent',
        color: selected ? color : 'hsl(var(--text-secondary))',
        transition: 'all 0.15s', textAlign: 'left', fontFamily: 'inherit',
        opacity: selected ? 0.7 : 1,
      }}
    >
      <span style={{ fontSize: 8, width: 14, height: 14, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {selected ? '✓' : '+'}
      </span>
      {field.label}
    </button>
  )
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════

export default function PersonalizadoPage() {
  const router = useRouter()
  const { mantenedores } = useData()
  const { currentUser } = useApp()

  // ── Template state
  const [templates, setTemplates] = useState<Template[]>([])
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null)
  const [showTemplateList, setShowTemplateList] = useState(true)

  // ── Builder state
  const [titulo, setTitulo] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [orientation, setOrientation] = useState<'retrato' | 'paisagem'>('paisagem')
  const [columns, setColumns] = useState<Column[]>([])
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS)
  const [showFilters, setShowFilters] = useState(false)

  // ── Field picker state
  const [showFieldPicker, setShowFieldPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerCat, setPickerCat] = useState<string>('all')

  // ── Column editor state
  const [editingCol, setEditingCol] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')

  // ── Data state
  const [rawRows, setRawRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [error, setError] = useState('')

  // ── Sort + pagination
  const [sortField, setSortField] = useState('')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  // ── Filter options from data
  const [unidadeOptions, setUnidadeOptions] = useState<string[]>([])
  const [turmaOptions, setTurmaOptions] = useState<string[]>([])
  const [serieOptions, setSerieOptions] = useState<string[]>([])

  const YR = new Date().getFullYear()
  const YR_OPTIONS = Array.from({ length: 6 }, (_, i) => String(YR - i))

  // Load saved templates on mount
  useEffect(() => {
    setTemplates(loadTemplates())
  }, [])

  // ── Field picker filtered list
  const pickerFields = useMemo(() => {
    let list = FIELD_CATALOG
    if (pickerCat !== 'all') list = list.filter(f => f.category === pickerCat)
    if (pickerSearch.trim()) {
      const q = pickerSearch.toLowerCase()
      list = list.filter(f => f.label.toLowerCase().includes(q) || getCatLabel(f.category).toLowerCase().includes(q))
    }
    return list
  }, [pickerCat, pickerSearch])

  const selectedKeys = useMemo(() => columns.map(c => c.fieldKey), [columns])

  // ── Data resolution (client-side from API)
  const processedRows = useMemo(() => {
    if (!rawRows.length || !columns.length) return []
    return rawRows.map(row => {
      const out: Record<string, unknown> = {}
      columns.filter(c => c.visible).forEach(col => {
        const field = getField(col.fieldKey)
        if (field) {
          out[col.id] = field.resolve(row)
        }
      })
      return out
    })
  }, [rawRows, columns])

  // ── Sort
  const sortedRows = useMemo(() => {
    if (!sortField) return processedRows
    const col = columns.find(c => c.id === sortField)
    if (!col) return processedRows
    return [...processedRows].sort((a, b) => {
      const va = a[sortField]; const vb = b[sortField]
      const dir = sortDir === 'asc' ? 1 : -1
      if (va === vb) return 0
      if (va == null) return dir
      if (vb == null) return -dir
      if (typeof va === 'number') return (va - Number(vb)) * dir
      return String(va).localeCompare(String(vb), 'pt-BR') * dir
    })
  }, [processedRows, sortField, sortDir])

  const pagedRows = useMemo(() => sortedRows.slice((page - 1) * pageSize, page * pageSize), [sortedRows, page, pageSize])
  const totalPages = Math.ceil(sortedRows.length / pageSize)

  const visibleCols = useMemo(() => columns.filter(c => c.visible), [columns])

  // ── Template operations
  function newTemplate() {
    setTitulo('')
    setObjetivo('')
    setOrientation('paisagem')
    setColumns([])
    setFilters(DEFAULT_FILTERS)
    setGenerated(false)
    setRawRows([])
    setError('')
    setActiveTemplate(null)
    setShowTemplateList(false)
    setShowFieldPicker(true)
  }

  function loadTemplate(t: Template) {
    setTitulo(t.titulo)
    setObjetivo(t.objetivo)
    setOrientation(t.orientation)
    setColumns(t.columns)
    setFilters(t.filters || DEFAULT_FILTERS)
    setActiveTemplate(t)
    setShowTemplateList(false)
    setGenerated(false)
    setRawRows([])
    setError('')
  }

  function saveTemplate() {
    if (!titulo.trim()) { alert('Informe um título para o relatório.'); return }
    if (columns.length === 0) { alert('Adicione pelo menos um campo.'); return }

    const t: Template = {
      id: activeTemplate?.id || uid(),
      nome: titulo,
      titulo, objetivo, orientation, columns,
      filters,
      createdAt: activeTemplate?.createdAt || new Date().toISOString()
    }
    const updated = activeTemplate
      ? templates.map(x => x.id === t.id ? t : x)
      : [...templates, t]
    setTemplates(updated)
    saveTemplates(updated)
    setActiveTemplate(t)
    alert('✅ Modelo salvo com sucesso!')
  }

  function deleteTemplate(id: string) {
    if (!confirm('Excluir este modelo?')) return
    const updated = templates.filter(t => t.id !== id)
    setTemplates(updated)
    saveTemplates(updated)
    if (activeTemplate?.id === id) {
      setActiveTemplate(null)
      setShowTemplateList(true)
    }
  }

  function duplicateTemplate(t: Template) {
    const copy: Template = { ...t, id: uid(), nome: t.nome + ' (cópia)', titulo: t.titulo + ' (cópia)', createdAt: new Date().toISOString() }
    const updated = [...templates, copy]
    setTemplates(updated)
    saveTemplates(updated)
  }

  // ── Column operations
  function addField(fieldKey: string) {
    if (selectedKeys.includes(fieldKey)) return
    const field = getField(fieldKey)
    if (!field) return
    const seq = columns.length + 1
    setColumns(prev => [...prev, { id: uid(), fieldKey, label: field.label, seq, visible: true }])
  }

  function removeColumn(id: string) {
    setColumns(prev => prev.filter(c => c.id !== id).map((c, i) => ({ ...c, seq: i + 1 })))
  }

  function toggleVisibility(id: string) {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, visible: !c.visible } : c))
  }

  function moveColumn(id: string, dir: -1 | 1) {
    setColumns(prev => {
      const idx = prev.findIndex(c => c.id === id)
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const arr = [...prev]
      ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
      return arr.map((c, i) => ({ ...c, seq: i + 1 }))
    })
  }

  function startEditLabel(col: Column) {
    setEditingCol(col.id)
    setEditLabel(col.label)
  }

  function commitEditLabel() {
    if (!editingCol) return
    setColumns(prev => prev.map(c => c.id === editingCol ? { ...c, label: editLabel || c.label } : c))
    setEditingCol(null)
  }

  // ── Generate report
  async function handleGenerate() {
    if (columns.length === 0) { setError('Adicione pelo menos um campo.'); return }
    setLoading(true)
    setError('')
    setGenerated(false)

    try {
      // Fetch all student data with related parties
      const res = await fetch('/api/relatorios/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'alunos_completo',
          filters: {
            busca: filters.busca,
            unidade: filters.unidade,
            turma: filters.turma,
            serie: filters.serie,
            turno: filters.turno,
            anoLetivo: filters.anoLetivo,
            statusMatricula: filters.status,
            sexo: filters.sexo,
          },
          page: 1,
          pageSize: 9999,
        }),
      })

      const result = await res.json()
      const rows = result.data || []

      // Populate filter options from raw data
      const unids = [...new Set(rows.map((r: any) => r.unidade || '').filter(Boolean))].sort() as string[]
      const turms = [...new Set(rows.map((r: any) => r.turma || '').filter(Boolean))].sort() as string[]
      const series = [...new Set(rows.map((r: any) => r.serie || '').filter(Boolean))].sort() as string[]
      setUnidadeOptions(unids)
      setTurmaOptions(turms)
      setSerieOptions(series)
      setRawRows(rows)
      setGenerated(true)
      setPage(1)
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  // ── Cell renderer
  function renderCell(value: unknown, fieldKey: string): React.ReactNode {
    const field = getField(fieldKey)
    if (!field) return String(value ?? '—')
    if (value === null || value === undefined || value === '') return '—'
    if (field.type === 'date') return fmtDate(value)
    if (field.type === 'number') return String(value)
    if (field.type === 'currency') {
      const n = parseFloat(String(value))
      return isNaN(n) ? String(value) : `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    if (field.type === 'badge') {
      const sv = String(value)
      const color = field.badgeColors?.[sv] || '#94a3b8'
      return (
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
          background: `${color}20`, color, border: `1px solid ${color}40`,
          display: 'inline-block', whiteSpace: 'nowrap',
        }}>{sv}</span>
      )
    }
    return String(value)
  }

  // ── Export XLSX
  function handleXLSX() {
    const wb = XLSX.utils.book_new()
    const headers = visibleCols.map(c => c.label)
    const rows = sortedRows.map(row =>
      visibleCols.map(col => {
        const v = row[col.id]
        const field = getField(col.fieldKey)
        if (!field || v == null || v === '') return ''
        if (field.type === 'date') return fmtDate(v)
        return String(v)
      })
    )
    const ws = XLSX.utils.aoa_to_sheet([
      [titulo || 'Relatório Personalizado'],
      [`Gerado em: ${new Date().toLocaleString('pt-BR')} | Total: ${sortedRows.length} registros`],
      [],
      headers,
      ...rows,
    ])
    ws['!cols'] = headers.map(() => ({ wch: 20 }))
    XLSX.utils.book_append_sheet(wb, ws, 'Dados')
    XLSX.writeFile(wb, `${(titulo || 'relatorio').replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0,10)}.xlsx`)
  }

  // ── Export PDF (print)
  function handlePrint() {
    const mant = (mantenedores as any)?.[0]
    const nomeEscola = mant?.razaoSocial || mant?.nome || 'Escola'
    const logo = mant?.logo || ''
    const logoH = logo ? `<img src="${logo}" style="max-height:44px;max-width:120px;object-fit:contain;" onerror="this.style.display='none'" />` : ''
    const hoje = new Date().toLocaleString('pt-BR')
    const isLandscape = orientation === 'paisagem'
    const pageSize = isLandscape ? 'A4 landscape' : 'A4 portrait'

    const css = `
      *{box-sizing:border-box;margin:0;padding:0}
      html,body{width:100%;print-color-adjust:exact;-webkit-print-color-adjust:exact}
      body{font-family:'Segoe UI',Arial,sans-serif;font-size:8.5px;color:#1e293b;padding:10mm 12mm}
      .hdr{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #3b82f6;padding-bottom:8px;margin-bottom:10px}
      .school{font-size:14px;font-weight:900;color:#0f172a}
      .report-title{font-size:11px;font-weight:700;color:#1d4ed8}
      .meta{font-size:7px;color:#94a3b8;margin-top:3px}
      table{width:100%;border-collapse:collapse}
      th{background:#1d4ed8;color:#fff;padding:4px 5px;font-size:7px;font-weight:700;text-align:left;white-space:nowrap}
      td{padding:3px 5px;font-size:8px;border-bottom:1px solid #e2e8f0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
      tr:nth-child(even) td{background:#f8fafc}
      .footer{margin-top:10px;font-size:7px;color:#94a3b8;text-align:center;border-top:1px dashed #e2e8f0;padding-top:6px}
      @media print{@page{size:${pageSize};margin:8mm 10mm}body{padding:0}.no-print{display:none}}
    `

    let tableH = '<tr>' + visibleCols.map(c => `<th>${c.label}</th>`).join('') + '</tr>'
    let tableB = sortedRows.map(row =>
      '<tr>' + visibleCols.map(col => {
        const v = row[col.id]
        const field = getField(col.fieldKey)
        const disp = (!field || v == null || v === '') ? '—' : (field.type === 'date' ? fmtDate(v) : String(v))
        return `<td>${disp}</td>`
      }).join('') + '</tr>'
    ).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${titulo || 'Relatório'}</title><style>${css}</style></head><body>`
      + `<div class="hdr"><div style="display:flex;align-items:center;gap:10px">${logoH}<div><div class="school">${nomeEscola}</div><div class="report-title">${titulo || 'Relatório Personalizado'}</div>${objetivo ? `<div class="meta">${objetivo}</div>` : ''}</div></div><div style="text-align:right"><div class="meta">Emitido por: ${currentUser?.nome || 'Usuário'}</div><div class="meta">${hoje}</div><div class="meta">${sortedRows.length} registro(s)</div></div></div>`
      + `<table><thead>${tableH}</thead><tbody>${tableB}</tbody></table>`
      + `<div class="footer">${titulo} — ${nomeEscola} — ${hoje}</div>`
      + `</body></html>`

    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    setTimeout(() => w.print(), 600)
  }

  // ── Sort toggle
  function toggleSort(colId: string) {
    if (sortField === colId) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(colId); setSortDir('asc') }
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 0 80px' }}>

      {/* ── HEADER ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => router.push('/relatorios')} className="btn btn-secondary btn-icon" style={{ marginTop: 2 }}>
          <ArrowLeft size={15} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${ACCENT}, #1d4ed8)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={20} color="#fff" />
            </div>
            <h1 className="page-title" style={{ fontSize: 22, margin: 0 }}>Relatórios Personalizados</h1>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: `${ACCENT}18`, color: ACCENT }}>133 campos</span>
          </div>
          <p className="page-subtitle" style={{ margin: 0, fontSize: 12 }}>
            Monte relatórios customizados com qualquer combinação de campos do cadastro de alunos, responsáveis e matrículas.
          </p>
        </div>
        {!showTemplateList && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setShowTemplateList(true)} className="btn btn-secondary" style={{ fontSize: 11, gap: 5 }}>
              <ClipboardList size={13} /> Modelos
            </button>
            <button onClick={saveTemplate} className="btn btn-secondary" style={{ fontSize: 11, gap: 5 }}>
              <Save size={13} /> Salvar Modelo
            </button>
            {columns.length > 0 && (
              <button onClick={handleGenerate} disabled={loading} className="btn btn-primary" style={{ fontSize: 11, gap: 5 }}>
                {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                Gerar Relatório
              </button>
            )}
            {generated && (
              <>
                <button onClick={handleXLSX} className="btn btn-secondary" style={{ fontSize: 11, gap: 5 }}>
                  <FileSpreadsheet size={13} /> XLSX
                </button>
                <button onClick={handlePrint} className="btn btn-secondary" style={{ fontSize: 11, gap: 5 }}>
                  <Printer size={13} /> PDF
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* TEMPLATE LIST VIEW */}
      {/* ═══════════════════════════════════════════ */}
      {showTemplateList && (
        <div>
          {/* New button */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'hsl(var(--text-primary))' }}>
              Modelos Salvos
            </h2>
            <button onClick={newTemplate} className="btn btn-primary" style={{ gap: 6, fontSize: 12 }}>
              <Plus size={14} /> Novo Relatório
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px 30px' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: 'hsl(var(--text-primary))' }}>Nenhum modelo criado</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', maxWidth: 400, margin: '0 auto 20px' }}>
                Crie seu primeiro relatório personalizado selecionando os campos que deseja exibir.
              </div>
              <button onClick={newTemplate} className="btn btn-primary" style={{ gap: 6, fontSize: 12 }}>
                <Plus size={14} /> Criar primeiro relatório
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {templates.map(t => (
                <div key={t.id} className="card" style={{ padding: '16px 18px', cursor: 'pointer', transition: 'all 0.15s' }}
                  onClick={() => loadTemplate(t)}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 2 }}>{t.titulo}</div>
                      {t.objetivo && <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{t.objetivo}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => duplicateTemplate(t)} title="Duplicar" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', padding: 4 }}><Copy size={13} /></button>
                      <button onClick={() => deleteTemplate(t.id)} title="Excluir" style={{ border: 'none', background: 'none', cursor: 'pointer', color: RED, padding: 4 }}><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: `${ACCENT}12`, color: ACCENT }}>{t.columns.length} campos</span>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: 'hsl(var(--bg-elevated))', color: 'hsl(var(--text-muted))' }}>{t.orientation}</span>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: 'hsl(var(--bg-elevated))', color: 'hsl(var(--text-muted))' }}>
                      {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* BUILDER VIEW */}
      {/* ═══════════════════════════════════════════ */}
      {!showTemplateList && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>

          {/* ── REPORT HEADER CARD ───────────────────── */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
              <div>
                <label className="form-label" style={{ fontSize: 10 }}>Título do Relatório</label>
                <input
                  className="form-input"
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  placeholder="Ex: Lista de Alunos por Turma"
                  style={{ fontSize: 14, fontWeight: 600 }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: 10 }}>Orientação</label>
                <select className="form-input" value={orientation} onChange={e => setOrientation(e.target.value as any)} style={{ fontSize: 12 }}>
                  <option value="retrato">Retrato</option>
                  <option value="paisagem">Paisagem</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label className="form-label" style={{ fontSize: 10 }}>Objetivo / Descrição</label>
              <input
                className="form-input"
                value={objetivo}
                onChange={e => setObjetivo(e.target.value)}
                placeholder="Descreva o objetivo deste relatório..."
                style={{ fontSize: 12 }}
              />
            </div>
          </div>

          {/* ── FILTERS PANEL ────────────────────────── */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Filter size={14} color={ACCENT} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>Filtros de Dados</span>
                {Object.values(filters).some(v => v) && (
                  <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: `${ACCENT}18`, color: ACCENT }}>ATIVO</span>
                )}
              </div>
              {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showFilters && (
              <div style={{ padding: '0 18px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                <div>
                  <label className="form-label" style={{ fontSize: 10 }}>Busca (nome/código)</label>
                  <input className="form-input" value={filters.busca} onChange={e => setFilters(f => ({ ...f, busca: e.target.value }))} placeholder="Buscar..." style={{ fontSize: 12 }} />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 10 }}>Ano Letivo</label>
                  <select className="form-input" value={filters.anoLetivo} onChange={e => setFilters(f => ({ ...f, anoLetivo: e.target.value }))} style={{ fontSize: 12 }}>
                    <option value="">Todos</option>
                    {YR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 10 }}>Unidade</label>
                  <select className="form-input" value={filters.unidade} onChange={e => setFilters(f => ({ ...f, unidade: e.target.value }))} style={{ fontSize: 12 }}>
                    <option value="">Todas</option>
                    {unidadeOptions.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 10 }}>Turma</label>
                  <select className="form-input" value={filters.turma} onChange={e => setFilters(f => ({ ...f, turma: e.target.value }))} style={{ fontSize: 12 }}>
                    <option value="">Todas</option>
                    {turmaOptions.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 10 }}>Série</label>
                  <select className="form-input" value={filters.serie} onChange={e => setFilters(f => ({ ...f, serie: e.target.value }))} style={{ fontSize: 12 }}>
                    <option value="">Todas</option>
                    {serieOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 10 }}>Turno</label>
                  <select className="form-input" value={filters.turno} onChange={e => setFilters(f => ({ ...f, turno: e.target.value }))} style={{ fontSize: 12 }}>
                    <option value="">Todos</option>
                    {['Manhã', 'Tarde', 'Noite', 'Integral'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 10 }}>Status</label>
                  <select className="form-input" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))} style={{ fontSize: 12 }}>
                    <option value="">Todos</option>
                    {['matriculado', 'ativo', 'inativo', 'transferido', 'formado', 'cancelado'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: 10 }}>Sexo</label>
                  <select className="form-input" value={filters.sexo} onChange={e => setFilters(f => ({ ...f, sexo: e.target.value }))} style={{ fontSize: 12 }}>
                    <option value="">Todos</option>
                    <option value="M">Masculino</option>
                    <option value="F">Feminino</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* ── COLUMN BUILDER ───────────────────────── */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Table2 size={15} color={ACCENT} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Colunas do Relatório</span>
                {columns.length > 0 && (
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: `${ACCENT}12`, color: ACCENT }}>{columns.length} campo(s)</span>
                )}
              </div>
              <button
                onClick={() => { setShowFieldPicker(!showFieldPicker); setPickerSearch('') }}
                className="btn btn-primary"
                style={{ fontSize: 11, gap: 5 }}
              >
                <Plus size={13} /> Adicionar Campo
              </button>
            </div>

            {/* ── FIELD PICKER PANEL ───────────────────── */}
            {showFieldPicker && (
              <div style={{
                borderRadius: 12, border: `1px solid ${ACCENT}30`, background: `${ACCENT}05`,
                padding: 16, marginBottom: 16,
              }}>
                {/* Search + category tabs */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                    <input
                      className="form-input"
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      placeholder="Buscar campo..."
                      style={{ paddingLeft: 32, fontSize: 12 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setPickerCat('all')}
                      style={{
                        padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600, border: '1px solid',
                        borderColor: pickerCat === 'all' ? ACCENT : 'hsl(var(--border-default))',
                        background: pickerCat === 'all' ? `${ACCENT}14` : 'transparent',
                        color: pickerCat === 'all' ? ACCENT : 'hsl(var(--text-muted))',
                        cursor: 'pointer',
                      }}
                    >Todos ({FIELD_CATALOG.length})</button>
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.key}
                        onClick={() => setPickerCat(cat.key)}
                        style={{
                          padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600, border: '1px solid',
                          borderColor: pickerCat === cat.key ? cat.color : 'hsl(var(--border-default))',
                          background: pickerCat === cat.key ? `${cat.color}14` : 'transparent',
                          color: pickerCat === cat.key ? cat.color : 'hsl(var(--text-muted))',
                          cursor: 'pointer',
                        }}
                      >{cat.icon} {cat.label.replace(/─/g, '').trim()} ({FIELD_CATALOG.filter(f => f.category === cat.key).length})</button>
                    ))}
                  </div>
                </div>

                {/* Fields grid */}
                <div style={{
                  maxHeight: 280, overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: 5,
                  padding: 4,
                }}>
                  {pickerFields.length === 0 ? (
                    <div style={{ color: 'hsl(var(--text-muted))', fontSize: 12, padding: 20 }}>Nenhum campo encontrado.</div>
                  ) : pickerFields.map(field => (
                    <FieldChip
                      key={field.key}
                      field={field}
                      selected={selectedKeys.includes(field.key)}
                      onAdd={() => addField(field.key)}
                    />
                  ))}
                </div>

                {/* Quick add all from category */}
                {pickerCat !== 'all' && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => pickerFields.forEach(f => addField(f.key))}
                      style={{ fontSize: 10, padding: '4px 12px', borderRadius: 6, border: `1px solid ${ACCENT}40`, background: `${ACCENT}10`, color: ACCENT, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      + Adicionar todos desta categoria
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── COLUMN LIST ──────────────────────────── */}
            {columns.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 20px', color: 'hsl(var(--text-muted))', border: `1px dashed hsl(var(--border-default))`, borderRadius: 10 }}>
                <Table2 size={28} style={{ opacity: 0.25, marginBottom: 8 }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>Nenhum campo selecionado</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Clique em "Adicionar Campo" para escolher os campos</div>
              </div>
            ) : (
              <div>
                {/* Column header */}
                <div style={{ display: 'grid', gridTemplateColumns: '40px 40px 1fr auto auto', gap: 8, padding: '6px 10px', fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                  <span>Seq.</span>
                  <span>Vis.</span>
                  <span>Campo / Label</span>
                  <span>Categoria</span>
                  <span>Ações</span>
                </div>

                {columns.map((col, idx) => {
                  const field = getField(col.fieldKey)
                  const isEditing = editingCol === col.id
                  return (
                    <div
                      key={col.id}
                      style={{
                        display: 'grid', gridTemplateColumns: '40px 40px 1fr auto auto',
                        gap: 8, padding: '7px 10px', alignItems: 'center',
                        borderBottom: '1px solid hsl(var(--border-subtle))',
                        background: idx % 2 === 0 ? 'transparent' : 'hsl(var(--bg-elevated) / 40%)',
                        opacity: col.visible ? 1 : 0.45,
                      }}
                    >
                      {/* Seq */}
                      <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, textAlign: 'center' }}>{col.seq}</span>

                      {/* Visibility toggle */}
                      <button
                        onClick={() => toggleVisibility(col.id)}
                        title={col.visible ? 'Ocultar' : 'Mostrar'}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', color: col.visible ? ACCENT : 'hsl(var(--text-muted))' }}
                      >
                        {col.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>

                      {/* Label (editable) */}
                      <div style={{ minWidth: 0 }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 5 }}>
                            <input
                              className="form-input"
                              value={editLabel}
                              onChange={e => setEditLabel(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') commitEditLabel(); if (e.key === 'Escape') setEditingCol(null) }}
                              autoFocus
                              style={{ fontSize: 12, padding: '3px 8px' }}
                            />
                            <button onClick={commitEditLabel} className="btn btn-primary" style={{ padding: '3px 8px', fontSize: 10 }}>✓</button>
                            <button onClick={() => setEditingCol(null)} className="btn btn-secondary" style={{ padding: '3px 8px', fontSize: 10 }}>✗</button>
                          </div>
                        ) : (
                          <div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--text-primary))' }}>{col.label}</span>
                            {col.label !== field?.label && (
                              <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginLeft: 5 }}>({field?.label})</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Category badge */}
                      <div>{field && <CategoryBadge cat={field.category} />}</div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 3 }}>
                        <button onClick={() => moveColumn(col.id, -1)} disabled={idx === 0} title="Mover para cima" style={{ border: 'none', background: 'none', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1, color: 'hsl(var(--text-muted))', padding: 3 }}>
                          <ArrowUp size={13} />
                        </button>
                        <button onClick={() => moveColumn(col.id, 1)} disabled={idx === columns.length - 1} title="Mover para baixo" style={{ border: 'none', background: 'none', cursor: idx === columns.length - 1 ? 'default' : 'pointer', opacity: idx === columns.length - 1 ? 0.3 : 1, color: 'hsl(var(--text-muted))', padding: 3 }}>
                          <ArrowDown size={13} />
                        </button>
                        <button onClick={() => startEditLabel(col)} title="Renomear coluna" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))', padding: 3 }}>
                          <Edit3 size={13} />
                        </button>
                        <button onClick={() => removeColumn(col.id)} title="Remover coluna" style={{ border: 'none', background: 'none', cursor: 'pointer', color: RED, padding: 3 }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── GENERATE BUTTON & ERROR ───────────────── */}
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 8, background: '#fee2e2', color: RED, fontSize: 12 }}>
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {columns.length > 0 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setColumns([]); setGenerated(false); setRawRows([]) }} className="btn btn-secondary" style={{ fontSize: 11, gap: 5 }}>
                <X size={13} /> Limpar Campos
              </button>
              <button onClick={handleGenerate} disabled={loading} className="btn btn-primary" style={{ minWidth: 160, gap: 6 }}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                {loading ? 'Gerando...' : 'Gerar Relatório'}
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════ */}
          {/* RESULTS TABLE */}
          {/* ═══════════════════════════════════════════ */}
          {generated && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Table toolbar */}
              <div style={{ padding: '12px 18px', borderBottom: '1px solid hsl(var(--border-default))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ClipboardList size={15} color={ACCENT} />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Resultado</span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: `${ACCENT}12`, color: ACCENT }}>{sortedRows.length} registro(s)</span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }} className="form-input" style={{ fontSize: 11, padding: '4px 8px', width: 'auto' }}>
                    {[25, 50, 100, 200].map(s => <option key={s} value={s}>{s}/pág</option>)}
                  </select>
                  <button onClick={handleXLSX} className="btn btn-secondary" style={{ fontSize: 10, gap: 4, padding: '5px 10px' }}>
                    <FileSpreadsheet size={12} /> XLSX
                  </button>
                  <button onClick={handlePrint} className="btn btn-secondary" style={{ fontSize: 10, gap: 4, padding: '5px 10px' }}>
                    <Printer size={12} /> PDF
                  </button>
                </div>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      {visibleCols.map(col => (
                        <th
                          key={col.id}
                          onClick={() => toggleSort(col.id)}
                          style={{
                            padding: '8px 10px', textAlign: 'left',
                            background: 'hsl(var(--bg-elevated))',
                            borderBottom: '2px solid hsl(var(--border-default))',
                            fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))',
                            textTransform: 'uppercase', cursor: 'pointer',
                            whiteSpace: 'nowrap', userSelect: 'none',
                            position: 'sticky', top: 0,
                          }}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {col.label}
                            {sortField === col.id
                              ? (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)
                              : <ArrowUpDown size={9} style={{ opacity: 0.3 }} />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.length === 0 ? (
                      <tr>
                        <td colSpan={visibleCols.length} style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                          Nenhum registro encontrado para os filtros aplicados.
                        </td>
                      </tr>
                    ) : pagedRows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', background: i % 2 === 0 ? 'transparent' : 'hsl(var(--bg-elevated) / 40%)' }}>
                        {visibleCols.map(col => (
                          <td key={col.id} style={{ padding: '6px 10px', whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {renderCell(row[col.id], col.fieldKey)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  {/* Footer row count */}
                  {sortedRows.length > 0 && (
                    <tfoot>
                      <tr style={{ borderTop: `2px solid ${ACCENT}`, background: 'hsl(var(--bg-elevated))' }}>
                        <td colSpan={visibleCols.length} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                          Total: {sortedRows.length} registro(s)
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ padding: '10px 18px', borderTop: '1px solid hsl(var(--border-default))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                    {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sortedRows.length)} de {sortedRows.length}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={() => setPage(1)} disabled={page === 1} className="btn btn-secondary btn-icon" style={{ padding: '4px 8px', fontSize: 11 }}>«</button>
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary btn-icon" style={{ padding: '4px 10px', fontSize: 11 }}>‹</button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const p = page <= 3 ? i + 1 : page + i - 2
                      if (p < 1 || p > totalPages) return null
                      return (
                        <button key={p} onClick={() => setPage(p)} className={`btn ${page === p ? 'btn-primary' : 'btn-secondary'} btn-icon`} style={{ padding: '4px 10px', fontSize: 11 }}>
                          {p}
                        </button>
                      )
                    })}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-secondary btn-icon" style={{ padding: '4px 10px', fontSize: 11 }}>›</button>
                    <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="btn btn-secondary btn-icon" style={{ padding: '4px 8px', fontSize: 11 }}>»</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
