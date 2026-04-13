import { NextResponse } from 'next/server'
import { createProtectedClient } from '@/lib/server/supabaseAuthFactory'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createProtectedClient();
    const { data, error } = await supabase.from('censo_escola_data').select('*').eq('tipo', 'alunos');
    if (error) throw new Error(error.message);
    return NextResponse.json((data||[]).map(r=>({...r,...r.dados})), { headers: {'Cache-Control': 'public, s-maxage=10'} })
  } catch (err: any) {
    return NextResponse.json({error: err.message}, {status: 400})
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const supabase = await createProtectedClient();
    if (Array.isArray(body)) {
      if (body.length===0) return NextResponse.json({ok:true,count:0});
      const rows = body.map(r=>({id:r.id||crypto.randomUUID(),tipo:'alunos',dados:r}));
      const {error} = await supabase.from('censo_escola_data').upsert(rows);
      if(error) throw new Error(error.message);
      return NextResponse.json({ok:true,count:rows.length})
    }
    const row={id:body.id||crypto.randomUUID(),tipo:'alunos',dados:body};
    const {data,error}=await supabase.from('censo_escola_data').upsert(row).select().single();
    if(error) throw new Error(error.message);
    return NextResponse.json({...data,...data.dados},{status:201})
  } catch (err: any) {
    return NextResponse.json({error: err.message}, {status: 400})
  }
}
