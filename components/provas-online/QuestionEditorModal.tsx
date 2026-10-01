'use client'

import React, { useState } from 'react'
import {
  X, Plus, Trash2, Check, AlertCircle, HelpCircle,
  FileText, Sparkles, CheckCircle2, Sliders, Image as ImageIcon,
  Calculator, Info
} from 'lucide-react'
import { toast } from 'sonner'
import {
  QuestaoProva,
  TipoQuestao,
  AlternativaQuestao,
  ItemVerdadeiroFalso,
  CriterioAvaliacao,
  ConfigPontuacaoParcial,
  DificuldadeQuestao
} from '@/types/provas-online'

interface QuestionEditorModalProps {
  open: boolean
  question: QuestaoProva | null
  onClose: () => void
  onSave: (q: QuestaoProva) => void
}

export function QuestionEditorModal({
  open,
  question,
  onClose,
  onSave
}: QuestionEditorModalProps) {
  if (!open || !question) return null

  // Local editable draft of the question
  const [draft, setDraft] = useState<QuestaoProva>(() => ({
    ...question,
    alternativas: question.alternativas ? [...question.alternativas] : [
      { id: 'alt-1', letra: 'A', texto: '', correta: true, ordem: 0 },
      { id: 'alt-2', letra: 'B', texto: '', correta: false, ordem: 1 },
      { id: 'alt-3', letra: 'C', texto: '', correta: false, ordem: 2 },
      { id: 'alt-4', letra: 'D', texto: '', correta: false, ordem: 3 },
    ],
    itensVF: question.itensVF ? [...question.itensVF] : [
      { id: 'vf-1', afirmacao: '', correta: true, ordem: 0 },
      { id: 'vf-2', afirmacao: '', correta: false, ordem: 1 },
      { id: 'vf-3', afirmacao: '', correta: true, ordem: 2 }
    ],
    criteriosAvaliacao: question.criteriosAvaliacao ? [...question.criteriosAvaliacao] : [
      { id: 'crit-1', descricao: 'Domínio do conteúdo e clareza argumentativa', pontosMaximos: 1.0 }
    ],
    configPontuacaoParcial: question.configPontuacaoParcial || {
      permiteParcial: true,
      tipoCalculo: 'proporcional',
      explicacaoCalculo: 'Pontuação distribuída proporcionalmente entre as opções corretas'
    }
  }))

  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

  const handleTypeChange = (newType: TipoQuestao) => {
    setDraft(prev => ({
      ...prev,
      tipo: newType
    }))
  }

  const handleAddAlternative = () => {
    const current = draft.alternativas || []
    if (current.length >= 8) {
      toast.error('Limite máximo de 8 alternativas por questão atingido.')
      return
    }
    const nextIdx = current.length
    const nextLetter = letters[nextIdx] || String.fromCharCode(65 + nextIdx)
    const newAlt: AlternativaQuestao = {
      id: crypto.randomUUID(),
      letra: nextLetter,
      texto: '',
      correta: false,
      ordem: nextIdx
    }
    setDraft(prev => ({
      ...prev,
      alternativas: [...(prev.alternativas || []), newAlt]
    }))
  }

  const handleRemoveAlternative = (id: string) => {
    const current = draft.alternativas || []
    if (current.length <= 2) {
      toast.error('Uma questão de múltipla escolha precisa ter no mínimo 2 alternativas.')
      return
    }
    const filtered = current.filter(a => a.id !== id).map((a, i) => ({
      ...a,
      letra: letters[i] || String.fromCharCode(65 + i),
      ordem: i
    }))
    setDraft(prev => ({
      ...prev,
      alternativas: filtered
    }))
  }

  const handleToggleAltCorrect = (id: string) => {
    setDraft(prev => {
      const current = prev.alternativas || []
      if (prev.tipo === 'multipla_escolha') {
        // Only one can be correct
        return {
          ...prev,
          alternativas: current.map(a => ({
            ...a,
            correta: a.id === id
          }))
        }
      } else {
        // Multiple can be correct
        return {
          ...prev,
          alternativas: current.map(a => a.id === id ? { ...a, correta: !a.correta } : a)
        }
      }
    })
  }

  // True / False handlers
  const handleAddVF = () => {
    const current = draft.itensVF || []
    const newVF: ItemVerdadeiroFalso = {
      id: crypto.randomUUID(),
      afirmacao: '',
      correta: true,
      ordem: current.length
    }
    setDraft(prev => ({
      ...prev,
      itensVF: [...current, newVF]
    }))
  }

  const handleRemoveVF = (id: string) => {
    const current = draft.itensVF || []
    if (current.length <= 1) {
      toast.error('A questão precisa de ao menos 1 afirmação.')
      return
    }
    setDraft(prev => ({
      ...prev,
      itensVF: current.filter(item => item.id !== id)
    }))
  }

  // Criterios dissertativa
  const handleAddCriterio = () => {
    const current = draft.criteriosAvaliacao || []
    const newCrit: CriterioAvaliacao = {
      id: crypto.randomUUID(),
      descricao: '',
      pontosMaximos: 0.5
    }
    setDraft(prev => ({
      ...prev,
      criteriosAvaliacao: [...current, newCrit]
    }))
  }

  const handleRemoveCriterio = (id: string) => {
    const current = draft.criteriosAvaliacao || []
    setDraft(prev => ({
      ...prev,
      criteriosAvaliacao: current.filter(c => c.id !== id)
    }))
  }

  const handleValidateAndSave = () => {
    if (!draft.enunciado || draft.enunciado.trim() === '') {
      toast.error('Informe o enunciado da questão.')
      return
    }

    if (draft.pontuacao <= 0) {
      toast.error('A pontuação da questão deve ser maior que zero.')
      return
    }

    if (draft.tipo === 'multipla_escolha' || draft.tipo === 'multipla_selecao') {
      const alts = draft.alternativas || []
      if (alts.length < 2) {
        toast.error('Cadastre ao menos duas alternativas.')
        return
      }
      const emptyAlt = alts.some(a => !a.texto.trim())
      if (emptyAlt) {
        toast.error('Preencha o texto de todas as alternativas.')
        return
      }
      const hasCorrect = alts.some(a => a.correta)
      if (!hasCorrect) {
        toast.error('Selecione ao menos uma alternativa correta como gabarito.')
        return
      }
    }

    if (draft.tipo === 'verdadeiro_falso') {
      const vfs = draft.itensVF || []
      if (vfs.length === 0) {
        toast.error('Cadastre ao menos uma afirmação para Verdadeiro ou Falso.')
        return
      }
      const emptyVF = vfs.some(i => !i.afirmacao.trim())
      if (emptyVF) {
        toast.error('Preencha o texto de todas as afirmações V/F.')
        return
      }
    }

    onSave(draft)
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      background: 'rgba(15, 23, 42, 0.5)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '820px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="#0284c7" />
              Editor de Questão
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
              Configure o tipo, pontuação, enunciado, gabarito e critérios pedagógicos
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-800">
          {/* Top Bar: Tipo & Pontuação */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            {/* Tipo de Questão */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Tipo de Questão *</label>
              <select
                value={draft.tipo}
                onChange={e => handleTypeChange(e.target.value as TipoQuestao)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-semibold focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all"
              >
                <option value="multipla_escolha">Objetiva - Uma Alternativa Correta (Apenas 1)</option>
                <option value="multipla_selecao">Objetiva - Múltipla Seleção (Várias Corretas)</option>
                <option value="verdadeiro_falso">Verdadeiro ou Falso (V ou F por item)</option>
                <option value="dissertativa">Dissertativa com Resposta Digitada</option>
              </select>
            </div>

            {/* Pontuação */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Pontuação (Valor) *</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="100"
                  value={draft.pontuacao}
                  onChange={e => setDraft(p => ({ ...p, pontuacao: Math.max(0, Number(e.target.value)) }))}
                  className="w-full pl-3.5 pr-12 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition-all"
                />
                <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">pts</span>
              </div>
            </div>

            {/* BNCC / Tags opcionais */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">Código BNCC (Opcional)</label>
              <input
                type="text"
                placeholder="Ex: EF09MA06"
                value={draft.habilidadeBNCC || ''}
                onChange={e => setDraft(p => ({ ...p, habilidadeBNCC: e.target.value }))}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-mono uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">Nível de Dificuldade</label>
              <select
                value={draft.dificuldade || 'medio'}
                onChange={e => setDraft(p => ({ ...p, dificuldade: e.target.value as DificuldadeQuestao }))}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs"
              >
                <option value="facil">Fácil</option>
                <option value="medio">Médio</option>
                <option value="dificil">Difícil</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">Assunto / Conteúdo (Tag)</label>
              <input
                type="text"
                placeholder="Ex: Teorema de Pitágoras"
                value={(draft.tags && draft.tags[0]) || ''}
                onChange={e => {
                  const val = e.target.value
                  setDraft(p => ({ ...p, tags: val ? [val] : [] }))
                }}
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs"
              />
            </div>
          </div>

          {/* Enunciado */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileText size={15} className="text-sky-600" /> Enunciado da Questão *
              </label>
              <span className="text-[11px] text-slate-400">Suporta formatação HTML, imagens e fórmulas</span>
            </div>
            <textarea
              rows={4}
              placeholder="Digite com clareza o texto do enunciado, contexto ou problema a ser resolvido..."
              value={draft.enunciado}
              onChange={e => setDraft(p => ({ ...p, enunciado: e.target.value }))}
              className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all font-sans leading-relaxed"
            />
          </div>

          {/* ── SEÇÃO: OBJETIVAS (ÚNICA OU MÚLTIPLA SELEÇÃO) ─────────────── */}
          {(draft.tipo === 'multipla_escolha' || draft.tipo === 'multipla_selecao') && (
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Alternativas e Gabarito Oficial
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {draft.tipo === 'multipla_escolha'
                      ? 'Marque o círculo da alternativa correta.'
                      : 'Marque as caixas de todas as alternativas corretas desta questão.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddAlternative}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold border border-sky-200 flex items-center gap-1.5 self-start sm:self-auto transition-colors"
                >
                  <Plus size={14} /> Adicionar Alternativa
                </button>
              </div>

              {/* Regra de pontuação parcial para múltipla seleção */}
              {draft.tipo === 'multipla_selecao' && (
                <div className="p-3.5 rounded-xl bg-white border border-sky-200 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sky-900">
                    <Info size={15} className="text-sky-600 shrink-0" />
                    Critério de Pontuação para Múltipla Seleção
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="pontuacaoParcial"
                        checked={draft.configPontuacaoParcial?.permiteParcial === true}
                        onChange={() => setDraft(p => ({
                          ...p,
                          configPontuacaoParcial: {
                            permiteParcial: true,
                            tipoCalculo: 'proporcional',
                            explicacaoCalculo: 'Pontuação proporcional por alternativa correta assinalada'
                          }
                        }))}
                        className="accent-sky-600"
                      />
                      <span className="text-slate-700 font-medium">Pontuação Parcial Proporcional</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="pontuacaoParcial"
                        checked={draft.configPontuacaoParcial?.permiteParcial === false}
                        onChange={() => setDraft(p => ({
                          ...p,
                          configPontuacaoParcial: {
                            permiteParcial: false,
                            tipoCalculo: 'estrita',
                            explicacaoCalculo: 'Exige todas as alternativas corretas para pontuar'
                          }
                        }))}
                        className="accent-sky-600"
                      />
                      <span className="text-slate-700 font-medium">Tudo ou Nada (Exige todas corretas)</span>
                    </label>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {draft.configPontuacaoParcial?.permiteParcial
                      ? 'O aluno receberá pontuação dividida pelo número de alternativas corretas assinaladas.'
                      : 'O aluno só pontuará se assinalar exatamente o conjunto correto de alternativas.'}
                  </p>
                </div>
              )}

              {/* Lista de alternativas */}
              <div className="space-y-3">
                {(draft.alternativas || []).map((alt, idx) => (
                  <div
                    key={alt.id}
                    className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                      alt.correta
                        ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleAltCorrect(alt.id)}
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                        alt.correta
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title={alt.correta ? 'Alternativa Correta (Gabarito)' : 'Clique para marcar como correta'}
                    >
                      {alt.correta ? <Check size={14} /> : alt.letra}
                    </button>

                    <div className="flex-1 space-y-1">
                      <input
                        type="text"
                        placeholder={`Texto da alternativa ${alt.letra}...`}
                        value={alt.texto}
                        onChange={e => {
                          const val = e.target.value
                          setDraft(p => ({
                            ...p,
                            alternativas: (p.alternativas || []).map((a, i) => i === idx ? { ...a, texto: val } : a)
                          }))
                        }}
                        className="w-full px-3.5 py-2 rounded-xl bg-transparent border border-transparent focus:border-slate-300 focus:bg-white text-slate-900 text-xs focus:outline-none transition-all"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveAlternative(alt.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                      title="Excluir alternativa"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SEÇÃO: VERDADEIRO OU FALSO ────────────────────────── */}
          {draft.tipo === 'verdadeiro_falso' && (
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Itens e Afirmações (V ou F)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Defina as afirmações e selecione o gabarito verdadeiro (V) ou falso (F) de cada uma.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddVF}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold border border-sky-200 flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Plus size={14} /> Adicionar Afirmação
                </button>
              </div>

              <div className="space-y-3">
                {(draft.itensVF || []).map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-3"
                  >
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>

                    <input
                      type="text"
                      placeholder="Texto da afirmação..."
                      value={item.afirmacao}
                      onChange={e => {
                        const val = e.target.value
                        setDraft(p => ({
                          ...p,
                          itensVF: (p.itensVF || []).map((it, i) => i === idx ? { ...it, afirmacao: val } : it)
                        }))
                      }}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-sky-500"
                    />

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => {
                          setDraft(p => ({
                            ...p,
                            itensVF: (p.itensVF || []).map((it, i) => i === idx ? { ...it, correta: true } : it)
                          }))
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          item.correta
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        V (Verdadeiro)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDraft(p => ({
                            ...p,
                            itensVF: (p.itensVF || []).map((it, i) => i === idx ? { ...it, correta: false } : it)
                          }))
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          !item.correta
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        F (Falso)
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveVF(item.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg ml-1"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SEÇÃO: DISSERTATIVA ───────────────────────────────── */}
          {draft.tipo === 'dissertativa' && (
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-4">
              <div className="border-b border-slate-200/80 pb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Gabarito do Corretor e Critérios de Avaliação
                </h4>
                <p className="text-[11px] text-slate-500">
                  A resposta esperada e os critérios são confidenciais e visíveis apenas aos professores e corretores.
                </p>
              </div>

              {/* Resposta Esperada */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Resposta Esperada / Padrão de Resposta</label>
                <textarea
                  rows={3}
                  placeholder="Descreva o que o aluno deve abordar para atingir pontuação máxima..."
                  value={draft.respostaEsperada || ''}
                  onChange={e => setDraft(p => ({ ...p, respostaEsperada: e.target.value }))}
                  className="w-full p-3.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Configurações adicionais */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Limite de Palavras (Opcional)</label>
                  <input
                    type="number"
                    placeholder="Ex: 250 (Deixe 0 para sem limite)"
                    value={draft.limitePalavras || ''}
                    onChange={e => setDraft(p => ({ ...p, limitePalavras: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="permiteAnexo"
                    checked={draft.permiteAnexoResolucao || false}
                    onChange={e => setDraft(p => ({ ...p, permiteAnexoResolucao: e.target.checked }))}
                    className="w-4 h-4 rounded accent-sky-600"
                  />
                  <label htmlFor="permiteAnexo" className="text-xs font-medium text-slate-700 cursor-pointer">
                    Permitir foto ou anexo da resolução manuscrita
                  </label>
                </div>
              </div>

              {/* Rubrica / Critérios */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Rubrica / Critérios de Correção</label>
                  <button
                    type="button"
                    onClick={handleAddCriterio}
                    className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 text-xs font-semibold hover:bg-sky-100 border border-sky-200"
                  >
                    + Novo Critério
                  </button>
                </div>

                <div className="space-y-2">
                  {(draft.criteriosAvaliacao || []).map((crit, idx) => (
                    <div key={crit.id} className="p-3 rounded-xl bg-white border border-slate-200 flex items-center gap-3">
                      <input
                        type="text"
                        placeholder="Ex: Argumentação coerente e estruturada"
                        value={crit.descricao}
                        onChange={e => {
                          const val = e.target.value
                          setDraft(p => ({
                            ...p,
                            criteriosAvaliacao: (p.criteriosAvaliacao || []).map((c, i) => i === idx ? { ...c, descricao: val } : c)
                          }))
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.25"
                          value={crit.pontosMaximos}
                          onChange={e => {
                            const val = Math.max(0, Number(e.target.value))
                            setDraft(p => ({
                              ...p,
                              criteriosAvaliacao: (p.criteriosAvaliacao || []).map((c, i) => i === idx ? { ...c, pontosMaximos: val } : c)
                            }))
                          }}
                          className="w-16 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-center"
                        />
                        <span className="text-[11px] text-slate-400 font-bold">pts</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveCriterio(crit.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Explicação da Resposta / Feedback do Aluno */}
          <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <HelpCircle size={15} className="text-sky-600" />
              Comentário Pedagógico / Explicação da Resposta (Feedback)
            </label>
            <p className="text-[11px] text-slate-500">
              Exibido ao aluno na devolução de gabarito e resultado quando publicado pelo professor.
            </p>
            <textarea
              rows={2}
              placeholder="Explique detalhadamente por que o gabarito é este..."
              value={draft.explicacaoResposta || ''}
              onChange={e => setDraft(p => ({ ...p, explicacaoResposta: e.target.value }))}
              className="w-full p-3 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>

        {/* Footer */}
        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: '40px',
              padding: '0 20px',
              borderRadius: '10px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.15s'
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleValidateAndSave}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '40px',
              padding: '0 24px',
              borderRadius: '10px',
              background: '#0284c7',
              border: 'none',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
              transition: 'all 0.15s'
            }}
          >
            <Check size={16} /> Salvar Questão
          </button>
        </div>
      </div>
    </div>
  )
}
