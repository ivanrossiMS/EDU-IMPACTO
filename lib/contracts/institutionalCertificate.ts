/**
 * lib/contracts/institutionalCertificate.ts
 *
 * Módulo de Assinatura Criptográfica Incorporada em PDF (PAdES / PKCS#7 / Adobe.PPKLite).
 * Responsável por gerenciar o Certificado Digital Corporativo X.509 do Colégio Impacto
 * e incorporar campos técnicos /Type /Sig e /ByteRange aos documentos nos termos da
 * Medida Provisória nº 2.200-2/2001 (art. 10, § 2º) e Código Civil (arts. 107 e 219).
 */

import fs from 'fs'
import path from 'path'
import forge from 'node-forge'
import { SignPdf } from '@signpdf/signpdf'
import { P12Signer } from '@signpdf/signer-p12'
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib'
import { PDFDocument } from 'pdf-lib'

const CERT_DIR = path.join(process.cwd(), 'storage', 'certs')
const CERT_PATH = path.join(CERT_DIR, 'colegio_impacto_keystore.p12')
const PASSPHRASE = process.env.INSTITUTIONAL_CERT_PASSPHRASE || 'impacto-edu-cert-2027'

let cachedP12Buffer: Buffer | null = null

/**
 * Obtém ou gera em tempo de execução o keystore PKCS#12 corporativo do Colégio Impacto.
 * O certificado é emitido em nome da instituição de ensino com validade de 10 anos.
 */
export function getOrGenerateInstitutionalP12(): Buffer {
  if (cachedP12Buffer) {
    return cachedP12Buffer
  }

  // 0. Verifica se há certificado A1 ICP-Brasil configurado via ENV (Base64 ou arquivo seguro)
  const envCertB64 = process.env.INSTITUTIONAL_CERT_P12_BASE64
  if (envCertB64) {
    try {
      const buffer = Buffer.from(envCertB64, 'base64')
      cachedP12Buffer = buffer
      return buffer
    } catch (errEnv) {
      console.warn('[InstitutionalCert] Falha ao ler certificado da variável INSTITUTIONAL_CERT_P12_BASE64:', errEnv)
    }
  }

  const customCertPath = process.env.INSTITUTIONAL_CERT_PATH
  if (customCertPath && fs.existsSync(customCertPath)) {
    try {
      const buffer = fs.readFileSync(customCertPath)
      cachedP12Buffer = buffer
      return buffer
    } catch (errPath) {
      console.warn('[InstitutionalCert] Falha ao ler certificado do caminho customizado:', errPath)
    }
  }

  // 1. Tenta ler do disco
  try {
    if (fs.existsSync(CERT_PATH)) {
      const buffer = fs.readFileSync(CERT_PATH)
      cachedP12Buffer = buffer
      return buffer
    }
  } catch (e) {
    console.warn('[InstitutionalCert] Falha ao ler certificado do disco, gerando novo:', e)
  }

  // 2. Gera novo par de chaves RSA 2048-bit e certificado X.509 corporativo
  console.log('[InstitutionalCert] Gerando Certificado Corporativo X.509 para COLÉGIO IMPACTO CENTRO DE ENSINO LTDA...')
  const keys = forge.pki.rsa.generateKeyPair(2048)
  const cert = forge.pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = String(Date.now())
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10)

  const attrs = [
    { name: 'commonName', value: 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA - Autoridade de Assinatura Institucional' },
    { name: 'countryName', value: 'BR' },
    { shortName: 'ST', value: 'Mato Grosso do Sul' },
    { name: 'localityName', value: 'Campo Grande' },
    { name: 'organizationName', value: 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA' },
    { shortName: 'OU', value: 'CNPJ: 04.395.789/0001-88' },
  ]
  cert.setSubject(attrs)
  cert.setIssuer(attrs)

  // Extensões de uso de chave (Assinatura Digital de Documentos)
  cert.setExtensions([
    {
      name: 'basicConstraints',
      cA: true,
    },
    {
      name: 'keyUsage',
      keyCertSign: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: true,
      dataEncipherment: true,
    },
    {
      name: 'extKeyUsage',
      serverAuth: false,
      clientAuth: false,
      codeSigning: false,
      emailProtection: true,
      timeStamping: true,
    },
  ])

  cert.sign(keys.privateKey, forge.md.sha256.create())

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], PASSPHRASE, {
    generateLocalKeyId: true,
    friendlyName: 'Colegio Impacto Assinatura Digital Corporativa',
  })
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes()
  const p12Buffer = Buffer.from(p12Der, 'binary')

  // Salva no disco para reutilização
  try {
    if (!fs.existsSync(CERT_DIR)) {
      fs.mkdirSync(CERT_DIR, { recursive: true })
    }
    fs.writeFileSync(CERT_PATH, p12Buffer)
  } catch (errSave) {
    console.warn('[InstitutionalCert] Não foi possível persistir certificado no disco:', errSave)
  }

  cachedP12Buffer = p12Buffer
  return p12Buffer
}

export interface AssinarPdfParams {
  pdfBytes: Uint8Array
  reason?: string
  name?: string
  contactInfo?: string
  location?: string
}

/**
 * Aplica a Assinatura Criptográfica Digital /Sig e /ByteRange nos bytes do PDF.
 * O arquivo gerado é compatível com Adobe Acrobat Reader e detecta qualquer
 * alteração ou adulteração posterior à assinatura.
 */
export async function assinarPdfCriptograficamente(
  params: AssinarPdfParams | Uint8Array
): Promise<Uint8Array> {
  const rawBytes = params instanceof Uint8Array ? params : params.pdfBytes
  const reason = !(params instanceof Uint8Array) && params.reason
    ? params.reason
    : 'Assinatura Eletrônica e Selo Digital de Integridade • MP 2.200-2/2001 e Código Civil'
  const name = !(params instanceof Uint8Array) && params.name
    ? params.name
    : 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA (CNPJ: 04.395.789/0001-88)'
  const contactInfo = !(params instanceof Uint8Array) && params.contactInfo
    ? params.contactInfo
    : 'contato@impacto-edu.net'
  const location = !(params instanceof Uint8Array) && params.location
    ? params.location
    : 'Campo Grande - MS, Brasil'

  // 1. Carrega o documento e insere o placeholder de assinatura PKCS#7
  const pdfDoc = await PDFDocument.load(rawBytes)

  pdflibAddPlaceholder({
    pdfDoc,
    reason,
    contactInfo,
    name,
    location,
    signatureLength: 8192,
  })

  const pdfWithPlaceholder = await pdfDoc.save()

  // 2. Obtém o certificado institucional PKCS#12
  const p12Buffer = getOrGenerateInstitutionalP12()

  // 3. Aplica o selo criptográfico PKCS#7 detached nos intervalos do ByteRange
  const signer = new SignPdf()
  const p12Signer = new P12Signer(p12Buffer, { passphrase: PASSPHRASE })

  const signedPdf = await signer.sign(pdfWithPlaceholder, p12Signer)
  return new Uint8Array(signedPdf)
}
