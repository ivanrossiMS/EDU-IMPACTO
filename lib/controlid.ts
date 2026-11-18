/**
 * Control iD iDFace — HTTP Client
 * Encapsula toda comunicação REST com o equipamento de reconhecimento facial.
 * API Reference: https://documenter.getpostman.com/view/10800185/2s9YJgSKm2
 */

interface DeviceInfo {
  serial: string
  model: string
  firmware: string
  online: boolean
}

interface ControliDConfig {
  ip: string
  port: number
  login?: string
  password?: string
}

export class ControliDClient {
  private baseUrl: string
  private session: string | null = null
  private login: string
  private password: string

  constructor(config: ControliDConfig) {
    const protocol = config.port === 80 ? 'http' : 'https'
    const cleanIp = config.ip.replace(/^https?:\/\//i, '')
    this.baseUrl = `${protocol}://${cleanIp}:${config.port}`
    this.login = config.login || 'admin'
    this.password = config.password || 'admin'
  }

  // ─── Auth ─────────────────────────────────────────────────────────
  async authenticate(): Promise<string> {
    try {
      const res = await fetch(`${this.baseUrl}/login.fcgi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: this.login, password: this.password }),
        signal: AbortSignal.timeout(3000),
      })
      if (!res.ok) throw new Error(`Login failed: ${res.status}`)
      const data = await res.json()
      this.session = data.session
      return data.session
    } catch (err: any) {
      throw new Error(`iDFace auth error: ${err.message}`)
    }
  }

  private async request(endpoint: string, body: any = {}): Promise<any> {
    if (!this.session) await this.authenticate()

    const res = await fetch(`${this.baseUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${this.session}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    })

    if (!res.ok) {
      // Session may have expired, re-auth once
      if (res.status === 401) {
        await this.authenticate()
        const retry = await fetch(`${this.baseUrl}/${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `session=${this.session}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(3000),
        })
        if (!retry.ok) throw new Error(`iDFace request failed: ${retry.status}`)
        return retry.json()
      }
      throw new Error(`iDFace request failed: ${res.status}`)
    }

    return res.json()
  }

  // ─── Users (Alunos) ───────────────────────────────────────────────
  async createUser(id: number, name: string, registration?: string): Promise<any> {
    return this.request('create_objects.fcgi', {
      object: 'users',
      values: [{ id, name, registration: registration || String(id) }],
    })
  }

  async updateUser(id: number, name: string): Promise<any> {
    return this.request('modify_objects.fcgi', {
      object: 'users',
      values: { name },
      where: { users: { id } },
    })
  }

  async deleteUser(id: number): Promise<any> {
    return this.request('destroy_objects.fcgi', {
      object: 'users',
      where: { users: { id } },
    })
  }

  async loadUsers(): Promise<any> {
    return this.request('load_objects.fcgi', {
      object: 'users',
    })
  }

  // ─── Photos ───────────────────────────────────────────────────────
  async setUserImage(userId: number, base64Image: string): Promise<any> {
    if (!this.session) await this.authenticate()

    if (!base64Image || base64Image.length < 200 || base64Image === 'data:image/jpeg;base64,') {
      throw new Error('Imagem inválida ou vazia')
    }

    // Strip data URL prefix if present
    const raw = base64Image.replace(/^data:image\/\w+;base64,/, '')
    const binary = Buffer.from(raw, 'base64')

    const sendImage = async () => {
      const nowTs = Math.floor(Date.now() / 1000)
      const res = await fetch(
        `${this.baseUrl}/user_set_image.fcgi?user_id=${userId}&session=${encodeURIComponent(this.session!)}&timestamp=${nowTs}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            Cookie: `session=${this.session}`,
          },
          body: binary,
          signal: AbortSignal.timeout(30000),
        }
      )
      if (!res.ok) throw new Error(`Set image failed: ${res.status}`)
      return res.json()
    }

    let data = await sendImage()
    if (data && data.success === false) {
      const faceExistsErr = (data.errors || []).find((e: any) => e.code === 3)
      const matchUserId = faceExistsErr?.info?.match_user_id
      if (matchUserId && Number(matchUserId) !== Number(userId)) {
        // Remove cadastro órfão antigo que prendia a mesma biometria facial e reenvia para o ID atual
        await this.deleteUser(Number(matchUserId)).catch(() => {})
        data = await sendImage()
      } else if (matchUserId && Number(matchUserId) === Number(userId)) {
        return { ...data, success: true }
      }
    }

    if (data && data.success === false) {
      const errMsg = data.errors?.[0]?.message || 'Foto recusada pela biometria da catraca'
      throw new Error(`Biometria recusada (${errMsg})`)
    }

    return data
  }

  async getUserImage(userId: number): Promise<string> {
    if (!this.session) await this.authenticate()

    const res = await fetch(
      `${this.baseUrl}/user_get_image.fcgi?user_id=${userId}`,
      {
        method: 'POST',
        headers: {
          Cookie: `session=${this.session}`,
        },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(15000),
      }
    )

    if (!res.ok) {
      return ''
    }

    const buffer = await res.arrayBuffer()
    if (!buffer || buffer.byteLength < 200) {
      return ''
    }

    const uint8 = new Uint8Array(buffer)
    // Valida bytes mágicos de imagens válidas:
    // JPEG: 0xFF 0xD8
    // PNG: 0x89 0x50 0x4E 0x47
    // WebP: 0x52 0x49 0x46 0x46 (RIFF)
    const isJpeg = uint8[0] === 0xff && uint8[1] === 0xd8
    const isPng = uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4e && uint8[3] === 0x47
    const isWebp = uint8[0] === 0x52 && uint8[1] === 0x49 && uint8[2] === 0x46 && uint8[3] === 0x46

    if (!isJpeg && !isPng && !isWebp) {
      return ''
    }

    const base64 = Buffer.from(buffer).toString('base64')
    const mime = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg'
    return `data:${mime};base64,${base64}`
  }


  // ─── Access Logs ──────────────────────────────────────────────────
  async loadAccessLogs(limit = 100): Promise<any> {
    return this.request('load_objects.fcgi', {
      object: 'access_logs',
      limit,
      order: 'time DESC',
    })
  }

  // ─── Templates ────────────────────────────────────────────────────
  async loadTemplates(userId?: number): Promise<any> {
    const body: any = { object: 'templates' }
    if (userId) body.where = { templates: { user_id: userId } }
    return this.request('load_objects.fcgi', body)
  }

  // ─── System ───────────────────────────────────────────────────────
  async getDeviceInfo(): Promise<DeviceInfo> {
    try {
      const data = await this.request('system_information.fcgi', {})
      return {
        serial: data.serial || '',
        model: data.model || 'iDFace',
        firmware: data.firmware || '',
        online: true,
      }
    } catch {
      return { serial: '', model: 'iDFace', firmware: '', online: false }
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const info = await this.getDeviceInfo()
      return info.online
    } catch {
      return false
    }
  }

  /** Configure iDFace to push events to our webhook */
  async setMonitorConfig(webhookUrl: string): Promise<any> {
    // Extrai o host (IP ou domínio) e a porta da URL recebida
    let hostname = webhookUrl
    let port = 80
    let path = '/api/portaria/webhook'
    
    try {
      const parsed = new URL(webhookUrl)
      hostname = parsed.hostname
      port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80)
      path = parsed.pathname + parsed.search
    } catch {
      // Fallback em caso de string que não seja URL absoluta completa
      hostname = webhookUrl.replace(/^https?:\/\//i, '').split(':')[0]
      port = webhookUrl.includes('https') ? 443 : 80
    }

    return this.request('set_configuration.fcgi', {
      monitor: {
        request_timeout: '5000',
        hostname,
        port: String(port),
        path,
      },
    })
  }

  // ─── Gate Control & Relay (Abertura Remota) ────────────────────────
  async openDoor(): Promise<any> {
    return this.request('execute_actions.fcgi', {
      actions: [
        {
          action: 'door',
          parameters: 'door=1'
        }
      ]
    })
  }

  // ─── Generic Object Access & Exit Blocking Rules ──────────────────
  async loadObjects(object: string, opts: { where?: any; fields?: string[]; limit?: number; order?: any } = {}): Promise<any> {
    const body: any = { object }
    if (opts.where) body.where = opts.where
    if (opts.fields) body.fields = opts.fields
    if (opts.limit) body.limit = opts.limit
    if (opts.order) body.order = opts.order
    return this.request('load_objects.fcgi', body)
  }

  async createObjects(object: string, values: any[]): Promise<any> {
    return this.request('create_objects.fcgi', { object, values })
  }

  async modifyObjects(object: string, values: any, where: any): Promise<any> {
    return this.request('modify_objects.fcgi', { object, values, where })
  }

  async destroyObjects(object: string, where: any): Promise<any> {
    return this.request('destroy_objects.fcgi', { object, where })
  }

  async ensureUserDefaultGroup(userId: number, groupId = 1): Promise<void> {
    try {
      const existing = await this.loadObjects('user_groups', {
        where: { user_groups: { user_id: userId, group_id: groupId } },
      })
      if (!existing?.user_groups?.length) {
        await this.createObjects('user_groups', [{ user_id: userId, group_id: groupId }])
      }
    } catch {
      // Ignora se já vinculado
    }
  }

  /**
   * Garante na catraca Mestre (.150) a estrutura de bloqueio exclusivo para o portal de SAÍDA:
   * - Grupo "EDU_BLOQUEIO_SAIDA_SOZINHO"
   * - Horário 24h "EDU_24H_BLOQUEIO"
   * - Regra de acesso type=0 (Bloqueio) "EDU_REGRA_BLOQUEIO_SAIDA"
   * - Vínculo exclusivo no portal de Saída (nunca na Entrada!)
   */
  async ensureExitBlockingRuleConfigured(): Promise<{ configured: boolean; groupId?: number; portalId?: number; reason?: string }> {
    const GROUP_NAME = 'EDU_BLOQUEIO_SAIDA_SOZINHO'
    const RULE_NAME = 'EDU_REGRA_BLOQUEIO_SAIDA'
    const TZ_NAME = 'EDU_24H_BLOQUEIO'

    const portalsRes = await this.loadObjects('portals')
    const portals: any[] = portalsRes?.portals || []
    if (portals.length < 2) {
      return {
        configured: false,
        reason: `Apenas ${portals.length} portal encontrado na catraca; bloqueio exclusivo de saída exige 2 portais distintos.`,
      }
    }

    const portalIds = new Set(portals.map(p => Number(p.id)).filter(id => id > 0))
    let exitPortalId: number | null = null
    let entryPortalId: number | null = null

    // 1. Prioridade máxima: component_id real nos access_logs (810373890 = Saída .154, 810373889 = Entrada .150)
    try {
      const logsRes = await this.loadObjects('access_logs', { limit: 150, order: ['id', 'descending'] })
      const logs: any[] = logsRes?.access_logs || []
      for (const l of logs) {
        const cid = Number(l.component_id || 0)
        const pid = Number(l.portal_id || l.portal || 0)
        if (pid <= 0 || !portalIds.has(pid)) continue
        if (!exitPortalId && cid === 810373890 && pid !== entryPortalId) exitPortalId = pid
        if (!entryPortalId && cid === 810373889 && pid !== exitPortalId) entryPortalId = pid
        if (exitPortalId && entryPortalId) break
      }
    } catch {
      // Fallback abaixo
    }

    // 2. Fallback determinístico pelo mapeamento físico da .150 (Portal 1 = Saída, Portal 2 = Entrada)
    if (!exitPortalId && portalIds.has(1) && portalIds.has(2) && entryPortalId !== 1) {
      exitPortalId = 1
      if (!entryPortalId) entryPortalId = 2
    }

    // 3. Último recurso: nomes dos portais
    if (!exitPortalId) {
      for (const p of portals) {
        const pid = Number(p.id)
        const name = String(p.name || '').toLowerCase()
        const isExitName = /sa[ií]da|gar[cç]as|exit|extern/.test(name) && !/entrada/.test(name)
        const isEntryName = /entrada|entry|principal|m[eé]dio/.test(name) && !/sa[ií]da|saida/.test(name)
        if (isExitName && !exitPortalId && pid !== entryPortalId) exitPortalId = pid
        if (isEntryName && !entryPortalId && pid !== exitPortalId) entryPortalId = pid
      }
    }

    if (!exitPortalId || exitPortalId === entryPortalId) {
      return {
        configured: false,
        reason: 'Não foi possível distinguir com segurança o Portal de Saída do Portal de Entrada.',
      }
    }

    // 1. Grupo
    const groupsRes = await this.loadObjects('groups', { where: { groups: { name: GROUP_NAME } } })
    let groupId: number | undefined = groupsRes?.groups?.[0]?.id ? Number(groupsRes.groups[0].id) : undefined
    if (!groupId) {
      const created = await this.createObjects('groups', [{ name: GROUP_NAME }])
      groupId = Number(created?.ids?.[0])
    }

    // 2. Fuso 24h
    const tzRes = await this.loadObjects('time_zones', { where: { time_zones: { name: TZ_NAME } } })
    let tzId: number | undefined = tzRes?.time_zones?.[0]?.id ? Number(tzRes.time_zones[0].id) : undefined
    if (!tzId) {
      const created = await this.createObjects('time_zones', [{ name: TZ_NAME }])
      tzId = Number(created?.ids?.[0])
    }

    const spansRes = await this.loadObjects('time_spans', { where: { time_spans: { time_zone_id: tzId } } })
    if (!spansRes?.time_spans?.length && tzId) {
      try {
        await this.createObjects('time_spans', [{
          time_zone_id: tzId,
          start: 0,
          end: 86399,
          sun: 1, mon: 1, tue: 1, wed: 1, thu: 1, fri: 1, sat: 1,
          hol1: 1, hol2: 1, hol3: 1,
        }])
      } catch {
        await this.createObjects('time_spans', [{
          time_zone_id: tzId,
          start: 0,
          end: 86399,
          sun: 1, mon: 1, tue: 1, wed: 1, thu: 1, fri: 1, sat: 1,
        }])
      }
    }

    // 3. Regra de Bloqueio (type = 0)
    const rulesRes = await this.loadObjects('access_rules', { where: { access_rules: { name: RULE_NAME } } })
    let ruleId: number | undefined = rulesRes?.access_rules?.[0]?.id ? Number(rulesRes.access_rules[0].id) : undefined
    if (!ruleId) {
      const created = await this.createObjects('access_rules', [{ name: RULE_NAME, type: 0, priority: 0 }])
      ruleId = Number(created?.ids?.[0])
    } else if (Number(rulesRes.access_rules[0].type) !== 0) {
      await this.modifyObjects('access_rules', { type: 0, priority: 0 }, { access_rules: { id: ruleId } })
    }

    if (!groupId || !tzId || !ruleId) {
      return { configured: false, reason: 'Falha ao obter IDs de grupo/regra/horário na catraca.' }
    }

    // 4. Vínculo regra <-> horário
    const artzRes = await this.loadObjects('access_rule_time_zones', {
      where: { access_rule_time_zones: { access_rule_id: ruleId, time_zone_id: tzId } },
    })
    if (!artzRes?.access_rule_time_zones?.length) {
      await this.createObjects('access_rule_time_zones', [{ access_rule_id: ruleId, time_zone_id: tzId }])
    }

    // 5. Vínculo grupo <-> regra
    const garRes = await this.loadObjects('group_access_rules', {
      where: { group_access_rules: { group_id: groupId, access_rule_id: ruleId } },
    })
    if (!garRes?.group_access_rules?.length) {
      await this.createObjects('group_access_rules', [{ group_id: groupId, access_rule_id: ruleId }])
    }

    // 6. Vínculo portal <-> regra (APENAS portal de Saída!)
    const parRes = await this.loadObjects('portal_access_rules', {
      where: { portal_access_rules: { access_rule_id: ruleId } },
    })
    const existingPortals = (parRes?.portal_access_rules || []).map((r: any) => Number(r.portal_id))
    for (const pId of existingPortals) {
      if (pId !== exitPortalId) {
        await this.destroyObjects('portal_access_rules', {
          portal_access_rules: { portal_id: pId, access_rule_id: ruleId },
        })
      }
    }
    if (!existingPortals.includes(exitPortalId)) {
      await this.createObjects('portal_access_rules', [{ portal_id: exitPortalId, access_rule_id: ruleId }])
    }

    return { configured: true, groupId, portalId: exitPortalId }
  }

  async syncStudentExitBlockGroup(userId: number, blockExit: boolean, blockGroupId: number): Promise<void> {
    const existing = await this.loadObjects('user_groups', {
      where: { user_groups: { user_id: userId, group_id: blockGroupId } },
    })
    const isLinked = Boolean(existing?.user_groups?.length)
    if (blockExit && !isLinked) {
      await this.createObjects('user_groups', [{ user_id: userId, group_id: blockGroupId }])
    } else if (!blockExit && isLinked) {
      await this.destroyObjects('user_groups', {
        user_groups: { user_id: userId, group_id: blockGroupId },
      })
    }
  }

  // ─── System Controls ──────────────────────────────────────────────
  async reboot(): Promise<any> {
    return this.request('reboot.fcgi', {})
  }

  async setSystemTime(date: Date): Promise<any> {
    return this.request('set_system_time.fcgi', {
      day: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds()
    })
  }
}
