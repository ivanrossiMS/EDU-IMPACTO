export type PresStatus = 'P' | 'F' | 'J' | 'A' | '-'

export interface TempoConfig {
  id: string
  label: string
  horario: string
}

export interface ScheduleResult {
  segmento: string
  turno: string
  tempos: TempoConfig[]
}

export function getTurmaSchedule(turma: any): ScheduleResult {
  const seg = turma?.dados?.segmento || '';
  const turnoRaw = (turma?.turno || turma?.dados?.turno || 'matutino').toLowerCase();
  const nome = (turma?.nome || '').toLowerCase();
  
  // "QUando a turma do periodo é integral deve considerar a logica do tempo matutino"
  // "1- somente manha"
  const isVespertino = turnoRaw === 'vespertino';
  const turnoFormatado = isVespertino ? 'Vespertino' : 'Matutino';
  
  if (seg === 'Ensino Médio' || nome.includes('médio') || nome.includes('série')) {
    // Médio é sempre matutino nas regras passadas
    return {
      segmento: 'Ensino Médio',
      turno: turnoFormatado,
      tempos: [
        { id: '1', label: '1º tempo', horario: '7h - 7h50' },
        { id: '2', label: '2º tempo', horario: '7h50 - 8h40' },
        { id: '3', label: '3º tempo', horario: '8h55 - 9h45' },
        { id: '4', label: '4º tempo', horario: '9h45 - 10h35' },
        { id: '5', label: '5º tempo', horario: '10h50 - 11h40' },
        { id: '6', label: '6º tempo', horario: '11h40 - 12h30' },
      ]
    }
  }
  
  if (seg === 'Ensino Fundamental II' || nome.includes('fundamental ii') || nome.includes('fundamental 2') || /^[6-9]º/.test(nome)) {
    return {
      segmento: 'Ensino Fundamental II',
      turno: turnoFormatado,
      tempos: isVespertino ? [
        { id: '1', label: '1º tempo', horario: '13h - 13h50' },
        { id: '2', label: '2º tempo', horario: '13h50 - 14h40' },
        { id: '3', label: '3º tempo', horario: '14h40 - 15h30' },
        { id: '4', label: '4º tempo', horario: '15h50 - 16h40' },
        { id: '5', label: '5º tempo', horario: '16h40 - 17h30' },
      ] : [
        { id: '1', label: '1º tempo', horario: '7h - 7h50' },
        { id: '2', label: '2º tempo', horario: '7h50 - 8h40' },
        { id: '3', label: '3º tempo', horario: '8h40 - 9h30' },
        { id: '4', label: '4º tempo', horario: '9h50 - 10h40' },
        { id: '5', label: '5º tempo', horario: '10h40 - 11h30' },
      ]
    }
  }

  if (seg === 'Ensino Fundamental I' || nome.includes('fundamental i') || nome.includes('fundamental 1') || /^[1-5]º/.test(nome)) {
    return {
      segmento: 'Ensino Fundamental I',
      turno: turnoFormatado,
      tempos: isVespertino ? [
        { id: '1', label: '1º tempo', horario: '13h - 14h' },
        { id: '2', label: '2º tempo', horario: '14h - 15h' },
        { id: '3', label: '3º tempo', horario: '15h20 - 16h20' },
        { id: '4', label: '4º tempo', horario: '16h20 - 17h20' },
      ] : [
        { id: '1', label: '1º tempo', horario: '7h - 8h' },
        { id: '2', label: '2º tempo', horario: '8h - 9h' },
        { id: '3', label: '3º tempo', horario: '9h20 - 10h20' },
        { id: '4', label: '4º tempo', horario: '10h20 - 11h20' },
      ]
    }
  }

  if (seg === 'Educação Infantil' || nome.includes('infantil') || nome.includes('maternal') || nome.includes('jardim') || nome.includes('pre') || nome.includes('pré')) {
    return {
      segmento: 'Educação Infantil',
      turno: turnoFormatado,
      tempos: isVespertino ? [
        { id: '1', label: '1º tempo', horario: '13h - 14h' },
        { id: '2', label: '2º tempo', horario: '14h - 15h' },
        { id: '3', label: '3º tempo', horario: '15h - 16h' },
        { id: '4', label: '4º tempo', horario: '16h - 17h' },
      ] : [
        { id: '1', label: '1º tempo', horario: '7h - 8h' },
        { id: '2', label: '2º tempo', horario: '8h - 9h' },
        { id: '3', label: '3º tempo', horario: '9h - 10h' },
        { id: '4', label: '4º tempo', horario: '10h - 11h' },
      ]
    }
  }

  // Padrão default (Fundamental I)
  return {
    segmento: 'Ensino Fundamental I',
    turno: turnoFormatado,
    tempos: [
      { id: '1', label: '1º tempo', horario: '7h - 8h' },
      { id: '2', label: '2º tempo', horario: '8h - 9h' },
      { id: '3', label: '3º tempo', horario: '9h20 - 10h20' },
      { id: '4', label: '4º tempo', horario: '10h20 - 11h20' },
    ]
  }
}

export function calcularFrequenciaDia(tempos: Record<string, PresStatus>, segment: string) {
  const isInfantilOuFundI = segment === 'Educação Infantil' || segment === 'Ensino Fundamental I';
  const temposEfetivos = { ...tempos };
  
  if (isInfantilOuFundI) {
    // "Se o aluno faltar consecutivamente no primeiro e segundo tempos, todos os tempos subsequentes são computados como ausências"
    if (tempos['1'] === 'F' && tempos['2'] === 'F') {
      Object.keys(temposEfetivos).forEach(k => {
        if (temposEfetivos[k] !== 'J') temposEfetivos[k] = 'F';
      });
    } else if (tempos['1'] === 'F') {
      // "Se o aluno faltar apenas no primeiro tempo e estiver presente no restante, a ausência é desconsiderada (contabiliza como Presente)."
      const hasOtherF = Object.keys(tempos).some(k => k !== '1' && tempos[k] === 'F');
      if (!hasOtherF) {
        temposEfetivos['1'] = 'P'; // Primeiro tempo vira presença
      }
    }
    
    // Na métrica de dia completo: ou leva falta de 1 dia ou leva presença de 1 dia.
    const statuses = Object.values(temposEfetivos);
    const temFalta = statuses.includes('F');
    const temJustificada = statuses.includes('J');
    
    const diaFalta = temFalta;
    const diaJustificado = !temFalta && temJustificada;
    
    return {
      presente: !diaFalta,
      justificativa: diaJustificado ? 'Justificada' : '',
      faltasContabilizadas: diaFalta ? 1 : 0,
      // Se não for falta e tiver justificativa, considera dia justificado
      justificadasContabilizadas: diaJustificado ? 1 : 0,
      totalTemposContabilizados: 1, // Por dia
      temposEfetivos
    };
  } else {
    // Ensino Fundamental II e Ensino Médio
    // "Regra de Bloqueio Consecutivo: Se o aluno tiver falta tanto no 1º quanto no 2º tempo, todos os tempos subsequentes daquele dia são automaticamente marcados como falta."
    if (tempos['1'] === 'F' && tempos['2'] === 'F') {
      Object.keys(temposEfetivos).forEach(k => {
        if (temposEfetivos[k] !== 'J') temposEfetivos[k] = 'F';
      });
    }
    
    let faltasContabilizadas = 0;
    let justificadasContabilizadas = 0;
    
    Object.values(temposEfetivos).forEach(s => {
      if (s === 'F') {
        faltasContabilizadas++;
      } else if (s === 'J') {
        justificadasContabilizadas++;
      }
    });
    
    // "Qualquer tempo marcado como Justificada (J) é desconsiderado na contagem de faltas... reduz proporcionalmente a frequência"
    const temposComuns = Object.keys(temposEfetivos).length;
    // Remove os tempos justificados do total que vai pro divisor. Ex: 5 tempos, 1 J = 4 totais contabilizados
    const totalTemposContabilizados = Math.max(1, temposComuns - justificadasContabilizadas);
    
    const hasF = Object.values(temposEfetivos).includes('F');
    const hasJ = Object.values(temposEfetivos).includes('J');
    
    return {
      presente: !hasF,
      justificativa: (hasJ && !hasF) ? 'Justificada' : '',
      faltasContabilizadas,
      justificadasContabilizadas,
      totalTemposContabilizados,
      temposEfetivos
    };
  }
}

/**
 * Returns the 0-based index of the first present period based on arrival time in minutes since midnight.
 */
export function getFirstPresentTempoIndex(arrivalMinutes: number, segment: string, turno: string = 'Matutino'): number {
  const isVespertino = turno === 'Vespertino';
  
  if (isVespertino) {
    // "até as 13h20 como presente se entrar apos 13h20 até as 13h50 falta primeiro tempo e presente nos outros tempos"
    if (arrivalMinutes <= 13 * 60 + 20) return 0; // Até 13:20
    if (arrivalMinutes <= 13 * 60 + 50) return 1; // Até 13:50
    
    if (segment === 'Ensino Fundamental II') {
      if (arrivalMinutes <= 14 * 60 + 40) return 2;
      if (arrivalMinutes <= 15 * 60 + 50) return 3;
      return 4;
    }
    
    if (segment === 'Educação Infantil' || segment === 'Ensino Fundamental I') {
      if (arrivalMinutes <= 15 * 60 + 0) return 2;
      return 3;
    }
    
    return 2;
  } else {
    // Matutino ou Integral
    // "até as 7h20 como presente se entrar apos 7h20 até as 7h50 falta primeiro tempo e presente nos outros tempos."
    if (arrivalMinutes <= 7 * 60 + 20) return 0; // Até 7:20
    if (arrivalMinutes <= 7 * 60 + 50) return 1; // Até 7:50
    
    if (segment === 'Ensino Médio') {
      if (arrivalMinutes <= 8 * 60 + 55) return 2;
      if (arrivalMinutes <= 9 * 60 + 45) return 3;
      if (arrivalMinutes <= 10 * 60 + 50) return 4;
      return 5;
    }
    
    if (segment === 'Ensino Fundamental II') {
      if (arrivalMinutes <= 8 * 60 + 40) return 2;
      if (arrivalMinutes <= 9 * 60 + 50) return 3;
      return 4;
    }
    
    if (segment === 'Ensino Fundamental I' || segment === 'Educação Infantil') {
      if (arrivalMinutes <= 9 * 60 + 0) return 2;
      return 3;
    }
    
    return 2;
  }
}
