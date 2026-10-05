// ==============================================================================
// Helper para Consulta de Dados Cadastrais da Unidade Escolar / Empregadora
// Busca na tabela mantenedores / unidades do Impacto EDU
// ==============================================================================

import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export interface DadosUnidadeEscolar {
  razaoSocial: string
  nomeFantasia?: string
  cnpj: string
  endereco: string
  cidadeUf: string
  unidadeNome?: string
}

const DEFAULT_UNIDADE: DadosUnidadeEscolar = {
  razaoSocial: 'Colegio Impacto Centro de Ensino LTDA',
  nomeFantasia: 'Colegio Impacto de Ef',
  cnpj: '04.395.789/0001-88',
  endereco: 'Rua Alagoas, nº 1081, Bairro Jardim dos Estados',
  cidadeUf: 'Campo Grande - MS • CEP: 79020-121',
  unidadeNome: 'Colegio Impacto de Ef'
}

export async function getDadosUnidadeEscolar(unidadeNomeOuId?: string): Promise<DadosUnidadeEscolar> {
  const sb = getAdminClient()

  try {
    const { data: mantenedores, error } = await sb.from('mantenedores').select('*')
    if (error || !Array.isArray(mantenedores) || mantenedores.length === 0) {
      return DEFAULT_UNIDADE
    }

    const clean = (s?: string) =>
      (s || '')
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')

    const target = clean(unidadeNomeOuId)

    let matchUnidade: any = null
    let matchMantenedor: any = null

    // 1. Busca por correspondência exata ou aproximada nas unidades filhas
    if (target) {
      for (const m of mantenedores) {
        const unidades = Array.isArray(m.unidades) ? m.unidades : []
        for (const u of unidades) {
          const nomeFan = clean(u.nomeFantasia)
          const razSoc = clean(u.razaoSocial)
          const uid = clean(u.id)
          const ucod = clean(u.codigo)

          if (
            nomeFan === target ||
            razSoc === target ||
            uid === target ||
            ucod === target ||
            (target.length >= 4 && (nomeFan.includes(target) || target.includes(nomeFan)))
          ) {
            matchUnidade = u
            matchMantenedor = m
            break
          }
        }
        if (matchUnidade) break
      }

      // 2. Se não achou na unidade filha, tenta casar com o mantenedor diretamente
      if (!matchUnidade) {
        for (const m of mantenedores) {
          const mNome = clean(m.nome)
          const mRazao = clean(m.razao_social)
          const mId = clean(m.id)

          if (mNome === target || mRazao === target || mId === target) {
            matchMantenedor = m
            if (Array.isArray(m.unidades) && m.unidades.length > 0) {
              matchUnidade = m.unidades[0]
            }
            break
          }
        }
      }
    }

    // 3. Fallback: seleciona o primeiro mantenedor e sua primeira unidade cadastrada
    if (!matchUnidade && !matchMantenedor) {
      matchMantenedor = mantenedores[0]
      if (Array.isArray(matchMantenedor.unidades) && matchMantenedor.unidades.length > 0) {
        matchUnidade = matchMantenedor.unidades[0]
      }
    }

    const m = matchMantenedor || {}
    const u = matchUnidade || {}

    const razaoSocial =
      u.razaoSocial ||
      m.razao_social ||
      u.nomeFantasia ||
      m.nome ||
      DEFAULT_UNIDADE.razaoSocial

    const nomeFantasia = u.nomeFantasia || m.nome || DEFAULT_UNIDADE.nomeFantasia

    const cnpj = u.cnpj || m.cnpj || DEFAULT_UNIDADE.cnpj

    // Formata o endereço completo
    const logradouro = u.endereco || m.endereco || 'Rua Alagoas'
    const num = u.numero || m.numero ? `nº ${u.numero || m.numero}` : 'nº 1081'
    const bairro = u.bairro || m.bairro ? `Bairro ${u.bairro || m.bairro}` : 'Jardim dos Estados'
    const endereco = [logradouro, num, bairro].filter(Boolean).join(', ')

    // Formata cidade, estado e CEP
    const cidade = u.cidade || m.cidade || 'Campo Grande'
    const estado = u.estado || m.estado || 'MS'
    const cep = u.cep || m.cep ? `CEP: ${u.cep || m.cep}` : 'CEP: 79020-121'
    const cidadeUf = `${cidade} - ${estado} • ${cep}`

    return {
      razaoSocial,
      nomeFantasia,
      cnpj,
      endereco,
      cidadeUf,
      unidadeNome: u.nomeFantasia || unidadeNomeOuId || DEFAULT_UNIDADE.unidadeNome
    }
  } catch (err) {
    console.error('[getDadosUnidadeEscolar error]', err)
    return DEFAULT_UNIDADE
  }
}
