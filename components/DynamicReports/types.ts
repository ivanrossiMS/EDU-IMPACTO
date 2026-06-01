export type ReportType = 'todos' | 'especifico';

export type FieldType = 'texto-curto' | 'unica-escolha';

export interface ReportField {
  id: string;
  type: FieldType;
  label: string;
  options?: string[]; // for unica-escolha
}

export interface ReportSection {
  id: string;
  title: string;
  fields: ReportField[];
}

export interface ReportTemplate {
  id: string;
  name: string;
  sections: ReportSection[];
}

export interface Student {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface ReportPayload {
  templateId: string;
  values: Record<string, Record<string, any>>; // studentId -> fieldId -> value
}

// --- MOCK DATA ---

export const MOCK_STUDENTS: Student[] = [
  { id: 's1', name: 'Ana Silva', avatarUrl: 'https://i.pravatar.cc/150?u=s1' },
  { id: 's2', name: 'Bruno Costa', avatarUrl: 'https://i.pravatar.cc/150?u=s2' },
  { id: 's3', name: 'Carlos Souza', avatarUrl: 'https://i.pravatar.cc/150?u=s3' },
  { id: 's4', name: 'Diana Lima', avatarUrl: 'https://i.pravatar.cc/150?u=s4' }
];

export const MOCK_TEMPLATES: ReportTemplate[] = [
  {
    id: 't1',
    name: 'Relatório Diário (Infantil)',
    sections: [
      {
        id: 'sec1',
        title: 'Alimentação e Sono',
        fields: [
          { id: 'f1', type: 'unica-escolha', label: 'Almoço', options: ['Comeu tudo', 'Comeu pouco', 'Não comeu'] },
          { id: 'f2', type: 'unica-escolha', label: 'Sono', options: ['Dormiu bem', 'Agitado', 'Não dormiu'] }
        ]
      },
      {
        id: 'sec2',
        title: 'Comportamento',
        fields: [
          { id: 'f3', type: 'texto-curto', label: 'Observações de comportamento' }
        ]
      }
    ]
  }
];
