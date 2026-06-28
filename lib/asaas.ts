import fs from 'fs';
import path from 'path';

function getFallbackAsaasKey() {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      const match = content.match(/ASAAS_API_KEY=['"]?([^'"\n]+)['"]?/);
      if (match && match[1]) return match[1];
    }
  } catch(e) {}
  return undefined;
}

export async function asaasRequest(endpoint: string, method: string = 'GET', body: any = null) {
  const asaasApiKey = process.env.ASAAS_API_KEY || getFallbackAsaasKey();
  const asaasEnv = process.env.ASAAS_ENVIRONMENT || 'sandbox';
  const asaasApiUrl = asaasEnv === 'sandbox' 
    ? 'https://sandbox.asaas.com/api/v3'
    : 'https://api.asaas.com/v3';

  if (!asaasApiKey) {
    throw new Error("ASAAS_API_KEY não configurada no ambiente.");
  }

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': asaasApiKey
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${asaasApiUrl}${endpoint}`, options);
  
  if (!response.ok) {
    let errorMessage = response.statusText;
    try {
      const errorData = await response.json();
      console.error('ASAAS API Error:', errorData);
      if (errorData.errors && errorData.errors.length > 0) {
        errorMessage = errorData.errors.map((e: any) => e.description).join(', ');
      }
    } catch(e) {}
    throw new Error(`Erro na API do Asaas: ${errorMessage}`);
  }

  return response.json();
}
