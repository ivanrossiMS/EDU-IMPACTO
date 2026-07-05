'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, PlayCircle, BookOpen, Users, GraduationCap, Settings, CheckCircle, FileText, Printer, FileEdit, Layout, Sparkles, Upload, Brain } from 'lucide-react'
import { useApp } from '@/lib/context'

export default function AjudaPage() {
  const { currentUserPerfil } = useApp()
  const [activeTab, setActiveTab] = useState<'professor' | 'coordenador'>(
    currentUserPerfil === 'Professor' ? 'professor' : 'coordenador'
  )
  const [search, setSearch] = useState('')

  return (
    <div style={{ padding: '40px', maxWidth: 1200, margin: '0 auto', paddingBottom: 100 }}>
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
              Aprenda a utilizar todos os recursos do sistema com nossos tutoriais interativos e animados.
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
              placeholder="Buscar por tópicos, como 'Criar Prova', 'Imprimir'..."
              style={{ width: '100%', padding: '16px 16px 16px 48px', borderRadius: 16, border: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))', color: 'hsl(var(--text-primary))', fontSize: 15, fontWeight: 500, outline: 'none', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(59,130,246,0.15)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: 16 }}>
            <button
              onClick={() => setActiveTab('professor')}
              style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: activeTab === 'professor' ? 'rgba(59,130,246,0.1)' : 'transparent', color: activeTab === 'professor' ? '#3b82f6' : 'hsl(var(--text-secondary))', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}
            >
              <GraduationCap size={20} /> Visão do Professor
            </button>
            <button
              onClick={() => setActiveTab('coordenador')}
              style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: activeTab === 'coordenador' ? 'rgba(59,130,246,0.1)' : 'transparent', color: activeTab === 'coordenador' ? '#3b82f6' : 'hsl(var(--text-secondary))', fontWeight: 800, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}
            >
              <Users size={20} /> Visão do Coordenador
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
            {activeTab === 'coordenador' && <CoordenadorContent search={search} />}
            {activeTab === 'professor' && <ProfessorContent search={search} />}
          </motion.div>
        </AnimatePresence>

      </motion.div>
    </div>
  )
}

function VideoPlaceholder({ title }: { title: string }) {
  return (
    <div style={{ width: '100%', aspectRatio: '16/9', background: 'hsl(var(--bg-app))', borderRadius: 16, border: '1px dashed hsl(var(--border-subtle))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '20px 0', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(45deg, rgba(59,130,246,0.03) 0%, rgba(139,92,246,0.03) 100%)' }} />
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'hsl(var(--bg-surface))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.05)', zIndex: 1 }}>
        <PlayCircle size={32} color="#3b82f6" />
      </div>
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-secondary))' }}>Vídeo Animado: {title}</p>
        <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'hsl(var(--text-muted))' }}>(Espaço reservado para a animação WebP)</p>
      </div>
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

function CoordenadorContent({ search }: { search: string }) {
  return (
    <>
      <Section title="Configurações Iniciais" icon={Settings} search={search}>
        
        <h3 style={{ fontSize: 18, color: 'hsl(var(--text-primary))', fontWeight: 800, marginTop: 0 }}>Como Adicionar Professores</h3>
        <StepList steps={[
          'Acesse <strong>Configurações &gt; Usuários</strong> no menu lateral.',
          'Clique no botão superior direito <strong>Adicionar Usuário</strong>.',
          'Preencha o nome, e-mail e defina o perfil obrigatoriamente como <strong>Professor</strong>.',
          'Pronto! O professor receberá um e-mail para criar sua senha de acesso.'
        ]} />
        <VideoPlaceholder title="Adicionando um Professor" />
        
        <hr style={{ border: 'none', borderTop: '1px solid hsl(var(--border-subtle))', margin: '40px 0' }} />
        
        <h3 style={{ fontSize: 18, color: 'hsl(var(--text-primary))', fontWeight: 800, marginTop: 0 }}>Criando Disciplinas e Vinculando Professores</h3>
        <p style={{ color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>As disciplinas são fundamentais para as provas, pois elas limitam quem pode criar questões para cada matéria.</p>
        <StepList steps={[
          'Vá até <strong>Simulados &gt; Cadastros &gt; Disciplinas</strong>.',
          'Clique em <strong>Nova Disciplina</strong> e preencha o Nome e a Área de Conhecimento.',
          'No campo de <strong>Professores Vinculados</strong>, selecione todos os professores que poderão criar questões para esta matéria.',
          'Salve a disciplina. Apenas esses professores poderão ser acionados ao criar provas.'
        ]} />
        <VideoPlaceholder title="Cadastro de Disciplinas e Vínculo" />
        
        <hr style={{ border: 'none', borderTop: '1px solid hsl(var(--border-subtle))', margin: '40px 0' }} />

        <h3 style={{ fontSize: 18, color: 'hsl(var(--text-primary))', fontWeight: 800, marginTop: 0 }}>Criando Bimestres (Períodos de Avaliação)</h3>
        <StepList steps={[
          'Acesse <strong>Simulados &gt; Cadastros &gt; Bimestres</strong>.',
          'Clique em <strong>Novo Bimestre</strong>.',
          'Selecione o <strong>Ano Letivo</strong> correspondente.',
          'Informe o <strong>Nome</strong> (ex: 1º Bimestre) e selecione o <strong>Status</strong> como Ativo.',
          'Esses bimestres aparecerão no filtro principal das provas e redações.'
        ]} />
        <VideoPlaceholder title="Criando Bimestres" />
        
      </Section>

      <Section title="Revisão e Aprovação de Provas" icon={CheckCircle} search={search}>
        <p style={{ color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>Depois que o professor inclui as questões e envia para revisão, o coordenador precisa aprovar a prova para que ela fique pronta para impressão.</p>
        <StepList steps={[
          'Na página <strong>Provas por Upload</strong>, procure as provas com status amarelo <strong>Em Revisão</strong>.',
          'Clique no botão de engrenagem e depois em <strong>Questões</strong> para analisar o que o professor inseriu.',
          'Faça as modificações e formatações necessárias (pelo Estúdio ou pela listagem).',
          'Quando estiver tudo certo, volte à listagem e altere o status para <strong>Aprovado</strong> ou publique.'
        ]} />
        <VideoPlaceholder title="Fluxo de Revisão e Aprovação" />
      </Section>
    </>
  )
}

function ProfessorContent({ search }: { search: string }) {
  return (
    <>
      <Section title="Como Criar uma Nova Prova" icon={FileText} search={search}>
        <p style={{ color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>
          A criação da prova pode ser feita tanto pelo <strong>Coordenador</strong> quanto pelo próprio <strong>Professor</strong>. 
        </p>
        
        <StepList steps={[
          'No menu, clique em <strong>Minhas Provas</strong> (ou Provas por Upload) e clique no botão <strong>Nova Prova</strong>.',
          'Preencha as informações gerais: Título, Bimestre, Data de Aplicação e selecione as Turmas (Séries).',
          '<strong>Atenção:</strong> Na sessão de Professores/Disciplinas, você deve selecionar a disciplina, o professor responsável por ela e indicar <strong>quantas questões</strong> aquele professor poderá incluir.',
          'Você pode adicionar múltiplas disciplinas clicando em "Adicionar Professor" (útil para provas multidisciplinares).'
        ]} />
        <VideoPlaceholder title="Preenchendo a criação da Prova" />

        <hr style={{ border: 'none', borderTop: '1px solid hsl(var(--border-subtle))', margin: '40px 0' }} />

        <h3 style={{ fontSize: 18, color: 'hsl(var(--text-primary))', fontWeight: 800, marginTop: 0 }}>Visualizando a Prova na Tela Inicial</h3>
        <p style={{ color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>Depois de salvar, a prova não aparece solta. Ela fica agrupada dentro da Turma (Série) escolhida.</p>
        <StepList steps={[
          'Na tela inicial, você verá um agrupamento com o nome da Turma (ex: 1ª Série EM).',
          'Clique no botão <strong>Expandir</strong> neste card.',
          'O card da sua prova aparecerá embaixo! Nele, você conseguirá ver os professores vinculados e quantas questões cada um precisa inserir.'
        ]} />
        <VideoPlaceholder title="Expandindo a Turma e Visualizando o Card" />

      </Section>

      <Section title="Enviando e Adicionando Questões" icon={Upload} search={search}>
        <h3 style={{ fontSize: 18, color: 'hsl(var(--text-primary))', fontWeight: 800, marginTop: 0 }}>Importando do Word (Upload)</h3>
        <p style={{ color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>Você pode enviar sua prova pronta e o sistema lerá tudo para você!</p>
        <StepList steps={[
          'O arquivo precisa estar no formato <strong>.doc</strong> ou <strong>.docx</strong>.',
          'As questões devem estar numeradas (exemplo: <em>1)</em>, <em>1.</em> ou <em>1-</em>).',
          'As alternativas também devem seguir um padrão (exemplo: <em>a)</em>, <em>a.</em> ou <em>a-</em>).',
          '<strong>Dica de Ouro:</strong> Pinte o texto da alternativa correta de <strong style="color:red;">vermelho</strong> no Word! Assim, o sistema marcará o gabarito automaticamente.',
          'O sistema também puxará automaticamente <strong>todas as imagens</strong> do seu arquivo.'
        ]} />
        <VideoPlaceholder title="Upload de Arquivo Word" />

        <hr style={{ border: 'none', borderTop: '1px solid hsl(var(--border-subtle))', margin: '40px 0' }} />

        <h3 style={{ fontSize: 18, color: 'hsl(var(--text-primary))', fontWeight: 800, marginTop: 0 }}>Criando Questões Manualmente</h3>
        <StepList steps={[
          'Dentro do painel de questões, clique em <strong>Adicionar Questão</strong>.',
          'Um modal se abrirá. Digite ou cole o seu enunciado e as alternativas.',
          'Você pode inserir imagens no meio do texto e marcar a alternativa correta clicando na bolinha ao lado dela.',
          '<strong>Gerador de Imagens IA:</strong> Precisa de uma ilustração? Clique no botão de Inteligência Artificial para gerar uma imagem exclusiva para a sua questão!'
        ]} />
        <VideoPlaceholder title="Criação Manual de Questões" />

        <hr style={{ border: 'none', borderTop: '1px solid hsl(var(--border-subtle))', margin: '40px 0' }} />

        <h3 style={{ fontSize: 18, color: 'hsl(var(--text-primary))', fontWeight: 800, marginTop: 0 }}>Gerando Questões com Inteligência Artificial</h3>
        <p style={{ color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>Ficou sem criatividade? Deixe a IA criar a questão perfeita para você.</p>
        <StepList steps={[
          'Clique em <strong>Gerar com IA</strong>.',
          'Selecione a <strong>Turma</strong> (para a IA entender a faixa etária e dificuldade correta).',
          'Escolha o <strong>Nível de Dificuldade</strong> (Fácil, Médio, Difícil).',
          'Digite o <strong>Tema</strong> (ex: "Revolução Francesa com foco em causas econômicas").',
          'A IA criará o enunciado, as alternativas e já marcará o gabarito. Se gostar, é só salvar!'
        ]} />
        <VideoPlaceholder title="Gerando Questão com Inteligência Artificial" />

      </Section>

      <Section title="Gerenciando Questões (O Painel Principal)" icon={FileEdit} search={search}>
        <p style={{ color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>
          No card da prova recém-criada, existem botões de ação muito importantes. O principal é o de <strong>Questões</strong>.
        </p>
        
        <StepList steps={[
          '<strong>Questões:</strong> Abre o resumo de todas as questões inseridas até agora. Aqui você pode: <br/> - Editar enunciados e alternativas.<br/> - Inserir fotos diretamente no texto.<br/> - Excluir questões ou selecionar a alternativa correta.',
          '<strong>Questões Descritivas:</strong> O sistema permite adicionar <strong>Linhas Pautadas</strong> automáticas ou um <strong>Espaço em Branco</strong> para o aluno responder.',
          '<strong>Gabarito:</strong> Exibe automaticamente as respostas corretas de todas as questões objetivas cadastradas.',
          '<strong>Imprimir:</strong> Uma visão super enxuta apenas para mandar para a impressora. Sem menus laterais ou estúdios.'
        ]} />
        <VideoPlaceholder title="Painel de Questões e Gabarito" />
      </Section>

      <Section title="Estúdio de Pré-visualização A4" icon={Layout} search={search}>
        <p style={{ color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>
          A cereja do bolo é o <strong>Estúdio A4</strong>, disponível clicando em <em>Pré-visualização A4</em> nas opções do card ou dentro do painel de questões. Tudo pode ser feito por aqui também!
        </p>

        <StepList steps={[
          '<strong>Estúdio Lateral (Esquerda):</strong> Você tem controles avançados para aumentar/diminuir fontes, e alterar o <strong>Layout da Prova</strong> (1 coluna inteira ou formato de 2 colunas tipo vestibular).',
          'Ainda no estúdio, você pode mudar o <strong>Layout das Questões</strong> (vertical uma embaixo da outra, ou lado a lado para economizar espaço).',
          '<strong>Folha Central:</strong> A folha no meio é interativa! Você pode clicar em qualquer imagem inserida e puxar pelas bordas para <strong>ajustar o tamanho da foto</strong> perfeitamente, trocar ou excluir.',
          'Pela folha também é possível editar os textos dos enunciados, formatar, excluir alternativas, trocar a resposta e arrastar e soltar questões para <strong>trocar de posição</strong>.',
          '<strong>Imprimir por aqui:</strong> Quando a formatação estiver pronta, basta clicar no botão azul de imprimir ou salvar na parte superior.'
        ]} />
        <VideoPlaceholder title="Trabalhando no Estúdio A4 (Formatação e Impressão)" />
      </Section>

      <Section title="Recurso de Adaptação (Copiar Provas)" icon={Sparkles} search={search}>
        <p style={{ color: 'hsl(var(--text-secondary))', lineHeight: 1.6 }}>
          Criar provas adaptadas para inclusão nunca foi tão fácil.
        </p>
        <StepList steps={[
          'No menu de ações da prova original, clique no botão <strong>Adaptar</strong>.',
          'O sistema criará uma <strong>cópia exata e independente</strong> da prova, sem substituir a normal. O nome ganhará a tag "ADAPTADO".',
          'Agora você pode entrar na nova prova e alterar as alternativas, aumentar a fonte e editar as questões difíceis como desejar.',
          '<strong>Provas Múltiplas:</strong> Quando uma prova adaptada for criada, você pode clicar em Adaptar novamente nela mesma caso precise de mais cópias para editar!'
        ]} />
        <VideoPlaceholder title="Criando e Editando uma Prova Adaptada" />
      </Section>
    </>
  )
}
