import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Upsert
  const { data, error } = await supabase.from('saida_config').upsert({
    id: 'default',
    dados: {
      "voiceURI": "",
      "voiceRate": 0.9,
      "voicePitch": 1,
      "rfidEnabled": true,
      "voiceVolume": 1,
      "tvUrgentTime": 5,
      "voiceEnabled": false, // CHANGED
      "tvDisplayTime": 40,   // CHANGED
      "allowMultiRFID": true,
      "voiceRepeatCount": 0,
      "voiceTruncateChar": "-",
      "voiceTruncateTurma": true,
      "requireConfirmation": true
    }
  }).select();

  console.log('Upsert:', data, error);
}

run();
