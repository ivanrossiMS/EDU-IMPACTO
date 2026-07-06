'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, BookOpen, Users, GraduationCap, Settings, CheckCircle, FileText, Layout, Sparkles, Upload, Layers, PenTool, LogIn, FileCode2, Camera, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function AjudaPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'geral' | 'professor' | 'coordenador'>('geral')
  const [search, setSearch] = useState('')

  return (
    <div style={{ padding: '40px', maxWidth: 1200, margin: '0 auto', paddingBottom: 100, minHeight: '100vh', background: 'hsl(var(--bg-app))' }}>
      
      {/* Back Button */}
      <button 
        onClick={() => router.back()}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 12,
          background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
          border: 'none',
          padding: '16px 32px', borderRadius: 16,
          color: '#ffffff',
          fontSize: 18, fontWeight: 800, letterSpacing: '0.05em',
          cursor: 'pointer',
          marginBottom: 40,
          boxShadow: '0 8px 24px rgba(59,130,246,0.3)',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 12px 32px rgba(59,130,246,0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(59,130,246,0.3)';
        }}
      >
        <ArrowLeft size={24} /> VOLTAR
      </button>

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(59,130,246,0.3)' }}>
            <BookOpen size={32} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 36, fontWeight: 900, margin: 0, color: 'hsl(var(--text-primary))', letterSpacing: '-0.02em' }}>
              Central de Ajuda
            </h1>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 16, margin: '4px 0 0 0' }}>
              Aprenda a utilizar todos os recursos do módulo de Simulados e Provas.
            </p>
          </div>
        </div>

        {/* Search & Tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 40 }}>
          <div style={{ position: 'relative', maxWidth: 500 }}>
            <Search size={20} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))' }} />
            <input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por tópicos..."
              style={{ width: '100%', padding: '16px 16px 16px 48px', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))', color: 'hsl(var(--text-primary))', fontSize: 15, fontWeight: 500, outline: 'none', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(59,130,246,0.15)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: 16, flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('geral')}
              style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: activeTab === 'geral' ? 'rgba(59,130,246,0.1)' : 'transparent', color: activeTab === 'geral' ? '#3b82f6' : 'hsl(var(--text-secondary))', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}
            >
              <LogIn size={20} /> Acesso e Visão Geral
            </button>
            <button
              onClick={() => setActiveTab('professor')}
              style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: activeTab === 'professor' ? 'rgba(59,130,246,0.1)' : 'transparent', color: activeTab === 'professor' ? '#3b82f6' : 'hsl(var(--text-secondary))', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}
            >
              <GraduationCap size={20} /> Sou Professor
            </button>
            <button
              onClick={() => setActiveTab('coordenador')}
              style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: activeTab === 'coordenador' ? 'rgba(59,130,246,0.1)' : 'transparent', color: activeTab === 'coordenador' ? '#3b82f6' : 'hsl(var(--text-secondary))', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}
            >
              <Users size={20} /> Sou Coordenador
            </button>
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 40 }}
          >
            {activeTab === 'geral' && <GeralContent search={search} />}
            {activeTab === 'professor' && <ProfessorContent search={search} />}
            {activeTab === 'coordenador' && <CoordenadorContent search={search} />}
          </motion.div>
        </AnimatePresence>

      </motion.div>
    </div>
  )
}

function Section({ title, icon: Icon, children, search }: { title: string, icon: any, children: React.ReactNode, search: string }) {
  if (search && !title.toLowerCase().includes(search.toLowerCase())) return null;
  return (
    <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: 24, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
      <div style={{ padding: '24px 32px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'rgba(59,130,246,0.02)', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 4px 12px rgba(59,130,246,0.3)' }}>
          <Icon size={20} />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'hsl(var(--text-primary))' }}>{title}</h2>
      </div>
      <div style={{ padding: '32px' }}>
        {children}
      </div>
    </div>
  )
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {steps.map((step, idx) => (
        <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0, marginTop: 2 }}>
            {idx + 1}
          </div>
          <p style={{ margin: 0, fontSize: 15, color: 'hsl(var(--text-primary))', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: step }} />
        </li>
      ))}
    </ul>
  )
}

function ImageCard({ src, alt, caption }: { src: string, alt: string, caption?: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))', boxShadow: '0 20px 40px rgba(0,0,0,0.06)' }}>
      <img src={src} alt={alt} style={{ width: '100%', display: 'block', objectFit: 'contain', background: '#f8fafc' }} />
      {caption && (
        <div style={{ padding: '16px 24px', background: 'rgba(59,130,246,0.05)', borderTop: '1px solid hsl(var(--border-subtle))', color: 'hsl(var(--text-secondary))', fontSize: 13, lineHeight: 1.5, fontWeight: 500 }}>
          {caption}
        </div>
      )}
    </div>
  )
}

function LayoutSplit({ left, right }: { left: React.ReactNode, right: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 40, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{left}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>{right}</div>
    </div>
  )
}

function GeralContent({ search }: { search: string }) {
  return (
    <>
      <Section title="Primeiro Acesso ao Sistema" icon={LogIn} search={search}>
        <p style={{ color: 'hsl(var(--text-secondary))', lineHeight: 1.6, fontSize: 16 }}>Bem-vindo ao módulo de Simulados e Provas! Ele pode parecer repleto de opções à primeira vista, mas conforme você for utilizando, verá que foi feito para agilizar e facilitar muito o seu trabalho.</p>
        
        <StepList steps={[
          'Acesse o site oficial: <a href="https://impacto-edu.net/" target="_blank" style="color: #3b82f6; text-decoration: none; font-weight: 600;">https://impacto-edu.net/</a>',
          'Na tela inicial, clique em <strong>Primeiro Acesso</strong>.',
          'Utilize o seu e-mail ou número de celular para se registrar.',
          'Após efetuar o login, selecione a opção <strong>Simulados</strong> no menu de seleção ou lateral para entrar neste módulo.'
        ]} />
        
        <div style={{ padding: 24, background: 'rgba(59,130,246,0.05)', borderRadius: 16, border: '1px solid rgba(59,130,246,0.2)', marginTop: 24 }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}><BookOpen size={20} />O que o sistema oferece?</h4>
          <p style={{ margin: 0, color: 'hsl(var(--text-primary))', lineHeight: 1.7, fontSize: 15 }}>
            Temos três pilares principais disponíveis:<br/><br/>
            <strong>1. Envio de Provas:</strong> Professores e Coordenadores podem criar, formatar e imprimir provas.<br/>
            <strong>2. Envio de Redação:</strong> Criação super rápida de folhas de redação prontas para impressão.<br/>
            <strong>3. Envio de Simulados:</strong> O Coordenador cria a estrutura multidisciplinar e vincula os professores.
          </p>
        </div>
      </Section>

      <Section title="Formatando seu Arquivo Word (.doc / .docx)" icon={FileCode2} search={search}>
        <LayoutSplit 
          left={
            <>
              <p style={{ color: 'hsl(var(--text-secondary))', lineHeight: 1.6, fontSize: 15, margin: 0 }}>
                A maneira mais recomendada e rápida de criar sua prova é fazendo um documento no Word com todas as suas questões (não precisa formatar margens ou cabeçalhos!). Siga exatamente as regras abaixo para que o sistema reconheça tudo sozinho, incluindo imagens!
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
                {/* Questão Múltipla Escolha */}
                <div style={{ background: '#1e293b', padding: 24, borderRadius: 16, color: '#f8fafc', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                  <h4 style={{ margin: '0 0 16px 0', color: '#38bdf8', fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle size={18} /> Questões de Múltipla Escolha</h4>
                  <div style={{ fontFamily: 'monospace', fontSize: 15, lineHeight: 1.6, background: '#0f172a', padding: 20, borderRadius: 12 }}>
                    1- ENUNCIADO DA QUESTÃO AQUI<br/>
                    a) alternativa falsa<br/>
                    <span style={{ color: '#f87171', fontWeight: 'bold' }}>b) alternativa correta em vermelho</span><br/>
                    c) alternativa falsa<br/>
                    <br/>
                    2- OUTRO ENUNCIADO<br/>
                    <span style={{ color: '#f87171', fontWeight: 'bold' }}>a) correta vermelha</span><br/>
                    b) falsa<br/>
                    c) falsa
                  </div>
                  <p style={{ margin: '16px 0 0 0', fontSize: 14, color: '#94a3b8', lineHeight: 1.5 }}>
                    * A alternativa correta <strong>DEVE estar na cor vermelha</strong> para o sistema ler o gabarito. Você não precisa se preocupar com a indentação, basta usar <strong>a)</strong>, <strong>b)</strong>.
                  </p>
                </div>
      
                {/* Questão Descritiva */}
                <div style={{ background: '#1e293b', padding: 24, borderRadius: 16, color: '#f8fafc', boxShadow: '0 10px 30px rgba(0,0,0,0.15)' }}>
                  <h4 style={{ margin: '0 0 16px 0', color: '#38bdf8', fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}><PenTool size={18} /> Questões Descritivas</h4>
                  <div style={{ fontFamily: 'monospace', fontSize: 15, lineHeight: 1.6, background: '#0f172a', padding: 20, borderRadius: 12 }}>
                    3- ENUNCIADO DA QUESTÃO DESCRITIVA XXXXXXXXX<br/>
                    <br/>
                    4- OUTRO ENUNCIADO DE DESCRITIVA...<br/>
                    <br/>
                    <br/>
                  </div>
                  <p style={{ margin: '16px 0 0 0', fontSize: 14, color: '#94a3b8', lineHeight: 1.5 }}>
                    * Sem alternativas! O sistema vai identificar que é uma questão descritiva e automaticamente criará um <strong>espaço em branco</strong>.
                  </p>
                </div>
              </div>
            </>
          }
          right={
            <ImageCard src="/ajuda/imagem2.png" alt="Exemplo de Word formatado" caption="Veja como é simples: enumere a questão e coloque a alternativa correta em vermelho. As imagens também são importadas perfeitamente!" />
          }
        />
      </Section>
    </>
  )
}

function ProfessorContent({ search }: { search: string }) {
  return (
    <>
      <Section title="Criando Provas e Redações" icon={FileText} search={search}>
        <LayoutSplit
          left={
            <>
              <p style={{ color: 'hsl(var(--text-secondary))', lineHeight: 1.6, fontSize: 15, margin: 0 }}>Professores têm permissão total para criar suas próprias provas e folhas de redação.</p>
              
              <StepList steps={[
                'No menu lateral, vá em <strong>Provas via Upload</strong> e clique no botão de <strong>Nova Prova</strong>.',
                'Preencha sempre todas as informações: Título, Data, Série, a sua Disciplina e a <strong>quantidade de questões</strong> que a prova terá.',
                'Após criar, a prova vai aparecer agrupada por turma. <em>Dica: o cabeçalho dela já estará automaticamente completo com os dados que você inseriu!</em>',
                '<strong>Atenção:</strong> Após a criação, <strong>clique no seu nome</strong> na listagem (em "Professor(a) Responsável") para abrir a inserção do arquivo.',
                '<strong>Folhas de Redação:</strong> Da mesma maneira, em "Redação via Upload", você preenche título, série e data, e a folha pautada oficial é gerada imediatamente. Só imprimir!'
              ]} />
            </>
          }
          right={
            <>
              <ImageCard src="/ajuda/imagem6.png" alt="Criando uma Nova Prova" caption="Preencha os dados básicos da prova e atribua a quantidade de questões." />
              <ImageCard src="/ajuda/imagem1.png" alt="Painel de Provas" caption="IMPORTANTE: Para começar a enviar suas questões, clique no seu nome no card da prova (conforme imagem acima)." />
            </>
          }
        />
      </Section>

      <Section title="Enviando e Gerenciando Questões" icon={Upload} search={search}>
        <LayoutSplit
          left={
            <>
              <p style={{ color: 'hsl(var(--text-secondary))', lineHeight: 1.6, fontSize: 15, margin: 0 }}>
                Acreditamos que o mais fácil é preparar tudo no <strong>arquivo Word (.doc, .docx)</strong> primeiro, importá-lo no sistema, e depois apenas ajustar o que for necessário.
              </p>
      
              <StepList steps={[
                '<strong>Importando (Upload):</strong> Clique na sua prova e faça o upload do arquivo Word que você preparou. Imagens e gabaritos em vermelho serão importados sozinhos!',
                '<strong>Tela de Questões:</strong> Após enviar, você verá a lista de questões. Nela é possível <strong>editar os textos</strong>, excluir questões indesejadas ou criar novas.',
                '<strong>Gerar com Inteligência Artificial:</strong> O painel permite criar questões do zero usando IA! Você define o nível, a turma e o tema, e o sistema formula o enunciado e alternativas para você!',
                '<strong>Imagens:</strong> Você pode adicionar imagens diretamente nas alternativas ou gerar imagens inéditas por IA dentro da questão.'
              ]} />
            </>
          }
          right={
            <ImageCard src="/ajuda/imagem3.png" alt="Upload de Arquivos" caption="Basta arrastar o seu arquivo Word direto na área indicada." />
          }
        />
      </Section>

      <Section title="Estúdio A4 (Pré-visualizar e Formatar)" icon={Layout} search={search}>
        <LayoutSplit
          left={
            <>
              <p style={{ color: 'hsl(var(--text-secondary))', lineHeight: 1.6, fontSize: 15, margin: 0 }}>
                Clicando no botão de <strong>Pré-visualizar</strong>, abrirá o nosso estúdio que parece um "Word Online". É aqui que você vê a cara final da prova!
              </p>
      
              <StepList steps={[
                '<strong>Ajustes Visuais:</strong> Você poderá alterar tamanhos de fontes, estilo das alternativas (mostrar na vertical ou na horizontal) e configurar o formato da página (coluna corrida inteira ou dividida ao meio, tipo Enem).',
                '<strong>Edição Livre na Folha:</strong> Viu um erro? Clique diretamente no texto dentro da visualização da folha para corrigir.',
                '<strong>Tamanhos e Espaços:</strong> Ajuste livremente o tamanho das imagens arrastando as bordas, e mexa nas margens laterais da folha para aproveitar o espaço ao máximo.',
                '<strong>Questões Descritivas:</strong> Com um clique, você insere "linhas pautadas" automáticas para os alunos escreverem.',
                '<strong>Salvar:</strong> Sempre que alterar algo, lembre-se de clicar no botão "Salvar".'
              ]} />
            </>
          }
          right={
            <ImageCard src="/ajuda/imagem5.png" alt="Estúdio A4" caption="Use a barra lateral para ajustar perfeitamente o tamanho de fonte, colunas e disposição das margens antes de imprimir." />
          }
        />
      </Section>

      <Section title="Finalizando Provas e Trabalhando com Simulados" icon={CheckCircle} search={search}>
        <LayoutSplit
          left={
            <StepList steps={[
              '<strong>Salvar e Enviar:</strong> Quando a sua prova estiver finalizada no sistema, clique neste botão. Isso sinalizará para o seu coordenador que a prova está pronta para a verificação final dele.',
              '<strong>Simulados:</strong> O fluxo é <em>exatamente o mesmo</em>! A diferença é que quem cria o simulado é o <strong>Coordenador</strong>. Ele vinculará o seu nome e dirá quantas questões você deve fazer.',
              'Se você for designado para um simulado, basta <strong>clicar no seu nome</strong> lá dentro para fazer o upload do seu arquivo de questões.',
              '<strong>Correção Automática de Simulados:</strong> O professor pode pegar o celular, abrir o sistema, tirar uma foto do cartão resposta (gabarito) do aluno, e o sistema mostrará na hora a quantidade de acertos, erros e a %! Muito rápido e fácil.'
            ]} />
          }
          right={
            <ImageCard src="/ajuda/imagem4.png" alt="Lista de Questões" caption="Após ajustar tudo, confira o número de questões. Estando pronto, use os botões verdes superiores (Salvar e Enviar / Aprovar)." />
          }
        />
      </Section>
    </>
  )
}

function CoordenadorContent({ search }: { search: string }) {
  return (
    <>
      <Section title="Criando Simulados e Orquestrando Professores" icon={Layers} search={search}>
        <p style={{ color: 'hsl(var(--text-secondary))', lineHeight: 1.6, fontSize: 15 }}>O principal diferencial do Coordenador é a montagem da grande estrutura dos simulados.</p>
        
        <StepList steps={[
          'Acesse o módulo e clique em <strong>Criar Simulado</strong>.',
          'Você precisa inserir as disciplinas participantes. Para cada disciplina, vincule o professor responsável.',
          '<strong>Importante:</strong> É necessário especificar a quantidade exata de questões que cada professor deverá inserir para aquele simulado.',
          'Uma vez salvo, o simulado ficará disponível na tela de cada professor vinculado para que eles insiram suas respectivas questões.'
        ]} />
      </Section>

      <Section title="Revisão e Aprovação de Provas/Simulados" icon={CheckCircle} search={search}>
        <p style={{ color: 'hsl(var(--text-secondary))', lineHeight: 1.6, fontSize: 15 }}>Você gerencia a qualidade final e aprova os documentos antes da impressão oficial.</p>

        <StepList steps={[
          'Quando um professor terminar de diagramar a sua prova ou a sua parte do simulado, ele clicará em "Salvar e Enviar".',
          'Você verá que a prova está aguardando revisão. Basta entrar nela e clicar em <strong>Pré-visualizar</strong>.',
          'No <strong>Estúdio de Pré-visualização</strong>, você pode fazer ajustes de margens, corrigir pequenos erros no texto, ajustar imagens e configurar colunas ou linhas pautadas.',
          'Quando a prova estiver 100% pronta e diagramada, clique em <strong>Salvar e Aprovar</strong>. Isso demonstra que ela está validada e pronta para o uso em sala!'
        ]} />
      </Section>

      <Section title="Criando Provas e Redações Avulsas" icon={PenTool} search={search}>
        <p style={{ color: 'hsl(var(--text-secondary))', lineHeight: 1.6, fontSize: 15 }}>
          Assim como os professores, você tem liberdade total de criar documentos pontuais.
        </p>

        <StepList steps={[
          '<strong>Provas e Redações:</strong> Você pode iniciar uma prova atribuindo ela a qualquer professor, ou fazer a diagramação de uma redação.',
          'Apenas inserindo Título, Série e Data na criação da Redação, o sistema gera o cabeçalho completo, e ela já pode ser impressa direto da listagem, super rápido.'
        ]} />
      </Section>
    </>
  )
}
