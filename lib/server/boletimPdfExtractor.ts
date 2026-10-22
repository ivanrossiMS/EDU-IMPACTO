import PDFParser from 'pdf2json'

export interface DisciplinaExtraida {
  nome: string
  avm: string
  avb: string
  simulado: string
  pntBonu: string
  mediaF: string
  rec: string
  mediaG: string
}

export interface AlunoBoletimExtraido {
  codigo: string
  nomeArquivo: string
  bimestre: string
  ano: number
  disciplinas: DisciplinaExtraida[]
}

interface RawTextItem {
  x: number
  y: number
  w: number
  str: string
}

interface MergedToken {
  x: number
  endX: number
  str: string
}

interface ColumnDef {
  key: keyof Omit<DisciplinaExtraida, 'nome'> | 'ignore'
  x: number
  endX: number
  str: string
}

/**
 * Agrupa fragmentos de texto na mesma linha horizontal (mesmo Y) que pertencem
 * à mesma palavra/frase ou célula, preservando a separação entre colunas da tabela.
 */
function mergeRowTokens(items: RawTextItem[], maxGap = 0.45): MergedToken[] {
  const clusters: { x: number; lastX: number; lastW: number; endX: number; str: string }[] = []

  for (const it of items) {
    if (clusters.length === 0) {
      clusters.push({
        x: it.x,
        lastX: it.x,
        lastW: it.w || 0,
        endX: it.x + (it.w || 0) / 21.6,
        str: it.str
      })
    } else {
      const prev = clusters[clusters.length - 1]
      const prevEndX = prev.lastX + (prev.lastW ? prev.lastW / 21.6 : 0.25)
      const gap = it.x - prevEndX

      if (gap < maxGap) {
        const needSpace = gap > 0.12 && !prev.str.endsWith(' ') && !it.str.startsWith(' ')
        prev.str += (needSpace ? ' ' : '') + it.str
        prev.lastX = it.x
        prev.lastW = it.w || 0
        prev.endX = it.x + (it.w || 0) / 21.6
      } else {
        clusters.push({
          x: it.x,
          lastX: it.x,
          lastW: it.w || 0,
          endX: it.x + (it.w || 0) / 21.6,
          str: it.str
        })
      }
    }
  }

  return clusters
    .map(c => ({
      x: Number(c.x.toFixed(2)),
      endX: Number(c.endX.toFixed(2)),
      str: c.str.replace(/\s+/g, ' ').trim()
    }))
    .filter(c => c.str.length > 0)
}

function mapHeaderKey(str: string): keyof Omit<DisciplinaExtraida, 'nome'> | null {
  const s = str.toLowerCase().replace(/\s+/g, '')
  if (/^(av\.?mens|avm)$/.test(s)) return 'avm'
  if (/^(av\.?bim|avb)$/.test(s)) return 'avb'
  if (/^simulado$/.test(s)) return 'simulado'
  if (/^(pnt\.?b[oô]nu.*|b[oô]nus)$/.test(s)) return 'pntBonu'
  if (/^(med\.?final|mediaf)$/.test(s)) return 'mediaF'
  if (/^(rec|recbim|recupera.*)$/.test(s)) return 'rec'
  if (/^(m[eé]d\.?geral|mediag)$/.test(s)) return 'mediaG'
  return null
}

function parseBoletimPdfData(pdfData: any): AlunoBoletimExtraido[] {
  const alunos: AlunoBoletimExtraido[] = []
  let currentBimestre = '1º Bimestre'
  let currentAno = new Date().getFullYear()
  let currentStudent: AlunoBoletimExtraido | null = null
  let currentColumns: ColumnDef[] | null = null
  let isAnnualLayout = false
  let lastDiscY = -999

  for (let p = 0; p < (pdfData?.Pages || []).length; p++) {
    const rawItems: RawTextItem[] = (pdfData.Pages[p].Texts || []).map((t: any) => {
      let rawStr = ''
      for (const r of t.R || []) {
        try {
          rawStr += decodeURIComponent(r.T)
        } catch {
          rawStr += r.T
        }
      }
      // Corrige quirk do pdf2json que adiciona espaços em ' C ' ou ' G ' isolados e normaliza ligaduras (ﬁ -> fi)
      rawStr = rawStr
        .replace(/^ ([A-Za-zÀ-ÿ]) $/, '$1')
        .replace(/[\uFB00-\uFB06]/g, m => m.normalize('NFKC'))

      return { x: t.x, y: t.y, w: t.w, str: rawStr }
    })

    const rows: { y: number; items: RawTextItem[] }[] = []
    for (const item of rawItems) {
      let row = rows.find(r => Math.abs(r.y - item.y) < 0.18)
      if (!row) {
        row = { y: item.y, items: [] }
        rows.push(row)
      }
      row.items.push(item)
    }
    rows.sort((a, b) => a.y - b.y)

    for (const r of rows) {
      r.items.sort((a, b) => a.x - b.x)
      const tokens = mergeRowTokens(r.items, 0.45)
      if (tokens.length === 0) continue

      const fullText = tokens.map(t => t.str).join(' ')

      // Extrai Bimestre e Ano se presentes na linha
      const bimMatch = fullText.match(/Bimestre:\s*(\d+)/i)
      if (bimMatch) {
        currentBimestre = `${bimMatch[1]}º Bimestre`
        if (currentStudent && currentStudent.disciplinas.length === 0) {
          currentStudent.bimestre = currentBimestre
        }
      }
      const anoMatch = fullText.match(/Ano(?:\s+Letivo)?:\s*(\d{4})/i)
      if (anoMatch) {
        currentAno = parseInt(anoMatch[1], 10)
        if (currentStudent && currentStudent.disciplinas.length === 0) {
          currentStudent.ano = currentAno
        }
      }

      // Cabeçalho de Aluno (Layout 1: "Código: 5158 - Aluno(a): Nome")
      const codMatch = fullText.match(/C[oó]digo:\s*(\d+)/i)
      const alunoMatch = fullText.match(/Aluno(?:\(a\))?:\s*([^\n\r]+?)(?:\s+Ano Letivo:|\s+Bimestre:|$)/i)
      if (codMatch && alunoMatch) {
        currentStudent = {
          codigo: codMatch[1].trim(),
          nomeArquivo: alunoMatch[1].trim(),
          bimestre: currentBimestre,
          ano: currentAno,
          disciplinas: []
        }
        alunos.push(currentStudent)
        currentColumns = null
        isAnnualLayout = false
        lastDiscY = -999
        continue
      }

      // Cabeçalho de Aluno (Layout 2 variante: "Aluno: 5164 - Isaque Gomes Peralta")
      const alunoCodMatch = fullText.match(/Aluno(?:\(a\))?:\s*(\d+)\s*-\s*([^\n\r]+?)(?:\s+Ano Letivo:|\s+Bimestre:|$)/i)
      if (alunoCodMatch) {
        currentStudent = {
          codigo: alunoCodMatch[1].trim(),
          nomeArquivo: alunoCodMatch[2].trim(),
          bimestre: currentBimestre,
          ano: currentAno,
          disciplinas: []
        }
        alunos.push(currentStudent)
        currentColumns = null
        isAnnualLayout = false
        lastDiscY = -999
        continue
      }

      // Cabeçalho de Colunas Padrão (Layout 1: Av.Mens, Av.Bim, Simulado, Pnt.bônu, MedFinal, Rec, MédGeral)
      const mappedCols: ColumnDef[] = []
      for (const t of tokens) {
        const key = mapHeaderKey(t.str)
        if (key) {
          mappedCols.push({ key, x: t.x, endX: t.endX, str: t.str })
        }
      }

      if (mappedCols.length >= 3) {
        currentColumns = mappedCols
        isAnnualLayout = false
        continue
      }

      // Cabeçalho de Colunas Bimestrais (Layout 2: 1º Bimestre | 2º Bimestre | 3º Bimestre | 4º Bimestre)
      const bimCols = tokens.filter(t => /^[1-4][ºo°]?\s*Bimestre$/i.test(t.str))
      if (bimCols.length >= 2) {
        const targetBimNum = (currentStudent?.bimestre || currentBimestre).match(/(\d+)/)?.[1] || '1'
        currentColumns = []
        for (const bc of bimCols) {
          const bNum = bc.str.match(/(\d+)/)?.[1]
          const isTarget = bNum === targetBimNum
          currentColumns.push({ key: isTarget ? 'mediaF' : 'ignore', x: bc.x, endX: bc.endX, str: bc.str })
          currentColumns.push({ key: 'ignore', x: bc.x + 1.8, endX: bc.x + 2.5, str: 'Falta' })
        }
        isAnnualLayout = true
        continue
      }

      // Ignorar linhas de rodapé, cabeçalho institucional ou subtítulos de tabela
      if (
        /SAE\+C|COL[ÉE]GIO IMPACTO|Boletim De Avalia|BOLETIM DE AVALIA|Componentes Curriculares|Lcto\.\s*Notas|Cria[çc][ãa]o:|Autoriza[çc][ãa]o de funcionamento|Ato de denomina|^Curso:|^Turma:|Nota\s+Falta|M[ée]dia\s+Exame|Anual\s+Final|^Componentes$|^Curriculares$|^Ex\.Final$/i.test(fullText) ||
        fullText.startsWith('"') ||
        fullText.startsWith('“')
      ) {
        if (/SAE\+C|COL[ÉE]GIO IMPACTO|Boletim De Avalia|BOLETIM DE AVALIA/i.test(fullText)) {
          currentColumns = null
        }
        continue
      }

      // Processar linha de disciplina
      if (currentStudent && currentColumns && currentColumns.length > 0) {
        const firstColX = currentColumns[0].x
        const nameTokens = tokens.filter(t => t.x < firstColX - 1.5)
        const gradeTokens = tokens.filter(t => t.x >= firstColX - 1.5)

        const nome = nameTokens.map(t => t.str).join(' ').trim()
        if (!nome || nome === '---' || nome.length < 2) continue

        // Caso o nome da disciplina quebre em segunda linha sem notas (ex: "UNIDADE CURRICULAR" + "MATEMÁTICA")
        if (
          gradeTokens.length === 0 &&
          currentStudent.disciplinas.length > 0 &&
          r.y - lastDiscY > 0 &&
          r.y - lastDiscY < 0.9
        ) {
          const prevDisc = currentStudent.disciplinas[currentStudent.disciplinas.length - 1]
          prevDisc.nome = `${prevDisc.nome} ${nome}`.replace(/\s+/g, ' ').trim()
          lastDiscY = r.y
          continue
        }

        const disc: DisciplinaExtraida = {
          nome,
          avm: '---',
          avb: '---',
          simulado: '---',
          pntBonu: '---',
          mediaF: '---',
          rec: '---',
          mediaG: '---'
        }

        let matchedCount = 0
        for (const gt of gradeTokens) {
          let bestCol: ColumnDef | null = null
          let bestDist = Infinity
          for (const col of currentColumns) {
            const dist = Math.abs(gt.x - col.x)
            if (dist < bestDist) {
              bestDist = dist
              bestCol = col
            }
          }
          if (bestCol && bestDist < 2.2) {
            if (bestCol.key !== 'ignore') {
              const cleanVal = isAnnualLayout ? gt.str.replace(/\*+$/, '').trim() : gt.str.trim()
              disc[bestCol.key] = cleanVal || '---'
              if (isAnnualLayout && bestCol.key === 'mediaF') {
                disc.mediaG = cleanVal || '---'
              }
            }
            matchedCount++
          }
        }

        if (matchedCount > 0) {
          currentStudent.disciplinas.push(disc)
          lastDiscY = r.y
        }
      }
    }
  }

  return alunos.filter(a => a.disciplinas.length > 0)
}

/**
 * Extrai boletins diretamente da estrutura vetorial (coordenadas X/Y) do PDF usando pdf2json.
 * Executa em ~20-80ms sem depender de chamadas externas de IA.
 */
export async function extractBoletinsFromPdfBuffer(buffer: Buffer): Promise<AlunoBoletimExtraido[]> {
  return new Promise((resolve) => {
    try {
      const pdfParser = new PDFParser()

      pdfParser.on('pdfParser_dataError', (err: any) => {
        console.warn('[boletimPdfExtractor] Erro no pdf2json:', err?.parserError || err)
        resolve([])
      })

      pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
        try {
          const alunos = parseBoletimPdfData(pdfData)
          resolve(alunos)
        } catch (parseErr) {
          console.warn('[boletimPdfExtractor] Erro ao interpretar coordenadas do PDF:', parseErr)
          resolve([])
        }
      })

      pdfParser.parseBuffer(buffer)
    } catch (err) {
      console.warn('[boletimPdfExtractor] Falha ao iniciar pdf2json:', err)
      resolve([])
    }
  })
}
