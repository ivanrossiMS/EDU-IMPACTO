'use client';

import React from 'react';
import { Book, Search, FileText, ShieldCheck, ArrowUp, Printer, Bookmark, CheckCircle2 } from "lucide-react";

const regimentoData = [
  {
    "id": "título-i",
    "title": "TÍTULO I",
    "subtitle": "DA IDENTIFICAÇÃO",
    "paragraphs": [
      "Art. 1.º O COLÉGIO IMPACTO DE EF, entidade particular de ensino com sede na Rua Alagoas, n.º 1081, Vila Suíça, neste município de Campo Grande, Estado de Mato Grosso do Sul.",
      "Art. 2.º O COLÉGIO IMPACTO DE EF é uma instituição de direito privado mantido pela empresa COLÉGIO IMPACTO CENTRO DE ENSINO LTDA - ME, devidamente registrada no Cadastro Nacional de Pessoa Jurídica/ CNPJ sob nº 04.395.789/0001-88.",
      "Art. 3.º Para efeito redacional, doravante, no corpo deste Regimento Escolar, o COLÉGIO IMPACTO DE EF será denominado de Colégio.",
      "Parágrafo único. Este regimento escolar constitui-se em instrumento jurídico-educacional que regulamenta a organização administrativa, didático-pedagógica e disciplinar do COLÉGIO IMPACTO DE EF."
    ]
  },
  {
    "id": "título-ii",
    "title": "TÍTULO II",
    "subtitle": "DAS FINALIDADES, DOS PRINCÍPIOS E DOS OBJETIVOS",
    "paragraphs": [
      "CAPÍTULO I\nDAS FINALIDADES",
      "Art. 4.º Este Colégio oferece a educação básica na etapa Ensino Fundamental, e tem por finalidades desenvolver o estudante, assegurar-lhe a formação comum indispensável para o exercício da cidadania e fornecer-lhe meios para progredir no trabalho e em estudos posteriores.",
      "Art. 5.º Este Colégio, atende ao disposto nas Constituições Federal e Estadual e na Lei de Diretrizes e Bases da Educação Nacional, na etapa do Ensino Fundamental, com as seguintes finalidades:",
      "I - valorizar o aluno como pessoa humana que necessita de compreensão, respeito e afeição;\nII - respeitar a dignidade e a liberdade fundamentais do homem, propiciando o apreço à tolerância;\nIII - desenvolver integralmente a personalidade humana e sua participação na obra do bem comum;\nIV - preparar o indivíduo para o domínio pleno dos recursos disponíveis a fim de vencer as dificuldades que o meio lhe oferece;\nV - incentivar o desenvolvimento da criatividade e da participação;\nVI - garantir a igualdade de condições para o acesso e permanência no Colégio;\nVII - desenvolver atividades condizentes com a realidade dos alunos propiciando uma aprendizagem de melhor qualidade;\nVIII - possibilitar a aprendizagem, o ensino, a pesquisa e a divulgação do pensamento, da arte e do saber;\nIX - desenvolver o espírito crítico e patriótico;\nX - propiciar o desenvolvimento da consciência política, filosófica e social religiosa no aluno, evitando tratamento desigual, discriminação e preconceitos;\nXI - estimular o aluno à preservação, à valorização e à implementação do patrimônio cultural;\nXII - assegurar o direito à proteção, à saúde, à liberdade, à confiança, ao respeito, à dignidade, à brincadeira, à convivência e à interação com outras crianças;\nXIII - considerar as dimensões do educar e do cuidar, em sua inseparabilidade, buscando recuperar, para a função social desse nível da educação, a sua centralidade, que é o estudante, pessoa em formação na sua essência humana;\nXIV - estabelecer ações destinadas a promover a cultura da paz no Colégio.",
      "CAPÍTULO II\nDOS PRINCÍPIOS",
      "Art. 6.º O Ensino Fundamental adota os seguintes princípios:",
      "I – éticos:\na) de justiça, solidariedade, liberdade e autonomia;\nb) de respeito à dignidade da pessoa humana e de compromisso com a promoção do bem de todos, contribuindo para combater e eliminar quaisquer manifestações de preconceito de origem, raça, sexo, cor, idade e quaisquer outras formas de discriminação.\nII – Políticos:\na) de reconhecimento dos direitos e deveres de cidadania, de respeito ao bem comum e à preservação do regime democrático e dos recursos ambientais;\nb) da busca da equidade no acesso à educação, à saúde, ao trabalho, aos bens culturais e outros benefícios;\nc) da exigência de diversidade de tratamento para assegurar a igualdade de direitos entre os estudantes que apresentam diferentes necessidades;\nd) da redução das desigualdades sociais e regionais.\nIII – estéticos:\na) do cultivo da sensibilidade juntamente com o da racionalidade;\nb) do enriquecimento das formas de expressão e do exercício da criatividade;\nc) da valorização das diferentes manifestações culturais, especialmente a da cultura brasileira;\nd) da construção de identidades plurais e solidárias.",
      "CAPÍTULO III\nDOS OBJETIVOS",
      "Art. 7.º O Colégio oferece o Ensino Fundamental, observando os objetivos específicos estabelecidos na legislação vigente.",
      "Art. 8.º Na educação básica é necessário considerar as dimensões do cuidar e do educar, em sua inseparabilidade, buscando recuperar, para a função social desse nível de educação, a sua centralidade, que é o estudante, pessoa em formação em sua essência humana.",
      "Parágrafo único. As funções indissociáveis de educar e cuidar, quando articuladas pedagogicamente no interior da própria instituição e externamente com os serviços de apoio e ainda com as políticas de outras áreas, proporcionam ações integradas que asseguram a aprendizagem, o bem-estar e o desenvolvimento do estudante em todas as suas dimensões.",
      "Seção I\nDo Ensino Fundamental",
      "Art. 9.º O Ensino Fundamental deve assegurar a cada estudante o acesso ao conhecimento e aos elementos da cultura imprescindíveis para o seu desenvolvimento pessoal e para a vida em sociedade, assim como os benefícios de uma formação comum, independente da diversidade da população escolar e das demandas sociais.",
      "Art. 10. O Ensino Fundamental, com duração de 9 (nove) anos, destinado à faixa etária dos 6 (seis) aos 14 (quatorze) anos de idade, tem por objetivo a formação do cidadão mediante:",
      "I -  o desenvolvimento da capacidade de aprendizagem, tendo em vista a aquisição de conhecimentos e habilidades e a formação de atitudes e valores como instrumentos para uma visão crítica do mundo;\nII -  a compreensão do ambiente natural e social, do sistema político, da tecnologia, das artes e dos valores em que se fundamenta a sociedade;\nIII -  o desenvolvimento da capacidade de aprender, tendo como meios básicos o pleno domínio da leitura, da escrita e do cálculo;\nIV -  o fortalecimento dos vínculos de família, dos laços de solidariedade humana e de tolerância recíproca em que se assenta a vida social."
    ]
  },
  {
    "id": "título-iii",
    "title": "TÍTULO III",
    "subtitle": "DA ESTRUTURA ADMINISTRATIVA E PEDAGÓGICA",
    "paragraphs": [
      "Art. 11. Este Colégio funcionará com a seguinte estrutura administrativa e pedagógica:",
      "I -  direção:\na) direção administrativa;\nb) direção pedagógica;\nII -  secretaria escolar;\nIII -  coordenação pedagógica;\nIV -  corpo docente;\nV -  serviços auxiliares:\na) auxiliar de sala de aula;\nb) auxiliar administrativo;\nc) inspetoria de alunos;\nd) auxiliar de serviços gerais e zeladoria.",
      "CAPÍTULO I\nDA DIREÇÃO",
      "Seção I\nDa Direção Administrativa",
      "Art. 12. A direção administrativa é o órgão responsável pela coordenação, execução e controle das atividades administrativas, orçamentárias e financeiras do Colégio e é exercida por um profissional com formação mínima em ensino médio, designado por ato específico pela entidade mantenedora.",
      "Parágrafo único. A direção administrativa, em seus impedimentos legais, será substituída por um profissional com formação mínima em Ensino Médio, através de portaria interna designado por ato específico pela entidade mantenedora.",
      "Seção II\nDa Direção Pedagógica",
      "Art. 13. A direção pedagógica é o órgão responsável pela coordenação e execução das atividades pedagógicas do Colégio é constituída por um diretor pedagógico.",
      "Art. 14. A direção pedagógica é exercida por profissional formado em nível superior em curso de licenciatura ou em nível de pós-graduação na área da educação, com experiência em docência, designado por ato específico pela entidade mantenedora.",
      "Parágrafo único. Na falta do profissional com a formação exigida no caput desse artigo, admitir-se-á profissional com formação em nível superior em curso de licenciatura na área educacional.\nArt. 15. Em seus afastamentos legais e eventuais, a direção pedagógica é substituída por um profissional com formação mínima em nível superior em curso de licenciatura, através de portaria interna pela entidade mantenedora.",
      "CAPÍTULO II\nDA SECRETARIA ESCOLAR",
      "Art. 16. A secretaria escolar é o órgão responsável pelo arquivo e escrituração dos fatos relativos à vida escolar dos alunos; vida funcional dos corpos docentes e técnico-administrativo; pela expedição de documentos escolares e pela correspondência geral do Colégio.",
      "Art. 17. A função de secretário é exercida por profissional com formação mínima em Ensino Médio, designada pela direção através de portaria interna.",
      "Parágrafo único. Durante seus afastamentos legais e eventuais, o secretário é substituído por um funcionário com formação mínima em Ensino Médio, designado pela direção através de portaria interna.",
      "CAPÍTULO III\nDA COORDENAÇÃO PEDAGÓGICA",
      "Art. 18. A coordenação pedagógica é a responsável imediata pela função destinada a superintender, articular e supervisionar a estrutura, organização e funcionamento pedagógico deste Colégio, subordinada à direção.",
      "Art. 19. As funções exercidas pela coordenação pedagógica constituem-se em serviços destinados a proporcionar apoio técnico e pedagógico às atividades docentes e discentes.",
      "§ 1º As atividades de coordenação pedagógica são exercidas por profissional com formação em nível superior em curso de licenciatura com experiência na docência, designado através de portaria interna, pela entidade mantenedora.\n§ 2º Em seus impedimentos legais e ocasionais o coordenador pedagógico é substituído por um profissional com a formação mínima prevista no caput, designado, através de portaria interna, pela entidade mantenedora.",
      "CAPÍTULO IV\nDO CORPO DOCENTE",
      "Art. 20. O corpo docente é constituído por todos os professores com nível superior, com licenciatura específica, admitindo-se para docência na Educação Infantil e anos iniciais do Ensino Fundamental a formação em Nível Médio, modalidade Normal, contratados pela entidade mantenedora.",
      "Parágrafo único. Quando houver o profissional licenciado em Pedagogia com habilitação para a Educação Infantil e anos iniciais do Ensino Fundamental, este terá prioridade sobre os profissionais com formação em Nível Médio na modalidade Normal.",
      "CAPÍTULO V\nDO ASSESSOR PEDAGÓGICO ESPECIALIZADO",
      "Art. 21. O assessor pedagógico especializado atua em articulação com o professor da classe comum, a equipe pedagógica e a administrativa desta Instituição de Ensino, na orientação de práticas necessárias para promover a escolarização dos estudantes com deficiência, transtornos globais do desenvolvimento, altas habilidades ou superdotação e desenvolverá, dentre outras, ações voltadas:",
      "I – ao processo de avaliação pedagógica dos estudantes, para fins de identificação de suas necessidades educacionais, tendo como referência suas vivências, realidade sociocultural e o lócus onde se dá a prática pedagógica;\nII – à orientação quanto à flexibilização da ação pedagógica, apresentando procedimentos didático-pedagógicos e práticas alternativas nas diferentes áreas de conhecimento;\nIII – ao apoio pedagógico especializado, na adequação metodológica e na orientação da oferta e do uso de tecnologia assistiva e outros aportes necessários à permanência e progressão do estudante na educação escolar.\nArt. 22. Para exercer a função de assessor pedagógico especializado, o professor deve ter formação em licenciatura com pós-graduação em educação especial de caráter generalista ou em uma de suas áreas e/ou cursos de licenciatura em educação especial.",
      "Parágrafo único. Em seu afastamento legal ou eventual o assessor pedagógico especializado será substituído por um profissional com a formação descrita no caput deste artigo.",
      "Seção I\nDos Direitos",
      "Art. 23. É direito do aluno:",
      "I- ser respeitado por todos os integrantes da comunidade escolar;\nII- ser considerado e valorizado em sua individualidade, sem comparação, nem preferências;\nIII- ser respeitado em seus princípios religiosos;\nIV- ser orientado em suas dificuldades;\nV- ser ouvido em suas queixas ou reclamações;\nVI- receber seus trabalhos e tarefas devidamente corrigidos e avaliados;\nVII- requerer junto à coordenação pedagógica nova oportunidade, quando faltar avaliações, mediante a apresentação de atestado médico, e/ou pagamento estipulado pela tesouraria do Colégio, no prazo de até 48 horas após a realização da mesma.",
      "Seção II\nDos Deveres",
      "Art. 24. É dever do aluno:",
      "§1º Comparecer pontualmente às aulas, provas e outras atividades preparadas e programadas pelo professor ou pelo Colégio;\n§2º No caso de o aluno precisar chegar fora do horário, será permitido uma tolerância de 10 (dez) minutos de atraso somente na 1ª (primeira) aula;\n§3º O aluno que não cumprir o inciso anterior, deverá aguardar o início da 2ª (segunda) aula nas dependências do Colégio;\nI- tratar com civilidade os integrantes da comunidade escolar;\nII- colaborar na preservação do patrimônio escolar;\nIII- atender convocação da direção, coordenação pedagógica e dos professores;\nIV- portar-se corretamente dentro do Colégio;\nV- indenizar os danos a que der causa, dentro do Colégio;\nVI- integrar-se no processo pedagógico desenvolvido pelo Colégio;\nVII- apresentar-se no Colégio com asseio pessoal e devidamente uniformizado e calçando tênis ou sandália fechada;\nVIII- manter hábitos de higiene em seu corpo, seu vestuário e em seus objetos escolares;\nIX- possuir o material escolar exigido e trazê-lo às atividades escolares em ordem;\nX- comportar-se adequadamente para fortalecer o espírito patriótico e a responsabilidade democrática.",
      "Seção III\nDas Proibições",
      "Art. 25. É proibido ao aluno:",
      "I- apresentar-se no Colégio sob efeito de bebidas alcoólicas ou substâncias químicas que produzam dependências física ou psíquica;\nII- introduzir materiais alheios a aula (baralhos, brinquedos, livros ou revistas pornográficas, celulares, etc.) passivo do objeto ficar retido no Colégio até os responsáveis virem buscá-los e tomarem ciência do ocorrido;\nIII- Comparecer ou trazer objetos de valor (joias, aparelho de som, dinheiro, celular, etc.), uma vez que o colégio não se responsabiliza em caso de perdas, avaria e/ou desaparecimento dos mesmos;\nIV- utilizar livros cadernos ou materiais de outro colega sem aquiescência do mesmo;\nV- promover eventos de qualquer natureza, em nome do Colégio, sem a devida autorização da direção;\nVI- portar, no recinto deste Colégio, armas e explosivos de qualquer natureza, bebidas alcoólicas, entorpecentes ou outros objetos estranhos às atividades escolares;\nVII- fumar, mascar fumo, usar bebidas alcoólicas, tomar tereré ou chimarrão no recinto do Colégio;\nVIII- ausentar-se do Colégio durante o período de aula, sem autorização da direção ou coordenação pedagógica do Colégio;\nIX- entrar em sala de aula ou dela sair, sem permissão do professor;\nX- permanecer nos recreios e nos intervalos de aula, fora do recinto que lhe fora destinado;\nXI- formar grupos com fim de promover algazarra, incitar os colegas a atos de rebeldia, movimentos contra normas regimentais, distúrbios dentro de sala de aula, nos corredores e pátios do Colégio;\nXII- desacatar os integrantes do Colégio tanto do corpo docente como discente ou qualquer funcionário do Colégio independentemente de quem seja;\nXIII- praticar atos que ofendam a integridade física, moral ou intelectual de qualquer integrante da comunidade escolar;\nXIV- rasurar ou falsificar qualquer documento escolar;\nXV- escrever nas paredes ou qualquer parte do Estabelecimento tais como: carteiras, quadro negro, cartazes; também palavras obscenas e ofensivas, desenhos ou qualquer outro sinal;\nXVI- danificar o patrimônio escolar;\nXVII- praticar atos estranhos ao processo educativo como “colar” durante provas/avaliações;\nXVIII- brigar dentro ou nas imediações do Colégio, acarretará em registro de ocorrência e encaminhamento à coordenação pedagógica ou à direção.\nXIX- manter atitudes inadequadas dentro da sala de aula ou dentro do Colégio;\nXX- manter atitudes inadequadas fora do Colégio estando uniformizado;\nXXI- comparecer as aulas sem uniforme, de shorts, minissaia, mini blusa ou qualquer outro vestuário que perturbe o bom andamento das aulas;\nXXII- usar boné, chinelos ou bermudas estampadas;\nXXIII- assinar por seus responsáveis legais documento que deva ser destinado ao Colégio;\nXXIV- promover jogos, excursões, coletas, listas de pedidos ou campanhas de qualquer natureza, sem prévia autorização da direção.\nXXV- praticar atitudes que venham constranger ou faltar com o decoro próprio a imagem da comunidade escolar como: beijos, carícias e namoros; os relacionamentos afetivos (de namoro) que forem constatados pela coordenação serão comunicados à família envolvida, devida esta atitude não ser permitido dentro da instituição;\nXXVI- usar aparelho celular sem fins pedagógicos ou similares durante ou fora do período de aula, inclusive nos horários de intervalos de aulas, gravar áudio ou fazer filmagens dentro do ambiente escolar;\nXXVII- Praticar bullying ou cyberbullying à direção, aos professores, colegas e demais funcionários. Entende-se por bullying a prática de atos de violência física ou psicológica, de modo intencional e repetitivo, exercida por indivíduo ou grupos de indivíduos, contra uma ou mais pessoas, com o objetivo de intimidar, agredir, causar dor, angústia ou humilhação à vítima.\nXXVIII- Praticar, em ambiente virtual, condutas que comprometam a integridade física, moral ou psicológica de membros da comunidade escolar ou que atentem contra a convivência escolar e a imagem institucional do Colégio.\nArt. 26. Para os fins deste Regimento, consideram-se abrangidas pelas normas de convivência escolar as condutas praticadas em ambientes virtuais, inclusive redes sociais, aplicativos de mensagens, grupos de comunicação eletrônica e plataformas digitais.",
      "§ 1º Os grupos de mensagens, redes sociais ou quaisquer ambientes virtuais criados e administrados por pais, responsáveis, alunos ou terceiros não constituem canais oficiais de comunicação do Colégio, não sendo administrados ou moderados pela instituição.\n§ 2º O Colégio não se responsabiliza pelas opiniões, conteúdos, informações, imagens, vídeos, áudios ou mensagens divulgados nos grupos particulares referidos no parágrafo anterior.\n§ 3º Cada participante responderá individualmente pelos conteúdos que produzir, compartilhar ou divulgar, nos termos da legislação vigente.\n§ 4º As condutas praticadas em ambiente virtual que afetem alunos, familiares, professores, colaboradores ou a comunidade escolar, bem como aquelas que comprometam a segurança, a integridade física ou moral das pessoas, a convivência escolar ou a imagem institucional do Colégio, poderão ser apuradas pela direção e sujeitar o infrator às medidas disciplinares previstas neste Regimento.\n§ 5º O disposto neste artigo aplica-se, inclusive, aos casos de cyberbullying, assédio, ameaças, ofensas, difamação, injúria, exposição indevida de imagem, divulgação de informações falsas ou qualquer outra prática incompatível com os princípios de respeito e convivência escolar.",
      "Seção IV\nDas Penalidades",
      "Art. 27. Pela inobservância de seus deveres e do que lhe é vedado, o aluno está sujeito às seguintes medidas disciplinares, de acordo com a gravidade da infração:",
      "I – Advertência verbal;\nII – Advertência por escrito;\nIII – Suspensão, por até 5 (cinco) dias consecutivos;\nIV – Transferência compulsória.\n§1º As medidas previstas no inciso I serão aplicadas pelos professores ou pelo coordenador pedagógico;\n§2º As medidas previstas no inciso II serão aplicadas pelo coordenador pedagógico ou pela direção pedagógica;\n§3º As medidas presentes no inciso III serão aplicadas somente pela direção pedagógica do Colégio;\n§4º A penalidade de transferência compulsória será aplicada somente pela direção pedagógica, nas seguintes situações:\nI- atos de vandalismo praticados dentro da escola;\nII- desacato para com o corpo discente, docente e administrativo;\nIII- após o aluno ter sido suspenso por três vezes;\nIV- apresentar-se para as aulas sob efeito de bebidas alcoólicas ou substâncias químicas que produzam dependência física ou psíquica;\nV- portar bebidas alcoólicas ou substâncias que produzam dependência física ou psíquica;\nVI- em caso de agressão física para com o corpo discente, docente e administrativo;\n§5º A aplicação de atividades com fins educativos deverá ocorrer mediante a prática de preservação ambiental, reparação de danos ou a realização de atividades extracurriculares, através de registro da ocorrência escolar com lavratura de termo de compromisso, constando a presença e a anuência dos pais ou responsável legal, em obediência ao disposto no Art. 1.634, incisos I, II e II do Código Civil.\n§6º Em caso de reiteração de falta grave, em se tratando de criança ou adolescente, a direção agirá em consonância com o que dispõe o Estatuto da Criança e do Adolescente, ouvido o Conselho Tutelar e a Promotoria da Infância e da Adolescência.\n§7º Caberá aos pais ou responsáveis reparar o eventual dano causado ao patrimônio do Colégio ou aos bens dos colegas ou professores.\n§8º O Art. 286 não se aplica as crianças da Educação Infantil.\nArt. 28. A reiterada falta de participação e cooperação dos pais ou responsáveis e/ou inobservância de seus deveres poderá ensejar a recusa de renovação de matrícula ao aluno, por parte da direção da escola.",
      "Art. 29. Toda e qualquer penalidade será comunicada, por escrito ao aluno quando este for maior de idade ou ao pai/ responsável quando se tratar de aluno menor de idade.",
      "Parágrafo único. Seja qual for a penalidade aplicada, caberá direito de defesa.",
      "CAPÍTULO VI\nDOS SERVIÇOS AUXILIARES",
      "Art. 30. Os serviços auxiliares constituem-se do conjunto de funcionários que dão suporte operacional às atividades pedagógicas, desportivas, culturais, sociais e administrativas desenvolvidas por este Colégio.",
      "Art. 31. Os funcionários que executam as atividades de serviços auxiliares são selecionados e contratados pela entidade mantenedora, deste Colégio, nos termos da legislação trabalhista em vigor.",
      "Art. 32. Constituem os serviços auxiliares deste Colégio as seguintes atividades:",
      "I -  auxiliar de sala de aula;\nII -  auxiliar administrativo;\nIII -  inspetoria de alunos;\nIV -  auxiliar de serviços gerais e da zeladoria.",
      "Seção I\nDo Auxiliar de Sala de Aula",
      "Art. 33. O auxiliar de sala de aula subsidiará administrativamente o corpo docente deste Colégio.",
      "Art. 34. O auxiliar de sala de aula estará diretamente subordinado à direção pedagógica deste Colégio.",
      "Parágrafo único. Para o exercício desta função serão contratados, preferencialmente, funcionários com escolaridade mínima em Ensino Médio, cursando Pedagogia ou Psicologia.",
      "Seção II\nDo Auxiliar Administrativo",
      "Art. 35. O auxiliar administrativo prestará serviços neste Colégio, auxiliando em todas as atividades de recepção, biblioteca, telefonia, secretaria, tesouraria, atendimento geral, registro da vida escolar dos alunos, arquivo e correspondência do Colégio.",
      "Parágrafo único. Para o exercício desta função serão contratados, preferencialmente, funcionários com escolaridade mínima em Ensino Médio.",
      "Seção III\nDa Inspetoria de Alunos",
      "Art. 36. A inspetoria de alunos é responsável pelo trato direto com os alunos nas dependências e pátio deste Colégio, zelando pela manutenção da ordem e encaminhamento do aluno aos setores competentes para o atendimento de suas necessidades.",
      "Parágrafo único. A função de inspetor de alunos é exercida por funcionários com formação mínima de Ensino Fundamental, diretamente subordinado à direção.",
      "Seção IV\nDo auxiliar de serviços gerais e da zeladoria",
      "Art. 37. É todo aquele que exerça trabalho de motorista, limpeza, manutenção, zeladoria, telefonista, vigilância e portaria.",
      "Art. 38. O auxiliar de serviços gerais e o zelador estará diretamente subordinado à direção deste Colégio.",
      "Parágrafo único. Para o exercício desta função serão contratados, funcionários com escolaridade mínima em Ensino Fundamental."
    ]
  },
  {
    "id": "título-iv",
    "title": "TÍTULO IV",
    "subtitle": "DA ORGANIZAÇÃO DO COLÉGIO",
    "paragraphs": [
      "CAPÍTULO I\nDO CONSELHO DE CLASSE",
      "Art. 39. O Conselho de Classe é órgão colegiado, de natureza consultiva e deliberativa em assuntos didático-pedagógicos, e tem como função específica sugerir medidas adequadas à avaliação do rendimento escolar, restritos a cada ano.",
      "Art. 40. O conselho de classe tem por finalidade:",
      "I -  analisar o aproveitamento global das turmas e individual dos alunos, verificando as causas de alto e baixo rendimento;\nII -  acompanhar criteriosamente o progresso dos alunos;\nIII -  estudar e sugerir medidas com vistas a intensificar o aproveitamento dos alunos e melhorar suas atividades;\nIV -  identificar os alunos com aproveitamento insuficiente, encaminhando-os à coordenação pedagógica;\nV -  identificar as causas do aproveitamento insuficiente, sugerindo alternativas para saná-las;\nVI -  coletar e utilizar informações sobre as necessidades, interesses e aptidões dos alunos;\nVII -  traduzir conceitos em notas e decidir sobre o significado dos símbolos ou conceitos utilizados nas transferências recebidas;\nVIII -  analisar a metodologia e os critérios de avaliação adotados pelos professores conduzindo-os a uma autoavaliação de sua prática, garantindo a eficácia da proposta pedagógica deste Colégio;\nIX -  decidir sobre a promoção de alunos, em casos especiais, atendida a proposta pedagógica;\nX -  assumir o cuidado e a educação, valorizando a aprendizagem para a conquista da cultura da vida, por meio de atividades lúdicas em situações de aprendizagem;\nXI -  considerar um conjunto de experiências em que se articulam saberes da experiência e socialização do conhecimento em seu dinamismo.\nArt. 41. O Conselho de Classe será constituído:",
      "I -  pela direção pedagógica;\nII -  pela coordenação pedagógica;\nIII -  pelos professores da classe.\nArt. 42. A presidência do Conselho de Classe será exercida pela coordenação pedagógica e, em sua falta, pela direção pedagógica.",
      "Art. 43. O conselho de classe reunir-se-á, ordinariamente, ao final de cada ano e, extraordinariamente, quando convocado.",
      "Parágrafo único. Os resultados da reunião do conselho de classe devem ser lavrados em ata específica, por quem presidirá.\nArt. 44. O trabalho a ser desenvolvido pelo conselho de classe deve ser coerente e com observância de aspectos que podem interferir no campo de decisão deste colegiado, com vistas à:",
      "I - provisão de meios de aprendizagem àqueles com baixo rendimento escolar;\nII - análise conjunta para definição de metodologia e de critérios de avaliação adotados pelos docentes, conduzindo-os a uma autoavaliação de sua prática, a fim de cumprir e garantir a eficácia da Proposta Pedagógica deste Colégio.\nArt. 45. A reunião do conselho de classe, deverá contar com 70% do corpo docente, que decidirá sobre as situações limítrofes dos estudantes, após exame final, caso possam ficar retidos.",
      "Parágrafo único. Situação limítrofe é o número de pontos necessários para aprovação do estudante, quando não foi atingida a nota mínima exigida para aprovação.\nArt. 46. Fica impedido ao Conselho de Classe deliberar sobre a aprovação com o limite de faltas acima do percentual previsto em lei.",
      "Art. 47. Em se tratando de estudante que, após a realização dos exames finais, continue em situações limítrofes, em determinados componentes curriculares, o Conselho de Classe deve avaliar a possibilidade de alteração dos resultados do rendimento escolar.",
      "Parágrafo único. Para o cumprimento do caput deste artigo, deve ser respeitado o índice de 80% de aprovação nos demais componentes curriculares, e ter a anuência da direção e coordenação pedagógica.\nArt. 48. O docente responsável pelo componente curricular da retenção, após exame final, poderá deixar de participar do Conselho de Classe, tendo em vista que já foi expresso o resultado do rendimento escolar por esse profissional.",
      "Parágrafo único. O colegiado do Conselho de Classe é soberano na decisão de situações limítrofes e o docente envolvido nessa situação deverá acatar a decisão desse colegiado. Em se tratando de estudante que após a realização dos exames finais persistam em situações limítrofes para aprovação, a pontuação a ser atribuída pelo conselho de classe não poderá ser superior a 1,0 (um) ponto por componente curricular/disciplina.\nArt. 49. Quando da reunião do conselho de classe, com o objetivo de deliberar sobre a aprovação ou não do estudante, por razão de situation limítrofe, deverão ser adotados os seguintes procedimentos:",
      "I - elaborar novo canhoto fazendo constar somente os estudantes que foram considerados aprovados na reunião do conselho de classe;\nII - registrar o aproveitamento com o valor mínimo igual ao exigido no exame final, para aprovação;\nIII - observar no novo canhoto dados sobre a ata da reunião do conselho de classe, constando número, data e assinaturas dos participantes;\nIV - manter inalterado o primeiro canhoto dos resultados do exame final, elaborado pelo professor que motivou a retenção;\nV - arquivar os canhotos do exame final e do conselho de classe juntamente com os demais da mesma turma e ano.\nArt. 50. Os procedimentos previstos no artigo anterior deverão ser adotados antes da inserção dos dados no Sistema de Gestão de dados Escolares, ou outro, quando for o caso.",
      "Art. 51. A nota final será sempre aquela constante do canhoto elaborado pelo Presidente do conselho de classe, conforme decisão tomada.",
      "Art. 52. Quando da expedição de qualquer documento escolar, deve ser transcrito o que consta da Ata de Resultados Finais, sem a necessidade de observação sobre o processo de aprovação pelo conselho de classe."
    ]
  },
  {
    "id": "título-v",
    "title": "TÍTULO V",
    "subtitle": "DO FUNCIONAMENTO E DA ESTRUTURA CURRICULAR",
    "paragraphs": [
      "CAPÍTULO I\nDO FUNCIONAMENTO",
      "Art. 53. Este Colégio oferece a educação básica, com observância das normas baixadas pelos órgãos competentes, devendo sempre ter em vista os interesses e a formação do estudante, da seguinte forma:",
      "I -  Ensino Fundamental, oferecido nos turnos matutino, vespertino e integral até o 6º ano, com o currículo organizado em anos;",
      "CAPÍTULO II\nESTRUTURA CURRICULAR",
      "Art. 54. O currículo é elaborado de acordo com o disposto na lei de diretrizes e bases da educação nacional, em consonância com as diretrizes nacionais de cada uma das etapas da Educação Básica, o previsto na proposta pedagógica do Colégio e nas normas e instruções determinadas pelos órgãos competentes.",
      "Art. 55. O currículo Ensino Fundamental deve ter uma base nacional comum a ser complementada por uma parte diversificada.",
      "Parágrafo único. O currículo a que se refere o caput devem abranger, obrigatoriamente, o estudo da Língua Portuguesa e da Matemática conhecimento do mundo físico e natural e da realidade social e política, especialmente do Brasil.\nArt. 56. Os conteúdos referentes à História e Cultura Afro-Brasileira e Indígena e as Relações Étnico-Raciais são ministrados nas etapas do Ensino Fundamental em especial nos componentes curriculares Arte e História.",
      "Art. 57. O ensino de Arte, especialmente em suas expressões regionais, constitui componente curricular obrigatório da Educação Básica.",
      "Parágrafo único. As artes visuais, a dança, a música e o teatro são as linguagens que constituem o componente curricular de que trata o caput deste artigo.\nArt. 58. Este colégio deverá incluir em seu currículo a abordagem de temas transversais, integradores e contemporâneos, exigidos por legislação e normas específicas, relevantes para o desenvolvimento da cidadania, em escala local, regional e global, observando-se a obrigatoriedade de temas tais como:",
      "I -  direito das crianças e dos adolescentes;\nII -  educação em direitos humanos;  \nIII -  educação ambiental;\nIV -  educação para o trânsito;\nV -  educação alimentar e nutricional;\nVI -  educação fiscal;\nVII -  educação financeira;\nVIII -  saúde, sexualidade e gênero, vida familiar e social;\nIX -  respeito, valorização e direito dos idosos;\nX -  educação digital;\nXI -  cultura sul-mato-grossense e diversidade cultural;\nXII -  promoção de medidas de conscientização, de prevenção e de combate a todos os tipos de violência, especialmente a intimidação sistemática do bullying, no âmbito deste colégio;\nXIII -  superação de discriminações e preconceitos como racismo, sexismo, homofobia e outros.\nArt. 59. A educação básica na etapa do Ensino Fundamental obedece às seguintes regras comuns:",
      "I - carga horária mínima de 800(oitocentas) horas, distribuídas por um mínimo de 200(duzentos) dias de efetivo trabalho educacional;\nII - duração da hora-aula nos anos iniciais do Ensino Fundamental de 60 (sessenta) minutos, com jornada diária mínima de 4 (quatro) horas diárias, para o turno parcial e de 7(sete) horas para jornada integral de efetivo trabalho escolar;\nIII - horário escolar semanal, nos anos iniciais do Ensino Fundamental de 4 (quatro) aulas diárias, durante 5 (cinco) dias da semana.\nIV - duração da hora-aula de 50 (cinquenta) minutos, com jornada diária mínima de 4 (quatro) horas diárias, para o turno parcial e de 7(sete) horas para jornada integral de efetivo trabalho escolar;\nV - horário escolar semanal, nos anos finais do Ensino Fundamental de 5 (cinco) aulas diárias, durante 5 (cinco) dias da semana.\nArt. 60. Do 1º (primeiro) ao 5º (quinto) ano do Ensino Fundamental o professor regente ministra aulas de todos os componentes curriculares, com exceção de Língua Inglesa e Educação Física.",
      "Parágrafo único. Os componentes curriculares nominados no caput são ministrados por professores com habilitação específica.\nArt. 61. A partir do 6º (sexto) ano do ensino fundamental todos os componentes curriculares são ministrados por professores com habilitação específica.",
      "Seção I\nDo Currículo Do Ensino Fundamental",
      "Art. 62. O currículo do Ensino Fundamental, com duração de 9 (nove) anos, estrutura-se em:",
      "I - anos iniciais, com 5 (cinco) anos de duração, atendendo a faixa etária de 6 (seis) a 10 (dez) anos;\nII - anos finais, com 4 (quatro) anos de duração, atendendo a faixa etária de 11 (onze) a 14 (quatorze) anos.\nArt. 63. No 1º (primeiro) ano e no 2º (segundo) ano do ensino fundamental devem assegurar, a ação pedagógica devendo ter como foco a alfabetização, de modo que se garanta aos alunos a apropriação do sistema de escrita alfabética, a compreensão leitora e a escrita de textos com complexidade adequada à faixa etária dos alunos, e o desenvolvimento da capacidade de ler e escrever números, compreender suas funções, bem como o significado e uso das quatro operações matemáticas.",
      "Art. 64. Este Colégio adota 3 (três) formas de progressão:",
      "I - continuada: possibilita ao estudante a progressão do 1° (primeiro) para o 2° (segundo) ano do ensino fundamental, sem interrupções;\nII - regular: possibilita ao estudante a progressão de um ano para outro de acordo com o disposto na proposta pedagógica e neste regimento escolar.\nIII - parcial: possibilita ao aluno avançar para o ano seguinte, suprindo, ao mesmo tempo, o ano para o qual foi promovido e o(s) componente(es) curricular(es) da reprovação.\nArt. 65. Este Colégio tem assegurado em sua proposta pedagógica a transposição aos alunos provenientes do Ensino Fundamental de 08 (oito) anos para o de 09 (nove) anos de duração.",
      "Parágrafo único. A transposição deve ser registrada nos documentos escolares do aluno.\nArt. 66. O currículo do Ensino Fundamental contém, obrigatoriamente, uma base nacional comum curricular complementada por uma parte diversificada que constituem um todo integrado e não podem ser considerados como dois blocos distintos.",
      "Parágrafo único. A articulação entre a base nacional comum curricular e a parte diversificada do currículo do Ensino Fundamental possibilita a sintonia dos interesses mais amplos de formação básica do cidadão com a realidade social e as necessidades dos alunos, as características regionais da sociedade, da cultura e da economia, e perpassa todo o currículo.\nArt. 67. Os componentes curriculares obrigatórios do Ensino Fundamental são assim organizados em relação às áreas de conhecimentos:",
      "I- Linguagens:\na) Língua Portuguesa; \nb) Redação; \nc) Língua Inglesa; \nd) Arte; \ne) Educação Física. \nII- Matemática:\na) Matemática; \nIII- Ciências da Natureza:\na) Ciências; \nIV- Ciências Humanas:\na) História; \nb) Geografia; \nc) Princípio Sociológico de Convivência.  \n§1º O componente curricular Princípio Sociológico de Convivência é de caráter não reprobatório, com presença obrigatória.\nArt. 68. A Educação Física, integrada à proposta pedagógica do Colégio, faz parte da matriz curricular, ajustando-se às faixas etárias e às condições do aluno.",
      "Art. 69. O ensino de História do Brasil levará em conta as contribuições das diferentes culturas e etnias para a formação do povo brasileiro, especialmente das matrizes indígena, africana e europeia.",
      "Art. 70. A história e as culturas indígena e afro-brasileira estarão presentes nos conteúdos desenvolvidos no âmbito de todo o currículo escolar e, em especial, no ensino de Arte, Literatura e História do Brasil, assim como a História da África, deverão assegurar o conhecimento e o reconhecimento desses povos para a constituição da nação.",
      "Art. 71. A musicalização constitui conteúdo do componente curricular Arte, o qual compreende também as artes visuais, o teatro e a dança.",
      "Art. 72. Os conteúdos referentes à história e cultura Sul-Mato-Grossense serão ministrados no âmbito de todo o currículo do Ensino Fundamental.",
      "Parágrafo único. O disposto no caput contemplará os elementos da história e cultura regional, música, artes plásticas, teatro, literatura e outros.\nArt. 73. O componente curricular Língua Inglesa é oferecido, a partir do 1º ano, em horário normal de aula, atendendo os objetivos da proposta pedagógica.",
      "Art. 74. O currículo do Ensino Fundamental inclui conteúdos relativos à condição e direitos dos idosos, educação alimentar e nutricional de forma a valorizar e produzir conhecimentos sobre os assuntos.",
      "Art. 75. O currículo do Ensino Fundamental inclui, obrigatoriamente, conteúdo que trate dos direitos e deveres das crianças e dos adolescentes, tendo como diretriz do Estatuto da Criança e do Adolescente.",
      "Parágrafo único. O disposto no caput contemplará os elementos da história e cultura regional, música, artes plásticas, teatro, literatura e outros.\nArt. 76. O currículo do Ensino Fundamental inclui em seus conteúdos temas relativos ao código de Defesa e Proteção do Consumidor.",
      "Art. 77. O currículo do Ensino Fundamental deve incluir, como tema transversal, o estudo sobre os símbolos nacionais.",
      "Art. 78. Os conteúdos que compõem a Base Nacional Comum e a parte diversificada têm origem no desenvolvimento das linguagens, no mundo do trabalho, na cultura e na tecnologia, na produção artística, nas atividades, desportivas e corporais, e na área da saúde.",
      "Parágrafo único. Os conteúdos a que se refere o caput incorporam saberes como os que advêm das formas diversas de exercícios da cidadania, dos movimentos sociais, da cultura escolar, da experiência docente, do cotidiano e dos alunos.\nArt. 79. O Colégio incluirá em sua proposta pedagógica, programa severo contendo medidas de conscientização, prevenção e combate ao bullying e cyberbullying escolar.",
      "§1º Entende-se por bullying a prática de atos de violência física ou psicológica, de modo intencional e repetitivo, exercida por indivíduo ou grupos de indivíduos, contra uma ou mais pessoas, com o objetivo de intimidar, agredir, causar dor, angústia ou humilhação à vítima.\n§2º Para os fins do disposto no caput deste artigo, considera-se ainda bullying contra os alunos ou professores: acarretar a exclusão social; subtrair coisa alheia para humilhar; perseguir; discriminar; amedrontar; destroçar pertences; instigar atos violentos, inclusive utilizando-se de meios tecnológicos.\n§3º Entende-se cyberbullying é a prática de intimidação, humilhação ou perseguição no ambiente virtual (redes sociais, jogos, mensagens), caracterizado por comportamentos repetitivos que causam danos psicológicos profundos, como ansiedade e depressão.",
      "CAPÍTULO III\nDO CALENDÁRIO ESCOLAR",
      "Art. 80. O calendário escolar é o instrumento que expressa à ordenação temporal das atividades previstas no plano anual deste Colégio, de acordo com a proposta pedagógica e este regimento escolar.",
      "Art. 81. No calendário escolar deverão estar especificados:",
      "I- o período inicial de matrículas;\nII- sessões de estudos para aperfeiçoamento profissional dos funcionários e dos professores;\nIII- previsão mensal de dias letivos;\nIV- início e o final das atividades docentes;\nV- data para entrega de notas na secretaria escolar;\nVI- dias letivos e não letivos;\nVII- início e o término dos bimestres e do ano letivo;\nVIII- período de férias do corpo docente e discente;\nIX- feriados e recesso do Colégio;\nX- recuperação e exame final;\nXI- reuniões do conselho de classe;\nXII- previsão mensal de carga horária;\nXIII- comemorações cívicas, culturais e desportivas.\nXIV- período de realização da Avaliação Institucional Interna.\nArt. 82. O calendário escolar é elaborado anualmente e aprovado por este Colégio e conta com, no mínimo, duzentos dias de atividades escolares.",
      "Art. 83. Serão considerados dias letivos aqueles em que as aulas forem normais neste Colégio, com a participação efetiva do professor e do aluno.",
      "Parágrafo único. Nos feriados que houver comemorações cívicas ou desportivas, previstas no calendário escolar, são considerados dias letivos, quando tiver a duração equivalente ao turno normal de aula.\nArt. 84. O ano letivo só poderá ser encerrado após o cumprimento de, no mínimo, 200 (duzentos) dias letivos e carga horária mínima de 800 (oitocentas) horas.",
      "Art. 85. No cômputo do mínimo de 200 (duzentos) dias letivos anuais não são incluídos os dias destinados a recuperação e aos exames finais.",
      "Art. 86. As aulas não podem ser suspensas, exceto em decorrência de fatos que justifiquem tal medida, neste caso, devem ser repostas para o devido cumprimento de carga horária e dos dias letivos.",
      "Art. 87. O calendário escolar, aprovado e em operacionalização no Colégio, só poderá ser modificado durante o ano letivo, para atender medidas didático-pedagógicas.",
      "CAPÍTULO IV\nDA EDUCAÇÃO ESPECIAL NA EDUCAÇÃO INCLUSIVA",
      "Art. 88. Entende-se por educação especial, a modalidade de educação escolar oferecida preferencialmente no ensino regular, para estudantes com deficiência, transtornos globais do desenvolvimento e altas habilidades ou superdotação, garantindo acesso, permanência, progressão escolar e terminalidade.",
      "Art. 89. O Colégio oportunizara a inclusão, em sala comum, dos estudantes com deficiência transtornos globais do desenvolvimento e altas habilidades ou superdotação, promovendo, participação e aprendizagem, assim como serviços de apoio especializados de acordo com as necessidades individuais dos estudantes, por meio:",
      "I. De Plano Educacional Individualizado (PEI) que contemple:\na) Avaliação das necessidades educacionais do estudante; \nb) Flexibilização curricular, estratégias pedagógicas e recursos de acessibilidade adequados;\nc) Processo de avaliação qualitativa, continua e sistemática.\nII. Da atualização colaborativa quando for o caso, entre professor regente, equipe pedagógica e professor especializado em educação especial; \nIII. Do apoio aos estudantes que necessitam de auxilio nas atividades de higiene, alimentação e locomoção, por profissional capacitado em educação especial;\nIV. Da distribuição dos estudantes pelas classes comuns, de maneira que se privilegie a interação entre eles;\nV. Da disponibilização de ambientes colaborativos de aprendizagem.\nParágrafo único. A avaliação das necessidades educacionais do estudante, prevista na alínea “a”, dar-se-á por professor especializado em educação especial no Colégio.\nArt. 90. A necessidade de atendimento especial do aluno devera, necessariamente, ser comprovada por laudo médico atualizado e produzido por especialista.",
      "Art. 91. A reflexão, o diálogo e a parceria entre a instituição e os responsáveis do aluno portador de necessidades especiais são bases para o atendimento especializado. Nesse sentido, os responsáveis que não participarem como Colégio do atendimento ao aluno com deficiência, transtornos globais do desenvolvimento e altas habilidades ou superdotação, dificultará todo o trabalho educacional adaptado (ou não) à necessidade do mesmo, podendo configurar desassistência e ensejará, assim, comunicados e notificações ao Conselho Tutelar.",
      "Parágrafo único. Quando o diálogo e a parceria entre o Colégio e os responsáveis dos alunos que necessitem de atendimento especializado não ocorrem da forma esperada e a instituição não receber dos mesmos e dos profissionais da área da saúde o suporte necessário para o atendimento ao aluno, a renovação da matrícula poderá ser indeferida.\nArt. 92. A educação escolar do estudante com deficiência, transtornos globais do desenvolvimento, altas habilidades ou superdotação, nas etapas e modalidades da educação básica, é de responsabilidade do professor regente, em conjunto com a equipe pedagógica e administrativa.",
      "Art. 93. Caberá à equipe pedagógica e administrativa do Colégio apoiar ações voltadas à escolarização dos estudantes, público da educação especial, em articulação com professores regentes das classes.",
      "Parágrafo único. A avaliação do processo educativo será coordenada pela equipe pedagógica desde Colégio.\nArt. 94. Para o atendimento escolar aos alunos com deficiência, transtornos globais do desenvolvimento e altas habilidades ou superdotação, o Colégio pode oferecer, quando for o caso, atendimento em ambiente hospitalar ou domiciliar.",
      "Art. 95. Em caráter transitório e concomitante, os alunos incluídos nas classes comuns poderão ser atendidos nas salas de recurso, conforme legislação vigente.",
      "Art. 96. Este Colégio poderá criar classe especial para estudantes, que não se beneficiam da organização curricular da classe comum, em caráter especial transitório, conforme legislação vigente."
    ]
  },
  {
    "id": "título-vi",
    "title": "TÍTULO VI",
    "subtitle": "DO REGIME ESCOLAR",
    "paragraphs": [
      "CAPÍTULO I\nDA MATRÍCULA",
      "Art. 97. A matrícula é a medida administrativa que formaliza o ingresso legal do estudante no Colégio.",
      "Art. 98. A idade para ingresso no 1º (primeiro) ano do ensino fundamental será de 6 (seis) anos completos ou a completar até o dia 31 de março do ano em que ocorrer a matrícula.",
      "Parágrafo único. As crianças que completarem 6 (seis) anos, após a data estabelecida no caput deste artigo, deverão ser matriculadas na Educação Infantil.\nArt. 99. A matrícula inicial poderá ser realizada em qualquer época do ano letivo, desde que haja vaga.",
      "Art. 100. A matrícula é requerida pelo candidato, se maior de idade, ou pai/mãe ou responsável, se menor de idade.",
      "Parágrafo único. A direção deste Colégio no ato da matrícula, fica obrigada a dar ciência ao estudante, se maior de idade, ou pai/mãe ou responsável, se menor de idade, da Proposta Pedagógica e do Regimento Escolar.\nArt. 101. Aos candidatos à matrícula exigir-se-ão os seguintes documentos:",
      "I - requerimento assinado pelo estudante, se maior de idade, ou pai/mãe ou responsável, se menor de idade;\nII - cópia da Certidão de Nascimento ou Casamento, acompanhada do original, para conferência e autenticação;\nIII - cópia do Cadastro de Pessoa Física (CPF), se houver;\nIV - ementa Curricular, se for o caso;\nV - guia de Transferência, original;\nVI - histórico Escolar, original, se for o caso;\nVII - cópia da Carteira de Vacinação, conforme legislação vigente;\nVIII - cópia do comprovante de residência, ou declaração, se for o caso;\nIX - cópia do documento de comprovação de guarda legal, do estudante menor de idade, conforme o caso.\n§ 1° A não apresentação do disposto no inciso III, VII e IX, não condiciona à negação da matrícula e nem ao ato de indeferimento.\n§ 2° No caso do matriculando não possuir a Carteira de Vacinação, seu responsável terá o prazo de 30 (trinta) dias para providenciá-la, no órgão responsável.\n§ 3° Quando do não cumprimento do prazo estipulado no § 2º a direção deste Colégio deverá comunicar ao Conselho Tutelar e à Coordenação Geral do Programa Nacional de Imunizações, da Secretaria de Vigilância em Saúde (SVS), para as providências necessárias.\n§ 4° Em caso excepcional, este Colégio pode aceitar cópia da Cédula de Identidade (RG), em substituição aos documentos do inciso II, desde que acompanhada do documento original, para conferência e autenticação.\n§ 5° Provisoriamente, os documentos mencionados nos incisos V e VI poderão ser substituídos pela Declaração de Transferência, conforme prazo estabelecido pela escola de origem ou pela escola recipiendária, se for o caso.\n§ 6° Quando da matrícula de estudante estrangeiro, exigir-se-á cópia da documentação comprobatória de seu registro no Serviço de Estrangeiro da Polícia Federal, observadas, ainda, as exigências previstas na legislação vigente.\nArt. 102. A matrícula concretizar-se-á após a apresentação da documentação exigida e o deferimento pela direção.",
      "Art. 103. É considerada nula e imediatamente cancelada a matrícula efetivada com documentos falsos ou adulterados.",
      "Art. 104. As irregularidades constatadas após o deferimento da matrícula serão de inteira responsabilidade deste Colégio.",
      "Art. 105. Quando os pais do estudante forem divorciados ou separados judicialmente, será exigido o documento oficial que comprove a guarda do menor.",
      "§ 1° O disposto no caput deste artigo não dispensa a obrigatoriedade de informar aos pais, conviventes ou não com seus filhos, sobre a frequência e rendimento escolar do estudante.\n§ 2° Quando da solicitação por parte do pai/mãe não detentor da guarda do menor, o Colégio deverá informar ao detentor da guarda o requerido.\nArt. 106. Quando da matrícula de estudante com deficiência, transtornos globais do desenvolvimento e altas habilidades ou superdotação, os pais ou o responsável, deverão informar ao Colégio, mediante laudo que identifique o tipo de deficiência ou superdotação.",
      "Art. 107. A matrícula, mediante a apresentação apenas de Declaração de Transferência, terá seu deferimento condicionado ao preenchimento do Termo de Compromisso, com assinatura prévia do estudante, se maior de idade, ou pai/mãe ou responsável, se menor de idade.",
      "Art. 108. A matrícula pode ser cancelada em qualquer época do ano letivo, pelo estudante, se maior de idade, ou pai/mãe ou responsável, se menor de idade, com justificativa formal da causa do cancelamento.",
      "Parágrafo único. No caso de cancelamento de matrícula de estudante menor, requerido pelos pais ou responsável, o Colégio deve comunicar o fato, imediatamente, ao Conselho Tutelar do município.\nArt. 109. Quando da matrícula de estudantes com escolaridade proveniente do exterior, a escola recipiendária deverá realizar a equivalência de estudos, conforme a legislação vigente.",
      "CAPÍTULO II\nDA MATRÍCULA POR TRANSFERÊNCIA",
      "Art. 110. A matrícula por transferência é aquela pela qual o estudante, ao se desvincular de uma escola, vincula-se a outra congênere, para prosseguimento dos estudos.",
      "§ 1° Quando houver dificuldade de traduzir conceitos em notas, cabe ao conselho de classe da escola recipiendária decidir sobre o significado dos símbolos ou conceitos usados.\n§ 2° Em caso de matrícula de estudante oriundo de escola com organização curricular diferenciada, a escola recipiendária, após a análise documental, deverá elaborar Portaria de classificação, para legitimar o ato de posicionamento do estudante.\n§ 3° Em caso de dúvida quanto à interpretação dos documentos escolares, oriundos de organização curricular diferenciada, excepcionalmente na impossibilidade de julgamento, o Colégio deve adotar as medidas necessárias à classificação por avaliação do estudante.\nArt. 111. É vedado a qualquer escola receber como aprovado o estudante que, segundo os critérios regimentais da escola de origem, tenha sido reprovado.",
      "Parágrafo único. A escola recipiendária pode efetivar a matrícula do estudante no ano subsequente quando em seu currículo inexistir o componente curricular que motivou sua reprovação na escola de origem.\nArt. 112. Ao aceitar a transferência, a direção deste Colégio assume a responsabilidade de submeter o estudante às adaptações curriculares necessárias, exceto nos anos iniciais do ensino fundamental.",
      "Art. 113. A aceitação da matrícula por transferência de estudante com escolaridade procedente de país estrangeiro depende do cumprimento, por parte do interessado, de todos os requisitos legais vigentes.",
      "Art. 114. Quando da matrícula realizada por meio de Declaração de Transferência, a direção deste Colégio procederá ao deferimento da matrícula, mediante preenchimento de Termo de Compromisso, a ser assinado pelo estudante, se maior de idade, ou pai/mãe ou responsável, se menor de idade e assegurar as seguintes condições:",
      "I - que a transferência seja entregue em conformidade com o prazo estabelecido na Declaração de Transferência da escola de origem e/ou com o Termo de Compromisso firmado na escola recipiendária;\nII - que a matrícula seja cancelada se não houver a entrega da transferência no prazo estabelecido na Declaração de Transferência e/ou Termo de Compromisso firmado neste estabelecimento ensino;\nIII - dar conhecimento prévio da classificação, por avaliação, ao estudante se maior de idade, ou pai/mãe ou responsável, se menor de idade, com lavratura da decisão em ata.\nArt. 115. Quando da ocorrência do disposto no inciso II do artigo anterior deste Regimento Escolar e o requerente persistir na permanência neste Colégio a direção, sob a anuência do estudante, quando maior, ou dos pais ou responsável, quando menor, procederá à classificação por avaliação, em conformidade com o previsto neste Regimento Escolar.",
      "Art. 116. Os registros referentes ao aproveitamento e à assiduidade do estudante, até a data da matrícula na escola recipiendária, são atribuições exclusivas da escola de origem.",
      "CAPÍTULO III\nDO AGRUPAMENTO DE ALUNOS",
      "Art. 117. As classes são constituídas por alunos devidamente matriculados neste Colégio, organizadas de acordo com a idade e nível de desenvolvimento da criança por anos, no Ensino Fundamental.",
      "Parágrafo único. O número de alunos no ensino fundamental é proporcional ao tamanho da sala.\nArt. 118. Quando houver alunos com deficiência, transtornos globais do desenvolvimento e altas habilidades ou superdotação inclusos nas turmas que compõem as etapas do ensino fundamental, o quantitativo de alunos por turma deverá ser no máximo de:",
      "I-  20 (vinte) alunos, nos anos iniciais do ensino fundamental;\nII- 25 (vinte e cinco) alunos, nos anos finais do ensino fundamental. \nParágrafo único. A inclusão dar-se-á, de no máximo 3 (três) estudantes, preferencialmente com a mesma deficiência, considerando-se parecer de professor especializado em educação especial, aplicando também essa quantidade nos casos de transtornos globais do desenvolvimento e altas habilidades ou superdotação.\nArt. 119. Podem ser organizadas classes ou turmas conforme o nível de desenvolvimento do estudante, independentemente do ano, para estudos de Língua Estrangeira no ensino fundamental, com opção de oferecimento em turno contrário.",
      "Art. 120. Na composição de turmas deve ser atendida o quantitativo máximo de estudantes estabelecidos nas normas vigentes.",
      "Art. 121. Para oferta das etapas da educação básica, a sala de aula deve assegurar as seguintes dimensões mínimas por alunos:",
      "I - 1,50 m2 nos anos iniciais do ensino fundamental;\nII - 1,30 m2 nos anos finais do ensino fundamental.\nParágrafo único. Deve ser respeitada a distância focal de, no mínimo, 1,50 m entre a lousa e a primeira fileira de carteira.",
      "CAPÍTULO IV\nDA FREQUÊNCIA",
      "Art. 122. A frequência às aulas é permitida somente aos alunos legalmente matriculados.",
      "Art. 123. É obrigatória, aos alunos, a frequência às aulas e a todas as atividades escolares devidamente uniformizados, conforme padrão do Colégio.",
      "Art. 124. A frequência do aluno será computada a partir do início do ano letivo.",
      "Art. 125. O aluno matriculado após o início do ano letivo terá a frequência computada a partir da data da matrícula no Colégio.",
      "Art. 126. No ensino fundamental é exigida a frequência mínima de 75% (setenta e cinco por cento) do total de horas letivas para aprovação, computadas ao final de cada ano, exceto no 1° (primeiro) ano do ensino fundamental.",
      "Art. 127. A frequência do aluno às atividades educacionais será efetuada, obrigatoriamente, pelo professor, no diário de classe, e deverá ser digitado/registrado pelo mesmo bimestralmente no sistema de controle de automação do Colégio (PROFESSUS), para controle e apuração final da assiduidade de cada aluno.",
      "Art. 128. A Constituição Federal, a Lei de Diretrizes e Bases da Educação Nacional (LDB - Lei 9.394/1996) e a Lei Pelé (Lei 9.615/1998) garantem aos alunos-atletas o direito de compatibilizar os estudos com a prática esportiva de alto rendimento, sem prejuízo na sua vida escolar dentro das possibilidades do Colégio.",
      "§1º O responsável ou o aluno, se maior de idade, deve apresentar pedido por escrito, solicitando o abono das faltas durante competições, treinos ou viagens esportivas com 48 horas de antecedência, salvo casos emergenciais.\n§2º O pedido deve conter, identificação completa do aluno, período em que ficará ausente e justificativa (participação em treinamento/competição de alto rendimento).\n§3º O responsável deve apresentar declaração ou atestado da entidade esportiva (federação, confederação, clube ou equipe) que confirme que o aluno é atleta federado ou de alto rendimento, descreva o período de treinamentos ou competições e seja assinada por responsável técnico ou dirigente, além de calendário oficial de competições (quando for o caso).\nArt. 129. O aluno impossibilitado de frequentar as aulas por motivos de saúde pode requerer o regime domiciliar ou hospitalar.",
      "Parágrafo único. A certificação da frequência deve ser realizada com base em relatório elaborado pelo professor que atende ao aluno.\nArt. 130. A frequência do aluno recebido por transferência é computada para fins de promoção ou para possibilitar a sua participação no exame final, sendo obrigatória a frequência mínima de 75% (setenta e cinco por cento) do cômputo da carga horária cursada pelo aluno.",
      "Parágrafo único. O disposto no caput somente será aplicado ao aluno que não passe por nenhum processo de classificação realizado por meio de avaliação ou equivalência de estudos.\nArt. 131. O aluno dispensado de cursar componente(s) curricular(es) mediante apresentação do documento de eliminação parcial, deve cumprir no mínimo 75% (setenta e cinco por cento), referente ao total da somatória da carga horária do(s) componente(s) curricular(es) a que estiver obrigado a cursar.",
      "Art. 132. As justificativas de faltas apresentadas servem apenas para atender às normas disciplinares, não abonando as faltas, exceto no caso previsto em lei.",
      "Art. 133. O Colégio deve adotar providências internas capazes de estimular a frequência e a pontualidade do aluno em suas atividades letivas, de forma a garantir o cumprimento da carga horária.",
      "Art. 134. O Colégio mantém um sistema de comunicação com as famílias para que a frequência e a pontualidade do aluno sejam objeto de acompanhamento.",
      "Parágrafo único. Notificar ao Conselho Tutelar comunicando a relação dos alunos que apresentarem quantitativo de faltas acima de 30% (trinta por cento) do percentual permitido em lei.",
      "CAPÍTULO V\nDO REGIME DOMICILIAR",
      "Art. 135. O regime domiciliar é um processo que envolve a família e o Colégio e dá ao aluno o direito de realizar atividades escolares em seu domicílio, quando houver impedimento de frequência às aulas, sem prejuízo na sua vida escolar dentro das possibilidades do Colégio.",
      "§1º O benefício de que trata o caput do artigo deve ser requerido pelos pais, responsável ou aluno, quando maior, mediante apresentação de atestado médico, no prazo mínimo de 5 (cinco) dias a contar do início do afastamento.\n§2º No atestado médico ou laudo deve, obrigatoriamente, constar o CID – Código Internacional de Doenças, o motivo do afastamento e a indicação das datas de início e término do período de afastamento.\n§3º Aos alunos que necessitarem de afastamento inferior a 5 (cinco) dias, as faltas serão computadas nos 25% (vinte e cinco por cento), que estes têm direito a faltar.\nArt. 136. São considerados merecedores de tratamento excepcional:",
      "I- alunas em estado de gestação a partir do 8º (oitavo) mês de gravidez, podendo ser antecipado;\nII- os alunos portadores de afecções congênitas ou adquiridas, infecções, traumatismo ou outras condições mórbidas, determinando distúrbios agudos ou agudizados, desde que se verifique a conservação das condições intelectuais e emocionais necessárias para o prosseguimento da atividade escolar.\nParágrafo único. A prorrogação do oferecimento do tratamento excepcional ocorrerá, desde que comprovada à necessidade por meio de atestado médico, na sua própria pessoa.\nArt. 137. Compete ao Secretário Escolar:",
      "I- orientar o preenchimento do requerimento, mediante o atestado médico e as informações da família;\nII- encaminhar a documentação para a coordenação pedagógica diretamente envolvida com o aluno.\nArt. 138. Compete ao Coordenador Pedagógico:",
      "I- fazer comunicação aos professores, solicitando as atividades escolares;                                                                    \nII- manter contato direto com a família ou responsável do aluno para o encaminhamento das atividades escolares e/ou recebimento das atividades realizadas;\nIII- encaminhar as atividades escolares realizadas para os professores.\nArt. 139. O aluno deverá cumprir as atividades escolares propostas de todos componentes curriculares, nos prazos estabelecidos pelos docentes.",
      "Art. 140. Os pais (ou responsável) pelo aluno deverão, obrigatoriamente, manter contato pessoal e periódico com a coordenação pedagógica para receber orientações e acompanhamento das atividades propostas.",
      "Art. 141. As atividades escolares deverão ser entregues pelos pais ou responsável pelo aluno no prazo estipulado pela coordenação pedagógica.",
      "Parágrafo único. O aluno será avaliado de acordo com as atividades dos componentes curriculares apresentados.\nArt. 142. O regime domiciliar não tem efeito retroativo.",
      "Art. 143. Findo o período do benefício, o aluno deverá retornar às atividades regulares do ano em curso.",
      "CAPÍTULO VI\nDA TRANSFERÊNCIA",
      "Art. 144. A transferência é a passagem do aluno de um para outro Colégio, inclusive de país estrangeiro, com base na equivalência e aproveitamento de estudos.",
      "Art. 145. Para a expedição da guia de transferência não será exigido o atestado de vaga do Colégio para o qual o aluno será transferido.",
      "Art. 146. É vedada a transferência de alunos sujeitos ao exame final, exceto no caso comprovado de mudança de município.",
      "Art. 147. O prazo para expedição de transferência será de até 15 (quinze) dias úteis, a partir da data do requerimento.",
      "Art. 148. A transferência será requerida pelo aluno, quando maior, ou pelos seus pais ou responsável, quando menor.",
      "Art. 149. O aluno, ao ser transferido, em qualquer época, deverá receber do Colégio a guia de transferência contendo:",
      "I- identificação completa do Colégio;\nII- identificação completa do aluno;\nIII- informações sobre:\na) a organização curricular cursada no Colégio e, anteriormente, em outras unidades escolares, quando for o caso;\nb) o aproveitamento obtido, quando for o caso;\nc) a frequência do ano em curso, quando for o caso;\nd) aprovação ou reprovação, quando for o caso.\ne) outros registros de observações pertinentes.\n§1º Os registros das observações previstas na alínea “e” devem ser pertinentes ao percurso escolar do aluno.\n§2º No 1º (primeiro) ano do ensino fundamental, a guia de transferência deve ser acompanhada do parecer descritivo.\n§3º A partir do 2º (segundo) ano do ensino fundamental, a guia de transferência deve ser acompanhada da ementa curricular.\nArt. 150. Na Educação Infantil, o Colégio deve expedir parecer descritivo constando os processos de desenvolvimento e da aprendizagem da criança.",
      "Art. 151. O remanejamento de turno poderá ser requerido pelo aluno, quando maior ou pelos pais ou responsável, quando o aluno for menor, desde que haja vaga.",
      "Parágrafo único. Quando o remanejamento for proposto pela direção, com fins pedagógicos, terá que contar com a anuência dos interessados.",
      "CAPÍTULO VII\nDO APROVEITAMENTO DE ESTUDOS",
      "Art. 152. Aproveitamento de estudos é o mecanismo que possibilita ao estudante a dispensa de cursar áreas de conhecimento/componentes curriculares do currículo escolar.",
      "§ 1º São objeto de aproveitamento os estudos formais concluídos com êxito.\n§ 2º O aproveitamento de estudos somente poderá ser efetivado após a matrícula do aluno na etapa da Educação Básica e mediante apresentação de documento comprobatório de escolaridade.\nArt. 153. O aluno fica dispensado de cursar a área de conhecimento que apresentar certificado de eliminação parcial.",
      "Art. 154. Para resguardar os direitos dos alunos, do Colégio e dos profissionais envolvidos no processo de aproveitamento de estudos, o Colégio exigirá os seguintes procedimentos:",
      "I- requerimento, solicitando o aproveitamento de estudos devidamente assinado pelo aluno, quando maior, ou pelos pais ou por seu responsável, quando menor, acompanhado da via original do certificado de eliminação parcial;\nII- proceder à análise comparativa do comprovante de escolaridade, apresentado pelo aluno com a matriz curricular deste Colégio;\nIII- verificada a possibilidade do aproveitamento de estudos, o Colégio deve registrar ata onde conste:\na) a área de conhecimento etapa para qual os estudos foram aproveitados e, consequentemente, dispensado de cursar; \nb) componente curricular que o aluno tem que cursar;\nc) frequência mínima exigida para aprovação, considerando o(s) componente(s) curricular (es) que o aluno terá que cursar.\nIV- elaborar termo de responsabilidade informando as obrigações do aluno quanto ao cumprimento do componente curricular que será cursado para cumprimento do currículo do Colégio;\nV- elaborar Portaria para legitimar o aproveitamento de estudos, do qual deve constar a área de conhecimento/componente curricular e ano para qual os estudos foram aproveitados;\nVI- arquivar o comprovante de escolaridade, cópia da ata de aproveitamento de estudos e do termo de responsabilidade, no prontuário do aluno.\nParágrafo único.  Havendo aproveitamento de estudos, quando da expedição de guia de transferência ou de histórico escolar, devem ser transcritos a denominação deste Colégio, nota, local e ano de conclusão.",
      "CAPÍTULO VIII\nDA ADAPTAÇÃO CURRICULAR",
      "Art. 155. Adaptação curricular é o procedimento pedagógico e administrativo decorrente da equiparação de currículos, que tem por finalidade, promover os ajustamentos indispensáveis para que o aluno possa prosseguir seus estudos.",
      "Art. 156. A adaptação será detectada no ato da matrícula, sendo que poderá ser caracterizada como:",
      "I- adaptação do(s) ano(s) concluído(s);\nII- adaptação de bimestre(s) do ano em curso.\nArt. 157. A adaptação curricular de ano concluído é exigida quando, no currículo do Colégio de destino, existir componente curricular da Base Nacional Comum e da parte diversificada não constante no currículo do Colégio cursado no ano anterior.",
      "Art. 158. A adaptação curricular de bimestre é exigida quando, no currículo do Colégio de destino, existir componente curricular da Base Nacional Comum Curricular e da parte diversificada não constante no currículo do Colégio de origem, no ano em curso.",
      "Art. 159. Para os estudos de adaptação são elaborados planos especiais, de forma que estes ocorram de maneira metódica e progressiva, com a participação conjunta dos professores dos componentes curriculares em questão e da coordenação pedagógica.",
      "Art. 160. O aluno somente poderá concluir o Ensino Fundamental após a efetivação das adaptações necessárias para o cumprimento do currículo deste Colégio.",
      "Art. 161. O aluno tem direito de cursar adaptação curricular de ano concluído em todos os componentes curriculares para cumprimento do currículo deste Colégio.",
      "Art. 162. A adaptação curricular de ano concluído se faz sempre de maneira regular, em aulas individuais, cursos paralelos ou outros processos pedagógicos, indicado pelo Colégio.",
      "Art. 163. A forma de adaptação curricular a que se refere o artigo anterior deve ser exequível, permitindo ao aluno cumprir a frequência e o aproveitamento.",
      "Parágrafo único. A frequência e o aproveitamento da adaptação curricular devem ser registrados em documento próprio, elaborado pelo Colégio.\nArt. 164. A adaptação de bimestre é realizada através de atividades sugeridas pelo professor e avaliação por ele aplicada, com data de aplicação antes do término do ano letivo.",
      "§1º Quando desta adaptação, os resultados de aproveitamento a serem registrados devem corresponder aos quantitativos de bimestres exigidos.\n§2° O registro do resultado da adaptação de bimestre deve ser feito por meio de canhoto, que fica no arquivo da secretaria do Colégio.\n§3º As anotações necessárias são efetuadas no diário de classe do componente curricular da turma na qual o aluno foi inserido, na forma de observação.\n§4º O aluno recebido por transferência do ano em curso, caso seja necessário, fará adaptação curricular de bimestre, dos componentes curriculares da base nacional comum curricular e da parte diversificada, neste Colégio.\n§5º A adaptação poderá ser efetuada através de trabalhos individuais ou em grupo, pesquisas ou outras atividades a critério do professor e da Coordenação Pedagógica.\nArt. 165. Para efetivação do processo de adaptação curricular de ano concluído, o Colégio deve:",
      "I- comparar o currículo;\nII- elaborar termo de responsabilidade, que será assinado pelo aluno, quando maior, ou pais ou responsável, quando menor, constando o componente curricular, que terá que cumprir em forma de adaptação curricular;\nIII- elaborar um plano próprio flexível e adequado a cada caso;\nIV- ao final do processo, proceder ao registro dos resultados obtidos, com apenas uma nota final para cada componente curricular;\nV- elaborar atas de resultados finais com resultados obtidos nos estudos de adaptação curricular de ano concluído;\nVI- arquivar, no prontuário do aluno o termo de responsabilidade, devidamente assinado pelos pais ou responsável, quando menor ou pelo aluno, quando maior.\nParágrafo único. A execução do plano e o registro do desempenho do aluno deverão ser acompanhados pela inspeção escolar.\nArt. 166. O aluno que sofrer classificação por avaliação ou equivalência de estudos neste Colégio não está sujeito à adaptação curricular.",
      "Art. 167. Os critérios para avaliação e aprovação nos estudos de adaptação curricular são os mesmos estabelecidos neste regimento escolar.",
      "Art. 168. Nos anos iniciais do Ensino Fundamental não é exigida adaptação curricular de ano concluído ou de bimestre.",
      "CAPÍTULO IX\nDA CLASSIFICAÇÃO",
      "Art. 169. Classificação é a medida administrativa que este Colégio adota, em conformidade com a sua proposta pedagógica, para posicionar o estudante em um dos anos do ensino fundamental, baseando-se nos conhecimentos, experiências e desempenho adquiridos por meios formais e informais.",
      "Art. 170. A classificação, exceto do 1º (primeiro) ano do ensino fundamental, dar-se-á por:",
      "I- promoção, para aluno do próprio Colégio, que obteve aproveitamento no ano anterior;\nII- transferência, para candidatos de outras escolas do país ou do exterior;\nIII- avaliação, feita pelo Colégio, quando da impossibilidade de comprovação de escolaridade anterior, que permita sua inscrição no ano adequado ao grau de desenvolvimento e experiência do candidato.\n§1o A classificação por transferência, em se tratando de estudante oriundo de organização de ensino diferenciada, será realizada mediante análise documental e, excepcionalmente, por avaliação, conforme Legislação vigente.\n§2o A classificação, por avaliação, deve observar o nível de conhecimento e a coerência entre a idade própria e o ano pretendido, em conformidade com a proposta pedagógica.\n§3o A classificação por avaliação dependerá de aprovação nas avaliações realizadas, exigindo-se nota igual ou superior a 7,0 (sete) em cada componente curricular.\nArt. 171. A classificação por avaliação tem caráter pedagógico, centrado na aprendizagem, e exige os seguintes procedimentos para resguardar os direitos do aluno, do Colégio e dos profissionais envolvidos:",
      "I- requerimento indicando o ano pretendido, devidamente assinado pelo interessado, quando maior, quando menor, pelos pais ou responsáveis;\nII- análise e homologação do requerimento, por parte da direção pedagógica do Colégio;\nIII- elaboração das avaliações por componente curricular constantes da base nacional comum do currículo, contemplando os conteúdos curriculares correspondentes ao período escolar anterior àquele pretendido;\nIV- aplicação das avaliações elaboradas, na forma escrita;\nV- correção e atribuição de nota correspondente ao desempenho demonstrado pelo candidato, nas avaliações aplicadas na forma escrita;\nVI- arquivamento das avaliações no prontuário do aluno.\nArt. 172. Todos os procedimentos adotados na realização das avaliações devem ser lavrados em ata de ocorrência.",
      "Art. 173. Mediante a obtenção da nota mínima 7,0 (sete) exigida para aprovação nos componentes curriculares objeto da avaliação, providenciar:",
      "I- o registro do resultado em ata de resultados finais, específica para esse fim;\nII- a portaria para legitimar o ato da classificação, onde deverá constar para qual ano e etapa da educação básica que o candidato à matricula foi classificado;\nIII- o registro da portaria nos documentos escolares do aluno, devidamente vistados pela inspeção escolar;\nIV- o arquivamento da portaria e da ata descritiva no prontuário do aluno.\nParágrafo único. A matrícula somente pode ser efetuada após a realização dos procedimentos previstos para a classificação, devidamente vistados pela inspeção escolar.",
      "CAPÍTULO X\nDA ACELERAÇÃO DE ESTUDOS",
      "Art. 174. Aceleração de estudos é o mecanismo utilizado pelo Colégio, com vistas a corrigir o atraso escolar do aluno em relação à idade/ano, possibilitando a este o alcance do nível de desenvolvimento próprio para a sua idade.",
      "Art. 175. Será considerada defasagem idade/ano a lacuna de, no mínimo, dois anos entre o ano escolar previsto para a faixa etária e a idade do aluno no ato da matrícula.",
      "Art. 176. Para a efetivação da aceleração de estudos, o Colégio deve:",
      "I- fazer um diagnóstico do nível de conhecimento apresentado pelo aluno;\nII- elaborar projeto pedagógico de aceleração de estudos que contenha as ações estratégicas para o pleno atendimento das necessidades básicas formação do aluno;\nIII- assegurar organização, metodologias e recursos diferenciados nas atividades de ensino e avaliações específicas, visando à superação da defasagem idade/ano.\nArt. 177. Este Colégio mediante a verificação do rendimento escolar poderá reposicionar o aluno por meio da aceleração de estudos.",
      "Art. 178. O reposicionamento do aluno, decorrente do processo de aceleração de estudos, somente poderá ocorrer após o prazo mínimo de 180 (cento e oitenta) dias, do início de suas atividades escolares, quando houver demonstração de conhecimentos referentes ao ano de escolarização em que foi posicionado.",
      "Art. 179. O Colégio, com vistas à correção do fluxo na idade obrigatória, poderá propor projetos diferenciados e utilizar metodologias diferenciadas, respeitando a Base Nacional Comum Curricular, tendo como parâmetros idade e crescimento para a composição de turmas.",
      "Art. 180. O aluno só poderá usufruir uma vez a cada ano letivo do instituto da Aceleração de Estudos.",
      "Art. 181. O aluno beneficiado pelo instituto da aceleração de estudos deverá cursar integralmente o ano no qual foi reposicionado.",
      "Art. 182. Os resultados da avaliação para efeito da aceleração de estudos serão registrados em Atas de Resultados Finais e Portarias específicas para cada aluno.",
      "Parágrafo único. Os documentos referentes ao processo ficarão arquivados no prontuário do aluno, devidamente vistados pela inspeção escolar.",
      "CAPÍTULO XI\nDO AVANÇO ESCOLAR",
      "Art. 183. Avanço escolar é a promoção do aluno para o ano de estudos superior àquele em que se encontra matriculado, desde que apresente características especiais e que comprove maturidade e pleno domínio dos conhecimentos relativos ao ano escolar em que está posicionado.",
      "Art. 184. O aluno poderá se beneficiar do avanço escolar quando:",
      "I- estiver matriculado e frequentando aulas no Colégio no período mínimo de um ano;\nII- apresentar aproveitamento igual ou superior a 80% (oitenta por cento) nos componentes curriculares cursando nos três anos anteriores ao que se encontra matriculado.\n§1º O aproveitamento a que se refere o inciso II deste artigo será a média resultante da somatória das notas dos bimestres.\n§2º O reposicionamento do aluno por meio do avanço escolar não poderá ocorrer após 90 (noventa) dias, contados a partir do início do ano letivo.\n§3º O aluno, ou seu responsável legal, poderá requerer o avanço escolar se atendidos os critérios previstos neste artigo.      \nArt. 185. Para a efetivação do processo de avanço escolar, o Colégio deve dispor dos seguintes documentos:",
      "I- justificativa fundamentada do requerente;\nII- parecer técnico de profissionais especializados;\nIII- histórico escolar do aluno;\nIV- relatório de inspeção escolar com informações sobre a vida escolar do aluno.\nArt. 186. Para a realização do processo do avanço escolar, no ensino fundamental, o Colégio deve:",
      "I- comunicar ao órgão executivo do Sistema Estadual de Ensino a necessidade de realização do avanço escolar;\nII- constituir comissão, composta de professores e coordenação pedagógica, para elaboração e aplicação de avaliações.\nParágrafo único. As avaliações devem ser realizadas na forma escrita e abranger os componentes curriculares da Base Nacional Comum Curricular e da parte diversificada.\nArt. 187. O aluno só poderá usufruir uma vez do instituto do avanço escolar neste Colégio.",
      "Art. 188. Os resultados da avaliação para efeito do avanço escolar serão registrados em atas descritivas e portarias específicas para cada aluno.",
      "Parágrafo único. Os documentos referentes ao processo ficarão arquivados no prontuário do aluno, devidamente vistados pela inspeção escolar.\nArt. 189. O avanço escolar dependerá da aprovação nas avaliações realizadas, exigindo-se nota igual ou superior a 8,0 (oito) em cada componente curricular.",
      "Art. 190. Mediante a obtenção da nota mínima exigida para a efetivação do avanço escolar, este Colégio adotará os seguintes procedimentos:",
      "I- registrar o resultado em ata descritiva;\nII- elaborar portaria, para legitimar a ato;\nIII- proceder às devidas anotações sobre o avanço escolar nos diários de classe do ano de origem;\nIV- proceder a matrícula do aluno no ano para o qual demostrou conhecimento, nos termos previstos neste regimento escolar;\nV- acrescer o nome do aluno na relação dos diários de classe do ano no qual foi matriculado;\nVI- assegurar o registro da portaria nos documentos escolares do aluno.\nVII- os documentos referentes ao processo, objeto do avanço escolar, devidamente vistados pela inspeção escolar devem ser arquivados no prontuário do estudante.",
      "CAPÍTULO XII\nDA EQUIVALÊNCIA DE ESTUDOS",
      "Art. 191. Equivalência de estudos é a equiparação formal dos conhecimentos adquiridos pelos alunos em países estrangeiros com os estudos do Brasil.",
      "Art. 192. A equivalência de estudos incompletos no ensino fundamental é de competência do Colégio e possibilitará a continuidade de estudos no Brasil.",
      "Parágrafo único. A equivalência prevista no caput será efetivada mediante análise documental e consolidada por meio da classificação.                      \nArt. 193. A referência para análise documental, com vistas à equivalência de estudos, é a Base Nacional Comum do Currículo estabelecida na legislação vigente.",
      "Art. 194. Quando desta equivalência, o candidato à matrícula deverá apresentar os seguintes documentos:",
      "I- requerimento dirigido ao diretor do Colégio;\nII- cópia de documento de identificação pessoal;\nIII- documento original comprobatório dos estudos incompletos.\n§1º O documento referido no inciso III deverá conter:\nI- assinatura da autoridade escolar competente;\nII- autenticação pela autoridade competente, representante consular do Brasil no país onde funcione a Instituição de Ensino que expediu os documentos, para aquele emitido em países não signatários à Convenção de Haia;\nIII- apostilamento, para documento emitido em país signatário à Convenção de Haia, no órgão competente do país de origem nos termos da legislação vigente;\nIV- tradução oficial, devidamente formalizada por tradutor público juramentado, dos documentos redigidos em Língua Estrangeira, exceto quando apresentados em Língua Espanhola.\n§2º Se estrangeiro, o candidato deverá apresentar, também, documento comprobatório de regularidade de sua permanência no Brasil, documento este, inclusive, indispensável para a efetivação da matrícula.\n§3º Ao receber todos os documentos e objetivando a equivalência de estudos, o Colégio considerando a sua proposta pedagógica, procederá:\nI- a compatibilização dos teores dos documentos originais de comprovação de estudos incompletos com as cópias apresentadas;\nII- a autenticação das cópias apresentadas, datadas e assinadas pelo funcionário responsável por este ato.\nArt. 195. Ao constatar a equiparação de estudos o Colégio declarará a equivalência de estudos do candidato, assegurando:",
      "I- a elaboração da portaria da equivalência de estudos, classificando-o para a continuidade de estudos;\nII- a efetivação da matrícula, em conformidade com o estabelecido na portaria de equivalência e exigências previstas neste regimento escolar;\nIII- o arquivamento da portaria e demais cópias de documentos no seu prontuário;\nIV- o registro dos dados pertinentes à portaria em todos os documentos da vida escolar do aluno, inclusive naqueles que serão expedidos.\nArt. 196. Quando o Colégio, após análise documental, não constatar de forma plena ou parcial o equivalente valor formativo das informações nele contidas, impossibilitando, de forma objetiva a declaração da equivalência de estudos, procederá à avaliação visando à classificação, conforme previsto neste regimento escolar.",
      "Art. 197. O interessado que se considerar prejudicado com o resultado da equivalência de estudos poderá encaminhar requerimento ao Conselho Estadual de Educação de Mato Grosso do Sul, em grau de recurso, anexando a documentação proveniente do exterior e a expedida pelo Colégio.",
      "CAPÍTULO XIII\nDA PROGRESSÃO PARCIAL",
      "Art. 198. O Regime de Progressão Parcial (RPP) é o procedimento pedagógico e administrativo que tem por finalidade propiciar ao estudante, que não obteve êxito em até 3 (três) componentes curriculares por aproveitamento, novas oportunidades de aprendizagem.",
      "Art. 199. O Sistema de Gestão de Dados Escolares (SGDE) identificará o estudante que não obteve êxito em até 3 (três) componentes curriculares e os classificará como Aprovados em Regime de Progressão Parcial (APP).",
      "Parágrafo único. Na Ata de Resultados Finais da turma e do respectivo ano letivo, o SGDE registrará os componentes curriculares nos quais o estudante em Regime de Progressão Parcial (APP) não obteve aproveitamento satisfatório e que deverão ser cursados no ano subsequente.\nArt. 200. O COLÉGIO IMPACTO DE EF deverá organizar os procedimentos pedagógicos necessários para execução do Regime de Progressão Parcial (RPP) para o estudante.",
      "Art. 201. A aprovação em Regime de Progressão Parcial é prevista do 7º (sétimo) ao 9º (nono) ano do Ensino Fundamental e no 1º (primeiro) e 2º (segundo) ano do Ensino Médio.",
      "Parágrafo único. O disposto no caput aplica-se também na transição do 9º (nono) ano do ensino fundamental para o 1º (primeiro) ano do Ensino Médio.\nArt. 202. Os critérios para a efetivação do Regime de Progressão Parcial devem estar previstos na Proposta Pedagógica.",
      "Art. 203. O estudante que não obtiver aproveitamento em até 3 (três) componentes curriculares, no percurso do 7º (sétimo) ano do Ensino Fundamental ao 2º (segundo) ano do Ensino Médio, deverá cursá los de forma subsequente e concomitante ao ano seguinte à aprovação em Regime de Progressão Parcial.         Parágrafo único. O direito ao Regime de Progressão Parcial será garantido apenas ao estudante que obtiver frequência igual ou superior a 75% (setenta e cinco por cento) da carga horária obrigatória durante o ano letivo em que não alcançar o aproveitamento necessário.",
      "Art. 204. O estudante do 3º (terceiro) ano do Ensino Médio que não alcançar o aproveitamento necessário para aprovação não terá direito ao Regime de Progressão Parcial.",
      "Parágrafo único. Para concluir a etapa do Ensino Médio, o estudante que se encontrar na situação descrita no caput deste artigo deverá cursar novamente o 3º (terceiro) ano do Ensino Médio.\nArt. 205. Ao estudante aprovado ou retido no 3º (terceiro) ano do Ensino Médio, que, concomitantemente, cursava componentes curriculares de anos anteriores em Regime de Progressão Parcial e não obteve êxito nesse Regime, será assegurado o cumprimento no ano letivo subsequente.",
      "Art. 206. O estudante em Regime de Progressão Parcial deverá assinar o Termo de Responsabilidade, se maior de 18 (dezoito) anos e para estudante menor de 18 (dezoito) anos, o Termo deverá ser assinado pelo pai, mãe ou responsável, com a devida especificação dos componentes curriculares a serem cumpridos no Regime de Progressão Parcial.",
      "Parágrafo único. O COLÉGIO IMPACTO DE EF oferecerá o Regime de Progressão Parcial conforme Plano de Estudo, o qual será previamente apresentado ao estudante quando maior de 18 (dezoito) anos ou, no caso de menor, ao pai, à mãe ou ao responsável, para que o estudante não tenha prejuízo no cumprimento de suas obrigações acadêmicas.",
      "Seção I\nDO PLANO DE ESTUDO\nArt. 207. Plano de Estudo é um instrumento elaborado pelo COLÉGIO IMPACTO DE EF com base na base nacional comum para as etapas do Ensino Fundamental e do Ensino Médio, com a finalidade de oferecer ao estudante em Regime de Progressão Parcial (RPP) um roteiro estruturado de estudos que possibilite a continuidade e progressão da aprendizagem.",
      "§ 1º As atividades previstas no Plano de Estudo, assim como a sua frequência, não estão vinculadas aos dias letivos regulares.\n§ 2º O Plano de Estudo deverá contemplar os conteúdos essenciais para a continuidade da aprendizagem no componente curricular, incluindo:\nI - sugestões de textos, vídeos, links, atividades de produção textual, cálculos e esquemas;\nII - outras estratégias definidas pelo COLÉGIO IMPACTO DE EF que promovam a fixação e/ou validação da aprendizagem.\nArt. 208. Concluído o Plano de Estudo, o estudante em Regime de Progressão Parcial será submetido a processo de avaliação, com vistas à verificação da aprendizagem e à consolidação dos conteúdos.",
      "§ 1º A avaliação de que trata o caput poderá ser realizada por meio de prova escrita ou mediante a entrega e o aproveitamento das atividades desenvolvidas no Plano de Estudo.\n§ 2º Nos componentes curriculares que integram o Itinerário Formativo do Ensino Médio, a avaliação do estudante em Regime de Progressão Parcial será realizada exclusivamente com base na entrega e no aproveitamento das atividades previstas no Plano de Estudo, devendo contemplar as temáticas abordadas nos dois semestres do ano letivo em que se deu a aprovação em Regime de Progressão Parcial.\n§ 3º Independentemente da forma de avaliação adotada — seja por meio de Plano de Estudo ou de prova escrita , o respectivo documento deverá ser arquivado no COLÉGIO IMPACTO DE EF, de modo a assegurar o registro formal do processo avaliativo.    \nArt. 209. As datas de aplicação das avaliações do Regime de Progressão Parcial (RPP) serão previstas em calendário escolar, a cada semestre.",
      "Art. 210. Quando ocorrer transferência escolar, em qualquer período do ano letivo, O COLÉGIO IMPACTO DE EF deverá emitir a Guia de Transferência do estudante, a qual deverá conter, além das informações obrigatórias, as seguintes observações, quando se tratar de estudante em Regime de Progressão Parcial:",
      "I – indicação de que o estudante foi matriculado no ano subsequente em Regime de Progressão Parcial;\nII – identificação do ano letivo e dos componentes curriculares a serem cumpridos em Regime de Progressão Parcial;\nIII – registro dos componentes curriculares nos quais o estudante foi aprovado em Regime de Progressão Parcial, com os respectivos resultados, indicando o ano escolar e a unidade escolar em que foram realizados.\nArt. 211. Da Guia de Transferência do estudante aprovado no 9º (nono) ano do Ensino Fundamental, com pendências de Regime de Progressão Parcial (RPP) referentes a anos anteriores, deverão constar, obrigatoriamente, as seguintes informações:",
      "I – os componentes curriculares a serem cumpridos em Regime de Progressão Parcial, com a indicação do respectivo ano de referência;\nII – os componentes curriculares nos quais o estudante foi aprovado em Regime de Progressão Parcial, acompanhados dos resultados obtidos, com a especificação da nota, do ano a que se referem e da unidade escolar onde foram realizados.\nArt. 212. A certificação de conclusão do Ensino Fundamental será responsabilidade do COLÉGIO IMPACTO DE EF em que o estudante concluiu os últimos componentes curriculares dessa etapa em Regime de Progressão Parcial.",
      "Seção II\nDA APROVAÇÃO EM REGIME DE PROGRESSÃO PARCIAL",
      "Art. 213. O Regime de Progressão Parcial não está condicionado ao cumprimento dos dias letivos, da carga horária anual ou da frequência mínima exigida para aprovação.",
      "Art. 214. Para a aprovação no Regime de Progressão Parcial, o estudante deverá alcançar aproveitamento igual ou superior a 6,0 (seis) no componente curricular objeto da Progressão Parcial.",
      "Art. 215. O COLÉGIO IMPACTO DE EF deverá registrar os resultados em Ata de Resultados Finais específica do Regime de Progressão Parcial, para garantir os direitos do estudante.",
      "Seção III\nDA MATRÍCULA EM REGIME DE PROGRESSÃO PARCIAL",
      "Art. 216. A matrícula em Regime de Progressão Parcial será permitida a partir do 7° (sétimo) ano do Ensino Fundamental até o 2° (segundo) ano do Ensino Médio, observadas as seguintes condições:",
      "I - para estudante aprovado em Regime de Progressão Parcial no Sistema Estadual de Ensino;\nII - para estudante proveniente de outras instituições de ensino, que apresente retenção em até 3 (três) componentes curriculares.\nParágrafo único. Para cumprimento do disposto nos incisos I e II, a matrícula em Regime de Progressão Parcial será obrigatória no ano letivo subsequente.\nParágrafo único. O COLÉGIO IMPACTO DE EF deverá registrar a fundamentação com referência expressa a este artigo ao expedir a Guia de Transferência ou o Histórico Escolar.",
      "CAPÍTULO XIV\nDA AVALIAÇÃO DA APRENDIZAGEM",
      "Art. 217. Avaliação da aprendizagem é parte integrante do processo educativo e visa:",
      "I- determinar o alcance dos objetivos educacionais;\nII- fornecer as bases para o planejamento;\nIII- propiciar ao aluno condições de avaliar seu conhecimento e desenvolver seu espírito crítico;                              \nIV- apurar o rendimento escolar do aluno, com vistas a sua promoção e continuidade de estudos;\nV- aperfeiçoar o processo de ensino e de aprendizagem.\nArt. 218. A avaliação da aprendizagem dos alunos, a ser realizada pelos professores como parte integrante da proposta curricular, é redimensionadora da ação pedagógica e deve:",
      "I- assumir caráter processual, formativo e participativo, a ser contínua, cumulativa e diagnóstica, com vistas a:\na) identificar potencialidades e dificuldades no processo de ensino e de aprendizagem;  \nb) subsidiar decisões sobre a utilização de estratégias em abordagens de acordo com as necessidades dos alunos, criando condições de intervir de modo imediato e a longo prazo para sanar dificuldades e redimensionar o trabalho docente; \nc) manter a família informada do desempenho dos alunos; \nd) reconhecer o direito do aluno e da família de discutir os resultados de avaliação, inclusive em instâncias superiores ao Colégio, revendo procedimentos sempre que as reivindicações forem procedentes; \nII- utilizar vários instrumentos e procedimentos, tais como observações, registro descritivos e reflexivos, trabalhos individuais e coletivos, portfólios, exercícios, provas, questionários, dentre outros, tendo em conta a sua adequação à faixa etária e às características de desenvolvimento do aluno;\nIII- fazer prevalecer os aspectos qualitativos da aprendizagem sobre quantitativos, bem como os resultados ao longo do período sobre os de eventuais provas finais;\nIV- assegurar tempos e espaços diversos para que os alunos com menor rendimento tenham condições de ser devidamente atendidos ao longo do ano letivo.\nArt. 219. A avaliação da aprendizagem tem, como referência, o conjunto de conhecimentos, habilidades, atitudes, valores e emoções que os sujeitos do processo educativo projetam para si modo integrado e articulado como os princípios definidos para a Educação Básica, redimensionados para cada uma de suas etapas na proposta pedagógica deste Colégio.",
      "§1º A avaliação na Educação Infantil é realizada bimestralmente através de um relatório retratando o desenvolvimento e aprendizagem da criança sem o objetivo de promoção ou retenção.\n§2º A avaliação da aprendizagem no Ensino Fundamental deve adotar uma estratégia de processo individual e contínuo que favoreça o crescimento do estudante, preservando a qualidade necessária para a sua formação escolar, sendo organizadas de acordo com as regras comuns a essa etapa.\nArt. 220. A avaliação da aprendizagem é realizada de forma individual, contínua, sistemática e integral, ao longo de todo processo de ensino e aprendizagem, observando-se o comportamento do aluno nos domínios cognitivo, afetivo e psicomotor através de diferentes técnicas e instrumentos.",
      "Seção I\nDa Apuração do Rendimento Escolar do Ensino Fundamental",
      "Art. 221. O rendimento dos alunos no 1º (primeiro) ano do Ensino Fundamental é expresso através de parecer descritivo constando o desenvolvimento dos alunos nos aspectos cognitivo, afetivo e psicomotor.",
      "Art. 222. Na observação sistemática e constante do desempenho do aluno, considera-se além do conhecimento, a atenção, o interesse, as habilidades, a responsabilidade, a participação, a pontualidade e assiduidade na realização de atividades e organização nos trabalhos escolares.",
      "Art. 223. Como expressão do resultado da avaliação do rendimento escolar, será adotado o sistema de números inteiros na escala de 0 (zero) a 10 (dez), permitindo-se o decimal 5 (cinco).",
      "Art. 224. Para o arredondamento são observados os seguintes critérios:",
      "I- os decimais 1 e 2 arredondar para o número inteiro imediatamente inferior;\nII- os decimais 3,4,5, 6 e 7 substituir pelo decimal 5;\nIII- os decimais 8 e 9 arredondar para o número inteiro imediatamente superior.\nArt. 225. A média da avaliação bimestral será obtida através da soma de todas as atividades como trabalhos, tarefas, atividades em sala, prova, participação e dividida pelo número de atividades realizadas no bimestre.",
      "Art. 226. A atribuição de notas é resultado da aplicação de várias técnicas e instrumentos de avaliação.",
      "Art. 227. Não será permitido repetir a nota de um bimestre para outro, nem progressiva nem regressivamente.",
      "Art. 228. Ao final de cada bimestre do ano letivo é registrada uma média que represente o aproveitamento escolar do aluno, para cada componente curricular, a partir do 2º (segundo) ano do Ensino Fundamental.",
      "I- Do 2° ao 5º ano do ensino fundamental, a média bimestral será calculada da seguinte forma:\n \n  MB = (AM + AB) = ≥ 7,0 (sete);\n                      2\nLegenda:\na) MB = Média Bimestral;          \nb) AM = Avaliação Mensal;\nc) AB = Avaliação Bimestral;\n \nII- Do 6° ao 9º ano do Ensino Fundamental, a média bimestral será calculada da seguinte forma:\nMB = (AM + AB+ S) = ≥ 7,0 (sete) + AT (vale no máximo 1,5);\n                    3\nLegenda:\na) MB = Média Bimestral;\nb) AM = Avaliação Mensal;\nc) AB = Avaliação Bimestral.\nd) S = Simulado.\ne) AT = Atividades.\nArt. 229. Para efeito de cálculo da média anual do aluno que ingressar após o início do ano letivo e que comprovadamente não realizou matrícula no ano em curso, considerar-se-á apenas os bimestres comprovadamente cursados.",
      "Art. 230. A apuração do rendimento anual será calculada por meio da média aritmética dos resultados bimestrais, de acordo com a seguinte fórmula:",
      "MA = 1ª MB + 2ª MB + 3ª MB + 4ª MB ≥ 7,0 (sete);\n                                                   4\nLegenda:\na) MA = média anual;\nb) MB = média bimestral.\nArt. 231. Será considerado aprovado para o ano seguinte e/ou concluinte do Ensino Fundamental, o aluno que obtiver:",
      "I- frequência igual ou superior a 75 % (setenta e cinco) por cento do total de horas letivas para aprovação;\nII- média anual igual ou superior a 7,0 (sete) em todos os componentes curriculares do ano em curso;\nIII- nota obtida no exame final igual ou superior a 5,0 (cinco).\nArt. 232. Será considerado retido, o aluno que obtiver um dos seguintes resultados:",
      "I- frequência inferior a 75 % (setenta e cinco) por cento do total de horas letivas para aprovação, independentemente dos resultados obtidos;\nII- nota obtida no exame final inferior a 5,0 (cinco).\nArt. 233. O prazo para solicitação de revisão de notas ou de médias é de até 3 (três) dias úteis, após a divulgação dos resultados.",
      "Art. 234. O exame final consiste num processo avaliativo, proporcionado aos alunos do 2º ao 9º ano do Ensino Fundamental, que não obtiverem a média anual mínima de 7,0 (sete) por componente curricular.",
      "Art. 235. Será encaminhado para exame final, o aluno que obtiver:",
      "I- média anual igual ou superior a 3,0 (três) e inferior a 7,0 (sete). O aluno poderá fazer o exame final de todos os componentes curriculares elencados na matriz curricular.\nII- frequência igual ou superior a 75 % (setenta e cinco) por cento do total de horas letivas para aprovação.\nArt. 236. Após o exame final, será considerado aprovado, o aluno que obtiver a média igual ou superior a 5,0 (cinco) em cada componente curricular, objeto do exame.",
      "O cálculo da média anual final, após o exame final, será efetivado de acordo com a seguinte fórmula:\nMF = (MA x 2) + (MEF x 1) ≥ 5,0\n                         3  \nLegenda:\na) MF = Média Final;\nb) MA = Média Anual;\nc) MEF = Média do Exame Final.",
      "Seção II\nDa Recuperação Semestral",
      "Art. 237. A recuperação acontecerá no final do semestre. O aluno que não atingir a média 7,0 (sete) na média semestral terá direito a realizar uma outra avaliação, abrangendo os principais conteúdos estudados. A avaliação será realizada em data previamente agendada pela coordenação pedagógica.",
      "Art. 238. Será encaminhado para a recuperação semestral os alunos do 2º ao 9º ano do Ensino Fundamental que não obtiverem a média mínima de 7,0 (sete) na média semestral, por componente curricular. O cálculo da recuperação será efetivado de acordo com a seguinte fórmula:",
      "MS = (MS+AR) \n                 2\nLegenda:\nMS = Média Semestral;\nAR = Avaliação da Recuperação.\nParágrafo único. Após a avaliação da recuperação semestral prevalecerá a maior nota entre a média semestral e a nova média após a recuperação.\nArt. 239. A recuperação semestral será oferecida em conformidade com o calendário escolar e será destinado um total de 5 (cinco) dias para a realização da mesma.",
      "Art. 240. O aluno do Ensino Fundamental poderá fazer recuperação semestral de todos os componentes curriculares elencados na matriz curricular.",
      "CAPÍTULO XV\nDA RECUPERAÇÃO DA APRENDIZAGEM",
      "Art. 241. A recuperação da aprendizagem é parte integrante do processo educativo e visa:",
      "I- oferecer oportunidade ao aluno de identificar suas necessidades e de assumir responsabilidade pessoal com sua própria aprendizagem;\nII- proporcionar ao aluno o alcance dos requisitos considerados indispensáveis para sua aprovação;\nIII- diminuir o índice de evasão e repetência.\nArt. 242. A recuperação da aprendizagem compreende duas formas:",
      "I- contínua - obrigatoriamente ao longo do processo ensino-aprendizagem, à medida que as deficiências forem detectadas;\nII- semestral – a recuperação semestral será oferecida aos alunos cuja a nota média semestral for inferior a 7,0 (sete).\nArt. 243. O planejamento do processo de recuperação por insuficiência de rendimento compreenderá:",
      "I- a identificação dos conteúdos programáticos em que estejam ocorrendo problemas de aproveitamento;\nII- a caracterização das dificuldades apresentadas pelos alunos e de suas possíveis causas;\nIII- a seleção de estratégias didáticas para o desenvolvimento da recuperação propriamente dita."
    ]
  },
  {
    "id": "título-vii",
    "title": "TÍTULO VII",
    "subtitle": "DA ESCRITURAÇÃO ESCOLAR E DO ARQUIVO",
    "paragraphs": [
      "CAPÍTULO I\nDOS OBJETIVOS E FORMAS",
      "Art. 244. Escrituração escolar é o registro sistemático dos dados relativos à vida escolar dos estudantes.",
      "Parágrafo único. A escrituração escolar é entendida como conjunto de instrumentos que contém dados, informações e título comprobatórios da identidade e vida escolar dos estudantes e dos atos escolares que legitimam a ocorrência do processo de ensino e aprendizado.\nArt. 245. Entende-se por arquivo, a ordenação e preservação de documentos destinados a garantir a manutenção dos dados e informações, objetos da escrituração escolar.",
      "§ 1º Ao arquivo ativo pertencem às pastas de assentamento individual do corpo docente e técnico administrativo e os documentos referentes a estudantes, matriculados no ano letivo.\n§ 2º Ao arquivo passivo pertencem às pastas de assentamento individual do corpo docente e técnico administrativo e documentos de estudantes e funcionários que não mais fazem parte deste Colégio.\nArt. 246. A escrituração escolar e o arquivo têm a finalidade de assegurar:",
      "I -  a verificação da identidade dos estudantes deste colégio;\nII -  a regularidade dos seus estudos;\nIII -  a autenticidade da sua vida escolar.\nArt. 247. A escrituração escolar e o arquivo devem ser organizados de forma simples e funcional, permitindo rápida verificação, preservação e segurança dos documentos dos estudantes do Colégio.",
      "Art. 248. A escrituração escolar e o arquivo destinam-se:",
      "I -  ao registro dos dados relativos à vida escolar dos estudantes;\nII -  à classificação e ordenação dos documentos que comprovam esses fatos;\nIII -  à preservação e segurança dos documentos;\nIV -  à localização fácil que permita rápida verificação, em qualquer tempo, dos documentos dos estudantes do colégio.  \nArt. 249. Ao Colégio compete organizar a escrituração escolar e o arquivo para atender às solicitações de informações nos limites de sua competência.",
      "Art. 250. À direção do Colégio compete superintender a escrituração escolar e o arquivo.",
      "Art. 251. A organização e guarda dos documentos escolares são de responsabilidade da mantenedora e da direção do Colégio, de forma a assegurar a regularidade de vida escolar dos estudantes.",
      "Art. 252. Nenhum documento pode ser retirado do arquivo sem a prévia autorização da direção deste Colégio.",
      "Parágrafo único. As certidões ou cópias de documentos arquivados podem ser fornecidas atendendo a requerimento do interessado legítimo, com autorização da direção.\nArt. 253. Nos documentos escolares devem constar abaixo da assinatura do diretor e do secretário escolar, em exercício à época de sua emissão, seus nomes por extenso e número de registro.",
      "Parágrafo único. Nenhum documento pode conter rasuras, borrões, emendas ou sobrescritos.\nArt. 254. É expedido histórico escolar aos estudantes que concluírem o Ensino Fundamental.",
      "Art. 255. Na escrituração escolar concentram-se dados escolares que são registrados de forma individual e /ou de forma coletiva.",
      "Art. 256. Fazem parte da forma de registros individuais indispensáveis à escrituração escolar, os seguintes documentos:",
      "I -  requerimento de matrícula;\nII -  cópia da certidão de nascimento ou casamento;\nIII -  parecer descritivo;\nIV -  portarias;\nV -  histórico escolar ou guia de transferência, quando for o caso.\nArt. 257. Fazem parte da forma de registros coletivos indispensáveis à escrituração escolar, os seguintes documentos:",
      "I -  diário de classe;\nII -  mapas colecionadores de canhotos;\nIII -  atas de resultados finais.\nArt. 258. Devem constar do arquivo deste Colégio os seguintes documentos que retratem sua realidade pedagógica e administrativa:",
      "I -  calendário escolar;\nII -  matrizes curriculares;\nIII -  regimento escolar e proposta pedagógica;\nIV -  controle de frequência dos administrativos;\nV -  controle de frequência do corpo docente;\nVI -  controle de frequência do corpo discente;\nVII -  projetos de cursos, quando for o caso.",
      "Seção I\nDo Descarte",
      "Art. 259. O descarte consiste no ato de fragmentação de documentos que, após cinco anos não necessitem mais permanecer em arquivo.",
      "Parágrafo único. Podem ser fragmentados e posteriormente descartados, os seguintes documentos:\nI- diários de classe;\nII- provas especiais ou relativas a adaptação, a recuperação, a classificação;\nIII- atestados médicos;\nArt. 260. O ato de descarte será lavrado em ata, que deverá ser assinada pelo Diretor Pedagógico, pelo Secretário Escolar e demais funcionários presentes.",
      "Seção II\nDa Responsabilidade e Autenticidade",
      "Art. 261. Ao Diretor Pedagógico e ao Secretário Escolar cabe a responsabilidade por toda a escrituração e expedição de documentos escolares, bem como a autenticação dos mesmos, pela aposição de suas assinaturas.",
      "Parágrafo único. Todos os funcionários serão responsáveis na respectiva órbita de competência, pela guarda e inviolabilidade dos arquivos, documentos e escrituração escolar."
    ]
  },
  {
    "id": "título-viii",
    "title": "TÍTULO VIII",
    "subtitle": "DA AVALIAÇÃO INSTITUCIONAL INTERNA",
    "paragraphs": [
      "Art. 262. Avaliação institucional é o mecanismo de acompanhamento sistemático e contínuo sobre as condições estruturais, pedagógicas e de funcionamento do Colégio, com vistas ao aperfeiçoamento da qualidade do ensino oferecido.",
      "§ 1º É de responsabilidade deste colégio realizar a avaliação institucional interna, anualmente, que contará com ampla participação das comunidades interna e externa.\n§ 2º Este Colégio constituirá Comissão de Avaliação composta por segmentos das comunidades interna e externa.\n§ 3º A avaliação institucional interna utilizará instrumentos e procedimentos próprios definidos com base nas dimensões estabelecidas nos termos da legislação vigente.\nArt. 263. A avaliação interna ou autoavaliação incidirá, no mínimo, sobre os seguintes critérios:",
      "I- o cumprimento da legislação do ensino;\nII- a execução da Proposta Pedagógica;\nIII- a formação inicial e continuada de dirigentes, equipe técnica, professores e funcionários;\nIV- o investimento em qualificação de recursos humanos;\nV- o desempenho de dirigentes, equipe técnica, professores e funcionários;\nVI- a qualidade dos espaços físicos, instalações, equipamentos e adequação às suas finalidades;\nVII- a articulação com a família e a comunidade externa;\nVIII- reuniões periódicas com pais/responsáveis para comunicação aos mesmos sobre o desempenho dos alunos frente aos objetivos propostos e as competências desenvolvidas;\nIX- a organização da escrituração e do arquivo escolar.\nX- para avaliar o desempenho a que se refere ao inciso 5 (cinco), a Equipe Técnica do Colégio elaborará questionários, que serão respondidos por todos os segmentos da comunidade escolar.\nXI- a avaliação institucional interna é realizada anualmente, sempre no último bimestre, organizada e executada por este colégio.\nXII- o Colégio elaborará relatórios, consolidando os resultados obtidos na avaliação institucional interna.\nArt. 264. As sínteses dos resultados, elaboradas pela Comissão, são registradas em relatório anual que promoverão a permanente reconstrução do trabalho pedagógico deste colégio redimensionando sua prática."
    ]
  },
  {
    "id": "título-ix",
    "title": "TÍTULO IX",
    "subtitle": "DA COMUNIDADE ESCOLAR",
    "paragraphs": [
      "Art. 265. A comunidade escolar deste Colégio é composta por todos os envolvidos no processo educativo e está dividida em comunidade interna sendo esta composta por todos os profissionais que integram o corpo técnico-administrativo, docentes e discentes bem como por uma comunidade externa composta por pais e/ou responsáveis.",
      "CAPÍTULO I\nDOS DIREITOS DOS CORPOS PEDAGÓGICO,",
      "TÉCNICO-ADMINISTRATIVO, DOCENTE, DO AUXILIAR E DA ZELADORIA",
      "Seção I\nDa Direção",
      "Subseção I\nDo Diretor Administrativo",
      "Art. 266. É direito do diretor administrativo:",
      "I- frequentar cursos de formação, atualização, treinamento e especialização profissional relativos à sua área de atuação; \nII- convocar reuniões extraordinárias do conselho de classe; \nIII- usufruir dos demais direitos e vantagens funcionais previstos em lei.",
      "Subseção II\nDo Diretor Pedagógico",
      "Art. 267. É direito do diretor pedagógico:",
      "I- frequentar cursos de formação, atualização, treinamento e especialização profissional relativos à sua área de atuação; \nII- convocar reuniões extraordinárias do conselho de classe; \nIII- usufruir dos demais direitos e vantagens funcionais previstos em lei.",
      "Seção II\nDo Secretário",
      "Art. 268. É direito do secretário:",
      "I- frequentar cursos de formação, atualização, treinamento e especialização profissional relativos à sua área de atuação; \nII- usufruir dos demais direitos e vantagens funcionais previstos em lei.",
      "Seção III\nDa Coordenação Pedagógica",
      "Art. 269. É direito do coordenador pedagógico:",
      "I- frequentar cursos de formação, atualização, treinamento e especialização profissional relativos à sua área de atuação; \nII- usufruir dos demais direitos e vantagens funcionais previstos em lei.",
      "Seção IV\nDo Corpo Docente",
      "Art. 270. É direito do professor:",
      "I- requisitar o material didático que julgar necessário ao exercício e desempenho de suas funções docentes, com, no mínimo, 02 (dois) dias de antecedência;\nII- utilizar os recursos instrucionais disponíveis no Colégio, necessários ao desempenho de sua função;\nIII- utilizar, com prévio consentimento da direção e coordenação pedagógica, os serviços auxiliares deste Colégio, para melhor exercício de suas funções docentes;\nIV- participar plena e ativamente do processo ensino-aprendizagem que o Colégio mantém e desenvolve, através de sua função e tarefas específicas.",
      "Seção V\nDos Serviços Auxiliares",
      "Subseção I\nDo Auxiliar de Sala de Aula",
      "Art. 271. É direito do auxiliar de sala de aula:",
      "I- ter assegurada a igualdade de tratamento, sem qualquer tipo de discriminação ou preconceito;\nII- utilizar os recursos instrucionais disponíveis no Colégio, necessários ao desempenho de sua função;\nIII- ter liberdade de expressão, manifestação e organização dentro das atribuições que o cargo lhe confere.",
      "Subseção II\nDo Auxiliar Administrativo",
      "Art. 272. É direito do auxiliar administrativo:",
      "I- ter assegurada a igualdade de tratamento, sem qualquer tipo de discriminação ou preconceito;\nII- ter liberdade de expressão, manifestação e organização;\nIII- dispor, no ambiente de trabalho, de materiais e equipamentos adequados e suficientes para exercer, com eficiência, sua função.",
      "Seção VI\nDa Inspetoria de alunos",
      "Art. 273. É direito da inspetoria:",
      "I- ter assegurada a igualdade de tratamento, sem qualquer tipo de discriminação ou preconceito; \nII- ter liberdade de expressão, manifestação e organização; \nIII- dispor, no ambiente de trabalho, de materiais e equipamentos adequados e suficientes para exercer, com eficiência, sua função.",
      "Seção VII\nDo auxiliar de serviços gerais e da zeladoria",
      "Art. 274. É direito do auxiliar de serviços gerais e zeladoria:",
      "I- ter assegurada a igualdade de tratamento, sem qualquer tipo de discriminação ou preconceito; \nII- ter liberdade de expressão, manifestação e organização; \nIII- dispor, no ambiente de trabalho, de materiais e equipamentos adequados e suficientes para exercer, com eficiência, sua função.",
      "CAPÍTULO II\nDOS DEVERES DOS CORPOS PEDAGÓGICO,",
      "TÉCNICO-ADMINISTRATIVO, DOCENTE, DO AUXILIAR E DA ZELADORIA",
      "Seção I\nDa Direção",
      "Subseção I\nDo Diretor Administrativo",
      "Art. 275. É dever do diretor administrativo, além da representação ativa, passiva, judicial e extrajudicial do Colégio:",
      "I- planejar, organizar, dirigir e controlar as atividades da área financeira do Colégio; \nII- elaborar e definir a política de valores dos serviços prestados e das atividades desenvolvidas pelo Colégio; \nIII- elaborar o estudo orçamentário da receita e despesas do Colégio para o ano letivo seguinte; \nIV- incentivar e implementar, juntamente com a direção pedagógica, o uso de tecnologia no processo educacional;\nV- supervisionar o serviço do pessoal técnico-administrativo e docente; \nVI- realizar todos os serviços de ordem financeira; \nVII- prover a escola de todo material de consumo; \nVIII- participar do processo de seleção dos professores e demais funcionários a serem contratados; \nIX- proporcionar a todos os setores da escola condições e meios para a adequada execution de seus planos de trabalho; \nX- prestar atendimento aos alunos, pais ou responsáveis e integrantes do corpo técnico administrativo e docente, sempre que necessário; \nXI- atuar com ética no exercício de sua função;  \nXII- participar de cursos de capacitação; \nXIII- otimizar o uso dos recursos financeiros destinados a aquisição de materiais, manutenção das instalações e dos equipamentos.",
      "Subseção II\nDo Diretor Pedagógico",
      "Art. 276. É dever do diretor pedagógico:",
      "I- representar oficialmente ativa e passivamente o Colégio;\nII- cumprir e zelar pelo cumprimento das leis do ensino e as determinações legais das autoridades competentes, na esfera de suas atribuições;\nIII- receber e despachar expedientes, dando-lhes a tramitação requerida para cada caso;\nIV- promover o intercâmbio entre o Colégio e a comunidade através da realização de eventos cívicos, culturais e desportivos;\nV- dar conhecimento à comunidade escolar dos termos deste regimento escolar;\nVI- coordenar as atividades deste Colégio;\nVII- decidir sobre as transgressões disciplinares dos alunos, ouvida a coordenação pedagógica;\nVIII- determinar a abertura e o encerramento das matrículas dos alunos, em articulação com a coordenação pedagógica;\nIX- elaborar a proposta pedagógica, o calendário escolar, a matriz curricular e outros documentos da escola;\nX- analisar juntamente com a secretária, as transferências recebidas e a documentação escolar dos alunos;\nXI- participar das reuniões do conselho de classe e outras, quando convocado;\nXII- assinar junto com a secretária, a correspondência oficial da escola e a documentação dos alunos;\nXIII- exercer outras atividades administrativas que lhe forem delegadas pelos órgãos competentes ou pela entidade mantenedora;\nXIV- cumprir e fazer cumprir os termos deste regimento escolar.",
      "Seção III\nDo Secretário",
      "Art. 277. É dever do secretário:",
      "I- cumprir as determinações da direção;\nII- manter em dia a escrituração, a correspondência escolar e o registro de resultados de avaliação dos alunos;\nIII- manter atualizado o arquivo de legislação e de documentação de alunos e funcionários deste Colégio;\nIV- conhecer a legislação do ensino vigente, zelando pelo seu cumprimento, no âmbito de suas atribuições;\nV- analisar, juntamente com o diretor pedagógico, as transferências recebidas;\nVI- encarregar-se da correspondência oficial do Colégio, submetendo-a à apreciação e assinatura da direção pedagógica;\nVII- divulgar, no prazo estabelecido, os resultados bimestrais das avaliações realizadas;\nVIII- entregar aos professores, os diários de classe;\nIX- vetar a presença de pessoas estranhas na secretaria, a não ser que haja autorização da direção escolar;\nX- divulgar e subscrever, por ordem da direção, instruções, editais e todos os documentos escolares;\nXI- secretariarsolenidadespromovidaspeloestabelecimento de ensino, quando necessário;\nXII- manter atualizadas as pastas individuais dos professores e alunos;\nXIII- participar de reuniões e treinamentos, quando convocado;\nXIV- instruir processos de professores, funcionários e dos alunos do Colégio;\nXV- atender o corpo docente, discente e técnico-administrativo, prestando-lhes informações e esclarecimentos relativos à escrituração escolar e à legislação do ensino;\nXVI- atender às solicitações do assessor técnico escolar, na sua tarefa de assessoramento técnico escolar, quando solicitados pelos órgãos competentes;\nXVII- assinar, junto com o diretor pedagógico, a documentação escolar dos alunos;\nXVIII- responsabilizar-se pela autenticidade da documentação escolar expedida.\nXIX- conhecer e cumprir os termos deste regimento escolar.",
      "Seção IV\nDa Coordenação Pedagógica",
      "Art. 278. É dever do coordenador pedagógico:",
      "I- participar das decisões sobre transgressões disciplinares dos alunos;\nII- coordenar e incentivar o processo pedagógico, de forma articulada com os professores, respeitando as diretrizes educacionais dos órgãos competentes;\nIII- organizar, acompanhar e avaliar a execução do processo pedagógico, do horário de aula e do calendário escolar, em articulação com o diretor;\nIV- assessorar o professor, técnica e pedagogicamente, de forma a adequar o seu trabalho aos objetivos do Colégio e aos fins da educação;\nV- assistir aos professores e alunos em seus problemas de relacionamento que estejam interferindo no processo ensino-aprendizagem;\nVI- proporcionar condições de atendimento aos estudantes com deficiência, transtornos globais do desenvolvimento e altas habilidades ou superdotação;\nVII- participar da elaboração da proposta pedagógica, matriz curricular, calendário escolar e outros documentos do Colégio;\nVIII- manter permanente contato com os pais ou responsáveis, informando-os e orientando-os sobre o desenvolvimento do aluno, obtendo dados de interesse para o processo educativo;\nIX- participar das atividades cívicas, culturais e desportivas da comunidade escolar;\nX- criar mecanismos efetivos de combate à evasão e à repetência;\nXI- conhecer e respeitar as normas educacionais vigentes;\nXII- participar das atividades do magistério que lhe forem atribuídas;\nXIII- comparecer ao local de trabalho com assiduidade e pontualidade, executando as tarefas com eficiência, zelo e presteza;\nXIV- apresentar-se ao serviço discretamente trajado;\nXV- manter espírito de cooperação e solidariedade com a comunidade escolar;\nXVI- acatar orientações dos superiores e tratar com urbanidade os colegas e os usuários dos serviços educacionais;\nXVII- comunicar à autoridade imediata as irregularidades de que tiver conhecimento na sua área de atuação;\nXVIII- zelar pela economia do material e pela conservação do que for confiado a sua guarda e uso;\nXIX- analisar, juntamente com os professores, as ementas curriculares dos alunos, a fim de definir as adaptações necessárias;\nXX- convocar reuniões extraordinárias do conselho de classe, quando necessário;\nXXI- proceder à observação dos alunos, identificando as necessidades que interferem na aprendizagem dos mesmos, comunicando aos pais ou responsáveis;\nXXII- orientar os professores na seleção e utilização de técnicas e estratégias para melhoria do rendimento escolar;\nXXIII- realizarencontros com os professores para troca de experiências e proposições de alternativas que visem a melhoria do ensino;\nXXIV- orientar e acompanhar a recuperação e o processo de avaliação do rendimento escolar;\nXXV- assessorar o diretor pedagógico na elaboração de todas as atividades pedagógicas do Colégio.",
      "Seção V\nDo Corpo Docente.",
      "Art. 279. É dever do professor:",
      "I - elaborar e executar a programação referente à regência de classe e atividades afins;\nII - executar atividades de recuperação e de exame final de alunos nos períodos previstos no calendário escolar;\nIII - participar do conselho de classe;\nIV - participar de atividades educativas promovidas pela comunidade escolar;\nV - executar e manter atualizados os registros relativos às suas atividades e fornecer informações conforme as normas estabelecidas;\nVI - responsabilizar-se pela utilização, manutenção e conservação de equipamentos e instrumentos em uso;\nVII - comparecer pontualmente às aulas e às reuniões para as quais tenha sido convocado;\nVIII - seguir a abordagem teórica utilizada pelo Colégio;\nIX - proceder a avaliação do rendimento escolar dos alunos em termos de objetivos propostos, como processo contínuo de acompanhamento da aprendizagem;\nX - corrigir, com o devido cuidado e dentro dos prazos estabelecidos, as provas e trabalhos escolares;\nXI - comentar com os alunos as provas e trabalhos escolares, esclarecendo erros e os critérios adotados;\nXII - registrar os resultados das avaliações, obtidos durante o processo de ensino-aprendizagem, de forma que possam ser levados ao conhecimento dos alunos, seus pais, e demais interessados;\nXIII - entregar na secretaria escolar em tempo determinado pela direção e coordenação pedagógica, os diários de classe;\nXIV - escriturar o diário de classe, observando rigorosamente as normas pertinentes;\nXV - manter a disciplina em sala de aula e colaborar para a ordem e disciplina geral do Colégio;\nXVI - conhecer as normas educacionais vigentes;\nXVII - cumprir as atividades inerentes ao exercício de sua função;\nXVIII - comparecer ao local de trabalho com assiduidade e pontualidade, executando as tarefas com eficiência, zelo e presteza;\nXIX - apresentar-se ao serviço devidamente e discretamente trajado;\nXX - manter espírito de cooperação e solidariedade com a comunidade;\nXXI - acatar as orientações dos superiores e tratar com respeito e urbanidade os colegas e os usuários dos serviços educacionais;\nXXII - comunicar à autoridade imediata as irregularidades de que tiver conhecimento na sua área de atuação;\nXXIII - zelar pelo uso adequado do material de consumo e permanente, conservando o que for confiado a sua guarda e uso;\nXXIV - analisar juntamente com a coordenação pedagógica as ementas curriculares dos alunos, a fim de definir as adaptações necessárias e o aproveitamento de estudos, quando for o caso;\nXXV - prestar assistência aos alunos que necessitam de estudos de adaptação;\nXXVI - garantir atendimento aos alunos que apresentam deficiência, transtornos globais do desenvolvimento, altas habilidades ou superdotação.",
      "Seção VI\nDos Serviços Auxiliares",
      "Subseção I\nDo Auxiliar Docente",
      "Art. 280. É dever do auxiliar docente:",
      "I- ser assíduo e pontual;\nII- desempenhar com zelo e presteza os trabalhos de que for incumbido;\nIII- receber, registrar, guardar, distribuir e controlar documentos e outros materiais dirigidos ao corpo docente, relacionados à sua área de atuação;\nIV- atender o corpo docente, prestando-lhes informações nos assuntos relativos à sua área de atuação;\nV- apresentar-se convenientemente trajado em serviço;\nVI- tratar com urbanidade os integrantes da comunidade escolar;\nVII- zelar pela economia do material e pela conservação do que for confiado a sua guarda ou utilização;\nVIII- executar outros encargos que lhe forem conferidos pelos seus superiores hierárquicos.",
      "Subseção II\nDo Auxiliar Administrativo",
      "Art. 281. É dever do auxiliar administrativo:",
      "I- ser assíduo e pontual;    \nII- atender telefones, realizar ligações telefônicas que lhe forem solicitadas à serviço;\nIII- auxiliar nas tarefas da secretaria quando solicitado pelos diretores administrativo e pedagógico, coordenadores pedagógicos e pelo secretário escolar;\nIV- Manter o espaço de leitura organizado;\nV- desempenhar com zelo e presteza os trabalhos que lhe forem designados;\nVI- receber, registrar, guardar, distribuir e controlar processos e outros documentos dirigidos ao Colégio ou dele emanados, relacionados a sua área de atuação;\nVII- redigir documentos, relatórios, preparar processos e todo expediente para despacho da direção quando necessário;\nVIII- atender aos interessados prestando-lhes informações nos assuntos relativos à sua área de atuação;\nIX- apresentar-se discretamente e convenientemente trajado em serviço;\nX- tratar com urbanidade os integrantes da comunidade escolar;\nXI- zelar pela economia do material e pela conservação do que for confiado a sua guarda ou utilização;\nXII- executar todo tipo de tarefa/encargos que se fizerem necessários para o bom andamento do Colégio que lhe forem conferidos por seus superiores hierárquicos.",
      "Seção III\nDa Inspetoria de alunos",
      "Art. 282. São deveres do inspetor de alunos:",
      "I- cumprir o horário de trabalho determinado pela direção; \nII- desempenhar com zelo e presteza os trabalhos que lhe forem incumbidos; \nIII- guardar sigilo sobre os assuntos da repartição e, especialmente, sobre os despachos, decisões e providências; \nIV- tratar com urbanidade os colegas de trabalho e superiores hierárquicos;\nV- apresentar-se convenientemente trajado em serviço;\nVI- auxiliar na realização de solenidades, festas escolares e outras atividades realizadas neste Colégio;\nVII- conhecer e cumprir os termos deste regimento escolar;\nVIII- zelar pelo uso racional do material sob sua guarda e utilização;\nIX- atender com presteza e comunicar à direção quando houver alguma ocorrência envolvendo alunos;\nX- zelar pela disciplina geral dos alunos, dentro do Colégio; \nXI- inspecionar os alunos dentro e fora das salas de aula e em todo o Colégio;\nXII- prestar assistência, no que lhe couber, ao aluno que adoecer ou sofrer qualquer acidente, comunicando o fato de forma imediata à autoridade escolar competente;\nXIII- levar ao conhecimento da direção, os casos de infração, indisciplina e irregularidades;\nXIV- encaminhar à coordenação pedagógica o aluno retardatário e não permitir, antes de findar os trabalhos escolares, a saída de alunos sem a devida autorização;\nXV- verificar a autorização para ingresso e vedar a entrada de pessoas não autorizadas no recinto do Colégio; \nXVI- impedir a entrada de alunos nas salas de aula antes do início das mesmas;\nXVII- manter a disciplina no pátio e nos corredores deste Colégio.",
      "Seção IV\nDo auxiliar de Serviços Gerais e da Zeladoria",
      "Art. 283. É dever do auxiliar de serviços gerais e zeladoria:",
      "I- ser assíduo e pontual;\nII- executar a limpeza das dependências do Colégio;\nIII- acatar e executar as ordens da direção;\nIV- usar de solicitude, moderação e delicadeza no trato com todos os integrantes da comunidade escolar;\nV- cumprir o horário de trabalho determinado pela direção do Colégio;\nVI- zelar pela conservação do mobiliário e dos equipamentos do Colégio;\nVII- usar adequadamente os materiais destinados à limpeza do Colégio;\nVIII- transportar pequenas encomendas;\nIX- usar de solicitude, moderação e delicadeza no trato com os integrantes da comunidade escolar.",
      "CAPÍTULO III\nDAS PROIBIÇÕES DOS CORPOS PEDAGÓGICO E",
      "TÉCNICO-ADMINISTRATIVO",
      "Art. 284. É proibido aos corpos pedagógico, técnico-administrativo:",
      "I- retirar sem prévia anuência da autoridade competente, qualquer documento ou objeto existente no Colégio;\nII- entreter-se, durante as horas de trabalho, em palestras, leituras ou outras atividades estranhas ao serviço;\nIII- deixar de comparecer ao serviço ou retirar-se de seu local de trabalho sem motivo plenamente justificado;\nIV- tratar de interesses particulares neste Colégio;\nV- coagir ou aliciar subordinados com objetivo de natureza político-partidária;\nVI- receber propinas, comissões ou vantagens de qualquer espécie, em razão de suas atribuições legais;\nVII- ferir a susceptibilidade do aluno no que diz respeito às suas convicções político-religiosas, evitando qualquer tipo de discriminação ou preconceito;\nVIII- falar, escrever ou publicar artigos em nome do Colégio, sem que para isso esteja autorizado pela direção;\nIX- apresentar-se ao serviço sob efeito de bebidas alcoólicas ou substâncias que produzam dependência física ou psíquica;\nX- suspender as aulas ou dispensar os alunos antes do horário previsto para seu término sem que haja ordem superior.\nXI- usar aparelho celular sem fins pedagógicos ou similares durante o período de trabalho.",
      "CAPÍTULO IV\nDAS PENALIDADES AOS CORPOS PEDAGÓGICO E",
      "TÉCNICO-ADMINISTRATIVO",
      "Art. 285. As penalidades ao corpo pedagógico, técnico-administrativo, docente, auxiliar e zeladoria serão aplicadas em conformidade com a Consolidação da Lei Trabalhista.",
      "Parágrafo único. Aos integrantes dos corpos pedagógico e técnico-administrativo em qualquer situação, cabe o direito de defesa perante o órgão competente.",
      "CAPÍTULO V\nDO CORPO DISCENTE",
      "Art. 286. O corpo discente é constituído por todos os alunos matriculados neste Colégio."
    ]
  },
  {
    "id": "título-x",
    "title": "TÍTULO X",
    "subtitle": "DA SAÚDE DOS ALUNOS",
    "paragraphs": [
      "Art. 287. Constitui-se em obrigação dos pais ou responsável comunicar à direção escolar toda patologia, moléstia, doença, limitação dos sentidos, deficiência física, psíquica ou orgânica, sendo assim, o Colégio não se responsabilizará pelas consequências advindas de tal omissão.",
      "Art. 288. O Colégio manterá em seus arquivos as informações necessárias ao atendimento em caso de doenças ou acidentes.",
      "Parágrafo único. A direção escolar comunicará aos responsáveis todo acidente, distúrbio ou indisposição relacionados aos alunos e verificados durante o período de permanência na instituição.\nArt. 289. Não será permitida a entrada de alunos que apresentem sintomas evidentes de doenças infectocontagiosas e ficará a cargo da direção escolar ou da coordenação pedagógica a responsabilidade pela dispensa.",
      "Parágrafo único. Quando evidenciada doença infectocontagiosa, o aluno somente poderá voltar a frequentar o Colégio mediante a apresentação de declaração médica afirmando a liberação.\nArt. 290. A conduta médica do Colégio é alopática, mas outras serão respeitadas desde que acordadas explicitamente com os pais ou responsável.",
      "Art. 291. Para serem administrados, todos os medicamentos deverão ser encaminhados ao colégio, acompanhados de prescrição médica, devidamente etiquetados com o nome completo do aluno, a dosagem e os horários, escritos de forma legível.",
      "§ 1º Toda medicação deverá ser armazenada na sala da direção escolar e ficará expressamente proibido que permaneça em sala de aula.\n§ 2º Os processos de inalação, aplicação de insulina e o manuseio de aparelhos respiratórios, dentre outros procedimentos específicos da área da saúde, não poderão ser realizados pelos profissionais do Colégio.\n § 3º Será expressamente proibida a administração de medicamento sem prescrição médica.\nArt. 292. Em situações de emergência que necessitem de pronto atendimento médico, os pais ou responsável serão convocados imediatamente."
    ]
  },
  {
    "id": "título-xi",
    "title": "TÍTULO XI",
    "subtitle": "DAS DISPOSIÇÕES GERAIS",
    "paragraphs": [
      "Art. 293. Este regimento escolar tem a finalidade de resguardar os direitos de toda a comunidade escolar, tanto a interna quanto a externa.",
      "Art. 294. Este Colégio respeitará a diversidade, sem discriminação de qualquer espécie, seja de raça, etnia, cor, religião, credo, nacionalidade, grupo social, por opção política ou de gênero entre outros.",
      "§1º Aos alunos, professores e funcionários com deficiência será assegurado a igualdade de tratamento e condições com as demais integrantes da comunidade escolar.\n§2º Aos alunos com deficiência, transtornos globais do desenvolvimento, altas habilidades ou superdotação será assegurado à acessibilidade ao conhecimento, em igualdade de condições com os demais alunos.\n§3º Todo e qualquer ato de discriminação praticados dentro do recinto escolar, deverá ser comunicado à direção do Colégio, a quem cabe apurar os fatos e adotar as medidas cabíveis previstas neste regimento escolar e na legislação em vigor.\nArt. 295. A equipe pedagógica do Colégio, sob a orientação da direção escolar, terá a incumbência de informar ao pai e à mãe, conviventes ou não com seus filhos, e, se for o caso, aos responsáveis legais sobre a frequência e o rendimento dos alunos, bem como sobre a execução da Proposta Pedagógica e do regimento escolar do Colégio.",
      "Art. 296. Nenhuma publicação oficial ou que envolva responsabilidade do Colégio poderá ser feita sem autorização prévia da entidade mantenedora.",
      "Art. 297. O Colégio poderá promover eventos, de qualquer natureza, visando à preservação e divulgação das tradições cívicas, desportivas ou culturais da região.",
      "Parágrafo único. As comemorações e promoções das turmas de formandos, só serão realizadas com a devida autorização da direção, após anuência da entidade mantenedora.                                                \nArt. 298. Este Colégio não se responsabilizará por objetos de valor, não necessários ao processo de ensino-aprendizagem, trazidos pelos alunos para o ambiente escolar, tais como dinheiro, joias, relógios, aparelhos celulares, jogos de videogame, MP3, MP4 entre outros.",
      "Art. 299. Este Colégio desenvolve projeto de alimentação saudável, sendo proibido comercializar na cantina escolar, refrigerantes e salgados industrializados ou fritos.",
      "Art. 300. Os casos omissos e as dúvidas surgidas na aplicação deste regimento escolar, serão resolvidos pela entidade mantenedora.",
      "Art. 301. Este regimento escolar poderá ser modificado sempre que houver necessidade de alterações do interesse do Colégio ou da entidade mantenedora e quando vier a colidir com a legislação vigente, sendo as modificações previamente submetidas à aprovação da entidade mantenedora e à apreciação do órgão competente.",
      "Art. 302. A legislação de ensino que modifique disposições deste regimento terá aplicação imediata e automática a este documento, sendo a ele, imediatamente, incorporada.",
      "Art. 303. Este regimento escolar foi devidamente aprovado pela direção deste Colégio e entrará em vigor a partir do ano de sua aprovação, revogando todas e quaisquer disposições anteriores ou contrárias ao mesmo.",
      "Campo Grande MS, 30 de junho de 2026.\nAprovado pela Ata 01/2026, de 30/06/2026"
    ]
  }
];

export default function RegimentoInternoPage() {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeTitle, setActiveTitle] = React.useState('título-i');

  // Filter content by search query
  const filteredData = React.useMemo(() => {
    if (!searchTerm.trim()) return regimentoData;
    const term = searchTerm.toLowerCase();

    return regimentoData.map(sec => {
      const matchTitle = sec.title.toLowerCase().includes(term) || sec.subtitle.toLowerCase().includes(term);
      const filteredParagraphs = sec.paragraphs.filter(p => p.toLowerCase().includes(term));

      if (matchTitle || filteredParagraphs.length > 0) {
        return {
          ...sec,
          paragraphs: matchTitle ? sec.paragraphs : filteredParagraphs
        };
      }
      return null;
    }).filter(Boolean) as typeof regimentoData;
  }, [searchTerm]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Helper to render structured content lines into rich UI components
  const renderStructuredContent = (paragraphText: string) => {
    const lines = paragraphText.split('\n').map(l => l.trim()).filter(Boolean);

    return (
      <div className="space-y-3 my-3">
        {lines.map((line, lineIdx) => {
          // 1. CAPÍTULO / Seção / Subseção
          if (line.startsWith("CAPÍTULO") || line.startsWith("Seção") || line.startsWith("Subseção")) {
            return (
              <div key={lineIdx} className="my-6 pt-6 border-t border-slate-200/80 dark:border-slate-800">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-sm tracking-wide shadow-xs border border-slate-200/60 dark:border-slate-700/60">
                  <Bookmark className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span>{line}</span>
                </div>
              </div>
            );
          }

          // 2. Artigo (Art. X)
          const artMatch = line.match(/^(Art\.\s*\d+\.º?|Art\.\s*\d+)(.*)/);
          if (artMatch) {
            const artLabel = artMatch[1];
            const artBody = artMatch[2];
            return (
              <div key={lineIdx} className="my-4 p-4 md:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:border-blue-300 dark:hover:border-blue-700 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-extrabold font-mono bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/80 shrink-0 w-fit">
                    {artLabel}
                  </span>
                  <span className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed text-sm md:text-base">
                    {artBody}
                  </span>
                </div>
              </div>
            );
          }

          // 3. Parágrafo único / § Xº
          if (line.startsWith("Parágrafo único") || line.startsWith("§")) {
            const firstDotIndex = line.indexOf('.');
            const hasDot = firstDotIndex !== -1;
            const prefix = hasDot ? line.substring(0, firstDotIndex + 1) : line;
            const restText = hasDot ? line.substring(firstDotIndex + 1) : '';

            return (
              <div key={lineIdx} className="my-3 ml-2 sm:ml-4 p-4 rounded-r-2xl border-l-4 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-slate-800 dark:text-slate-200 text-sm leading-relaxed">
                <span className="font-bold text-indigo-900 dark:text-indigo-300 mr-2">
                  {prefix}
                </span>
                <span>{restText}</span>
              </div>
            );
          }

          // 4. List Items (I -, II -, a), b))
          const listMatch = line.match(/^([IVXLC]+\s*[-–]|§\s*\d+º?|[a-z]\))(.*)/);
          if (listMatch) {
            const bullet = listMatch[1];
            const rest = listMatch[2];
            return (
              <div key={lineIdx} className="my-2 ml-3 sm:ml-6 pl-4 py-2 border-l-2 border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50/30 dark:hover:bg-slate-800/40 transition-colors rounded-r-xl flex items-start gap-3 text-sm md:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
                <span className="font-bold text-blue-600 dark:text-blue-400 font-mono shrink-0 min-w-[28px] text-xs pt-0.5">
                  {bullet}
                </span>
                <span className="flex-1">{rest}</span>
              </div>
            );
          }

          // 5. Default line (Dates, Signatures, intros)
          return (
            <p key={lineIdx} className="my-2.5 text-slate-700 dark:text-slate-300 leading-relaxed text-sm md:text-base font-normal">
              {line}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans selection:bg-blue-100 selection:text-blue-900 w-full pb-16">
      
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Book className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                Regimento Interno
              </h1>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                COLÉGIO IMPACTO DE EF
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
              title="Imprimir Regimento"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <div className="bg-gradient-to-b from-blue-900 via-indigo-900 to-slate-900 text-white py-12 px-4 sm:px-6 lg:px-8 border-b border-slate-800 relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center relative z-10 space-y-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" /> Documento Oficial & Regulatório
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
            Regimento Escolar Interno
          </h1>
          <p className="text-sm sm:text-base text-blue-100/80 max-w-2xl mx-auto leading-relaxed">
            Instrumento jurídico-educacional que regulamenta a organização administrativa, didático-pedagógica e disciplinar do Colégio Impacto DE EF.
          </p>

          {/* Live Search Input */}
          <div className="pt-4 max-w-xl mx-auto">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Pesquisar por artigo, direitos, deveres, faltas, proibições..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-10 py-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder-blue-200/60 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white/15 transition-all shadow-lg"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded-lg"
                >
                  Limpar
                </button>
              )}
            </div>
            {searchTerm && (
              <p className="text-xs text-blue-200 mt-2">
                Exibindo resultados para &quot;{searchTerm}&quot; ({filteredData.length} seção(ões) encontrada(s))
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Horizontal Quick Title Selector (Mobile + Desktop) */}
      <div className="sticky top-16 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs py-2.5 px-4 sm:px-6 lg:px-8 overflow-x-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto flex items-center gap-2 min-w-max">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 shrink-0 mr-2 flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" /> Ir para:
          </span>
          {regimentoData.map((sec) => (
            <a
              key={sec.id}
              href={`#${sec.id}`}
              onClick={() => setActiveTitle(sec.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                activeTitle === sec.id
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700'
              }`}
            >
              {sec.title}
            </a>
          ))}
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start relative">

          {/* Desktop Left Sidebar Navigation */}
          <aside className="hidden lg:block w-72 shrink-0 sticky top-36">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" /> Sumário Geral
              </h2>
              <div className="overflow-y-auto max-h-[calc(100vh-12rem)] pr-2 space-y-1 custom-scrollbar">
                {regimentoData.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    onClick={() => setActiveTitle(section.id)}
                    className={`group flex flex-col p-2.5 rounded-xl text-xs transition-all border ${
                      activeTitle === section.id
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold border-blue-200/80 dark:border-blue-800'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 border-transparent'
                    }`}
                  >
                    <span className="font-extrabold">{section.title}</span>
                    <span className="text-[11px] font-medium opacity-75 truncate">{section.subtitle}</span>
                  </a>
                ))}
              </div>
            </div>
          </aside>

          {/* Content Document Viewer */}
          <main className="flex-1 min-w-0 w-full space-y-12">
            {filteredData.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm">
                <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Nenhum resultado encontrado</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Não encontramos nenhum artigo ou seção correspondente a &quot;{searchTerm}&quot;.
                </p>
                <button
                  onClick={() => setSearchTerm('')}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors"
                >
                  Limpar busca
                </button>
              </div>
            ) : (
              filteredData.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-36 bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 md:p-10 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all"
                >
                  {/* Title Header */}
                  <div className="mb-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold uppercase tracking-widest bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 mb-1">
                        {section.title}
                      </span>
                      <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                        {section.subtitle}
                      </h2>
                    </div>
                  </div>

                  {/* Section Paragraphs */}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {section.paragraphs.map((pText, pIdx) => (
                      <div key={pIdx} className="py-2">
                        {renderStructuredContent(pText)}
                      </div>
                    ))}
                  </div>
                </section>
              ))
            )}

            {/* Document Signature Footer */}
            <div className="bg-slate-900 text-slate-300 rounded-3xl p-8 text-center space-y-3 shadow-lg border border-slate-800">
              <Book className="w-8 h-8 text-blue-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">COLÉGIO IMPACTO DE EF</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                CNPJ nº 04.395.789/0001-88 — Rua Alagoas, n.º 1081, Vila Suíça, Campo Grande, MS.
              </p>
              <div className="pt-4 border-t border-slate-800 text-xs text-slate-400 font-mono">
                <p>Campo Grande MS, 30 de junho de 2026.</p>
                <p className="text-blue-400 font-semibold mt-1">Aprovado pela Ata 01/2026, de 30/06/2026</p>
              </div>
            </div>
          </main>

        </div>
      </div>

      {/* Floating Scroll to Top */}
      <button
        onClick={scrollToTop}
        className="fixed bottom-6 right-6 z-50 p-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-600/30 transition-all cursor-pointer hover:scale-105 active:scale-95"
        title="Voltar ao topo"
      >
        <ArrowUp className="w-5 h-5" />
      </button>

    </div>
  );
}
