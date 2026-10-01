import { ExamWizard } from '@/components/provas-online/ExamWizard'

export const metadata = {
  title: 'Nova Prova Online | IMPACTO-EDU',
  description: 'Assistente de criação de provas e avaliações online'
}

export default function NovaProvaPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 md:p-8">
      <ExamWizard isEditing={false} />
    </div>
  )
}
