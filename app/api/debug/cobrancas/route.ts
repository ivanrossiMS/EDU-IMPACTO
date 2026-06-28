import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';

export async function GET() {
  const { data, error } = await supabaseServer.from('agenda_cobrancas').select('*').order('created_at', { ascending: false }).limit(10);
  const { data: dests } = await supabaseServer.from('agenda_cobrancas_destinatarios').select('*').order('created_at', { ascending: false }).limit(20);
  const { data: coms } = await supabaseServer.from('comunicados').select('id, titulo, created_at').order('created_at', { ascending: false }).limit(5);
  
  return NextResponse.json({ cobrancas: data, dests, coms, error });
}
