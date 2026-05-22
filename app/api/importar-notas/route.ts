import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    console.log('API Route: Recebendo requisição com pdf2json')
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    console.log('API Route: Arquivo recebido:', file.name)

    const buffer = Buffer.from(await file.arrayBuffer())
    
    // Importação dinâmica do pdf2json
    const PDFParser = require('pdf2json')
    const pdfParser = new PDFParser()

    // Extração de texto usando Promise para lidar com eventos
    const text = await new Promise<string>((resolve, reject) => {
      pdfParser.on('pdfParser_dataError', (err: any) => {
        console.error('Erro no pdf2json:', err)
        reject(err.parserError || err)
      })
      
      pdfParser.on('pdfParser_dataReady', () => {
        // getRawTextContent retorna o texto bruto do PDF, que costuma vir URL encoded
        const rawText = pdfParser.getRawTextContent()
        try {
          resolve(decodeURIComponent(rawText))
        } catch {
          resolve(rawText)
        }
      })
      
      pdfParser.parseBuffer(buffer)
    })

    console.log('Texto extraído com sucesso. Tamanho:', text.length)
    console.log('Início do texto:', text.substring(0, 500))

    // Parser para extrair os dados
    const alunosDetectados = []
    
    // Divide o texto por páginas ou por blocos de aluno
    // Na imagem vemos: "Boletim De Avaliação Lcto. de Notas"
    // Dependendo do pdf2json, o texto pode vir com quebras de linha diferentes
    const blocos = text.split(/Boletim De Avaliação/i)

    for (const bloco of blocos) {
      if (!bloco.trim()) continue

      // Extrair Código/Matrícula
      const codigoMatch = bloco.match(/Código:\s*(\d+)/i)
      const codigo = codigoMatch ? codigoMatch[1] : null

      // Extrair Nome do Aluno
      const alunoMatch = bloco.match(/Aluno:\s*([^\n\r]+)/i)
      const nomeArquivo = alunoMatch ? alunoMatch[1].trim() : 'Aluno no Arquivo'

      if (!codigo) continue

      const disciplinas: any[] = []
      
      // Regex para capturar a linha da disciplina
      // Como o pdf2json pode retornar o texto com espaços ou quebras diferentes,
      // vamos usar uma regex mais flexível!
      const lineRegex = /^([A-ZÀ-Ú\s\-+]+?)\s+([\d,]+|Dez)\s+([\d,]+|Dez)\s+([\d,]+|Dez)\s+([\d,]+|Dez)$/gm
      
      let match
      while ((match = lineRegex.exec(bloco)) !== null) {
        disciplinas.push({
          nome: match[1].trim(),
          avm: match[2],
          avb: match[3],
          mediaF: match[4],
          mediaG: match[5]
        })
      }

      alunosDetectados.push({
        codigo,
        nomeArquivo,
        disciplinas,
        bimestre: '1º Bimestre',
        ano: 2026
      })
    }

    // Se não encontrou nenhuma disciplina com a regex restrita, vamos tentar uma mais flexível
    // ou apenas retornar os alunos com os dados brutos para o usuário ver
    if (alunosDetectados.length === 0 || alunosDetectados.every(a => a.disciplinas.length === 0)) {
      console.log('Regex restrita não encontrou disciplinas. Tentando parser flexível...')
      
      // Parser flexível: procura por linhas que tenham um nome e pelo menos uma nota
      const blocosSimples = text.split(/Código:/i)
      
      for (let i = 1; i < blocosSimples.length; i++) {
        const bloco = blocosSimples[i]
        const lines = bloco.split('\n')
        
        const codigoMatch = lines[0].match(/^\s*(\d+)/)
        const codigo = codigoMatch ? codigoMatch[1] : 'Desconhecido'
        
        const disciplinasFlex: any[] = []
        
        for (const line of lines) {
          // Procura por linhas que pareçam uma disciplina e notas
          // Ex: "MATEMÁTICA 9,00"
          const discMatch = line.match(/^([A-ZÀ-Ú\s\-+]{3,})\s+([\d,]+|Dez)/)
          if (discMatch) {
            disciplinasFlex.push({
              nome: discMatch[1].trim(),
              avm: discMatch[2],
              avb: '0,00',
              mediaF: '0,00',
              mediaG: '0,00'
            })
          }
        }
        
        if (disciplinasFlex.length > 0) {
          alunosDetectados.push({
            codigo,
            nomeArquivo: 'Aluno ' + codigo,
            disciplinas: disciplinasFlex,
            bimestre: '1º Bimestre',
            ano: 2026
          })
        }
      }
    }

    return NextResponse.json({ success: true, data: alunosDetectados })

  } catch (error: any) {
    console.error('Erro detalhado na API (pdf2json):', error)
    return NextResponse.json({ error: 'Erro ao processar o arquivo: ' + error.message }, { status: 500 })
  }
}
