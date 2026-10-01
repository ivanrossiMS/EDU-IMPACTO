import test from 'node:test'
import assert from 'node:assert'
import {
  parseRawTextOrHtmlToQuestoes,
  extractGlobalGabaritoMap,
  extractImagesFromHtml
} from '../lib/provas-online/importParser.ts'

test('ImportParser: Global Gabarito Detection at bottom of document', () => {
  const text = `
1. Primeira questão sobre física
A) Opção 1
B) Opção 2
C) Opção 3

2. Segunda questão sobre química
A) Alternativa A
B) Alternativa B
C) Alternativa C

Gabarito Oficial:
1 - B
2 - C
`
  const { cleanedText, gabaritoMap } = extractGlobalGabaritoMap(text)
  assert.strictEqual(gabaritoMap.get(1), 'B')
  assert.strictEqual(gabaritoMap.get(2), 'C')

  const questoes = parseRawTextOrHtmlToQuestoes(text)
  assert.strictEqual(questoes.length, 2)
  assert.strictEqual(questoes[0].alternativas.find(a => a.correta)?.letra, 'B')
  assert.strictEqual(questoes[1].alternativas.find(a => a.correta)?.letra, 'C')
})

test('ImportParser: Multiple choice with inline check and trailing gabarito', () => {
  const text = `
Questão 1: Qual o satélite natural da Terra?
A) Sol
B) Lua
C) Marte
D) Júpiter
Gabarito: B

2) Qual o maior oceano do planeta?
( ) A) Atlântico
(X) B) Pacífico
( ) C) Índico
( ) D) Ártico
`
  const questoes = parseRawTextOrHtmlToQuestoes(text)
  assert.strictEqual(questoes.length, 2)
  assert.strictEqual(questoes[0].tipo, 'multipla_escolha')
  assert.strictEqual(questoes[0].alternativas.find(a => a.correta)?.letra, 'B')

  assert.strictEqual(questoes[1].tipo, 'multipla_escolha')
  assert.strictEqual(questoes[1].alternativas.find(a => a.correta)?.letra, 'B')
})

test('ImportParser: Multiple selection (multiple correct answers)', () => {
  const text = `
Questão 1: Quais dos elementos abaixo são gases nobres?
[X] A) Hélio (He)
[ ] B) Oxigênio (O)
[X] C) Neônio (Ne)
[ ] D) Ferro (Fe)
[X] E) Argônio (Ar)
`
  const questoes = parseRawTextOrHtmlToQuestoes(text)
  assert.strictEqual(questoes.length, 1)
  assert.strictEqual(questoes[0].tipo, 'multipla_selecao')
  const correct = questoes[0].alternativas.filter(a => a.correta).map(a => a.letra)
  assert.deepStrictEqual(correct, ['A', 'C', 'E'])
})

test('ImportParser: True or False (V/F) items detection', () => {
  const text = `
1. Julgue os itens a seguir em V ou F:
(V) O oxigênio é fundamental para a respiração humana.
(F) A água ferve a 50 graus Celsius ao nível do mar.
(V) O carbono é a base da química orgânica.
`
  const questoes = parseRawTextOrHtmlToQuestoes(text)
  assert.strictEqual(questoes.length, 1)
  assert.strictEqual(questoes[0].tipo, 'verdadeiro_falso')
  assert.strictEqual(questoes[0].itensVF.length, 3)
  assert.strictEqual(questoes[0].itensVF[0].correta, true)
  assert.strictEqual(questoes[0].itensVF[1].correta, false)
  assert.strictEqual(questoes[0].itensVF[2].correta, true)
})

test('ImportParser: Dissertative question detection and points calculation', () => {
  const text = `
1. Discorra detalhadamente sobre a importância da preservação dos recursos hídricos para as futuras gerações.
`
  const questoes = parseRawTextOrHtmlToQuestoes(text, { defaultPoints: 2.5 })
  assert.strictEqual(questoes.length, 1)
  assert.strictEqual(questoes[0].tipo, 'dissertativa')
  assert.strictEqual(questoes[0].pontuacao, 2.5)
  assert.ok(questoes[0].criteriosAvaliacao.length > 0)
})

test('ImportParser: Image preservation from HTML paste', () => {
  const html = `
<p><strong>1.</strong> Analise a figura abaixo e assinale a alternativa correta:</p>
<p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" alt="Gráfico" /></p>
<p>A) Curva de crescimento linear</p>
<p>B) Curva de crescimento exponencial</p>
<p>Gabarito: B</p>
`
  const questoes = parseRawTextOrHtmlToQuestoes(html)
  assert.strictEqual(questoes.length, 1)
  assert.ok(questoes[0].enunciado.includes('<img'))
  assert.ok(questoes[0].enunciado.includes('data:image/png;base64'))
  assert.strictEqual(questoes[0].alternativas.find(a => a.correta)?.letra, 'B')
})

test('ImportParser: Equal points distribution for 5 questions on 10 pts exam', () => {
  const text = `
1. Pergunta 1
A) Opção 1
B) Opção 2

2. Pergunta 2
A) Opção 1
B) Opção 2

3. Pergunta 3
A) Opção 1
B) Opção 2

4. Pergunta 4
A) Opção 1
B) Opção 2

5. Pergunta 5
A) Opção 1
B) Opção 2
`
  const questoes = parseRawTextOrHtmlToQuestoes(text, { totalExamPoints: 10 })
  assert.strictEqual(questoes.length, 5)
  questoes.forEach(q => {
    assert.strictEqual(q.pontuacao, 2.0)
  })
})

test('ImportParser: Multi-question paste with images in specific questions and zero image pollution in alternatives', () => {
  const input = `
1. Primeira questao com imagem:
<p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" alt="img1" /></p>
A) Alternativa 1
<b>B)</b> Alternativa 2

2. Segunda questao sem imagem:
A) Opcao 1
B) Opcao 2
<b>C)</b> Opcao 3

3. Terceira questao com imagem no enunciado:
<p><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" alt="img3" /></p>
<b>A)</b> Correta
B) Incorreta
`
  const questoes = parseRawTextOrHtmlToQuestoes(input)
  assert.strictEqual(questoes.length, 3)
  assert.ok(questoes[0].enunciado.includes('<img'))
  assert.ok(!questoes[1].enunciado.includes('<img'))
  assert.ok(questoes[2].enunciado.includes('<img'))
  
  // Assert no alternative text contains an img tag
  questoes.forEach(q => {
    q.alternativas?.forEach(a => {
      assert.ok(!a.texto.includes('<img'), 'Alternative text should not contain img tag')
    })
  })

  // Assert bold gabaritos detected
  assert.strictEqual(questoes[0].alternativas?.find(a => a.correta)?.letra, 'B')
  assert.strictEqual(questoes[1].alternativas?.find(a => a.correta)?.letra, 'C')
  assert.strictEqual(questoes[2].alternativas?.find(a => a.correta)?.letra, 'A')
})

test('ImportParser: Question numbering without space after hyphen or dot (e.g. 9-Oficialmente)', () => {
  const input = `
8- O Benelux é considerado o embrião para a formação da União Europeia.
a) Dinamarca, Noruega
b) Bélgica, Países Baixos

9-Oficialmente, a União Europeia foi constituída em 1º de janeiro de 1993.
<b>a)</b> Tratado de Maastricht
b) Tratado de Versalhes

10- A Política Agrícola Comum é uma importante medida.
a) Lisboa
<b>b)</b> Roma
`
  const questoes = parseRawTextOrHtmlToQuestoes(input)
  assert.strictEqual(questoes.length, 3)
  assert.ok(questoes[1].enunciado.includes('Oficialmente, a União Europeia'))
  assert.strictEqual(questoes[1].alternativas?.find(a => a.correta)?.letra, 'A')
})

test('ImportParser: Word HTML with MsoNormal paragraphs and red font gabaritos', () => {
  const wordHtml = `
<p class="MsoNormal"><b><span style="font-size:12.0pt">1. </span></b>A América pode ser regionalizada, dentre outras formas, por meio da divisão em América Anglo-Saxônica e América Latina. Essa divisão se dá por meio de critérios:</p>
<p class="MsoNormal">a) geográficos, devido à diversidade de relevo e geologia entre as regiões do continente americano.</p>
<p class="MsoNormal">b) naturais, já que na porção mais ao norte da América há a predominância de climas tropicais.</p>
<p class="MsoNormal">c) pedológicos, pois o solo americano possui composições distintas no extremo norte do continente.</p>
<p class="MsoNormal">d) econômicos, uma vez que os países anglo-saxões possuem economias subdesenvolvidas.</p>
<p class="MsoNormal"><font color="red">e) socioculturais, em razão da diferença cultural dos povos colonizadores que chegaram à América.</font></p>

<p class="MsoNormal"><b>2. </b>No que toca aos aspectos naturais dos países anglo- saxões da América, assinale a alternativa <b>correta</b>.</p>
<p class="MsoNormal"><font color="red">a) Estão localizados nas zonas temperadas e polares do globo, com climas predominantemente frios.</font></p>
<p class="MsoNormal">b) São influenciados climaticamente pelas massas de ar frias, provenientes da zona antártica.</p>
<p class="MsoNormal">c) Apresentam climas típicos das zonas tropicais e intertropicais do mundo, como o equatorial.</p>
<p class="MsoNormal">d) Possuem tipos climáticos marcados pela grande presença de umidade, como o subtropical.</p>
<p class="MsoNormal">e) Detêm características climáticas de zonas mediterrâneas, como os climas semiárido e desértico.</p>
`
  const questoes = parseRawTextOrHtmlToQuestoes(wordHtml)
  assert.strictEqual(questoes.length, 2)
  assert.strictEqual(questoes[0].tipo, 'multipla_escolha')
  assert.strictEqual(questoes[0].alternativas?.length, 5)
  assert.strictEqual(questoes[0].alternativas?.find(a => a.correta)?.letra, 'E')

  assert.strictEqual(questoes[1].tipo, 'multipla_escolha')
  assert.strictEqual(questoes[1].alternativas?.length, 5)
  assert.strictEqual(questoes[1].alternativas?.find(a => a.correta)?.letra, 'A')
})

test('ImportParser: RTF hex extraction and HTML image injection into questions', async () => {
  const { extractImagesFromRtf, injectRtfImagesIntoHtml } = await import('../lib/provas-online/importParser.ts')

  const testPngHex = '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c636060600000000400012734270a0000000049454e44ae426082'
  const testJpgHex = 'ffd8ffe000104a46494600010101006000600000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffda0008010100003f007f00ffd9'

  const sampleRtf = `{\\rtf1 {\\shppict{\\pict\\pngblip ${testPngHex}}}{\\nonshppict{\\pict\\wmetafile8 ${testPngHex}}} {\\shppict{\\pict\\jpegblip ${testJpgHex}}}}`
  const rtfImages = extractImagesFromRtf(sampleRtf)

  assert.strictEqual(rtfImages.length, 2)
  assert.strictEqual(rtfImages[0].mime, 'image/png')
  assert.strictEqual(rtfImages[1].mime, 'image/jpeg')

  const wordHtml = `
<p class="MsoNormal">1. Questão 1 com primeira imagem:</p>
<p class="MsoNormal"><!--[if gte vml 1]><v:shape><v:imagedata src="file:///tmp/img1.png"/></v:shape><![endif]--><![if !vml]><img src="file:///tmp/img1.png"><![endif]></p>
<p class="MsoNormal">a) Opção 1</p>
<p class="MsoNormal"><font color="red">b) Opção 2</font></p>

<p class="MsoNormal">2. Questão 2 sem imagem:</p>
<p class="MsoNormal">a) Opção A</p>
<p class="MsoNormal">b) Opção B</p>

<p class="MsoNormal">3. Questão 3 com segunda imagem:</p>
<p class="MsoNormal"><img src="file:///tmp/img2.jpg"></p>
<p class="MsoNormal">a) Opção X</p>
<p class="MsoNormal">b) Opção Y</p>
`
  const { injectedHtml } = injectRtfImagesIntoHtml(wordHtml, rtfImages)
  const questoes = parseRawTextOrHtmlToQuestoes(injectedHtml)

  assert.strictEqual(questoes.length, 3)
  assert.ok(questoes[0].enunciado.includes('<img'), 'Question 1 must contain first image')
  assert.ok(questoes[0].enunciado.includes('data:image/png;base64,'), 'Question 1 image must be PNG base64')
  assert.strictEqual(questoes[0].alternativas?.find(a => a.correta)?.letra, 'B')

  assert.ok(!questoes[1].enunciado.includes('<img'), 'Question 2 must not contain image')

  assert.ok(questoes[2].enunciado.includes('<img'), 'Question 3 must contain second image')
  assert.ok(questoes[2].enunciado.includes('data:image/jpeg;base64,'), 'Question 3 image must be JPEG base64')
})

test('ImportParser: Real-world Word RTF with blipuid GUID, nested picprop and VML HTML', async () => {
  const { extractImagesFromRtf, injectRtfImagesIntoHtml, parseRawTextOrHtmlToQuestoes } = await import('../lib/provas-online/importParser.ts')

  const testPngHex = '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c636060600000000400012734270a0000000049454e44ae426082'
  const testJpgHex = 'ffd8ffe000104a46494600010101006000600000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffc0000b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffda0008010100003f007f00ffd9'

  // Word 2016 / 2019 / 2021 / Mac RTF with blipuid GUID, bliptag, nested picprop, and nonshppict duplicate
  const wordRtf = `{\\rtf1\\ansi\\ansicpg1252
{\\*\\shppict{\\pict{\\*\\picprop{\\sp{\\sn shapeType}{\\sv 75}}{\\sp{\\sn fFlipH}{\\sv 0}}}\\picw10583\\pich7938\\picwgoal6000\\pichgoal4500\\pngblip\\bliptag-1072938475\\blipupi96\\blipuid a8f7c9e0123456789abcdef012345678
${testPngHex}
}}{\\nonshppict{\\pict{\\*\\picprop{\\sp{\\sn shapeType}{\\sv 75}}}\\wmetafile8\\picw10583\\pich7938 010009000003000000000000}}
{\\*\\shppict{\\pict{\\*\\picprop{\\sp{\\sn shapeType}{\\sv 75}}}\\picw10583\\pich7938\\picwgoal6000\\pichgoal4500\\jpegblip\\bliptag-987654321\\blipupi96\\blipuid b1c2d3e4f5061728394a5b6c7d8e9f00
${testJpgHex}
}}{\\nonshppict{\\pict\\wmetafile8 010009000003000000000000}}
}`

  const rtfImages = extractImagesFromRtf(wordRtf)
  assert.strictEqual(rtfImages.length, 2, 'Should extract exactly 2 modern images, ignoring nonshppict fallbacks')

  // Validate PNG image
  assert.strictEqual(rtfImages[0].mime, 'image/png')
  assert.strictEqual(rtfImages[0].name, 'imagem_1.png')
  const pngB64 = rtfImages[0].src.replace('data:image/png;base64,', '')
  const pngBuf = Buffer.from(pngB64, 'base64')
  assert.strictEqual(pngBuf.slice(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG must begin with exact PNG magic bytes')
  assert.strictEqual(pngBuf.slice(-8).toString('hex'), '49454e44ae426082', 'PNG must terminate with exact IEND chunk')

  // Validate JPEG image
  assert.strictEqual(rtfImages[1].mime, 'image/jpeg')
  assert.strictEqual(rtfImages[1].name, 'imagem_2.jpg')
  const jpgB64 = rtfImages[1].src.replace('data:image/jpeg;base64,', '')
  const jpgBuf = Buffer.from(jpgB64, 'base64')
  assert.strictEqual(jpgBuf.slice(0, 3).toString('hex'), 'ffd8ff', 'JPEG must begin with exact SOI marker')
  assert.strictEqual(jpgBuf.slice(-2).toString('hex'), 'ffd9', 'JPEG must terminate with exact EOI marker')

  // Validate HTML injection with realistic Word conditional comments
  const wordHtml = `
<p class="MsoNormal"><b>1-</b> A América pode ser regionalizada, dentre outras formas, por meio da divisão em América Anglo-Saxônica e América Latina:</p>
<!--[if gte vml 1]><v:shapetype id="_x0000_t75"><v:shape id="Imagem 1"><v:imagedata src="file:///tmp/clip_image001.png"/></v:shape></v:shapetype><![endif]--><![if !vml]><img src="file:///tmp/clip_image001.png" alt="imagem_1.png"><![endif]>
<p class="MsoNormal">a) geográficos, devido à diversidade</p>
<p class="MsoNormal"><font color="red">e) socioculturais, em razão da diferença cultural</font></p>

<p class="MsoNormal"><b>2-</b> No que toca aos aspectos naturais dos países anglo-saxões:</p>
<p class="MsoNormal"><font color="red">a) Estão localizados nas zonas temperadas</font></p>
<p class="MsoNormal">b) São influenciados climaticamente</p>

<p class="MsoNormal"><b>3-</b> (FGV) A conquista colonial inglesa resultou no estabelecimento de três áreas:</p>
<!--[if gte vml 1]><v:shape id="Imagem 2"><v:imagedata src="file:///tmp/clip_image002.jpg"/></v:shape><![endif]--><![if !vml]><img src="file:///tmp/clip_image002.jpg" alt="imagem_2.jpg"><![endif]>
<p class="MsoNormal">a) Baseava-se, sobretudo</p>
<p class="MsoNormal"><font color="red">c) Baseava-se em uma economia escravista</font></p>
`
  const { injectedHtml, unassignedImages } = injectRtfImagesIntoHtml(wordHtml, rtfImages)
  assert.strictEqual(unassignedImages.length, 0, 'All images must be assigned to their matching <img> tags')

  const questoes = parseRawTextOrHtmlToQuestoes(injectedHtml)
  assert.strictEqual(questoes.length, 3, 'Must parse 3 questions')

  // Question 1 has PNG image
  assert.ok(questoes[0].enunciado.includes('<img'), 'Question 1 must have image')
  assert.ok(questoes[0].enunciado.includes('data:image/png;base64,'), 'Question 1 must have PNG base64')
  assert.strictEqual(questoes[0].alternativas?.find(a => a.correta)?.letra, 'E')

  // Question 2 has no image
  assert.ok(!questoes[1].enunciado.includes('<img'), 'Question 2 must NOT have image')
  assert.strictEqual(questoes[1].alternativas?.find(a => a.correta)?.letra, 'A')

  // Question 3 has JPEG image
  assert.ok(questoes[2].enunciado.includes('<img'), 'Question 3 must have image')
  assert.ok(questoes[2].enunciado.includes('data:image/jpeg;base64,'), 'Question 3 must have JPEG base64')
  assert.strictEqual(questoes[2].alternativas?.find(a => a.correta)?.letra, 'C')
})

test('ImportParser: Word HTML edge cases (nested v:shape, commented !vml, standalone v:imagedata)', async () => {
  const { injectRtfImagesIntoHtml, parseRawTextOrHtmlToQuestoes } = await import('../lib/provas-online/importParser.ts')
  const rtfImg = [
    { name: 'imagem_1.png', src: 'data:image/png;base64,PNG1' },
    { name: 'imagem_2.jpg', src: 'data:image/jpeg;base64,JPG2' }
  ]

  // Case A: v:shape wrapping <img>
  const htmlA = `
  1. Questão 1:
  <v:shape id="s1"><v:imagedata src="file:///img1.png"/><![if !vml]><img src="file:///img1.png"><![endif]></v:shape>
  a) A
  b) B
  2. Questão 2:
  <v:shape id="s2"><v:imagedata src="file:///img2.jpg"/><![if !vml]><img src="file:///img2.jpg"><![endif]></v:shape>
  a) A
  b) B
  `
  const resA = injectRtfImagesIntoHtml(htmlA, rtfImg)
  assert.strictEqual(resA.unassignedImages.length, 0, 'Case A: All images should be injected')
  const qA = parseRawTextOrHtmlToQuestoes(resA.injectedHtml)
  assert.strictEqual(qA.length, 2)
  assert.ok(qA[0].enunciado.includes('PNG1'))
  assert.ok(qA[1].enunciado.includes('JPG2'))

  // Case C: standalone v:imagedata without <img>
  const htmlC = `
  1. Questão 1:
  <v:shape id="s1"><v:imagedata src="file:///img1.png"/></v:shape>
  a) A
  b) B
  `
  const resC = injectRtfImagesIntoHtml(htmlC, [rtfImg[0]])
  assert.strictEqual(resC.unassignedImages.length, 0, 'Case C: Standalone v:imagedata should be converted and injected')
  const qC = parseRawTextOrHtmlToQuestoes(resC.injectedHtml)
  assert.strictEqual(qC.length, 1)
  assert.ok(qC[0].enunciado.includes('PNG1'))
})

test('ImportParser: Word HTML with immediate span adhesion after marker and clean alternative text', () => {
  const wordHtml = `
  1. A saga de pioneiros e desbravadores foi retratada em filmes:
  <p class=MsoNormal style='margin-bottom:0cm;line-height:normal'><b><span style='font-family:"Arial",sans-serif;color:black'>a)</span></b><span style='font-family:"Arial",sans-serif;color:black'> a corrida do ouro na Califórnia</span></p>
  <p class=MsoNormal style='margin-bottom:0cm;line-height:normal'><b><span style='font-family:"Arial",sans-serif;color:black'>b)</span></b><span style='font-family:"Arial",sans-serif;color:black'> a ocupação de todos os territórios</span></p>
  <p class=MsoNormal style='margin-bottom:0cm;line-height:normal'><b><span style='font-family:"Arial",sans-serif;color:black'>c)</span></b><span style='font-family:"Arial",sans-serif;color:black'> a colonização de terras do oeste</span></p>
  <p class=MsoNormal style='margin-bottom:0cm;line-height:normal'><b><span style='font-family:"Arial",sans-serif;color:black'>d)</span></b><span style='font-family:"Arial",sans-serif;color:black'> a ocupação de áreas além do rio</span></p>
  <p class=MsoNormal style='margin-bottom:0cm;line-height:normal'><b><span style='font-family:"Arial",sans-serif;color:black'>e)</span></b><span style='font-family:"Arial",sans-serif;color:black'> a anexação dos estados do Texas<!--EndFragment--></body></html></span></p>
  `
  const questoes = parseRawTextOrHtmlToQuestoes(wordHtml)
  assert.strictEqual(questoes.length, 1)
  assert.strictEqual(questoes[0].tipo, 'multipla_escolha')
  assert.strictEqual(questoes[0].alternativas?.length, 5)
  assert.deepStrictEqual(questoes[0].alternativas?.map(a => a.letra), ['A', 'B', 'C', 'D', 'E'])

  // Verify texts have zero HTML tag remnants
  questoes[0].alternativas?.forEach(a => {
    assert.ok(!a.texto.includes('<span'), 'Alternative text should not contain span tag')
    assert.ok(!a.texto.includes('<!--EndFragment'), 'Alternative text should not contain EndFragment')
    assert.ok(!a.texto.includes('</body>'), 'Alternative text should not contain body tag')
  })
  assert.strictEqual(questoes[0].alternativas?.[0].texto, 'a corrida do ouro na Califórnia')
  assert.strictEqual(questoes[0].alternativas?.[4].texto, 'a anexação dos estados do Texas')
})

test('ImportParser: Automatic recovery of swallowed embedded alternative (e.g. C inside B)', async () => {
  const { repairQuestion } = await import('../lib/provas-online/textSanitizer.ts')

  const questionWithSwallowedC = {
    id: 'q-test-1',
    ordem: 0,
    tipo: 'multipla_escolha',
    enunciado: 'Enunciado de teste',
    alternativas: [
      { id: '1', letra: 'A', texto: 'Alternativa A texto', correta: true, ordem: 0 },
      {
        id: '2',
        letra: 'B',
        texto: "Alternativa B texto.</span><span style='font-size:11pt'></span> <p><b>c)</b> Alternativa C texto recuperado</span>",
        correta: false,
        ordem: 1
      },
      { id: '3', letra: 'D', texto: 'Alternativa D texto', correta: false, ordem: 2 },
      { id: '4', letra: 'E', texto: 'Alternativa E texto<!--EndFragment--></body></html>', correta: false, ordem: 3 }
    ]
  }

  const repaired = repairQuestion(questionWithSwallowedC)
  assert.strictEqual(repaired.alternativas?.length, 5)
  assert.deepStrictEqual(repaired.alternativas?.map(a => a.letra), ['A', 'B', 'C', 'D', 'E'])
  assert.strictEqual(repaired.alternativas?.[1].texto, 'Alternativa B texto.')
  assert.strictEqual(repaired.alternativas?.[2].texto, 'Alternativa C texto recuperado')
  assert.strictEqual(repaired.alternativas?.[4].texto, 'Alternativa E texto')
})

test('ImportParser: Question with alternatives in enunciado restored from dissertativa to multipla_escolha', async () => {
  const { repairQuestion } = await import('../lib/provas-online/textSanitizer.ts')

  const misclassifiedQ = {
    id: 'q-test-diss',
    ordem: 0,
    tipo: 'dissertativa',
    enunciado: `No que toca aos aspectos naturais, assinale a alternativa correta.
    <p><b><span style="color:#EE0000">a)</span></b> Estão localizados nas zonas temperadas</p>
    <p>b) São influenciados climaticamente</p>
    <p>c) Apresentam climas tropicais</p>
    <p>d) Possuem tipos climáticos úmidos</p>
    <p>e) Detêm características mediterrâneas</p>`,
    respostaEsperada: 'Critério dissertativa'
  }

  const repaired = repairQuestion(misclassifiedQ)
  assert.strictEqual(repaired.tipo, 'multipla_escolha')
  assert.strictEqual(repaired.alternativas?.length, 5)
  assert.deepStrictEqual(repaired.alternativas?.map(a => a.letra), ['A', 'B', 'C', 'D', 'E'])
  assert.strictEqual(repaired.alternativas?.[0].correta, true, 'Red marked option A should be recognized as gabarito')
  assert.strictEqual(repaired.respostaEsperada, undefined)
})

test('ImportParser: Question with 10 alternatives fused via Word paste splits into two distinct questions', async () => {
  const { splitFusedQuestionsIfAny } = await import('../lib/provas-online/textSanitizer.ts')

  const fusedQ = {
    id: 'q-fused-17',
    ordem: 16,
    tipo: 'multipla_escolha',
    enunciado: 'O euro representou um avanço no processo de integração da União Europeia... Está(ão) correta(s):',
    pontuacao: 0.5,
    alternativas: [
      { id: '1', letra: 'A', ordem: 0, texto: 'apenas a afirmativa I.', correta: false },
      { id: '2', letra: 'B', ordem: 1, texto: 'apenas a afirmativa II.', correta: false },
      { id: '3', letra: 'C', ordem: 2, texto: 'apenas a afirmativa III.', correta: true },
      { id: '4', letra: 'D', ordem: 3, texto: 'apenas as afirmativas I e II.', correta: false },
      {
        id: '5',
        letra: 'E',
        ordem: 4,
        texto: 'apenas as afirmativas II e III. 8 - O Benelux é considerado o embrião para a formação da União Europeia. Quais países formavam esse agrupamento?',
        correta: false
      },
      { id: '6', letra: 'A', ordem: 5, texto: 'Dinamarca, Noruega e Finlândia.', correta: false },
      { id: '7', letra: 'B', ordem: 6, texto: 'Bélgica, Países Baixos e Luxemburgo.', correta: false },
      { id: '8', letra: 'C', ordem: 7, texto: 'Grã-Bretanha, Noruega e Escócia.', correta: false },
      { id: '9', letra: 'D', ordem: 8, texto: 'França, Bélgica e República Tcheca.', correta: false },
      { id: '10', letra: 'E', ordem: 9, texto: 'Suíça, Reino Unido e Espanha.', correta: false }
    ]
  }

  const splits = splitFusedQuestionsIfAny(fusedQ)
  assert.strictEqual(splits.length, 2, 'Should split into exactly two questions')

  // Question 1
  assert.strictEqual(splits[0].alternativas?.length, 5)
  assert.deepStrictEqual(splits[0].alternativas?.map(a => a.letra), ['A', 'B', 'C', 'D', 'E'])
  assert.strictEqual(splits[0].alternativas?.[4].texto, 'apenas as afirmativas II e III.')
  assert.strictEqual(splits[0].alternativas?.[2].correta, true)

  // Question 2
  assert.strictEqual(splits[1].enunciado, 'O Benelux é considerado o embrião para a formação da União Europeia. Quais países formavam esse agrupamento?')
  assert.strictEqual(splits[1].alternativas?.length, 5)
  assert.deepStrictEqual(splits[1].alternativas?.map(a => a.letra), ['A', 'B', 'C', 'D', 'E'])
  assert.strictEqual(splits[1].alternativas?.[1].correta, true, 'Option B should be recognized as correct for Benelux')
})



