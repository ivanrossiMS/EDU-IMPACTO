import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function test() {
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: 'test_trigger@impactoedu.local',
    password: 'password123',
    email_confirm: true,
  })
  console.log('authData', authData?.user?.id, authErr)
  
  if (authData?.user?.id) {
    const { data: sysUser } = await supabase.from('system_users').select('*').eq('email', 'test_trigger@impactoedu.local')
    console.log('sysUser automatically created?', sysUser)
    
    // cleanup
    await supabase.auth.admin.deleteUser(authData.user.id)
    await supabase.from('system_users').delete().eq('email', 'test_trigger@impactoedu.local')
  }
}
test()
