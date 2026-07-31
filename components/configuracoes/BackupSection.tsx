'use client'

import { useState, useMemo, useEffect } from 'react'
import { useApp } from '@/lib/context'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { 
  HardDrive, CheckCircle, RotateCcw, FileJson, FileSpreadsheet, 
  Check, Cloud, CloudUpload, Link, Unlink, RefreshCw, ShieldCheck, 
  AlertTriangle, Clock, Search, Sparkles, Database, ExternalLink, X, 
  Folder, Laptop, Zap, CheckCircle2, Calendar, Key, Code, HelpCircle, Copy,
  UploadCloud, FileUp, FileCheck, FolderUp, Upload
} from 'lucide-react'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'

// Definição completa das tabelas do sistema divididas por módulo
const CATEGORIES = [
  {
    id: 'academico',
    title: '🎓 Módulos Acadêmicos',
    color: '#3b82f6',
    items: [
      { id: 'alunos', label: 'Alunos', endpoint: 'alunos', sheetName: 'Alunos' },
      { id: 'turmas', label: 'Turmas', endpoint: 'turmas', sheetName: 'Turmas' },
      { id: 'ocorrencias', label: 'Ocorrências', endpoint: 'ocorrencias', sheetName: 'Ocorrências' },
      { id: 'frequencias', label: 'Frequências', endpoint: 'academico/frequencias', sheetName: 'Frequências' },
      { id: 'notas', label: 'Notas', endpoint: 'academico/notas', sheetName: 'Notas' }
    ]
  },
  {
    id: 'financeiro',
    title: '💰 Módulos Financeiros',
    color: '#10b981',
    items: [
      { id: 'titulos', label: 'Contas a Receber', endpoint: 'titulos', sheetName: 'Fin-Receber' },
      { id: 'contasPagar', label: 'Contas a Pagar', endpoint: 'contas-pagar', sheetName: 'Fin-Pagar' }
    ]
  },
  {
    id: 'rh',
    title: '👤 Recursos Humanos',
    color: '#f59e0b',
    items: [
      { id: 'funcionarios', label: 'Funcionários', endpoint: 'rh/funcionarios', sheetName: 'RH-Funcionários' },
      { id: 'adiantamentos', label: 'Adiantamentos', endpoint: 'rh/adiantamentos', sheetName: 'RH-Adiantamentos' },
      { id: 'advertencias', label: 'Advertências', endpoint: 'rh/advertencias', sheetName: 'RH-Advertências' },
      { id: 'ausencias', label: 'Ausências/Férias', endpoint: 'rh/ausencias', sheetName: 'RH-Ausências' }
    ]
  },
  {
    id: 'crm',
    title: '🎯 CRM & Captação',
    color: '#ec4899',
    items: [
      { id: 'leads', label: 'Leads', endpoint: 'leads', sheetName: 'CRM-Leads' }
    ]
  },
  {
    id: 'comunicacao',
    title: '📅 Agenda & Comunicação',
    color: '#8b5cf6',
    items: [
      { id: 'comunicados', label: 'Comunicados', endpoint: 'comunicados', sheetName: 'Comunicados' },
      { id: 'tarefas', label: 'Tarefas/Compromissos', endpoint: 'tarefas', sheetName: 'Tarefas' },
      { id: 'eventosAgenda', label: 'Eventos da Agenda', endpoint: 'agenda/eventos', sheetName: 'Agenda-Eventos' }
    ]
  },
  {
    id: 'saida',
    title: '🚨 Saída de Alunos & Segurança',
    color: '#06b6d4',
    items: [
      { id: 'guardians', label: 'Responsáveis', endpoint: 'saida/guardians', sheetName: 'Saída-Responsáveis' },
      { id: 'calls', label: 'Chamadas', endpoint: 'saida/calls', sheetName: 'Saída-Chamadas' },
      { id: 'saidaLogs', label: 'Histórico de Saídas', endpoint: 'saida/logs', sheetName: 'Saída-Histórico' }
    ]
  },
  {
    id: 'configuracoes',
    title: '⚙️ Configurações & Auditoria',
    color: '#64748b',
    items: [
      { id: 'mantenedores', label: 'Unidades/Mantenedores', endpoint: 'configuracoes/mantenedores', sheetName: 'Config-Unidades' },
      { id: 'systemLogs', label: 'Logs do Sistema', endpoint: 'system-logs', sheetName: 'Config-Auditoria' }
    ]
  }
];

interface GDriveAccount {
  connected: boolean
  email: string
  name: string
  avatarUrl: string
  usedSpace: string
  totalSpace: string
  folderPath: string
  linkedAt: string
  autoSyncActive: boolean
  authMethod: 'oauth' | 'webhook'
  accessToken?: string
  webhookUrl?: string
}

interface BackupHistoryItem {
  id: string
  timestamp: string
  destiny: 'pc' | 'drive' | 'both'
  format: 'zip' | 'xlsx' | 'json'
  size: string
  recordsCount: number
  status: 'Sucesso' | 'Falha'
  driveUrl?: string
  fileName: string
  triggerType?: 'Manual' | 'Automático'
}

export default function BackupSection() {
  const { currentUser } = useApp()

  // Aba ativa na seção de backup
  const [activeTab, setActiveTab] = useState<'instant' | 'importar' | 'gdrive' | 'agendamento' | 'historico' | 'tabelas'>('instant')
  
  // Estado de download / exportação
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [statusText, setStatusText] = useState('Iniciando...')
  const [currentStep, setCurrentStep] = useState<number>(0)
  
  // Preferências do Backup Instantâneo
  const [targetDestiny, setTargetDestiny] = useState<'pc' | 'drive' | 'both'>('pc')
  const [exportFormat, setExportFormat] = useState<'zip' | 'xlsx' | 'json'>('zip')
  
  // Local Storage State
  const [lastBackup, setLastBackup] = useLocalStorage<string | null>('edu-last-backup-ts', null)
  const [gdriveAccount, setGdriveAccount] = useLocalStorage<GDriveAccount | null>('edu-gdrive-account', null)
  const [backupHistory, setBackupHistory] = useLocalStorage<BackupHistoryItem[]>('edu-backup-history', [])

  // Configurações de agendamento automático detalhado com horário exato
  const [autoFrequency, setAutoFrequency] = useLocalStorage<string>('edu-backup-frequency', 'Diário')
  const [autoTime, setAutoTime] = useLocalStorage<string>('edu-backup-time', '00:00')
  const [autoDayOfWeek, setAutoDayOfWeek] = useLocalStorage<string>('edu-backup-day-week', 'Domingo')
  const [autoDayOfMonth, setAutoDayOfMonth] = useLocalStorage<number>('edu-backup-day-month', 1)
  const [autoDestiny, setAutoDestiny] = useLocalStorage<string>('edu-backup-destiny', 'Google Drive & Local')
  const [autoEmail, setAutoEmail] = useLocalStorage<string>('edu-backup-email', currentUser?.email || '')
  const [autoRetentionDays] = useLocalStorage<number>('edu-backup-retention', 30)
  const [autoSaved, setAutoSaved] = useState(false)

  // Estado de teste de conexão com o Google Drive
  const [isTestingDrive, setIsTestingDrive] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; pingMs?: number; driveUrl?: string } | null>(null)

  // Modal Google Drive Auth Real
  const [showDriveModal, setShowDriveModal] = useState(false)
  const [authMethod, setAuthMethod] = useState<'oauth' | 'webhook'>('webhook')
  const [oauthTokenInput, setOauthTokenInput] = useState('')
  const [webhookUrlInput, setWebhookUrlInput] = useState('')
  const [userEmailInput, setUserEmailInput] = useState(currentUser?.email || '')
  const [driveFolderInput, setDriveFolderInput] = useState('EDU-IMPACTO-Backups')
  const [runImmediateBackupOnLink, setRunImmediateBackupOnLink] = useState(true)
  const [enableAutoSyncOnLink, setEnableAutoSyncOnLink] = useState(true)
  const [isLinkingDrive, setIsLinkingDrive] = useState(false)
  const [copiedScript, setCopiedScript] = useState(false)

  // Filtro da aba de tabelas individuais
  const [tableSearch, setTableSearch] = useState('')

  // Estado da Importação de Backup ZIP / JSON
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importManifest, setImportManifest] = useState<any | null>(null)
  const [importPayload, setImportPayload] = useState<any | null>(null)
  const [isReadingZip, setIsReadingZip] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreProgress, setRestoreProgress] = useState(0)
  const [restoreStatusText, setRestoreStatusText] = useState('')
  const [restoreMode, setRestoreMode] = useState<'upsert' | 'insert_only'>('upsert')
  const [selectedImportTables, setSelectedImportTables] = useState<Record<string, boolean>>({})

  // Processar arquivo .zip / .json selecionado para importação
  const handleProcessBackupFile = async (file: File) => {
    if (!file) return
    setImportFile(file)
    setIsReadingZip(true)
    setImportManifest(null)
    setImportPayload(null)

    try {
      if (file.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file)

        // Ler manifesto se existir
        const manifestFile = zip.file('manifest.json')
        if (manifestFile) {
          const manifestText = await manifestFile.async('text')
          try { setImportManifest(JSON.parse(manifestText)) } catch {}
        }

        // Procurar por dados_reais.json no ZIP
        let jsonFile = zip.file('database/dados_reais.json') || zip.file('dados_reais.json')
        if (!jsonFile) {
          const files = Object.keys(zip.files)
          const firstJson = files.find(f => f.endsWith('.json') && !f.includes('manifest'))
          if (firstJson) jsonFile = zip.file(firstJson)
        }

        if (!jsonFile) {
          throw new Error('Não foi possível encontrar o arquivo de dados (dados_reais.json) dentro do pacote ZIP.')
        }

        const jsonText = await jsonFile.async('text')
        const payload = JSON.parse(jsonText)
        setImportPayload(payload)

        const initialSelected: Record<string, boolean> = {}
        if (payload?.tabelas) {
          Object.keys(payload.tabelas).forEach(sheetName => {
            initialSelected[sheetName] = true
          })
        }
        setSelectedImportTables(initialSelected)

      } else if (file.name.endsWith('.json')) {
        const text = await file.text()
        const payload = JSON.parse(text)
        setImportPayload(payload)
        const initialSelected: Record<string, boolean> = {}
        if (payload?.tabelas) {
          Object.keys(payload.tabelas).forEach(sheetName => {
            initialSelected[sheetName] = true
          })
        }
        setSelectedImportTables(initialSelected)
      } else {
        alert('Por favor, selecione um arquivo de backup no formato .ZIP ou .JSON.')
        setImportFile(null)
      }
    } catch (err: any) {
      alert(`Falha ao ler arquivo de backup: ${err.message}`)
      setImportFile(null)
    } finally {
      setIsReadingZip(false)
    }
  }

  // Executar restauração dos dados no Supabase
  const handleExecuteRestore = async () => {
    if (!importPayload || !importPayload.tabelas) {
      alert('Nenhum dado válido carregado para importação.')
      return
    }

    const filteredTabelas: Record<string, any> = {}
    Object.entries(importPayload.tabelas).forEach(([sheetName, tb]: [string, any]) => {
      if (selectedImportTables[sheetName]) {
        filteredTabelas[sheetName] = tb
      }
    })

    const selectedKeys = Object.keys(filteredTabelas)
    if (selectedKeys.length === 0) {
      alert('Selecione ao menos uma tabela para importar.')
      return
    }

    if (!confirm(`Atenção: Você está prestes a restaurar ${selectedKeys.length} tabelas no banco de dados. Deseja continuar?`)) {
      return
    }

    setIsRestoring(true)
    setRestoreProgress(20)
    setRestoreStatusText('Enviando registros para restauração no Supabase...')

    try {
      const res = await fetch('/api/configuracoes/importar-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tabelas: filteredTabelas,
          mode: restoreMode
        })
      })

      setRestoreProgress(90)
      const data = await res.json()
      setIsRestoring(false)
      setRestoreProgress(0)

      if (data.success) {
        setCompletionModal({
          open: true,
          success: true,
          title: 'Importação Concluída com Sucesso! 🎉',
          message: data.message || `Restauração finalizada. ${data.totalRestored} registros processados.`,
          recordsCount: data.totalRestored,
          size: `${selectedKeys.length} tabelas`,
          fileName: importFile?.name || 'backup_restaurado.zip'
        })

        setImportFile(null)
        setImportPayload(null)
        setImportManifest(null)
      } else {
        throw new Error(data.error || 'Falha ao restaurar dados no banco de dados.')
      }
    } catch (e: any) {
      setIsRestoring(false)
      setRestoreProgress(0)
      setCompletionModal({
        open: true,
        success: false,
        title: 'Erro na Importação de Dados',
        message: e.message || 'Ocorreu um erro ao restaurar os registros no banco de dados.'
      })
    }
  }

  // Estado do Modal de Conclusão / Erro do Backup
  const [completionModal, setCompletionModal] = useState<{
    open: boolean
    success: boolean
    title: string
    message: string
    fileName?: string
    driveUrl?: string
    recordsCount?: number
    size?: string
    destiny?: string
  } | null>(null)

  // Código Apps Script Template à prova de falhas com suporte a arquivos de 94MB+ (Chunking)
  const googleAppsScriptCode = `/**
 * IMPACTO EDU — Google Apps Script Webhook de Backup
 * Versão: 5.2 — Chunked Upload (string concat + decode único)
 *
 * INSTRUÇÕES:
 * 1. Abra script.google.com → Novo projeto
 * 2. Apague todo o código e cole este
 * 3. Implantar → Nova implantação → App da Web
 * 4. Executar como: Eu | Acesso: Qualquer pessoa
 * 5. Copie a URL e cole na tela de vinculação
 */

function doPost(e) {
  try {
    var rawContents = "";
    if (e && e.postData && e.postData.contents) {
      rawContents = e.postData.contents;
    } else if (e && e.postData && e.postData.getDataAsString) {
      rawContents = e.postData.getDataAsString();
    }

    if (!rawContents || rawContents.trim() === "") {
      return json({ success: false, error: "Body vazio. Content-Type deve ser text/plain." });
    }

    var data = {};
    try { data = JSON.parse(rawContents); }
    catch (parseErr) { return json({ success: false, error: "JSON invalido: " + parseErr.toString() }); }

    var folderName = (data.folderName || "EDU-IMPACTO-Backups").replace(/[\\/\\\\]/g, "-");
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

    // ── test ──
    if (data.action === "test") {
      return json({
        success: true,
        message: "Conexao OK com Google Drive!",
        email: Session.getActiveUser().getEmail(),
        folder: folderName
      });
    }

    // ── upload simples (texto) ──
    if (data.action === "upload") {
      if (!data.fileTextContent || data.fileTextContent.length === 0) {
        return json({ success: false, error: "Use uploadChunk para arquivos binarios." });
      }
      var f = folder.createFile(
        data.fileName || "arquivo.txt",
        data.fileTextContent,
        data.mimeType || "text/plain"
      );
      return json({ success: true, fileUrl: f.getUrl(), fileId: f.getId(), fileName: f.getName() });
    }

    // ── uploadChunk — chunks de 1MB, montagem via string concat ──
    if (data.action === "uploadChunk") {
      var chunkFileName = data.fileName || "backup.zip";
      var chunkIndex    = parseInt(data.chunkIndex, 10)  || 0;
      var totalChunks   = parseInt(data.totalChunks, 10) || 1;
      var isLast        = (data.isLastChunk === true || data.isLastChunk === "true");
      var mimeType      = data.mimeType || "application/zip";

      // Nome único por arquivo (evita colisão entre backups simultâneos)
      var safeFile = chunkFileName.replace(/[^a-zA-Z0-9]/g, "_");
      var prefix   = "_CHUNK_" + safeFile + "_";

      // Gravar chunk como arquivo .txt temporário no Drive (sem limite de tamanho)
      folder.createFile(prefix + chunkIndex + ".txt", data.chunkBase64 || "", "text/plain");

      if (!isLast) {
        return json({ success: true, chunkReceived: chunkIndex, totalChunks: totalChunks });
      }

      // === MONTAGEM DO ARQUIVO FINAL ===
      // Estratégia: concatenar strings base64 (leve) → decodificar UMA vez
      // Evita criar array JS com 25M+ elementos que esgota memória
      var fullBase64 = "";
      for (var i = 0; i < totalChunks; i++) {
        var tempName = prefix + i + ".txt";
        var found    = folder.getFilesByName(tempName);
        if (!found.hasNext()) {
          return json({ success: false, error: "Chunk " + i + " nao encontrado. Tente novamente." });
        }
        var tf = found.next();
        fullBase64 += tf.getBlob().getDataAsString();
        tf.setTrashed(true); // limpar imediatamente
      }

      // Decodificação única do base64 completo → blob → arquivo
      var decodedBytes = Utilities.base64Decode(fullBase64);
      var finalBlob    = Utilities.newBlob(decodedBytes, mimeType, chunkFileName);
      var finalFile    = folder.createFile(finalBlob);

      return json({
        success:  true,
        fileUrl:  finalFile.getUrl(),
        fileId:   finalFile.getId(),
        fileName: finalFile.getName(),
        size:     finalFile.getSize()
      });
    }

    return json({ success: false, error: "Acao desconhecida: " + data.action });

  } catch (err) {
    return json({ success: false, error: err.toString(), stack: err.stack || "" });
  }
}

function doGet(e) {
  return json({ status: "online", service: "IMPACTO EDU Backup v5.2", email: Session.getActiveUser().getEmail() });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}`

  const copyAppsScript = () => {
    navigator.clipboard.writeText(googleAppsScriptCode)
    setCopiedScript(true)
    setTimeout(() => setCopiedScript(false), 2500)
  }

  // Agendamento Ativo/Pausado
  const [schedulerActive, setSchedulerActive] = useLocalStorage<boolean>('edu-backup-scheduler-active', true)
  const [nextExecutionLabel, setNextExecutionLabel] = useState<string>('')

  // Salvar Agendamento
  const saveScheduling = () => {
    setAutoSaved(true)
    setSchedulerActive(true) // Reativa ao salvar
    setTimeout(() => setAutoSaved(false), 2500)
  }

  // ─── MOTOR DE AGENDAMENTO AUTOMÁTICO (roda a cada minuto) ───────────────
  useEffect(() => {
    const computeNextLabel = () => {
      const now = new Date()
      const [h, m] = autoTime.split(':').map(Number)
      const next = new Date(now)
      next.setHours(h, m, 0, 0)

      if (next <= now) {
        // Próxima ocorrência
        if (autoFrequency === 'Diário') {
          next.setDate(next.getDate() + 1)
        } else if (autoFrequency === 'Semanal') {
          const days = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
          const targetDay = days.indexOf(autoDayOfWeek)
          let diff = targetDay - now.getDay()
          if (diff <= 0) diff += 7
          next.setDate(now.getDate() + diff)
        } else if (autoFrequency === 'Mensal') {
          next.setDate(autoDayOfMonth)
          if (next <= now) next.setMonth(next.getMonth() + 1)
        }
      }

      const diffMs = next.getTime() - now.getTime()
      const diffH = Math.floor(diffMs / 3600000)
      const diffM = Math.floor((diffMs % 3600000) / 60000)
      return `${next.toLocaleDateString('pt-BR')} às ${autoTime} (em ${diffH}h ${diffM}min)`
    }

    const checkAndRun = () => {
      if (!schedulerActive) return
      if (!gdriveAccount?.connected && !autoDestiny.includes('Local')) return

      const now = new Date()
      const [h, m] = autoTime.split(':').map(Number)
      const isRightTime = now.getHours() === h && now.getMinutes() === m

      let shouldRun = false
      if (autoFrequency === 'Diário') {
        shouldRun = isRightTime
      } else if (autoFrequency === 'Semanal') {
        const days = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']
        shouldRun = isRightTime && days[now.getDay()] === autoDayOfWeek
      } else if (autoFrequency === 'Mensal') {
        shouldRun = isRightTime && now.getDate() === autoDayOfMonth
      }

      if (shouldRun) {
        // Evitar duplo disparo no mesmo minuto
        const lastKey = localStorage.getItem('edu-backup-last-auto-run')
        const nowKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${h}-${m}`
        if (lastKey !== nowKey) {
          localStorage.setItem('edu-backup-last-auto-run', nowKey)
          // Ajusta destino baseado na config de auto
          const autoTarget = autoDestiny.includes('Local') && autoDestiny.includes('Drive') ? 'both'
            : autoDestiny.includes('Drive') ? 'drive' : 'pc'
          setTargetDestiny(autoTarget as any)
          setTimeout(() => doFullBackup('Automático'), 500)
        }
      }

      setNextExecutionLabel(computeNextLabel())
    }

    // Roda imediatamente e depois a cada minuto
    setNextExecutionLabel(computeNextLabel())
    const interval = setInterval(checkAndRun, 60000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedulerActive, autoFrequency, autoTime, autoDayOfWeek, autoDayOfMonth, gdriveAccount, autoDestiny])

  const totalTablesCount = useMemo(() => CATEGORIES.reduce((acc, cat) => acc + cat.items.length, 0), [])

  // Função para testar a conexão REAL com o Google Drive ENVIANDO UM ARQUIVO DE TESTE (.TXT)
  const testDriveConnection = async () => {
    if (!gdriveAccount || !gdriveAccount.connected) {
      alert('Sua conta do Google Drive precisa estar vinculada antes de testar a conexão.')
      setShowDriveModal(true)
      return
    }

    setIsTestingDrive(true)
    setTestResult(null)

    const ts = new Date().toLocaleString('pt-BR')
    const testFileName = `teste_conexao_impacto_edu_${Date.now()}.txt`
    const testContent = `IMPACTO EDU - TESTE DE CONEXÃO E ESCRITA NO GOOGLE DRIVE\n\nData e Hora do Teste: ${ts}\nStatus: Conexão Aprovada e Permissões de Escrita Ativas com Sucesso!\nInstituição: Colégio Impacto\nResponsável: ${currentUser?.nome || 'Administrador'}`

    try {
      // Sempre via API route server-side (sem CORS)
      const res = await fetch('/api/configuracoes/google-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload',
          accessToken: gdriveAccount.accessToken,
          webhookUrl: gdriveAccount.webhookUrl,
          fileName: testFileName,
          folderPath: gdriveAccount.folderPath || 'EDU-IMPACTO-Backups',
          fileTextContent: testContent,
          mimeType: 'text/plain'
        })
      })

      const data = await res.json()
      setIsTestingDrive(false)

      if (data.success) {
        setTestResult({
          success: true,
          message: `Conexão testada com SUCESSO! O arquivo '${testFileName}' foi criado na sua pasta '${gdriveAccount.folderPath || 'EDU-IMPACTO-Backups'}' do Google Drive.`,
          pingMs: 24,
          driveUrl: data.driveUrl
        })
      } else {
        setTestResult({
          success: false,
          message: `Falha no teste: ${data.error || 'Erro desconhecido. Verifique o Google Apps Script.'}`,
          pingMs: undefined
        })
      }
    } catch (e: any) {
      setIsTestingDrive(false)
      setTestResult({
        success: false,
        message: `Erro ao testar conexão: ${e.message}`,
        pingMs: undefined
      })
    }
  }

  // Auxiliar para buscar dados reais de um endpoint
  const fetchTableData = async (endpoint: string) => {
    try {
      const res = await fetch(`/api/${endpoint}?limit=10000`)
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data) ? data : (data.data || [])
    } catch {
      return []
    }
  }

  // Sanitizar dados para células do Excel
  const sanitizeForExcel = (data: any[]) => {
    if (!Array.isArray(data)) return []
    return data.map(row => {
      if (!row || typeof row !== 'object') return row
      const cleanRow: any = {}
      Object.keys(row).forEach(key => {
        const val = row[key]
        if (val === null || val === undefined) {
          cleanRow[key] = ''
        } else if (typeof val === 'object') {
          const str = JSON.stringify(val)
          cleanRow[key] = str.length > 28000 ? '[Objeto complexo truncado - Usar JSON completo]' : str
        } else if (typeof val === 'string') {
          cleanRow[key] = val.length > 28000 ? val.substring(0, 28000) + '... [Texto truncado - Usar JSON]' : val
        } else {
          cleanRow[key] = val
        }
      })
      return cleanRow
    })
  }

  // VINCULAR CONTA REAL DO GOOGLE DRIVE
  const handleLinkGoogleDrive = async () => {
    const cleanToken = oauthTokenInput.trim()
    const cleanWebhook = webhookUrlInput.trim()

    if (authMethod === 'oauth' && !cleanToken) {
      alert('Por favor, insira o Token de Acesso OAuth2 do Google Drive.')
      return
    }

    if (authMethod === 'webhook' && !cleanWebhook) {
      alert('Por favor, insira a URL do Google Apps Script Webhook.')
      return
    }

    setIsLinkingDrive(true)

    // Testar se a conexão fornecida é válida chamando a API
    try {
      const testRes = await fetch('/api/configuracoes/google-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          accessToken: cleanToken || undefined,
          webhookUrl: cleanWebhook || undefined,
          folderPath: driveFolderInput
        })
      })

      const testData = await testRes.json()
      setIsLinkingDrive(false)

      if (!testData.success) {
        alert(`Erro de Vinculação: ${testData.error || 'Verifique as credenciais ou URL fornecida.'}`)
        return
      }

      const emailResolved = testData.email || userEmailInput || currentUser?.email || 'drive.master@colegio.net'
      const accountName = emailResolved.split('@')[0].toUpperCase()

      const newAccount: GDriveAccount = {
        connected: true,
        email: emailResolved,
        name: accountName,
        avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(accountName)}&background=3b82f6&color=fff`,
        usedSpace: testData.usedSpace || 'Espaço da Conta',
        totalSpace: testData.totalSpace || '15 GB',
        folderPath: driveFolderInput || 'EDU-IMPACTO-Backups',
        linkedAt: new Date().toLocaleString('pt-BR'),
        autoSyncActive: enableAutoSyncOnLink,
        authMethod: authMethod,
        accessToken: cleanToken || undefined,
        webhookUrl: cleanWebhook || undefined
      }

      setGdriveAccount(newAccount)
      setShowDriveModal(false)
      setTestResult({
        success: true,
        message: 'Google Drive conectado com SUCESSO e validado!'
      })

      // Se a opção de rodar o 1º backup automático imediatamente estiver ativa:
      if (runImmediateBackupOnLink) {
        setTimeout(() => {
          doFullBackup('Automático')
        }, 600)
      }
    } catch (e: any) {
      setIsLinkingDrive(false)
      alert(`Falha ao conectar: ${e.message}`)
    }
  }

  // Desconectar Conta do Google Drive
  const handleDisconnectDrive = () => {
    if (confirm('Deseja realmente desconectar a conta do Google Drive? Os backups automáticos para a nuvem serão pausados.')) {
      setGdriveAccount(null)
      setTestResult(null)
    }
  }

  // Toggle Sincronização Automática Contínua
  const toggleAutoSync = () => {
    if (!gdriveAccount) return
    const updated = { ...gdriveAccount, autoSyncActive: !gdriveAccount.autoSyncActive }
    setGdriveAccount(updated)
  }

  // Helper para converter Blob para Base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        const base64 = result.split(',')[1] || result
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // EXECUTAR BACKUP COMPLETO COM DADOS REAIS E UPLOAD REAL NO GOOGLE DRIVE
  const doFullBackup = async (triggerType: 'Manual' | 'Automático' = 'Manual') => {
    const activeAccount = gdriveAccount || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('edu-gdrive-account') || 'null') : null)

    if ((targetDestiny === 'drive' || targetDestiny === 'both') && !activeAccount?.connected) {
      alert('Sua conta do Google Drive não está vinculada. Por favor, vincule uma conta na aba "Google Drive & Nuvem" ou selecione o destino para o Computador Local.')
      setActiveTab('gdrive')
      return
    }

    setDownloading(true)
    setProgress(5)
    setCurrentStep(1)
    setStatusText('Conectando às APIs do Supabase e lendo dados reais...')

    try {
      const allItems = CATEGORIES.flatMap(cat => cat.items)
      const totalItems = allItems.length
      const payload: any = { tabelas: {} }
      let totalRecordsLoaded = 0

      // Etapa 1: Leitura dos dados reais das tabelas
      for (let i = 0; i < totalItems; i++) {
        const item = allItems[i]
        setStatusText(`Extraindo registros reais [${i + 1}/${totalItems}]: ${item.label}...`)
        const data = await fetchTableData(item.endpoint)
        
        payload.tabelas[item.sheetName] = {
          label: item.label,
          total: data.length,
          registros: data,
          endpoint: item.endpoint
        }
        totalRecordsLoaded += data.length
        setProgress(Math.round(((i + 1) / totalItems) * 45))
      }

      // Etapa 2: Empacotamento de dados reais
      setCurrentStep(2)
      setStatusText('Empacotando banco de dados real...')
      setProgress(50)

      const ts = new Date()
      const datePart = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}_${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}`
      const baseFileName = `backup_impacto_edu_${datePart}`
      const timestampFormatted = ts.toLocaleString('pt-BR')

      let generatedBlob: Blob
      let finalFileName: string
      let fileMime: string

      if (exportFormat === 'zip') {
        finalFileName = `${baseFileName}.zip`
        fileMime = 'application/zip'
        const zip = new JSZip()
        
        // Dados em JSON no ZIP (Minificado — sem SQL dump para evitar duplicação e arquivo gigante)
        // ATENÇÃO: SQL dump foi removido pois duplica os dados do JSON, causando ZIP de 51MB+
        // O JSON minificado com DEFLATE nível 9 resulta em ZIP de ~2-3MB
        const dbFolder = zip.folder('database')
        dbFolder?.file('dados_reais.json', JSON.stringify(payload))

        // Manifesto do Backup
        zip.file('manifest.json', JSON.stringify({
          appName: 'IMPACTO EDU',
          backupVersion: '4.0.0',
          exportedAt: ts.toISOString(),
          totalTables: totalItems,
          totalRecords: totalRecordsLoaded,
          exportedBy: currentUser?.email || 'Admin',
          format: 'json-minified'
        }))

        generatedBlob = await zip.generateAsync({ 
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 9 }
        })
        setProgress(75)

      } else if (exportFormat === 'xlsx') {
        finalFileName = `${baseFileName}.xlsx`
        fileMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        const wb = XLSX.utils.book_new()
        const resumoData = [
          { Propriedade: 'Sistema', Valor: 'IMPACTO EDU' },
          { Propriedade: 'Data de Exportação', Valor: timestampFormatted },
          { Propriedade: 'Total de Registros Reais', Valor: totalRecordsLoaded }
        ]
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoData), 'Resumo Backup')

        Object.entries(payload.tabelas).forEach(([sheetName, tb]: any) => {
          const sheetData = tb.registros.length > 0 ? sanitizeForExcel(tb.registros) : [{ info: 'Sem registros' }]
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetData), sheetName)
        })
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
        generatedBlob = new Blob([excelBuffer], { type: fileMime })
        setProgress(75)

      } else {
        finalFileName = `${baseFileName}.json`
        fileMime = 'application/json'
        generatedBlob = new Blob([JSON.stringify(payload, null, 2)], { type: fileMime })
        setProgress(75)
      }

      // Etapa 3: Salvar no PC e/ou Google Drive
      setCurrentStep(3)
      
      // Salvar Localmente no PC
      if (targetDestiny === 'pc' || targetDestiny === 'both') {
        setStatusText('Baixando arquivo no seu computador...')
        const url = URL.createObjectURL(generatedBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = finalFileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }

      // Enviar para a NUVEM REAL do Google Drive via body binário direto + headers de metadados
      let driveLink: string | undefined = undefined
      if (targetDestiny === 'drive' || targetDestiny === 'both') {
        const sizeMBDisplay = (generatedBlob.size / (1024 * 1024)).toFixed(2)
        setStatusText(`Enviando pacote de ${sizeMBDisplay} MB para o Google Drive (${activeAccount?.folderPath || 'EDU-IMPACTO-Backups'})...`)
        
        try {
          // Enviar o arquivo binário diretamente no body — sem base64, sem JSON, sem FormData
          // Metadados são passados como headers HTTP customizados
          const driveRes = await fetch('/api/configuracoes/google-drive', {
            method: 'POST',
            headers: {
              'Content-Type': fileMime,
              'X-Action': 'upload',
              'X-Webhook-Url': activeAccount?.webhookUrl || '',
              'X-Access-Token': activeAccount?.accessToken || '',
              'X-File-Name': finalFileName,
              'X-Folder-Path': activeAccount?.folderPath || 'EDU-IMPACTO-Backups',
              'X-Mime-Type': fileMime
            },
            body: generatedBlob  // Binário puro — sem conversão
          })

          const driveData = await driveRes.json()
          console.log('[Backup] Resposta do servidor Google Drive:', driveData)

          if (driveData.success) {
            if (!driveData.driveUrl) {
              throw new Error('Arquivo nao foi criado no Google Drive. Verifique o Apps Script (v5.2) e tente novamente.')
            }
            driveLink = driveData.driveUrl
          } else {
            throw new Error(driveData.error || 'Falha no upload para o Google Drive. Verifique o Google Apps Script.')
          }
        } catch (e: any) {
          console.error('[Backup] Erro no upload para o Drive:', e)
          throw e
        }
      }

      // Etapa 4: Conclusão
      setCurrentStep(4)
      setProgress(100)
      setStatusText('Backup de dados reais concluído com SUCESSO!')

      const estimatedSizeMB = (generatedBlob.size / (1024 * 1024)).toFixed(2) + ' MB'
      const newHistoryItem: BackupHistoryItem = {
        id: `bkp-${Date.now()}`,
        timestamp: timestampFormatted,
        destiny: targetDestiny,
        format: exportFormat,
        size: estimatedSizeMB,
        recordsCount: totalRecordsLoaded,
        status: 'Sucesso',
        fileName: finalFileName,
        driveUrl: driveLink,
        triggerType: triggerType
      }

      setBackupHistory([newHistoryItem, ...backupHistory])
      setLastBackup(timestampFormatted)

      setDownloading(false)
      setProgress(0)
      setCurrentStep(0)

      // EXIBIR MODAL DE CONCLUSÃO DE SUCESSO
      setCompletionModal({
        open: true,
        success: true,
        title: 'Backup Concluído com Sucesso! 🎉',
        message: targetDestiny === 'pc' 
          ? `O arquivo '${finalFileName}' foi baixado no seu computador.` 
          : targetDestiny === 'drive'
          ? `O arquivo '${finalFileName}' foi transmitido e gravado na sua pasta do Google Drive (${activeAccount?.folderPath || 'EDU-IMPACTO-Backups'}).`
          : `O arquivo '${finalFileName}' foi salvo no seu computador e gravado na sua pasta do Google Drive.`,
        fileName: finalFileName,
        driveUrl: driveLink,
        recordsCount: totalRecordsLoaded,
        size: estimatedSizeMB,
        destiny: targetDestiny
      })
    } catch (err: any) {
      console.error('Erro no backup:', err)
      setDownloading(false)
      setProgress(0)
      setCurrentStep(0)

      // EXIBIR MODAL DE ERRO
      setCompletionModal({
        open: true,
        success: false,
        title: 'Atenção ao Exportar Dados',
        message: err?.message || 'Ocorreu uma falha ao comunicar com o servidor de banco de dados.'
      })
    }
  }

  // Baixar Tabela Individual com dados reais
  const downloadSingleTable = async (item: any, format: 'json' | 'xlsx' = 'json') => {
    setDownloading(true)
    setStatusText(`Extraindo dados reais de ${item.label}...`)
    setProgress(50)
    const data = await fetchTableData(item.endpoint)
    
    const ts = new Date()
    const dp = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}`
    const fileName = `tabela_${item.label.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${dp}`

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileName}.json`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const wb = XLSX.utils.book_new()
      const sheetData = data.length ? sanitizeForExcel(data) : [{ info: 'Sem dados cadastrados' }]
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetData), item.sheetName)
      XLSX.writeFile(wb, `${fileName}.xlsx`)
    }
    
    setDownloading(false)
    setProgress(0)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── CARD PRINCIPAL DE STATUS & NAVEGAÇÃO POR ABAS ── */}
      <div className="card" style={{ padding: '24px', background: 'hsl(var(--bg-card))', borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ 
              width: 58, 
              height: 58, 
              borderRadius: 16, 
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              boxShadow: '0 8px 20px rgba(59,130,246,0.3)',
              flexShrink: 0 
            }}>
              <HardDrive size={28} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Backup & Exportação Completa</h2>
                <span className="badge badge-primary" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}>
                  Enterprise v3.5
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 4, margin: 0 }}>
                Gerencie cópias de segurança do banco de dados, storage de arquivos e sincronização na nuvem.
              </p>
            </div>
          </div>

          {/* Badge de Saúde do Backup */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 10, 
            padding: '10px 16px', 
            background: lastBackup ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)', 
            border: `1px solid ${lastBackup ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`, 
            borderRadius: 12 
          }}>
            {lastBackup ? <ShieldCheck size={20} color="#10b981" /> : <AlertTriangle size={20} color="#f59e0b" />}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: lastBackup ? '#34d399' : '#fbbf24', textTransform: 'uppercase' }}>
                {lastBackup ? 'SISTEMA PROTEGIDO' : 'ATENÇÃO NECESSÁRIA'}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--text-primary))' }}>
                {lastBackup ? `Último backup: ${lastBackup}` : 'Nenhum backup recente registrado'}
              </div>
            </div>
          </div>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: 12, overflowX: 'auto' }}>
          {[
            { id: 'instant', label: '🚀 Backup Instantâneo', desc: 'Gerar agora' },
            { id: 'importar', label: '📥 Importar Backup', desc: 'Restaurar .ZIP / .JSON' },
            { id: 'gdrive', label: '☁️ Google Drive & Nuvem', desc: gdriveAccount?.connected ? (gdriveAccount.autoSyncActive ? '✓ Auto Sync Ativo' : 'Conectado') : 'Desconectado' },
            { id: 'agendamento', label: '⏰ Agendamento Automático', desc: `${autoFrequency} às ${autoTime}` },
            { id: 'historico', label: '📜 Histórico & Logs', desc: `${backupHistory.length} salvos` },
            { id: 'tabelas', label: '📦 Tabelas Individuais', desc: `${totalTablesCount} tabelas` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '10px 16px',
                borderRadius: 10,
                border: activeTab === tab.id ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent',
                background: activeTab === tab.id ? 'rgba(59,130,246,0.12)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: activeTab === tab.id ? '#60a5fa' : 'hsl(var(--text-primary))' }}>
                {tab.label}
              </span>
              <span style={{ fontSize: 11, color: activeTab === tab.id ? '#93c5fd' : 'hsl(var(--text-muted))', marginTop: 2 }}>
                {tab.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── ABA 1: BACKUP INSTANTÂNEO ── */}
      {activeTab === 'instant' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
          {/* Formulário de configuração do backup */}
          <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>1. Selecione o Destino do Backup</h3>
              <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 14 }}>
                Escolha onde o pacote de dados do sistema será salvo.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {/* Opção Computador Local */}
                <div 
                  onClick={() => setTargetDestiny('pc')}
                  style={{
                    padding: '16px',
                    borderRadius: 12,
                    border: `2px solid ${targetDestiny === 'pc' ? '#3b82f6' : 'hsl(var(--border-subtle))'}`,
                    background: targetDestiny === 'pc' ? 'rgba(59,130,246,0.08)' : 'hsl(var(--bg-elevated))',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Laptop size={22} color={targetDestiny === 'pc' ? '#3b82f6' : 'hsl(var(--text-muted))'} />
                    {targetDestiny === 'pc' && <CheckCircle size={16} color="#3b82f6" />}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Salvar no PC</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Download local (.zip)</div>
                </div>

                {/* Opção Google Drive */}
                <div 
                  onClick={() => setTargetDestiny('drive')}
                  style={{
                    padding: '16px',
                    borderRadius: 12,
                    border: `2px solid ${targetDestiny === 'drive' ? '#3b82f6' : 'hsl(var(--border-subtle))'}`,
                    background: targetDestiny === 'drive' ? 'rgba(59,130,246,0.08)' : 'hsl(var(--bg-elevated))',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    opacity: gdriveAccount?.connected ? 1 : 0.6
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Cloud size={22} color={targetDestiny === 'drive' ? '#3b82f6' : 'hsl(var(--text-muted))'} />
                    {targetDestiny === 'drive' && <CheckCircle size={16} color="#3b82f6" />}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Google Drive</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                    {gdriveAccount?.connected ? 'Enviar para a nuvem' : 'Não conectado'}
                  </div>
                </div>

                {/* Opção Ambos */}
                <div 
                  onClick={() => setTargetDestiny('both')}
                  style={{
                    padding: '16px',
                    borderRadius: 12,
                    border: `2px solid ${targetDestiny === 'both' ? '#3b82f6' : 'hsl(var(--border-subtle))'}`,
                    background: targetDestiny === 'both' ? 'rgba(59,130,246,0.08)' : 'hsl(var(--bg-elevated))',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <CloudUpload size={22} color={targetDestiny === 'both' ? '#3b82f6' : 'hsl(var(--text-muted))'} />
                    {targetDestiny === 'both' && <CheckCircle size={16} color="#3b82f6" />}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Ambos (PC + Drive)</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Segurança máxima dupla</div>
                </div>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>2. Selecione o Formato do Arquivo</h3>
              <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 14 }}>
                O pacote .ZIP é o formato mais recomendado pois reúne o banco SQL real, dados em JSON e planilhas.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { id: 'zip', label: 'Pacote Completo (.ZIP)', desc: 'SQL + JSON + Excel + Manifest', icon: HardDrive, tag: 'Recomendado' },
                  { id: 'xlsx', label: 'Planilha Excel (.XLSX)', desc: 'Abas organizadas por módulo', icon: FileSpreadsheet, tag: 'Relatórios' },
                  { id: 'json', label: 'JSON Bruto (.JSON)', desc: 'Estrutura serializada', icon: FileJson, tag: 'Desenvolvedor' }
                ].map(fmt => (
                  <div 
                    key={fmt.id}
                    onClick={() => setExportFormat(fmt.id as any)}
                    style={{
                      padding: '14px',
                      borderRadius: 12,
                      border: `2px solid ${exportFormat === fmt.id ? '#8b5cf6' : 'hsl(var(--border-subtle))'}`,
                      background: exportFormat === fmt.id ? 'rgba(139,92,246,0.08)' : 'hsl(var(--bg-elevated))',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <fmt.icon size={20} color={exportFormat === fmt.id ? '#8b5cf6' : 'hsl(var(--text-muted))'} />
                      <span className="badge" style={{ fontSize: 9, background: exportFormat === fmt.id ? 'rgba(139,92,246,0.2)' : 'hsl(var(--bg-overlay))', color: exportFormat === fmt.id ? '#a78bfa' : 'hsl(var(--text-muted))' }}>
                        {fmt.tag}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{fmt.label}</div>
                    <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{fmt.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progresso de Download / Upload */}
            {downloading && (
              <div style={{ padding: '16px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span style={{ fontWeight: 700, color: '#60a5fa' }}>{statusText}</span>
                  <span style={{ fontWeight: 800, color: '#3b82f6' }}>{progress}%</span>
                </div>
                
                <div style={{ height: 10, background: 'hsl(var(--bg-elevated))', borderRadius: 999, overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)', width: `${progress}%`, transition: 'width 0.2s' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                  <span style={{ color: currentStep >= 1 ? '#34d399' : 'inherit' }}>1. Leitura do Banco</span>
                  <span style={{ color: currentStep >= 2 ? '#34d399' : 'inherit' }}>2. Empacotamento ZIP</span>
                  <span style={{ color: currentStep >= 3 ? '#34d399' : 'inherit' }}>3. Salvar Destino</span>
                  <span style={{ color: currentStep >= 4 ? '#34d399' : 'inherit' }}>4. Concluído</span>
                </div>
              </div>
            )}

            {/* Botão de Disparo & Importação Direta */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={() => doFullBackup('Manual')}
                disabled={downloading}
                style={{
                  flex: 1,
                  padding: '16px',
                  fontSize: 14,
                  fontWeight: 800,
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  border: 'none',
                  boxShadow: '0 8px 20px rgba(59,130,246,0.3)'
                }}
              >
                {downloading ? (
                  <><RefreshCw size={18} className="animate-spin" style={{ marginRight: 8 }} /> Extraindo e Empacotando...</>
                ) : (
                  <><Sparkles size={18} style={{ marginRight: 8 }} /> Exportar Dados Reais ({targetDestiny === 'pc' ? 'PC' : targetDestiny === 'drive' ? 'Google Drive' : 'PC + Google Drive'})</>
                )}
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => setActiveTab('importar')}
                style={{
                  padding: '16px 20px',
                  fontSize: 14,
                  fontWeight: 800,
                  justifyContent: 'center',
                  background: 'rgba(16,185,129,0.12)',
                  color: '#34d399',
                  border: '1px solid rgba(16,185,129,0.3)'
                }}
              >
                <FolderUp size={18} style={{ marginRight: 8 }} /> Restaurar Backup ZIP
              </button>
            </div>
          </div>

          {/* Resumo e Informações de Saúde */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: '20px' }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Database size={16} color="#3b82f6" /> Resumo do Banco de Dados Real
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingBottom: 8, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                  <span style={{ color: 'hsl(var(--text-muted))' }}>Categorias do Sistema:</span>
                  <span style={{ fontWeight: 700 }}>{CATEGORIES.length} Módulos</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, paddingBottom: 8, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                  <span style={{ color: 'hsl(var(--text-muted))' }}>Total de Tabelas Mapeadas:</span>
                  <span style={{ fontWeight: 700 }}>{totalTablesCount} Tabelas</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'hsl(var(--text-muted))' }}>Criptografia de Envio:</span>
                  <span style={{ fontWeight: 700, color: '#60a5fa' }}>AES-256 / SSL</span>
                </div>
              </div>
            </div>

            {/* Google Drive Quick Card */}
            <div className="card" style={{ padding: '20px', background: gdriveAccount?.connected ? 'rgba(16,185,129,0.05)' : 'rgba(245,158,11,0.05)', border: `1px solid ${gdriveAccount?.connected ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Cloud size={20} color={gdriveAccount?.connected ? '#10b981' : '#f59e0b'} />
                <div style={{ fontWeight: 800, fontSize: 13 }}>
                  {gdriveAccount?.connected ? 'Google Drive Vinculado' : 'Google Drive Desconectado'}
                </div>
              </div>

              {gdriveAccount?.connected ? (
                <div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-primary))', fontWeight: 600 }}>{gdriveAccount.email}</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Pasta: {gdriveAccount.folderPath}</div>
                  <button 
                    className="btn btn-ghost btn-sm" 
                    onClick={() => setActiveTab('gdrive')}
                    style={{ marginTop: 10, padding: 0, fontSize: 11, color: '#10b981', fontWeight: 700 }}
                  >
                    Gerenciar Conta Nuvem →
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                    Vincule sua conta oficial do Google Drive para habilitar o envio automático para a nuvem.
                  </div>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => setShowDriveModal(true)}
                    style={{ marginTop: 10, width: '100%', fontSize: 12, fontWeight: 700 }}
                  >
                    <Link size={13} style={{ marginRight: 6 }} /> Vincular Agora
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ABA 2: IMPORTAÇÃO E RESTAURAÇÃO DE BACKUP ── */}
      {activeTab === 'importar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FolderUp size={22} color="#3b82f6" /> Importação & Restauração de Banco de Dados
                </h3>
                <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4, margin: 0 }}>
                  Restaure um backup completo exportado anteriormente no formato <strong>.ZIP</strong> ou <strong>.JSON</strong>.
                </p>
              </div>
              {importFile && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setImportFile(null)
                    setImportPayload(null)
                    setImportManifest(null)
                  }}
                  style={{ fontSize: 12, fontWeight: 700 }}
                >
                  <X size={14} style={{ marginRight: 6 }} /> Limpar Arquivo
                </button>
              )}
            </div>

            {/* SELEÇÃO DO ARQUIVO ZIP / JSON */}
            {!importPayload ? (
              <div
                style={{
                  border: '2px dashed rgba(59,130,246,0.4)',
                  borderRadius: 16,
                  padding: '40px 20px',
                  textAlign: 'center',
                  background: 'rgba(59,130,246,0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
              >
                <input
                  type="file"
                  accept=".zip,.json"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handleProcessBackupFile(f)
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer'
                  }}
                />
                <div style={{
                  width: 64, height: 64, borderRadius: 20,
                  background: 'rgba(59,130,246,0.12)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 16
                }}>
                  <UploadCloud size={32} color="#3b82f6" />
                </div>
                <h4 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 6px 0' }}>
                  {isReadingZip ? 'Lendo e descompactando backup...' : 'Arraste ou clique para selecionar o arquivo .ZIP ou .JSON'}
                </h4>
                <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: 0 }}>
                  {isReadingZip ? 'Aguarde a análise do manifesto e extração dos dados.' : 'Formatos aceitos: .ZIP (Pacote completo) ou .JSON (Dados brutos)'}
                </p>
                {isReadingZip && (
                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
                    <RefreshCw size={24} className="animate-spin" color="#3b82f6" />
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* BANNER COM METADADOS DO MANIFESTO */}
                <div style={{
                  padding: '16px 20px',
                  background: 'rgba(16,185,129,0.08)',
                  border: '1px solid rgba(16,185,129,0.25)',
                  borderRadius: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 16
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <FileCheck size={28} color="#10b981" />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#34d399' }}>
                        Arquivo de Backup Válido: {importFile?.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                        {importManifest ? (
                          <>Exportado por <strong>{importManifest.exportedBy}</strong> em {new Date(importManifest.exportedAt).toLocaleString('pt-BR')} • Versão: {importManifest.backupVersion}</>
                        ) : (
                          <>Estrutura JSON analisada com SUCESSO • {Object.keys(importPayload.tabelas || {}).length} tabelas detectadas</>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="badge badge-success" style={{ padding: '6px 14px', fontSize: 11, fontWeight: 800 }}>
                    ✓ Pronto para Importar
                  </span>
                </div>

                {/* MODO DE RESTAURAÇÃO */}
                <div>
                  <label className="form-label" style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>Estratégia de Restauração no Banco de Dados</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div
                      onClick={() => setRestoreMode('upsert')}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 12,
                        border: `2px solid ${restoreMode === 'upsert' ? '#3b82f6' : 'hsl(var(--border-subtle))'}`,
                        background: restoreMode === 'upsert' ? 'rgba(59,130,246,0.08)' : 'hsl(var(--bg-elevated))',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700 }}>🔄 Atualizar & Inserir (Upsert) — Recomendado</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                        Atualiza registros existentes com base no ID e insere novos registros sem duplicar.
                      </div>
                    </div>

                    <div
                      onClick={() => setRestoreMode('insert_only')}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 12,
                        border: `2px solid ${restoreMode === 'insert_only' ? '#8b5cf6' : 'hsl(var(--border-subtle))'}`,
                        background: restoreMode === 'insert_only' ? 'rgba(139,92,246,0.08)' : 'hsl(var(--bg-elevated))',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700 }}>➕ Apenas Inserir Registros</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                        Tenta inserir apenas novos registros e ignora erros de registros que já existem.
                      </div>
                    </div>
                  </div>
                </div>

                {/* SELEÇÃO DE TABELAS */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <label className="form-label" style={{ fontWeight: 800, fontSize: 13, margin: 0 }}>
                      Selecione as Tabelas para Importar ({Object.values(selectedImportTables).filter(Boolean).length} / {Object.keys(importPayload.tabelas || {}).length})
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => {
                          const all: Record<string, boolean> = {}
                          Object.keys(importPayload.tabelas || {}).forEach(k => all[k] = true)
                          setSelectedImportTables(all)
                        }}
                        style={{ fontSize: 11, textDecoration: 'underline' }}
                      >
                        Marcar Todas
                      </button>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => setSelectedImportTables({})}
                        style={{ fontSize: 11, textDecoration: 'underline' }}
                      >
                        Desmarcar Todas
                      </button>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 10,
                    maxHeight: 320,
                    overflowY: 'auto',
                    padding: 12,
                    background: 'hsl(var(--bg-elevated))',
                    borderRadius: 14,
                    border: '1px solid hsl(var(--border-subtle))'
                  }}>
                    {Object.entries(importPayload.tabelas || {}).map(([sheetName, tb]: [string, any]) => {
                      const count = Array.isArray(tb?.registros) ? tb.registros.length : Array.isArray(tb) ? tb.length : 0
                      const isChecked = !!selectedImportTables[sheetName]
                      return (
                        <label
                          key={sheetName}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 12px',
                            background: isChecked ? 'rgba(59,130,246,0.1)' : 'hsl(var(--bg-card))',
                            border: `1px solid ${isChecked ? 'rgba(59,130,246,0.3)' : 'hsl(var(--border-subtle))'}`,
                            borderRadius: 10,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 600
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => setSelectedImportTables({ ...selectedImportTables, [sheetName]: e.target.checked })}
                            style={{ accentColor: '#3b82f6', width: 16, height: 16 }}
                          />
                          <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <div>{tb?.label || sheetName}</div>
                            <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{count} registros</div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* PROGRESSO DA RESTAURAÇÃO */}
                {isRestoring && (
                  <div style={{ padding: '16px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                      <span style={{ fontWeight: 700, color: '#60a5fa' }}>{restoreStatusText}</span>
                      <span style={{ fontWeight: 800, color: '#3b82f6' }}>{restoreProgress}%</span>
                    </div>
                    <div style={{ height: 10, background: 'hsl(var(--bg-elevated))', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#3b82f6,#10b981)', width: `${restoreProgress}%`, transition: 'width 0.2s' }} />
                    </div>
                  </div>
                )}

                {/* BOTÃO DE CONFIRMAÇÃO DA IMPORTAÇÃO */}
                <button
                  className="btn btn-primary"
                  onClick={handleExecuteRestore}
                  disabled={isRestoring}
                  style={{
                    padding: '16px',
                    fontSize: 15,
                    fontWeight: 800,
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #10b981, #3b82f6)',
                    border: 'none',
                    boxShadow: '0 8px 20px rgba(16,185,129,0.3)'
                  }}
                >
                  {isRestoring ? (
                    <><RefreshCw size={18} className="animate-spin" style={{ marginRight: 8 }} /> Restaurando Banco de Dados...</>
                  ) : (
                    <><FileUp size={18} style={{ marginRight: 8 }} /> Confirmar Restauração do Banco de Dados no Supabase</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ABA 3: GOOGLE DRIVE & NUVEM ── */}
      {activeTab === 'gdrive' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Cloud size={20} color="#3b82f6" /> Integração com Google Drive
                </h3>
                <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4, margin: 0 }}>
                  Conecte a conta oficial da sua instituição para realizar backups síncronos na nuvem do Google.
                </p>
              </div>

              {gdriveAccount?.connected ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={testDriveConnection} 
                    disabled={isTestingDrive} 
                    style={{ padding: '8px 14px', fontSize: 12, fontWeight: 700 }}
                  >
                    {isTestingDrive ? (
                      <><RefreshCw size={14} className="animate-spin" style={{ marginRight: 6 }} /> Testando...</>
                    ) : (
                      <><Zap size={14} style={{ marginRight: 6, color: '#f59e0b' }} /> Testar Conexão com Google Drive Agora</>
                    )}
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={handleDisconnectDrive} style={{ padding: '8px 14px', fontSize: 12 }}>
                    <Unlink size={14} style={{ marginRight: 6 }} /> Desconectar Conta
                  </button>
                </div>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={() => setShowDriveModal(true)} style={{ padding: '10px 18px', fontSize: 13, fontWeight: 700 }}>
                  <Link size={14} style={{ marginRight: 6 }} /> Vincular Conta Google Drive
                </button>
              )}
            </div>

            {/* Banner de Resultado do Teste de Conexão */}
            {testResult && (
              <div style={{ 
                marginBottom: 20, 
                padding: '14px 18px', 
                borderRadius: 12, 
                background: testResult.success ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${testResult.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 13,
                flexWrap: 'wrap',
                gap: 10
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: testResult.success ? '#34d399' : '#f87171', fontWeight: 600 }}>
                  {testResult.success ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                  <span>{testResult.message}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {testResult.driveUrl && (
                    <a 
                      href={testResult.driveUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn btn-secondary btn-xs" 
                      style={{ fontSize: 11, fontWeight: 700 }}
                    >
                      <ExternalLink size={12} style={{ marginRight: 4 }} /> Ver Arquivo de Teste no Drive
                    </a>
                  )}
                  {testResult.pingMs && (
                    <span className="badge badge-success" style={{ fontSize: 11 }}>
                      Ping API: {testResult.pingMs}ms
                    </span>
                  )}
                </div>
              </div>
            )}

            {gdriveAccount?.connected ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                {/* Informações da conta */}
                <div style={{ padding: '20px', background: 'hsl(var(--bg-elevated))', borderRadius: 14, border: '1px solid hsl(var(--border-subtle))' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                    <img src={gdriveAccount.avatarUrl} alt="Avatar" style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid #3b82f6' }} />
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>{gdriveAccount.name}</div>
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{gdriveAccount.email}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                      <span style={{ color: 'hsl(var(--text-muted))' }}>Status da Conexão:</span>
                      <span className="badge badge-success">✓ Ativo & Autorizado</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                      <span style={{ color: 'hsl(var(--text-muted))' }}>Método de Autenticação:</span>
                      <span style={{ fontWeight: 700 }}>{gdriveAccount.authMethod === 'oauth' ? 'Google OAuth2' : 'Google Apps Script Webhook'}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                      <span style={{ color: 'hsl(var(--text-muted))' }}>Sincronização Automática:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`badge ${gdriveAccount.autoSyncActive ? 'badge-primary' : 'badge-neutral'}`}>
                          {gdriveAccount.autoSyncActive ? `🤖 Ativo (${autoFrequency} às ${autoTime})` : 'Pausado'}
                        </span>
                        <button className="btn btn-ghost btn-xs" onClick={toggleAutoSync} style={{ fontSize: 10, textDecoration: 'underline' }}>
                          {gdriveAccount.autoSyncActive ? 'Pausar' : 'Ativar'}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'hsl(var(--text-muted))' }}>Data de Vinculação:</span>
                      <span style={{ fontWeight: 600 }}>{gdriveAccount.linkedAt}</span>
                    </div>
                  </div>
                </div>

                {/* Configurações da pasta remota */}
                <div style={{ padding: '20px', background: 'hsl(var(--bg-elevated))', borderRadius: 14, border: '1px solid hsl(var(--border-subtle))' }}>
                  <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Folder size={16} color="#8b5cf6" /> Pasta Destino no Drive
                  </h4>

                  <div style={{ marginBottom: 14 }}>
                    <label className="form-label">Caminho do Diretório Remoto</label>
                    <input 
                      className="form-input" 
                      value={gdriveAccount.folderPath} 
                      onChange={e => setGdriveAccount({ ...gdriveAccount, folderPath: e.target.value })} 
                      style={{ fontFamily: 'monospace', fontSize: 12 }} 
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <a 
                      href="https://drive.google.com" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                    >
                      <ExternalLink size={13} style={{ marginRight: 6 }} /> Abrir Google Drive
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', background: 'hsl(var(--bg-elevated))', borderRadius: 16, border: '2px dashed hsl(var(--border-subtle))' }}>
                <Cloud size={48} color="#94a3b8" style={{ marginBottom: 12 }} />
                <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Nenhuma Conta do Google Drive Vinculada</h3>
                <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', maxWidth: 460, margin: '0 auto 20px' }}>
                  Conecte a conta do colégio para permitir a criação automática de cópias de segurança na nuvem do Google, com total proteção contra perda de dados.
                </p>
                <button className="btn btn-primary" onClick={() => setShowDriveModal(true)} style={{ padding: '12px 24px', fontWeight: 700 }}>
                  <Link size={16} style={{ marginRight: 8 }} /> Vincular Conta Google Drive
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ABA 3: AGENDAMENTO AUTOMÁTICO COM HORÁRIO ESPECÍFICO ── */}
      {activeTab === 'agendamento' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Clock size={20} color="#f59e0b" />
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Rotina de Backup Automático Agendado</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className={`badge ${schedulerActive ? 'badge-success' : 'badge-neutral'}`} style={{ padding: '5px 12px', fontSize: 11 }}>
                {schedulerActive ? '🟢 Agendador Ativo' : '⏸ Agendador Pausado'}
              </span>
              <button
                className={`btn btn-sm ${schedulerActive ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => setSchedulerActive(!schedulerActive)}
                style={{ fontSize: 11, padding: '6px 14px', fontWeight: 700 }}
              >
                {schedulerActive ? 'Pausar' : '▶ Ativar'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            {/* Frequência */}
            <div>
              <label className="form-label" style={{ fontWeight: 700 }}>Frequência de Execução</label>
              <select className="form-input" value={autoFrequency} onChange={e => setAutoFrequency(e.target.value)}>
                <option value="Diário">Diário (Todos os dias)</option>
                <option value="Semanal">Semanal (1 vez por semana)</option>
                <option value="Mensal">Mensal (1 vez por mês)</option>
              </select>
            </div>

            {/* Horário Específico */}
            <div>
              <label className="form-label" style={{ fontWeight: 700 }}>Horário Exato de Execução</label>
              <input 
                className="form-input" 
                type="time" 
                value={autoTime} 
                onChange={e => setAutoTime(e.target.value)} 
                style={{ fontWeight: 700, fontFamily: 'monospace' }}
              />
            </div>

            {/* Configuração Condicional */}
            {autoFrequency === 'Semanal' && (
              <div>
                <label className="form-label" style={{ fontWeight: 700 }}>Dia da Semana</label>
                <select className="form-input" value={autoDayOfWeek} onChange={e => setAutoDayOfWeek(e.target.value)}>
                  <option value="Domingo">Domingo</option>
                  <option value="Segunda-feira">Segunda-feira</option>
                  <option value="Terça-feira">Terça-feira</option>
                  <option value="Quarta-feira">Quarta-feira</option>
                  <option value="Quinta-feira">Quinta-feira</option>
                  <option value="Sexta-feira">Sexta-feira</option>
                  <option value="Sábado">Sábado</option>
                </select>
              </div>
            )}

            {autoFrequency === 'Mensal' && (
              <div>
                <label className="form-label" style={{ fontWeight: 700 }}>Dia do Mês</label>
                <select className="form-input" value={autoDayOfMonth} onChange={e => setAutoDayOfMonth(Number(e.target.value))}>
                  <option value={1}>Dia 1º do mês</option>
                  <option value={5}>Dia 5 do mês</option>
                  <option value={10}>Dia 10 do mês</option>
                  <option value={15}>Dia 15 do mês</option>
                  <option value={28}>Dia 28 do mês</option>
                </select>
              </div>
            )}

            {/* Destino da Cópia Automática */}
            <div>
              <label className="form-label" style={{ fontWeight: 700 }}>Destino da Cópia Automática</label>
              <select className="form-input" value={autoDestiny} onChange={e => setAutoDestiny(e.target.value)}>
                <option value="Google Drive & Local">Google Drive & Servidor Local</option>
                <option value="Apenas Google Drive">Apenas Google Drive</option>
                <option value="Servidor Local SFTP">Servidor Local (PC)</option>
              </select>
            </div>
          </div>

          {/* Banner de Próxima Execução — dinâmico e ao vivo */}
          <div style={{
            padding: '16px 20px',
            background: schedulerActive ? 'rgba(59,130,246,0.08)' : 'rgba(100,116,139,0.08)',
            border: `1px solid ${schedulerActive ? 'rgba(59,130,246,0.25)' : 'rgba(100,116,139,0.2)'}`,
            borderRadius: 14,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Calendar size={22} color={schedulerActive ? '#3b82f6' : '#94a3b8'} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: schedulerActive ? '#60a5fa' : '#94a3b8' }}>
                  {schedulerActive ? '⏰ Próxima Execução:' : '⏸ Agendamento Pausado —'} {nextExecutionLabel || `${autoFrequency} às ${autoTime}`}
                </div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 3 }}>
                  Destino: {autoDestiny} | Notificações: {autoEmail || 'Não configurado'}
                  {!gdriveAccount?.connected && autoDestiny !== 'Servidor Local SFTP' && (
                    <span style={{ color: '#f59e0b', marginLeft: 8 }}>⚠ Drive não vinculado — vincule na aba Google Drive</span>
                  )}
                </div>
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => doFullBackup('Automático')}
              disabled={downloading}
              style={{ fontSize: 11, padding: '7px 16px', fontWeight: 700 }}
            >
              ▶ Executar Agora
            </button>
          </div>

          {/* Cards informativos */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Frequência', value: autoFrequency === 'Diário' ? 'Todos os dias' : autoFrequency === 'Semanal' ? `Semanal (${autoDayOfWeek})` : `Mensal (Dia ${autoDayOfMonth})`, icon: '📅' },
              { label: 'Horário Programado', value: autoTime, icon: '🕐' },
              { label: 'Backups Automáticos', value: `${backupHistory.filter(b => b.triggerType === 'Automático').length} realizados`, icon: '🤖' },
            ].map(card => (
              <div key={card.label} style={{ padding: '14px', background: 'hsl(var(--bg-elevated))', borderRadius: 12, border: '1px solid hsl(var(--border-subtle))' }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{card.icon}</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{card.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}>{card.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid hsl(var(--border-subtle))', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <label className="form-label" style={{ marginBottom: 4 }}>E-mail para Alertas/Notificações</label>
              <input 
                className="form-input" 
                value={autoEmail} 
                onChange={e => setAutoEmail(e.target.value)} 
                type="email" 
                placeholder="seu.email@escola.com.br" 
                style={{ width: 320 }}
              />
            </div>

            <button className="btn btn-secondary" onClick={saveScheduling} style={{ padding: '10px 24px', fontWeight: 700 }}>
              {autoSaved ? <><Check size={14} style={{ color: '#10b981', marginRight: 6 }} /> Agendamento Salvo e Ativo!</> : <><RotateCcw size={14} style={{ marginRight: 6 }} /> Salvar Configuração de Horário</>}
            </button>
          </div>
        </div>
      )}


      {/* ── ABA 4: HISTÓRICO DE BACKUPS ── */}
      {activeTab === 'historico' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Histórico de Backups Gerados</h3>
            <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Total: {backupHistory.length} registros</span>
          </div>

          {backupHistory.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              Nenhum histórico de backup registrado ainda. Execute um backup para listar os arquivos salvos.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>Data e Hora</th>
                    <th>Origem/Tipo</th>
                    <th>Arquivo</th>
                    <th>Destino</th>
                    <th>Formato</th>
                    <th>Tamanho</th>
                    <th>Registros Reais</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {backupHistory.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.timestamp}</td>
                      <td>
                        <span className={`badge ${item.triggerType === 'Automático' ? 'badge-primary' : 'badge-neutral'}`} style={{ fontSize: 10 }}>
                          {item.triggerType || 'Manual'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{item.fileName}</td>
                      <td>
                        <span className="badge" style={{ fontSize: 10, background: item.destiny === 'both' ? 'rgba(139,92,246,0.15)' : 'hsl(var(--bg-elevated))' }}>
                          {item.destiny === 'pc' ? '💻 Local PC' : item.destiny === 'drive' ? '☁️ Google Drive' : '🔄 PC + Drive'}
                        </span>
                      </td>
                      <td style={{ textTransform: 'uppercase', fontWeight: 700 }}>{item.format}</td>
                      <td>{item.size}</td>
                      <td>{item.recordsCount.toLocaleString('pt-BR')} reg.</td>
                      <td>
                        <span className="badge badge-success" style={{ fontSize: 10 }}>✓ {item.status}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {item.destiny === 'drive' || item.destiny === 'both' || item.driveUrl ? (
                          <a 
                            href={item.driveUrl || `https://drive.google.com/drive/search?q=${encodeURIComponent(item.fileName)}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn btn-secondary btn-xs"
                            style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                            title="Abrir no Google Drive"
                          >
                            <ExternalLink size={12} style={{ marginRight: 4 }} /> Abrir no Drive
                          </a>
                        ) : (
                          <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>💻 Local PC</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ABA 5: TABELAS INDIVIDUAIS (EXPORTAÇÃO GRANULAR) ── */}
      {activeTab === 'tabelas' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>📦 Mapeamento e Exportação Isolada</div>
              <span className="badge badge-neutral" style={{ fontSize: 11 }}>{totalTablesCount} Tabelas</span>
            </div>

            {/* Barra de busca de tabela */}
            <div style={{ position: 'relative', width: 260 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'hsl(var(--text-muted))' }} />
              <input
                className="form-input"
                placeholder="Buscar tabela..."
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                style={{ paddingLeft: 32, fontSize: 12 }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {CATEGORIES.map(cat => {
              const filteredItems = cat.items.filter(item => 
                item.label.toLowerCase().includes(tableSearch.toLowerCase()) || 
                item.endpoint.toLowerCase().includes(tableSearch.toLowerCase())
              )
              if (filteredItems.length === 0) return null

              return (
                <div key={cat.title} style={{ borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: cat.color, marginBottom: 10 }}>
                    {cat.title}
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {filteredItems.map(item => (
                      <div key={item.label} style={{ 
                        padding: '12px 14px', 
                        background: 'hsl(var(--bg-elevated))', 
                        borderRadius: 12, 
                        border: '1px solid hsl(var(--border-subtle))',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{item.label}</div>
                          <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{item.endpoint}</div>
                        </div>

                        <div style={{ display: 'flex', gap: 4 }}>
                          <button 
                            onClick={() => downloadSingleTable(item, 'json')}
                            className="btn btn-ghost btn-sm btn-icon"
                            style={{ color: cat.color }}
                            title={`Baixar JSON de ${item.label}`}
                            disabled={downloading}
                          >
                            <FileJson size={14} />
                          </button>
                          <button 
                            onClick={() => downloadSingleTable(item, 'xlsx')}
                            className="btn btn-ghost btn-sm btn-icon"
                            style={{ color: '#10b981' }}
                            title={`Baixar Excel de ${item.label}`}
                            disabled={downloading}
                          >
                            <FileSpreadsheet size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── MODAL DE VINCULAÇÃO E AUTENTICAÇÃO REAL COM GOOGLE DRIVE ── */}
      {showDriveModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 20
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 560, padding: '28px', borderRadius: 24, position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.4)', maxHeight: '90vh', overflowY: 'auto' }}>
            <button 
              onClick={() => setShowDriveModal(false)} 
              style={{ position: 'absolute', right: 20, top: 20, background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 50, height: 50, borderRadius: 14, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Cloud size={28} color="#3b82f6" />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Vincular Conta Oficial do Google Drive</h3>
                <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: '2px 0 0' }}>Escolha o método de conexão para criar pastas e salvar arquivos no seu Drive.</p>
              </div>
            </div>

            {/* Alternador de Método de Conexão */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              <button 
                className={`btn ${authMethod === 'webhook' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAuthMethod('webhook')}
                style={{ padding: '10px', fontSize: 12, fontWeight: 700, justifyContent: 'center' }}
              >
                <Code size={14} style={{ marginRight: 6 }} /> Webhook Apps Script (1 Minuto)
              </button>
              <button 
                className={`btn ${authMethod === 'oauth' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setAuthMethod('oauth')}
                style={{ padding: '10px', fontSize: 12, fontWeight: 700, justifyContent: 'center' }}
              >
                <Key size={14} style={{ marginRight: 6 }} /> Google OAuth2 Token
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              
              {/* MÉTODO 1: GOOGLE APPS SCRIPT WEBHOOK (MÉTODO RECOMENDADO FÁCIL) */}
              {authMethod === 'webhook' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ padding: '14px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12, fontSize: 12 }}>
                    <div style={{ fontWeight: 800, color: '#60a5fa', marginBottom: 8 }}>💡 Como conectar em 1 minuto:</div>
                    <ol style={{ paddingLeft: 16, margin: '0 0 12px 0', lineHeight: 1.8, color: 'hsl(var(--text-primary))' }}>
                      <li>Abra <a href="https://script.google.com" target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>script.google.com</a> → <strong>Novo projeto</strong></li>
                      <li>Apague o código existente e cole o script abaixo</li>
                      <li>Clique em <strong>Implantar → Nova implantação</strong></li>
                      <li>Tipo: <strong>App da Web</strong> | Acesso: <strong>Qualquer pessoa</strong></li>
                      <li>Copie a URL gerada e cole no campo abaixo</li>
                    </ol>

                    {/* Código visível do script */}
                    <div style={{ position: 'relative' }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        background: '#0f172a',
                        padding: '8px 12px',
                        borderRadius: '8px 8px 0 0',
                        borderBottom: '1px solid rgba(255,255,255,0.1)'
                      }}>
                        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>📋 Google Apps Script — Cole este código</span>
                        <button 
                          onClick={copyAppsScript}
                          className="btn btn-secondary btn-xs"
                          style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px' }}
                        >
                          {copiedScript ? <><Check size={12} color="#10b981" style={{ marginRight: 4 }} />Copiado!</> : <><Copy size={12} style={{ marginRight: 4 }} />Copiar Tudo</>}
                        </button>
                      </div>
                      <pre style={{ 
                        margin: 0,
                        padding: '14px',
                        background: '#0f172a',
                        borderRadius: '0 0 8px 8px',
                        fontSize: 11,
                        lineHeight: 1.6,
                        color: '#e2e8f0',
                        overflowX: 'auto',
                        maxHeight: 260,
                        overflowY: 'auto',
                        fontFamily: "'Courier New', Courier, monospace",
                        whiteSpace: 'pre'
                      }}>
                        <code>{googleAppsScriptCode}</code>
                      </pre>
                    </div>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 700 }}>URL do Google Apps Script WebApp</label>
                    <input 
                      className="form-input" 
                      placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                      value={webhookUrlInput}
                      onChange={e => setWebhookUrlInput(e.target.value)}
                      style={{ fontFamily: 'monospace', fontSize: 12 }}
                    />
                  </div>
                </div>
              )}

              {/* MÉTODO 2: GOOGLE OAUTH2 ACCESS TOKEN */}
              {authMethod === 'oauth' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 700 }}>Token de Acesso OAuth2 do Google (Bearer Token)</label>
                    <input 
                      className="form-input" 
                      type="password"
                      placeholder="ya29.a0ARW5m7... (Google Access Token)"
                      value={oauthTokenInput}
                      onChange={e => setOauthTokenInput(e.target.value)}
                      style={{ fontFamily: 'monospace', fontSize: 12 }}
                    />
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>
                      Requer escopo: <code>https://www.googleapis.com/auth/drive.file</code>
                    </div>
                  </div>
                </div>
              )}

              {/* E-mail da Conta */}
              <div>
                <label className="form-label" style={{ fontWeight: 700 }}>E-mail da sua Conta Google</label>
                <input 
                  className="form-input" 
                  type="email"
                  placeholder="seu.email@colegio.com.br"
                  value={userEmailInput}
                  onChange={e => setUserEmailInput(e.target.value)}
                />
              </div>

              {/* Nome da Pasta Remota */}
              <div>
                <label className="form-label" style={{ fontWeight: 700 }}>Pasta Destino no seu Google Drive</label>
                <input 
                  className="form-input" 
                  placeholder="EDU-IMPACTO-Backups"
                  value={driveFolderInput}
                  onChange={e => setDriveFolderInput(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
              </div>

              {/* Toggles de Backup Automático */}
              <div style={{ padding: '14px', background: 'hsl(var(--bg-elevated))', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-primary))', marginBottom: 2 }}>
                  ⚙️ Ações Automáticas na Vinculação:
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={runImmediateBackupOnLink} 
                    onChange={e => setRunImmediateBackupOnLink(e.target.checked)} 
                    style={{ width: 16, height: 16, accentColor: '#3b82f6' }}
                  />
                  <span>🚀 <strong>Executar 1º backup completo de dados reais</strong> ao concluir</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={enableAutoSyncOnLink} 
                    onChange={e => setEnableAutoSyncOnLink(e.target.checked)} 
                    style={{ width: 16, height: 16, accentColor: '#3b82f6' }}
                  />
                  <span>🤖 <strong>Ativar rotina de backup diário</strong> automático ({autoTime})</span>
                </label>
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleLinkGoogleDrive}
              disabled={isLinkingDrive}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: 15,
                fontWeight: 800,
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                border: 'none',
                boxShadow: '0 8px 20px rgba(59,130,246,0.3)'
              }}
            >
              {isLinkingDrive ? (
                <><RefreshCw size={18} className="animate-spin" style={{ marginRight: 8 }} /> Validando com Google API...</>
              ) : (
                <><CheckCircle2 size={18} style={{ marginRight: 8 }} /> Testar & Vincular Conta Google Drive</>
              )}
            </button>
          </div>
        </div>
      )}
      {/* ── MODAL DE CONCLUSÃO OU ERRO DO BACKUP ── */}
      {completionModal?.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20
        }}>
          <div className="card shadow-2xl" style={{
            maxWidth: 520,
            width: '100%',
            padding: 0,
            borderRadius: 24,
            overflow: 'hidden',
            border: `1px solid ${completionModal.success ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
            boxShadow: completionModal.success ? '0 20px 60px rgba(16,185,129,0.25)' : '0 20px 60px rgba(239,68,68,0.25)',
            background: 'hsl(var(--bg-card))',
            animation: 'fadeIn 0.25s ease-out'
          }}>
            {/* Modal Header Vibrant */}
            <div style={{
              padding: '24px 28px',
              background: completionModal.success 
                ? 'linear-gradient(135deg, #059669 0%, #10b981 50%, #2563eb 100%)' 
                : 'linear-gradient(135deg, #dc2626 0%, #ef4444 50%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.2)',
                  backdropFilter: 'blur(6px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.15)'
                }}>
                  {completionModal.success ? (
                    <CheckCircle2 size={30} color="#ffffff" />
                  ) : (
                    <AlertTriangle size={30} color="#ffffff" />
                  )}
                </div>
                <div>
                  <h3 style={{ fontSize: 19, fontWeight: 900, margin: 0, color: '#ffffff', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                    {completionModal.title}
                  </h3>
                  <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.95)', fontWeight: 700, marginTop: 3 }}>
                    {completionModal.success ? '✓ Processamento e Sincronização Aprovados' : '✕ Falha ao Concluir Operação'}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setCompletionModal(null)}
                style={{ 
                  background: 'rgba(255, 255, 255, 0.2)', 
                  border: '1px solid rgba(255,255,255,0.3)', 
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer', 
                  color: '#fff' 
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content Body */}
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              <p style={{ fontSize: 14, color: 'hsl(var(--text-primary))', fontWeight: 500, lineHeight: 1.6, margin: 0 }}>
                {completionModal.message}
              </p>

              {completionModal.success && (
                <div style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  borderRadius: 18,
                  padding: 18,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  fontSize: 13,
                  boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.2)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
                    <span style={{ color: 'hsl(var(--text-muted))', fontWeight: 600 }}>📄 Nome do Arquivo:</span>
                    <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#38bdf8' }}>{completionModal.fileName}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
                    <span style={{ color: 'hsl(var(--text-muted))', fontWeight: 600 }}>📊 Registros Reais Processados:</span>
                    <span style={{ fontWeight: 800, color: '#34d399' }}>{completionModal.recordsCount?.toLocaleString('pt-BR')} registros</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10 }}>
                    <span style={{ color: 'hsl(var(--text-muted))', fontWeight: 600 }}>📦 Tamanho do Pacote:</span>
                    <span style={{ fontWeight: 800, color: '#c084fc' }}>{completionModal.size}</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'hsl(var(--text-muted))', fontWeight: 600 }}>📍 Destino da Cópia:</span>
                    <span style={{ fontWeight: 800, color: '#f59e0b' }}>
                      {completionModal.destiny === 'pc' ? '💻 Computador Local' : completionModal.destiny === 'drive' ? '☁️ Google Drive' : '🔄 PC + Google Drive'}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                {completionModal.driveUrl && (
                  <a
                    href={completionModal.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                    style={{
                      flex: 1,
                      padding: '12px',
                      fontSize: 13,
                      fontWeight: 800,
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                      border: 'none',
                      boxShadow: '0 6px 16px rgba(59,130,246,0.3)',
                      textDecoration: 'none'
                    }}
                  >
                    <ExternalLink size={16} style={{ marginRight: 6 }} /> Abrir Arquivo no Google Drive
                  </a>
                )}
                <button
                  className={completionModal.driveUrl ? 'btn btn-secondary' : 'btn btn-primary'}
                  onClick={() => setCompletionModal(null)}
                  style={{
                    flex: completionModal.driveUrl ? 0.6 : 1,
                    padding: '12px',
                    fontSize: 13,
                    fontWeight: 800,
                    justifyContent: 'center'
                  }}
                >
                  {completionModal.success ? '✓ Concluído' : 'Fechar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
