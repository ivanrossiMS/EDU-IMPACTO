'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';

import { useState, useCallback, useMemo } from 'react'
import { useData } from '@/lib/dataContext'
import { type CensoExport } from '@/lib/dataContext'
import { FileText, Download, AlertTriangle, XCircle, CheckCircle2, Eye, Lock, BarChart3, Info, Layers, Users, GraduationCap, BookOpen } from 'lucide-react'

// ─── UTILITÁRIOS DE GERAÇÃO ───────────────────────────────────────────────────

function padR(s: string, n: number) { return String(s || '').slice(0, n).padEnd(n, ' ') }
function padL(s: string, n: number) { return String(s || '').slice(0, n).padStart(n, '0') }
function padLN(n: number, len: number) { return String(Math.abs(Math.floor(n)) || 0).padStart(len, '0') }

function calcHash(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash) + content.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')
}

function cleanDate(d: string): string {
  if (!d) return '00000000'
  try {
    const parts = d.includes('/') ? d.split('/').reverse() : d.split('-')
    return `${parts[2]||'00'}${parts[1]||'00'}${parts[0]||'00'}`.slice(0, 8).replace(/\D/g,'0')
  } catch { return '00000000' }
}

const TURNO_MAP: Record<string, string> = {
  'Manhã':'1','manhã':'1','manha':'1',
  'Tarde':'2','tarde':'2',
  'Noite':'3','noite':'3','Noche':'3',
  'Integral':'4','integral':'4',
  'Intermediário':'5','intermediario':'5',
}

const SEX_MAP: Record<string, string> = {
  'M':'1','F':'2','m':'1','f':'2','1':'1','2':'2',
  'masculino':'1','feminino':'2','Masculino':'1','Feminino':'2',
}

// ─── GERADOR OFICIAL INEP ─────────────────────────────────────────────────────
function gerarArquivoINEP(data: {
  escola: any; turmas: any[]; alunos: any[]; funcionarios: any[]
  censoAlunosData: any[]; censoTurmasData: any[]; censoProfsData: any[]
  anoCensitario: number; etapa: string; layoutVersion: string
}): string {
  const lines: string[] = []
  const ano = String(data.anoCensitario)
  const inep = padR(data.escola?.inep?.replace(/\D/g,'') || '', 8)
  const censoAluMap = new Map(data.censoAlunosData.map((ca: any) => [ca.alunoId, ca]))
  const censoTurMap = new Map(data.censoTurmasData.map((ct: any) => [ct.turmaId, ct]))
  const censoPrfMap = new Map(data.censoProfsData.map((cp: any) => [cp.funcionarioId, cp]))

  // ── R00: Escola ──────────────────────────────────────────────────────────────
  if (data.escola) {
    const e = data.escola
    lines.push([
      '00',                                                   // 2   tipo registro
      padR(ano, 4),                                           // 4   ano censitário
      padR(inep, 8),                                          // 8   código INEP escola
      padR(e.nomeFantasia || e.razaoSocial || '', 100),       // 100 nome escola
      padR(e.cnpj?.replace(/\D/g,'') || '', 14),             // 14  CNPJ
      '2',                                                    // 1   dependência admin (2=privada)
      '1',                                                    // 1   situação funcionamento (1=ativa)
      padR(e.estado || '', 2),                                // 2   UF
      padR(e.cidade || '', 60),                               // 60  município
      padR(e.endereco || e.logradouro || '', 60),             // 60  endereço
      padR(e.numero || 'S/N', 10),                            // 10  número
      padR(e.complemento || '', 30),                          // 30  complemento
      padR(e.bairro || '', 50),                               // 50  bairro
      padR(e.cep?.replace(/\D/g,'') || '', 8),               // 8   CEP
      padR(e.telefone?.replace(/\D/g,'') || '', 15),         // 15  telefone
      padR(e.email || '', 80),                                // 80  e-mail
      padR(e.diretor?.nome || '', 80),                        // 80  gestor
      padR(data.etapa === '1-matricula' ? '1' : '2', 1),     // 1   etapa
      padR(data.layoutVersion, 10),                           // 10  layout
    ].join(''))
  }

  // ── R10: Turmas ──────────────────────────────────────────────────────────────
  const turmasValidas = data.turmas.filter((t: any) => t.nome?.trim())
  turmasValidas.forEach((t: any, i: number) => {
    const ct = censoTurMap.get(t.id) as any
    const codigo = padLN(i + 1, 5)
    lines.push([
      '10',                                     // tipo registro
      padR(ano, 4),                             // ano
      inep,                                     // INEP escola
      codigo,                                   // 5   código turma (sequencial)
      padR(ct?.codigoINEP || codigo, 8),        // 8   código INEP turma
      padR(t.nome || '', 50),                   // 50  nome turma
      padR(TURNO_MAP[t.turno] || '1', 1),       // 1   turno
      padR(ct?.etapaModalidade || '', 10),      // 10  etapa/modalidade
      padL(String(t.capacidade || 0), 3),       // 3   capacidade máxima
      padR(ct?.tipoAtendimento || '1', 1),      // 1   tipo atendimento turma
      padR(ct?.tipoMediacaoDidatica || '1', 1), // 1   mediação didática
      padR(ct?.localizacaoDiferenciada || '0',1), // 1 localização diferenciada
      padR(t.professor || '', 80),              // 80  docente responsável
      padR('', 20),                             //     reserva
    ].join(''))
  })

  // ── R20: Alunos / Código ──────────────────────────────────────────────────
  const alunosValidos = data.alunos.filter((a: any) => a.nome?.trim())
  alunosValidos.forEach((a: any, i: number) => {
    const ca   = censoAluMap.get(a.id) as any
    const turmaIdx = turmasValidas.findIndex((t: any) => t.nome === a.turma)
    const codTurma = padLN(turmaIdx >= 0 ? turmaIdx + 1 : 1, 5)
    const dt   = cleanDate(a.dataNascimento)
    const sexo = ca?.sexo || SEX_MAP[a.sexo || ''] || SEX_MAP[a.genero || ''] || '1'

    lines.push([
      '20',                                     // tipo
      padR(ano, 4),                             // ano
      inep,                                     // INEP escola
      padLN(i + 1, 7),                          // 7   nº matrícula censo (sequencial)
      padR(a.matricula || String(i + 1), 20),   // 20  matrícula interna
      padR(a.nome, 80),                         // 80  nome completo
      padR(dt, 8),                              // 8   data nasc DDMMAAAA
      padR(sexo, 1),                            // 1   sexo 1=M 2=F
      padR(a.cpf?.replace(/\D/g,'') || '', 11),// 11  CPF (opcional)
      padR(codTurma, 5),                        // 5   código turma
      padR(ca?.tipoAtendimento || '1', 1),      // 1   tipo atendimento
      padR(ca?.etapaModalidade || '', 10),      // 10  etapa/modalidade
      padR(ca?.corRaca || '0', 1),              // 1   cor/raça
      padR(ca?.nacionalidade || '1', 1),        // 1   nacionalidade
      padR(ca?.naturalidadeUF || '', 2),        // 2   UF nascimento
      padR(ca?.deficiencia ? '1' : '0', 1),    // 1   tem deficiência
      // Tipos de deficiência — 13 campos de 1 char (0=não, 1=sim)
      ...Array.from({length:13}, (_,j) => padR(ca?.tiposDeficiencia?.includes(String(j+1).padStart(2,'0')) ? '1':'0', 1)),
      padR(ca?.tipoMatricula || '1', 1),        // 1   tipo matrícula
      padR(ca?.dataMatricula?.replace(/-/g,'')?.slice(0,8) || '00000000', 8), // 8 data matrícula
      padR('', 20),                             //     reserva
    ].join(''))
  })

  // ── R30: Situação Final do Aluno (Etapa 2) ───────────────────────────────────
  if (data.etapa === '2-situacao') {
    alunosValidos.forEach((a: any, i: number) => {
      const ca = censoAluMap.get(a.id) as any
      lines.push([
        '30',
        padR(ano, 4),
        inep,
        padLN(i + 1, 7),                 // nº matrícula censo
        padR(ca?.situacaoCenso || '8', 1),// 1 situação final (8=ainda matriculado)
        padR('', 20),
      ].join(''))
    })
  }

  // ── R40: Profissionais ───────────────────────────────────────────────────────
  const docentes = data.funcionarios.filter((f: any) =>
    f.cargo?.toLowerCase().includes('professor') ||
    f.cargo?.toLowerCase().includes('docente') ||
    f.cargo?.toLowerCase().includes('auxiliar')
  )
  docentes.forEach((f: any, i: number) => {
    const cp = censoPrfMap.get(f.id) as any
    lines.push([
      '40',
      padR(ano, 4),
      inep,
      padLN(i + 1, 7),                           // nº sequencial profissional
      padR(cp?.cpf?.replace(/\D/g,'') || '', 11), // 11 CPF
      padR(f.nome, 80),                           // 80 nome
      padR(cp?.funcaoDocente || '1', 2),          // 2  função docente (código INEP)
      padR(cp?.escolaridade || '7', 1),           // 1  escolaridade
      padR(f.email || '', 80),                    // 80 e-mail
      padR('', 20),                               //    reserva
    ].join(''))
  })

  // ── R50: Vínculo Professor × Turma × Disciplina (NOVO) ──────────────────────
  let vinculoSeq = 0
  docentes.forEach((f: any) => {
    const cp = censoPrfMap.get(f.id) as any
    const vincs = cp?.turmasVinculadas || []
    vincs.forEach((v: any) => {
      const turmaIdx = turmasValidas.findIndex((t: any) => t.id === v.turmaId)
      if (turmaIdx < 0) return
      vinculoSeq++
      lines.push([
        '50',
        padR(ano, 4),
        inep,
        padLN(vinculoSeq, 7),                  // sequencial vínculo
        padLN(turmaIdx + 1, 5),                // código turma
        padR(f.nome, 80),                      // nome professor
        padR(cp?.cpf?.replace(/\D/g,'') || '', 11), // CPF professor
        padR(v.disciplinaNome || '', 60),      // disciplina
        padL(String(v.cargaHoraria || 0), 3), // carga horária
        padR(cp?.funcaoDocente || '1', 2),     // função docente
        padR('', 20),
      ].join(''))
    })
  })

  return lines.join('\r\n')
}

// ─── COMPONENTE ──────────────────────────────────────────────────────────────
export function GeracaoArquivosTab() {
  const { turmas = [], mantenedores = [], censoConfig, censoPendencias = [], setCensoExports, censoExports = [], logCensoAction, censoAlunosData, censoTurmasData, censoProfsData } = useData();
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const [funcionarios, setFuncionarios] = useSupabaseArray<any>('rh/funcionarios');

  const [preview, setPreview]       = useState(false)
  const [generating, setGenerating] = useState(false)

  const todasUnidades = (mantenedores || []).flatMap(m => m.unidades || [])
  const unidadeAtivaId = censoConfig.unidadeId || (todasUnidades[0]?.id || '')
  const escola = (todasUnidades.find(u => u.id === unidadeAtivaId) || todasUnidades[0]) as any

  const isUnidade = (regUnid: string) => {
    if (!unidadeAtivaId) return true
    if (regUnid === unidadeAtivaId) return true
    if (escola && (regUnid === escola.nomeFantasia || regUnid === escola.razaoSocial)) return true
    return false
  }

  const criticas       = censoPendencias.filter(p => p.tipo === 'critica' && (p.status === 'aberta' || p.status === 'em_tratamento'))
  const alertas        = censoPendencias.filter(p => (p.tipo === 'alta' || p.tipo === 'media') && (p.status === 'aberta' || p.status === 'em_tratamento'))
  const bloqueado      = criticas.length > 0
  const alunosValidos  = alunos.filter(a => isUnidade(a.unidade)).filter(a => a.nome?.trim())
  const turmasValidas  = turmas.filter(t => isUnidade(t.unidade)).filter(t => t.nome?.trim())
  const docentes       = funcionarios.filter(f => isUnidade(f.unidade)).filter(f =>
    f.cargo?.toLowerCase().includes('professor') ||
    f.cargo?.toLowerCase().includes('docente') ||
    f.cargo?.toLowerCase().includes('auxiliar')
  )
  const vinculosTotal  = censoProfsData.reduce((s, cp) => s + (cp.turmasVinculadas?.length || 0), 0)
  const situacoes      = censoConfig.etapaAtiva === '2-situacao' ? alunosValidos.length : 0
  const totalLinhas    = 1 + turmasValidas.length + alunosValidos.length + situacoes + docentes.length + vinculosTotal

  // Completude de dados censo
  const alunosComCenso = censoAlunosData.filter(ca => ca.sexo && ca.etapaModalidade && ca.tipoAtendimento).length
  const tumasComEtapa  = censoTurmasData.filter(ct => ct.etapaModalidade).length
  const profsComCPF    = censoProfsData.filter(cp => cp.cpf).length

  const handleGerar = useCallback(async () => {
    if (bloqueado) return
    setGenerating(true)
    await new Promise(r => setTimeout(r, 900))

    const content = gerarArquivoINEP({
      escola, turmas: turmasValidas, alunos: alunosValidos,
      funcionarios, censoAlunosData, censoTurmasData, censoProfsData,
      anoCensitario: censoConfig.anoCensitario,
      etapa: censoConfig.etapaAtiva,
      layoutVersion: censoConfig.layoutVersion,
    })

    const hash     = calcHash(content)
    const dataStr  = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const etapaNum = censoConfig.etapaAtiva === '1-matricula' ? '1' : '2'
    const nomeArq  = `EDUCACENSO_${censoConfig.anoCensitario}_ETAPA${etapaNum}_${escola?.inep?.replace(/\D/g,'') || 'ESCOLA'}_${dataStr}.txt`

    const exportacao: CensoExport = {
      id: `EXP-${Date.now()}`,
      anoCensitario: censoConfig.anoCensitario,
      etapa: censoConfig.etapaAtiva,
      layoutVersion: censoConfig.layoutVersion,
      dataGeracao: new Date().toISOString(),
      usuarioGerou: (() => { try { const u = JSON.parse(localStorage.getItem('edu-current-user')||'null'); return u?.nome || 'Usuário' } catch { return 'Usuário' } })(),
      totalRegistros: totalLinhas,
      totalAlunos: alunosValidos.length,
      totalTurmas: turmasValidas.length,
      totalProfissionais: docentes.length,
      hash,
      nomeArquivo: nomeArq,
      conteudo: btoa(unescape(encodeURIComponent(content))),
      status: 'gerado',
      pendenciasNaMomento: censoPendencias.filter(p => p.status === 'aberta' || p.status === 'em_tratamento').length,
    }

    setCensoExports(prev => [exportacao, ...prev])
    logCensoAction('Geração de Arquivo', `Arquivo gerado: ${nomeArq}`, {
      anoCensitario: censoConfig.anoCensitario, etapa: censoConfig.etapaAtiva,
      registroNome: `${totalLinhas} registros · hash ${hash}`,
    })
    setGenerating(false)
  }, [bloqueado, escola, turmasValidas, alunosValidos, funcionarios, censoConfig, totalLinhas, censoPendencias, censoAlunosData, censoTurmasData, censoProfsData])

  const handleDownload = (exp: CensoExport) => {
    if (!exp.conteudo) return
    const content = decodeURIComponent(escape(atob(exp.conteudo)))
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = exp.nomeArquivo; a.click()
    URL.revokeObjectURL(url)
    setCensoExports(prev => prev.map(e => e.id === exp.id ? { ...e, status: 'baixado' } : e))
    logCensoAction('Download', `Download: ${exp.nomeArquivo}`, { anoCensitario: exp.anoCensitario, etapa: exp.etapa })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Geração de Arquivo Oficial INEP</h2>
        <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', margin: '4px 0 0' }}>
          Layout Educacenso {censoConfig.layoutVersion} · Registros R00/R10/R20/R30/R40/R50 ·
          Etapa {censoConfig.etapaAtiva === '1-matricula' ? '1 — Código Inicial' : '2 — Situação do Aluno'}
        </p>
      </div>

      {/* ALERTA BLOQUEIO */}
      {bloqueado && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 14, padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <Lock size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }}/>
          <div>
            <div style={{ fontWeight: 700, color: '#fca5a5', marginBottom: 4 }}>
              Geração BLOQUEADA — {criticas.length} erro(s) crítico(s) impedem o envio
            </div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
              Resolva todas as pendências críticas na aba "Pendências" ou reexecute o Validador para atualizar.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10 }}>
              {criticas.slice(0, 4).map(c => (
                <div key={c.id} style={{ fontSize: 11, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <XCircle size={11} color="#ef4444"/> {c.registroNome} · {c.campo} — {c.descricao.slice(0, 80)}
                </div>
              ))}
              {criticas.length > 4 && <div style={{ fontSize: 11, color: '#94a3b8' }}>+ {criticas.length - 4} outros críticos...</div>}
            </div>
          </div>
        </div>
      )}
      {!bloqueado && alertas.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
          <AlertTriangle size={16} color="#f59e0b"/>
          <div style={{ fontSize: 12 }}>
            <strong style={{ color: '#fbbf24' }}>{alertas.length} alerta(s) não crítico(s).</strong> A geração prosseguirá, mas revise os alertas.
          </div>
        </div>
      )}

      {/* PAINEL PRINCIPAL */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* RESUMO DE REGISTROS */}
        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, padding: 24 }}>
          <div style={{ fontWeight: 800, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={16} color="#6366f1"/> Resumo da Exportação
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'R00 — Escola (Header)',           count: 1,                  icon: <BookOpen size={13}/>, ok: !!escola },
              { label: 'R10 — Turmas',                   count: turmasValidas.length, icon: <Layers size={13}/>, ok: turmasValidas.length > 0 },
              { label: 'R20 — Alunos / Matrícula',       count: alunosValidos.length, icon: <Users size={13}/>,   ok: alunosValidos.length > 0 },
              { label: 'R30 — Situação Final (Etapa 2)', count: situacoes,            icon: <CheckCircle2 size={13}/>, ok: true },
              { label: 'R40 — Profissionais',            count: docentes.length,     icon: <GraduationCap size={13}/>, ok: true },
              { label: 'R50 — Vínculos Prof×Turma',      count: vinculosTotal,       icon: <FileText size={13}/>,  ok: true },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'hsl(var(--bg-elevated))', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  {item.ok ? <CheckCircle2 size={13} color="#10b981"/> : <XCircle size={13} color="#ef4444"/>}
                  <span style={{ color: 'hsl(var(--text-muted))' }}>{item.icon}</span>
                  {item.label}
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: item.ok ? 'hsl(var(--text-primary))' : '#ef4444' }}>{item.count}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(99,102,241,0.06)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.15)', marginTop: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>TOTAL DE LINHAS</span>
              <span style={{ fontSize: 16, fontWeight: 900, color: '#818cf8', fontFamily: 'Outfit' }}>{totalLinhas}</span>
            </div>
          </div>
        </div>

        {/* PARÂMETROS + COMPLETUDE CENSO */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, padding: 24 }}>
            <div style={{ fontWeight: 800, marginBottom: 14 }}>Parâmetros</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Ano Censitário', value: censoConfig.anoCensitario },
                { label: 'Etapa', value: censoConfig.etapaAtiva === '1-matricula' ? '1 — Código Inicial' : '2 — Situação do Aluno' },
                { label: 'Layout INEP', value: `Educacenso ${censoConfig.layoutVersion}` },
                { label: 'Escola / INEP', value: `${escola?.nomeFantasia || '—'} · ${escola?.inep || '—'}` },
                { label: 'Codificação', value: 'UTF-8 / ISO-8859-1' },
                { label: 'Separador', value: 'Largura fixa (sem delimitador)' },
                { label: 'Terminador de linha', value: 'CRLF (\\r\\n)' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'hsl(var(--text-muted))' }}>{item.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Completude Censo */}
          <div style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 14, padding: 18 }}>
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Info size={14} color="#818cf8"/> Completude dos Dados Censo
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              {[
                { label: `Alunos com dados censo (${alunosComCenso}/${alunosValidos.length})`, pct: alunosValidos.length > 0 ? Math.round((alunosComCenso / alunosValidos.length) * 100) : 0 },
                { label: `Turmas com etapa INEP (${tumasComEtapa}/${turmasValidas.length})`, pct: turmasValidas.length > 0 ? Math.round((tumasComEtapa / turmasValidas.length) * 100) : 0 },
                { label: `Profissionais com CPF (${profsComCPF}/${docentes.length})`, pct: docentes.length > 0 ? Math.round((profsComCPF / docentes.length) * 100) : 100 },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, color: 'hsl(var(--text-muted))', fontSize: 11 }}>
                    <span>{item.label}</span><span style={{ fontWeight: 700, color: item.pct === 100 ? '#10b981' : item.pct >= 70 ? '#f59e0b' : '#ef4444' }}>{item.pct}%</span>
                  </div>
                  <div style={{ height: 4, background: 'hsl(var(--bg-overlay))', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${item.pct}%`, height: '100%', background: item.pct === 100 ? '#10b981' : item.pct >= 70 ? '#f59e0b' : '#ef4444', borderRadius: 2, transition: 'width 0.3s' }}/>
                  </div>
                </div>
              ))}
            </div>
            {alunosComCenso < alunosValidos.length && (
              <div style={{ marginTop: 10, fontSize: 11, color: '#fbbf24', background: 'rgba(245,158,11,0.08)', borderRadius: 8, padding: '6px 10px' }}>
                ⚠ {alunosValidos.length - alunosComCenso} aluno(s) sem dados censo incompletos vão gerar linhas R20 com campos em branco. Complete em Código Inicial.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTÕES */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={handleGerar}
          disabled={bloqueado || generating}
          className="btn btn-primary"
          style={{ gap: 8, padding: '12px 28px', fontSize: 14, fontWeight: 700, opacity: (bloqueado || generating) ? 0.5 : 1 }}
        >
          {bloqueado ? <Lock size={16}/> : <FileText size={16}/>}
          {generating ? 'Gerando arquivo...' : bloqueado ? 'Bloqueado — Corrija Erros Críticos' : 'Gerar Arquivo Oficial'}
        </button>
        {censoExports[0] && (
          <button onClick={() => setPreview(!preview)} className="btn btn-secondary" style={{ gap: 8 }}>
            <Eye size={15}/> {preview ? 'Ocultar Preview' : 'Preview do Último Arquivo'}
          </button>
        )}
        {censoExports[0] && (
          <button onClick={() => handleDownload(censoExports[0])} className="btn btn-secondary" style={{ gap: 8 }}>
            <Download size={15}/> Baixar Último
          </button>
        )}
      </div>

      {/* PREVIEW */}
      {preview && censoExports[0]?.conteudo && (
        <div style={{ background: '#0d1117', borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#7ee787' }}>{censoExports[0].nomeArquivo}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Hash: {censoExports[0].hash} · {censoExports[0].totalRegistros} linhas</span>
          </div>
          <pre style={{ margin: 0, padding: '16px', fontSize: 10, fontFamily: 'monospace', color: '#e6edf3', overflowX: 'auto', maxHeight: 320, overflowY: 'auto', lineHeight: 1.6 }}>
            {(() => { try { return decodeURIComponent(escape(atob(censoExports[0].conteudo!))).split('\n').slice(0, 50).join('\n') } catch { return '(erro ao decodificar)' } })()}
          </pre>
        </div>
      )}

      {/* HISTÓRICO DE GERAÇÕES */}
      {censoExports.length > 0 && (
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14 }}>Histórico de Gerações</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {censoExports.slice(0, 8).map((exp, i) => {
              const STATUS_MAP: Record<string, {color:string;bg:string}> = {
                gerado:    {color:'#818cf8',bg:'rgba(99,102,241,0.1)'},
                baixado:   {color:'#10b981',bg:'rgba(16,185,129,0.1)'},
                enviado:   {color:'#3b82f6',bg:'rgba(59,130,246,0.1)'},
                rejeitado: {color:'#ef4444',bg:'rgba(239,68,68,0.1)'},
              }
              const statusItem = STATUS_MAP[exp.status] || {color:'#94a3b8',bg:'rgba(148,163,184,0.1)'}
              return (
                <div key={exp.id} style={{ background: 'hsl(var(--bg-surface))', border: `1px solid ${i===0?'rgba(99,102,241,0.2)':'hsl(var(--border-subtle))'}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <FileText size={18} color={i===0?'#818cf8':'hsl(var(--text-muted))'}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{exp.nomeArquivo}</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                      {new Date(exp.dataGeracao).toLocaleString('pt-BR')} · {exp.totalRegistros} registros · {exp.totalAlunos} alunos · hash <code style={{ background: 'hsl(var(--bg-overlay))', padding: '1px 4px', borderRadius: 3 }}>{exp.hash}</code>
                    </div>
                    {exp.pendenciasNaMomento > 0 && (
                      <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2 }}>⚠ {exp.pendenciasNaMomento} pendências no momento da geração</div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: statusItem.bg, color: statusItem.color }}>
                    {exp.status.toUpperCase()}
                  </span>
                  <button onClick={() => handleDownload(exp)} className="btn btn-secondary btn-sm" style={{ gap: 6 }}>
                    <Download size={13}/> Baixar
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
