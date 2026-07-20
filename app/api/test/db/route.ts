import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const supabase = getAdminClient()
  
  const { data: checkins } = await supabase.from('colaborador_checkin').select('*')
  const { data: sysUsers } = await supabase.from('system_users').select('id, email, nome')
  const { data: funcs } = await supabase.from('funcionarios').select('id, email, nome')

  const dump = JSON.stringify({ checkins, sysUsers, funcs }, null, 2)
  fs.writeFileSync(path.join(process.cwd(), 'db_dump.json'), dump)

  return NextResponse.json({ success: true })
}
