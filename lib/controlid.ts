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
    this.baseUrl = `https://${config.ip}:${config.port}`
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
        signal: AbortSignal.timeout(8000),
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
      signal: AbortSignal.timeout(15000),
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
          signal: AbortSignal.timeout(15000),
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
    return this.request('set_configuration.fcgi', {
      monitor: {
        request_timeout: 3000,
        hostname: webhookUrl,
        port: 443,
        path: '/api/portaria/webhook',
      },
    })
  }
}
