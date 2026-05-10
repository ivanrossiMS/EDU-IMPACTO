'use client'

import { useData } from '@/lib/dataContext'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useState, useMemo, useRef, Fragment } from 'react'
import { useEnsalamento } from '@/lib/useEnsalamento'
import { aplicarArredondamentoGeral, getCasasVirgula } from '@/lib/notasEngine'
import { Printer, Search, FileText, GraduationCap, BookOpen, AlertTriangle } from 'lucide-react'

// ─── helpers ───────────────────────────────────────────────────────────────────
const fmt = (v: number | null | undefined, casas = 1) =>
  v === null || v === undefined ? '—' : v.toFixed(casas)

function situacaoCor(media: number | null, minAprov = 6, minRec = 5) {
  if (media === null) return { bg: '#f1f5f9', color: '#94a3b8', label: 'Aguardando' }
  if (media >= minAprov) return { bg: '#dcfce7', color: '#166534', label: 'Aprovado' }
  if (media >= minRec)   return { bg: '#fef9c3', color: '#854d0e', label: 'Recuperação' }
  return { bg: '#fee2e2', color: '#991b1b', label: 'Reprovado' }
}

// ─── sub-component: one student boletim ────────────────────────────────────────
function BoletimAluno({
  aluno, turmaObj, disciplinas, lancamentosNota, esquemaNota,
  cfgArredondamentos, cfgFormulasNotas, turmaId, anoLetivo, numeroChamada, unidade
}: any) {
  const formula = useMemo(() => {
    const ativas = (cfgFormulasNotas || []).filter((f: any) => f.situacao === 'Ativo')
    if (!ativas.length) return null
    if (turmaObj?.serie) {
      const m = ativas.find((f: any) => f.nivel?.toLowerCase() === turmaObj.serie?.toLowerCase())
      if (m) return m
    }
    return ativas[0] || null
  }, [cfgFormulasNotas, turmaObj])

  const casas = getCasasVirgula(formula)
  const minAprov = formula?.media ?? 6
  const minRec = formula?.mediaAposRecuperacao ?? 5
  const bims = [1, 2, 3, 4]

  // For each discipline, for each bimestre: get mediaParcial, faltas, rec
  const rows = disciplinas.map((disc: string) => {
    const bimData = bims.map(bim => {
      const lanc = lancamentosNota.find((l: any) =>
        l.turmaId === turmaId && l.disciplina === disc && l.bimestre === bim
      )
      const notaAluno = lanc?.notas?.find((n: any) => n.alunoId === aluno.id)
      if (!notaAluno) return { mp: null, faltas: 0, rec: null }

      // find recuperacao value in valores
      const esquema = esquemaNota.find((e: any) => e.id === lanc?.esquemaId)
      const detalhes = esquema?.detalhes || []
      let rec: number | null = null
      if (notaAluno.valores) {
        for (const det of detalhes) {
          const meta = det.tipoDado
          if (meta?.includes('Recuperação') || meta === 'Recuperação 1' || meta === 'Recuperação 2') {
            const v = notaAluno.valores[det.id]
            if (v !== null && v !== undefined && v !== '') {
              rec = typeof v === 'number' ? v : parseFloat(String(v))
              break
            }
          }
        }
      }
      return { mp: notaAluno.mediaParcial ?? null, faltas: notaAluno.faltas ?? 0, rec }
    })

    // Média anual = avg of non-null MPs
    const validMPs = bimData.map(b => b.mp).filter(m => m !== null) as number[]
    let mediaAnual: number | null = null
    if (validMPs.length > 0) {
      const raw = validMPs.reduce((a, b) => a + b, 0) / validMPs.length
      mediaAnual = aplicarArredondamentoGeral(raw, cfgArredondamentos, formula, true)
    }

    // Total faltas
    const totalFaltas = bimData.reduce((s, b) => s + (b.faltas || 0), 0)

    // Resultado final lanc (bimestre=0)
    const lancRF = lancamentosNota.find((l: any) =>
      l.turmaId === turmaId && l.disciplina === disc && l.bimestre === 0
    )
    const notaRF = lancRF?.notas?.find((n: any) => n.alunoId === aluno.id)
    const mediaFinal = notaRF?.mediaParcial ?? mediaAnual

    const sit = situacaoCor(mediaFinal, minAprov, minRec)

    return { disc, bimData, mediaAnual, totalFaltas, mediaFinal, sit, casas }
  })

  const enderecoLinha1 = [unidade?.endereco, unidade?.numero && `nº ${unidade.numero}`, unidade?.bairro].filter(Boolean).join(', ')
  const enderecoLinha2 = [unidade?.cidade && `${unidade.cidade}${unidade?.estado ? `/${unidade.estado}` : ''}`, unidade?.cep && `CEP ${unidade.cep}`].filter(Boolean).join(' — ')

  return (
    <div className="boletim-card">

      {/* ─── CABEÇALHO INSTITUCIONAL ─── */}
      <div className="bh-wrapper">

        {/* Painel esquerdo branco */}
        <div className="bh-left">
          <div className="bh-logo-wrap">
            {unidade?.logo
              ? <img src={unidade.logo} alt="Logo" className="bh-logo-img" />
              : (
                <div className="bh-logo-fallback">
                  <span style={{ fontSize: 9, fontWeight: 800, color: '#1d4ed8', letterSpacing: '0.1em', textTransform: 'uppercase' }}>COLÉGIO</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: '#1d4ed8', fontFamily: 'Outfit,sans-serif', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {(unidade?.nome || 'IMPACTO').split(' ').pop()?.toUpperCase()}
                  </span>
                </div>
              )
            }
          </div>

          <div className="bh-info">
            <p className="bh-nome">{unidade?.nome || 'IMPACTO EDU'}</p>
            {unidade?.razaoSocial && <p className="bh-row">{unidade.razaoSocial}</p>}
            {enderecoLinha1 && (
              <p className="bh-row bh-row-icon">
                <span>&#x1F4CD;</span>
                <span>{enderecoLinha1}{enderecoLinha2 ? ` ${enderecoLinha2}` : ''}</span>
              </p>
            )}
            {unidade?.telefone && (
              <p className="bh-row bh-row-icon">
                <span>&#x1F4F2;</span>
                <span>{unidade.telefone}</span>
              </p>
            )}
            {unidade?.email && (
              <p className="bh-row bh-row-icon">
                <span>&#x1F4E7;</span>
                <span>{unidade.email}</span>
              </p>
            )}
            {unidade?.cnpj && <p className="bh-row">CNPJ: {unidade.cnpj}</p>}
            {(unidade?.inep || unidade?.codigoMec) && (
              <p className="bh-row">Código MEC: INEP/Censo: {unidade.inep || unidade.codigoMec}</p>
            )}
          </div>
        </div>

        {/* Painel direito azul com diagonal */}
        <div className="bh-right">
          {/* Forma diagonal branca sobre fundo azul */}
          <div className="bh-chevron" />
          <div className="bh-chevron-light" /> {/* Faixa azul clara */}

          <div className="bh-right-content">
            <div className="bh-doc-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,1)" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <p className="bh-tag">BOLETIM DE</p>
            <p className="bh-title">AVALIAÇÃO ESCOLAR</p>
            <div className="bh-hr" />
            <div className="bh-year">
              <span>&#x1F4C5;</span> ANO LETIVO {anoLetivo}
            </div>
          </div>

          {/* SVG decorativo livro/folha — canto direito */}
          <svg className="bh-deco-svg" viewBox="0 0 120 120" fill="none" aria-hidden="true">
            <ellipse cx="60" cy="95" rx="38" ry="12" fill="white" opacity="0.08"/>
            <path d="M60 88 Q40 55 46 28 Q60 14 74 28 Q80 55 60 88Z" fill="white" opacity="0.1"/>
            <path d="M60 88 Q72 60 67 32" stroke="white" strokeWidth="2.5" opacity="0.15"/>
            <rect x="28" y="84" width="64" height="10" rx="3" fill="white" opacity="0.09"/>
            <rect x="30" y="76" width="60" height="10" rx="3" fill="white" opacity="0.07"/>
          </svg>
        </div>
      </div>

      {/* Barra azul escura com site */}
      {unidade?.website && (
        <div className="bh-sitebar">
          <span>&#x1F310;</span> {unidade.website}
        </div>
      )}

      {/* ── DADOS DO ALUNO: Nome | Turma | Turno | Nº Chamada | Matrícula ── */}
      <div className="student-info-bar">
        <div className="info-item" style={{ flex: 3, minWidth: 220 }}>
          <span className="info-label">Nome do Aluno(a)</span>
          <span className="info-val aluno-nome">{aluno.nome}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Turma</span>
          <span className="info-val">{turmaObj?.nome || '—'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Turno</span>
          <span className="info-val">{turmaObj?.turno || '—'}</span>
        </div>
        <div className="info-item chamada-item">
          <span className="info-label">Nº Chamada</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #1d4ed8, #1e3a8a)',
              color: '#fff', fontSize: 16, fontWeight: 900, fontFamily: 'Outfit, monospace',
              boxShadow: '0 3px 10px rgba(29,78,216,0.35)', flexShrink: 0,
            }}>
              {numeroChamada != null ? String(numeroChamada).padStart(2, '0') : '—'}
            </span>
          </div>
        </div>
        <div className="info-item">
          <span className="info-label">Matrícula</span>
          <span className="info-val">{aluno.matricula || '—'}</span>
        </div>
      </div>

      {/* Grade table */}
      <div className="table-wrapper">
        <table className="boletim-table">
          <thead>
            <tr className="bim-headers">
              <th rowSpan={2} className="disc-col">Componente Curricular</th>
              {bims.map(b => (
                <th key={b} colSpan={3} className="bim-group">{b}º Bimestre</th>
              ))}
              <th rowSpan={2} className="media-anual">Méd. Anual</th>
              <th rowSpan={2} className="faltas-col">Faltas</th>
              <th rowSpan={2} className="media-final">Méd. Final</th>
              <th rowSpan={2} className="sit-col">Situação</th>
            </tr>
            <tr className="sub-headers">
              {bims.map(b => (
                <Fragment key={`bim-header-${b}`}>
                  <th className="sub-th nota">Nota</th>
                  <th className="sub-th falta">Falta</th>
                  <th className="sub-th rec">Rec.</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any, i: number) => (
              <tr key={row.disc} className={i % 2 === 0 ? 'row-even' : 'row-odd'}>
                <td className="disc-name">{row.disc}</td>
                {row.bimData.map((bd: any, bi: number) => (
                  <Fragment key={`${row.disc}-bim-${bi}`}>
                    <td className="nota-cell">{bd.mp !== null ? bd.mp.toFixed(row.casas) : '—'}</td>
                    <td className="falta-cell">{bd.faltas ?? 0}</td>
                    <td className={`rec-cell ${bd.rec !== null && bd.rec > 0 ? 'rec-active' : ''}`}>
                      {bd.rec !== null ? bd.rec.toFixed(1) : '—'}
                    </td>
                  </Fragment>
                ))}
                <td className="media-anual-cell">{fmt(row.mediaAnual, row.casas)}</td>
                <td className="faltas-total">{row.totalFaltas}</td>
                <td className={`media-final-cell ${row.mediaFinal !== null ? (row.mediaFinal >= minAprov ? 'aprov' : row.mediaFinal >= minRec ? 'rec' : 'reprov') : ''}`}>
                  {fmt(row.mediaFinal, row.casas)}
                </td>
                <td>
                  <span className="sit-badge" style={{ background: row.sit.bg, color: row.sit.color }}>
                    {row.sit.label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="boletim-footer">
        <div className="footer-quote">
          "A inteligência é a capacidade de aprender novas coisas, a sabedoria é aplicar o conhecimento aprendido." — Albert Einstein
        </div>
        <div className="footer-sign">
          <div className="sign-line"><div className="line" /><span>Direção</span></div>
          <div className="sign-line"><div className="line" /><span>Responsável</span></div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────────
export default function BoletimPage() {
  const {
    turmas = [], lancamentosNota = [], cfgDisciplinas = [],
    esquemaNota = [], cfgArredondamentos = [], cfgFormulasNotas = [],
    cfgSeries = [], cfgNiveisEnsino = [], mantenedores = []
  } = useData()
  const [alunos] = useSupabaseArray<any>('alunos', [])

  const [anoSel, setAnoSel] = useState<number | null>(null)
  const [turmaSel, setTurmaSel] = useState<string>('')
  const [alunoSel, setAlunoSel] = useState<string>('todos')
  const [busca, setBusca] = useState('')
  const printRef = useRef<HTMLDivElement>(null)

  const anos = useMemo(() => [...new Set(turmas.map(t => t.ano).filter(Boolean))].sort((a, b) => b - a), [turmas])
  const turmasFiltradas = useMemo(() => turmas.filter(t => !anoSel || t.ano === anoSel), [turmas, anoSel])
  const turmaObj = useMemo(() => turmas.find(t => t.id === turmaSel || t.nome === turmaSel), [turmas, turmaSel])
  const turmaId = turmaObj?.id ?? turmaSel

  const { getNumeroChamada, ordenarPorChamada } = useEnsalamento(turmaObj)

  const alunosDaTurma = useMemo(() =>
    turmaSel ? (alunos || []).filter((a: any) => a.turma === turmaObj?.nome || a.turma === turmaSel) : [],
    [alunos, turmaSel, turmaObj]
  )

  const alunosFiltrados = useMemo(() => {
    let list = alunosDaTurma as any[]
    if (busca) list = list.filter((a: any) => a.nome?.toLowerCase().includes(busca.toLowerCase()))
    if (alunoSel !== 'todos') list = list.filter((a: any) => a.id === alunoSel)
    return ordenarPorChamada(list)
  }, [alunosDaTurma, busca, alunoSel, ordenarPorChamada])

  const disciplinas = useMemo(() => {
    if (!turmaObj) return []
    const extra = turmaObj as any
    if (extra?.disciplinas?.length > 0) return (extra.disciplinas as any[]).map((d: any) => d.nome ?? d)
    return cfgDisciplinas.filter(d =>
      d.situacao === 'ativa' && (!turmaObj.serie || !d.niveisEnsino?.length || d.niveisEnsino.includes(turmaObj.serie))
    ).map(d => d.nome)
  }, [turmaObj, cfgDisciplinas])

  // Resolver unidade da turma → dados completos para cabeçalho
  const unidadeInfo = useMemo(() => {
    const fallback = { nome: 'IMPACTO EDU', logo: '', razaoSocial: '', endereco: '', numero: '', bairro: '', cidade: '', estado: '', cep: '', telefone: '', email: '', cnpj: '', inep: '', codigoMec: '', website: '' }
    if (!turmaObj) return fallback
    const nomeUnidade = (turmaObj as any).unidade || ''
    for (const m of mantenedores) {
      const u = (m.unidades || []).find((un: any) =>
        un.id === nomeUnidade || un.nomeFantasia === nomeUnidade || un.codigo === nomeUnidade
      )
      if (u) return {
        nome:        u.nomeFantasia  || u.razaoSocial || m.nome,
        logo:        u.cabecalhoLogo || '',
        razaoSocial: u.razaoSocial   || '',
        endereco:    u.endereco      || '',
        numero:      u.numero        || '',
        bairro:      u.bairro        || '',
        cidade:      u.cidade        || '',
        estado:      u.estado        || '',
        cep:         u.cep           || '',
        telefone:    u.telefone      || '',
        email:       u.email         || '',
        cnpj:        u.cnpj          || m.cnpj || '',
        inep:        u.inep          || '',
        codigoMec:   u.codigoMec     || '',
        website:     m.website       || ''
      }
    }
    const m0 = mantenedores[0]
    return { ...fallback, nome: m0?.nome || 'IMPACTO EDU', website: m0?.website || '' }
  }, [turmaObj, mantenedores])

  const handlePrint = () => window.print()

  const hasData = turmaSel && alunosFiltrados.length > 0

  return (
    <>
      <style>{`
        @media print {
          /* Oculta tudo na tela */
          body * { visibility: hidden; }
          /* Mostra apenas a área de impressão e seus descendentes */
          .print-area, .print-area * { visibility: visible; }
          /* Posiciona a área de impressão no topo esquerdo */
          .print-area {
            position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0;
          }
          .no-print { display: none !important; }
          .boletim-card { break-after: page; page-break-after: always; box-shadow: none !important; border: 1px solid #ccc !important; margin: 0 0 20px 0 !important; border-radius: 0 !important; }
          .boletim-card:last-child { break-after: avoid; page-break-after: avoid; }
          @page { margin: 8mm; size: A4 landscape; }
          
          /* Redução agressiva para caber na página de impressão */
          .bh-wrapper { min-height: 80px !important; }
          .bh-left { padding: 8px 12px !important; gap: 8px !important; }
          .bh-right { padding: 8px 16px 8px 60px !important; }
          .bh-logo-img { height: 45px !important; max-width: 80px !important; }
          .bh-nome { font-size: 13px !important; }
          .bh-row { font-size: 8px !important; line-height: 1.1 !important; }
          .bh-title { font-size: 18px !important; }
          .bh-tag { font-size: 9px !important; }
          .bh-year { padding: 2px 8px !important; font-size: 9px !important; }
          .bh-doc-icon { width: 28px !important; height: 28px !important; }
          .bh-doc-icon svg { width: 14px !important; height: 14px !important; }
          
          .boletim-table th { padding: 4px 2px !important; font-size: 8px !important; }
          .boletim-table td { padding: 4px 2px !important; font-size: 9px !important; }
          .student-info-bar .info-item { padding: 8px 12px !important; min-width: 120px !important; }
          .info-val { font-size: 11px !important; }
          .aluno-nome { font-size: 13px !important; }
        }
        .boletim-card {
          background: #fff;
          border-radius: 20px;
          box-shadow: 0 8px 40px rgba(59,130,246,0.12), 0 2px 12px rgba(0,0,0,0.06);
          border: 1px solid rgba(59,130,246,0.12);
          margin-bottom: 40px;
          overflow: hidden;
        }
        /* ════ CABEÇALHO DOIS PAINÉIS ════════════════════════ */
        .bh-wrapper {
          display: flex;
          overflow: hidden;
          background: #fff;
          min-height: 100px;
          border-bottom: none;
        }
        /* ── Painel Esquerdo (branco) ── */
        .bh-left {
          display: flex; align-items: center; gap: 16px;
          padding: 12px 20px 12px 18px;
          background: #fff;
          flex-shrink: 0;
          width: 440px;
          z-index: 2;
        }
        .bh-logo-wrap { flex-shrink: 0; }
        .bh-logo-img { height: 64px; max-width: 110px; object-fit: contain; }
        .bh-logo-fallback {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          width: 90px; height: 64px;
          border: 2px solid #1d4ed8; border-radius: 8px; padding: 4px;
          gap: 2px;
        }
        .bh-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .bh-nome { font-size: 15px; font-weight: 900; color: #1d4ed8; font-family: 'Outfit',sans-serif; margin: 0 0 2px; line-height: 1.1; }
        .bh-row { font-size: 9px; color: #64748b; line-height: 1.3; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
        .bh-row-icon { display: flex; align-items: flex-start; gap: 4px; white-space: normal; color: #475569; }
        .bh-row-icon span:first-child { flex-shrink: 0; font-size: 11px; margin-top: 1px; }
        /* ── Divisor diagonal ── */
        .bh-right {
          flex: 1;
          position: relative;
          background: linear-gradient(110deg, #1d4ed8 0%, #1e3a8a 100%);
          display: flex; align-items: center; justify-content: flex-start;
          overflow: hidden;
          clip-path: polygon(50px 0%, 100% 0%, 100% 100%, 0% 100%);
          margin-left: -50px;
          padding: 12px 24px 12px 70px;
        }
        .bh-chevron {
          position: absolute; left: 0; top: 0; bottom: 0; width: 50px;
          background: #fff;
          clip-path: polygon(0 0, 100% 0, 30% 100%, 0 100%);
          z-index: 2;
        }
        .bh-chevron-light {
          position: absolute; left: 35px; top: 0; bottom: 0; width: 50px;
          background: #3b82f6;
          clip-path: polygon(0 0, 100% 0, 30% 100%, 0 100%);
          z-index: 1;
        }
        .bh-right-content {
          position: relative; z-index: 3;
          display: flex; flex-direction: column; align-items: flex-start; gap: 4px; text-align: left; width: 100%;
          padding-left: 20%; /* Espaço de aproximadamente 30% da área útil do painel */
        }
        .bh-doc-icon {
          width: 38px; height: 38px; border-radius: 50%;
          background: transparent;
          border: 2px solid rgba(255,255,255,0.4);
          box-shadow: inset 0 0 0 3px rgba(255,255,255,0.1);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 2px;
        }
        .bh-doc-icon svg { width: 22px; height: 22px; }
        .bh-tag { font-size: 11px; font-weight: 600; color: #e2e8f0; letter-spacing: 0.05em; text-transform: uppercase; margin: 0; }
        .bh-title { font-size: 26px; font-weight: 900; color: #fff; font-family: 'Outfit',sans-serif; letter-spacing: 0.02em; line-height: 1; margin: 0; }
        .bh-hr { width: 80px; height: 2px; background: rgba(255,255,255,0.3); margin: 4px 0; border-radius: 1px; }
        .bh-year {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 12px; border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.4);
          color: #fff; font-size: 11px; font-weight: 700; letter-spacing: 0.05em;
          background: transparent; width: fit-content;
        }
        /* Decoração SVG livro */
        .bh-deco-svg {
          position: absolute; right: 4px; bottom: 0;
          width: 80px; height: 80px; opacity: 0.18; z-index: 1; pointer-events: none;
        }
        /* Barra azul inferior com website */
        .bh-sitebar {
          background: #1e3a8a;
          color: rgba(255,255,255,0.9); font-size: 11px; font-weight: 500;
          padding: 5px 20px;
          display: flex; align-items: center; gap: 8px;
          letter-spacing: 0.03em;
        }
        /* ════ FIM CABEÇALHO ══════════════════════════════════ */
        .student-info-bar {
          display: flex; flex-wrap: wrap; gap: 0;
          border-bottom: 2px solid #e2e8f0;
          background: linear-gradient(180deg, #f8faff 0%, #fff 100%);
        }
        .info-item {
          flex: 1; min-width: 160px; padding: 14px 20px;
          border-right: 1px solid #e2e8f0;
        }
        .info-item:last-child { border-right: none; }
        .info-label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; margin-bottom: 4px; }
        .info-val { display: block; font-size: 14px; font-weight: 700; color: #1e293b; }
        .aluno-nome { font-size: 16px; color: #1d4ed8; }
        .table-wrapper { overflow-x: auto; }
        .boletim-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .boletim-table th { background: #1e3a8a; color: #fff; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; padding: 10px 8px; text-align: center; border: 1px solid rgba(255,255,255,0.15); }
        .disc-col { text-align: left !important; min-width: 180px; width: 200px; padding-left: 16px !important; }
        .bim-group { background: #1d4ed8 !important; border-bottom: 2px solid rgba(255,255,255,0.3) !important; }
        .sub-th { background: #2563eb !important; padding: 6px 4px !important; font-size: 9px !important; }
        .sub-th.nota { color: #bfdbfe !important; }
        .sub-th.falta { color: #fde68a !important; }
        .sub-th.rec { color: #bbf7d0 !important; }
        .media-anual { background: #0f172a !important; }
        .faltas-col { background: #374151 !important; }
        .media-final { background: #0f172a !important; }
        .sit-col { background: #0f172a !important; min-width: 100px; }
        .row-even { background: #fff; }
        .row-odd { background: #f8fafc; }
        .boletim-table td { padding: 10px 8px; text-align: center; border: 1px solid #e2e8f0; color: #334155; font-weight: 600; }
        .disc-name { text-align: left !important; padding-left: 16px !important; font-weight: 700; color: #1e293b; font-size: 12px; }
        .nota-cell { color: #1d4ed8; font-weight: 800; }
        .falta-cell { color: #64748b; }
        .rec-cell { color: #64748b; }
        .rec-active { color: #f59e0b !important; font-weight: 800 !important; }
        .media-anual-cell { background: #f0f9ff; color: #0369a1; font-weight: 900; font-size: 13px; }
        .faltas-total { background: #fafafa; }
        .media-final-cell { font-weight: 900; font-size: 14px; }
        .media-final-cell.aprov { background: #f0fdf4; color: #15803d; }
        .media-final-cell.rec { background: #fefce8; color: #854d0e; }
        .media-final-cell.reprov { background: #fef2f2; color: #dc2626; }
        .sit-badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; }
        .boletim-footer { padding: 20px 32px; background: #f8fafc; border-top: 2px solid #e2e8f0; }
        .footer-quote { font-size: 12px; color: #64748b; font-style: italic; text-align: center; margin-bottom: 24px; line-height: 1.6; }
        .footer-sign { display: flex; justify-content: space-around; gap: 40px; }
        .sign-line { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; }
        .sign-line .line { width: 100%; height: 1px; background: #94a3b8; }
        .sign-line span { font-size: 11px; color: #64748b; font-weight: 600; }
        .bim-headers th { white-space: nowrap; }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Page Header */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 50, height: 50, borderRadius: 15, background: 'linear-gradient(135deg,#1d4ed8,#1e3a8a)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(29,78,216,0.4)' }}>
              <FileText size={24} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', margin: 0, fontFamily: 'Outfit, sans-serif' }}>Boletim Escolar</h1>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0, marginTop: 2 }}>Emissão de boletins por turma ou aluno</p>
            </div>
          </div>
          {hasData && (
            <button onClick={handlePrint} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 44, padding: '0 22px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 14, background: 'linear-gradient(135deg,#1d4ed8,#1e3a8a)', color: '#fff', boxShadow: '0 4px 16px rgba(29,78,216,0.35)', transition: 'all 0.2s' }}>
              <Printer size={18} /> Imprimir / PDF
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="no-print card" style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Ano Letivo</label>
              <select className="form-input" value={anoSel ?? ''} onChange={e => { setAnoSel(e.target.value ? Number(e.target.value) : null); setTurmaSel(''); setAlunoSel('todos') }} style={{ height: 42 }}>
                <option value="">Todos os anos</option>
                {anos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Turma *</label>
              <select className="form-input" value={turmaSel} onChange={e => { setTurmaSel(e.target.value); setAlunoSel('todos') }} style={{ height: 42 }}>
                <option value="">Selecione a turma…</option>
                {turmasFiltradas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Aluno (opcional)</label>
              <select className="form-input" value={alunoSel} onChange={e => setAlunoSel(e.target.value)} disabled={!turmaSel} style={{ height: 42 }}>
                <option value="todos">Todos os alunos</option>
                {ordenarPorChamada(alunosDaTurma as any[]).map((a: any) => {
                  const nc = getNumeroChamada(a.id)
                  return <option key={a.id} value={a.id}>{nc ? `Nº${String(nc).padStart(2,'0')} — ` : ''}{a.nome}</option>
                })}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Buscar Aluno</label>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input className="form-input" style={{ paddingLeft: 36, height: 42 }} placeholder="Nome do aluno…" value={busca} onChange={e => setBusca(e.target.value)} />
              </div>
            </div>
          </div>

          {turmaSel && alunosDaTurma.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <AlertTriangle size={16} color="#f59e0b" />
              <span style={{ fontSize: 13, color: '#92400e' }}>Nenhum aluno encontrado nesta turma. Verifique o vínculo de alunos.</span>
            </div>
          )}
        </div>

        {/* Empty state */}
        {!turmaSel && (
          <div className="no-print card" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(29,78,216,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <BookOpen size={32} color="#1d4ed8" />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Selecione uma Turma</div>
            <div style={{ fontSize: 14, color: '#64748b' }}>Escolha a turma e o aluno para gerar o boletim escolar.</div>
          </div>
        )}

        {/* Boletins */}
        {hasData && (
          <div className="print-area print-root" ref={printRef}>
            {alunosFiltrados.map((aluno: any) => (
              <BoletimAluno
                key={aluno.id}
                aluno={aluno}
                turmaObj={turmaObj}
                disciplinas={disciplinas}
                lancamentosNota={lancamentosNota}
                esquemaNota={esquemaNota}
                cfgArredondamentos={cfgArredondamentos}
                cfgFormulasNotas={cfgFormulasNotas}
                turmaId={turmaId}
                anoLetivo={turmaObj?.ano || new Date().getFullYear()}
                numeroChamada={getNumeroChamada(aluno.id)}
                unidade={unidadeInfo}
              />
            ))}
          </div>
        )}

      </div>
    </>
  )
}
