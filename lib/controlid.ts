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

    // Strip data URL prefix if present
    const raw = base64Image.replace(/^data:image\/\w+;base64,/, '')
    const binary = Buffer.from(raw, 'base64')

    const res = await fetch(
      `${this.baseUrl}/user_set_image.fcgi?user_id=${userId}`,
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
      throw new Error(`Get image failed: ${res.status}`)
    }

    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    return `data:image/jpeg;base64,${base64}`
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
