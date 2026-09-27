'use strict';
/**
 * [EN]    Signs an eSocial event XML (any S-xxxx event) with the employer's e-CPF/e-CNPJ
 *         certificate, using a SolidSign KMS-custodied certificate. Always signs the ENTIRE
 *         document with the same fixed parameters.
 * [PT-BR] Assina o XML de um evento eSocial (qualquer evento S-xxxx) com o certificado
 *         e-CPF/e-CNPJ do empregador, via KMS SolidSign. Sempre assina o DOCUMENTO INTEIRO.
 */
import axios from 'axios';
import FormData from 'form-data';

interface SignLink { rel: string; href: string; }
interface SignedDocument { hash?: string; links?: SignLink[]; _links?: { self?: { href: string } }; }
interface SignResponse { identifier?: string; signatureCount?: number; documents: SignedDocument[]; }

export async function sign(document: Express.Multer.File, kmsCode: string): Promise<Buffer | null> {
  const baseUrl = (process.env.SOLIDSIGN_API_BASE_URL ?? '').replace(/\/$/, '');
  const authorization = process.env.SOLIDSIGN_API_AUTHORIZATION ?? '';

  const form = new FormData();
  form.append('document[0]', document.buffer, { filename: document.originalname });
  form.append('kmsCode', kmsCode);
  form.append('profile', process.env.SOLIDSIGN_ESOCIAL_PROFILE ?? 'XML_INTERNATIONAL');
  form.append('hashAlgorithm', process.env.SOLIDSIGN_ESOCIAL_HASH_ALGORITHM ?? 'SHA256');
  form.append('signaturePackaging', process.env.SOLIDSIGN_ESOCIAL_SIGNATURE_PACKAGING ?? 'ENVELOPED');
  form.append('canonicalizationMethod', process.env.SOLIDSIGN_ESOCIAL_CANONICALIZATION_METHOD ?? 'INCLUSIVE');
  form.append('isRemoveXPathExclusionFilter', process.env.SOLIDSIGN_ESOCIAL_REMOVE_XPATH_FILTER ?? 'true');
  form.append('isRemoveNamespacePrefixFromNodeNames', process.env.SOLIDSIGN_ESOCIAL_REMOVE_NAMESPACE_PREFIX ?? 'true');

  try {
    const resp = await axios.post<SignResponse>(`${baseUrl}/solidsign/dsig/xml/sign-kms`, form,
      { headers: { Authorization: authorization, ...form.getHeaders() }, timeout: 120000 });
    const doc = resp.data.documents?.[0];
    const href = doc?._links?.self?.href ?? doc?.links?.find((l) => l.rel === 'self')?.href;
    if (!href) { console.error('SolidSign response had no download link.'); return null; }

    const dl = await axios.get<ArrayBuffer>(href, {
      headers: { Authorization: authorization }, responseType: 'arraybuffer', timeout: 120000,
    });
    return Buffer.from(dl.data);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      console.error(`SolidSign API error ${err.response?.status}: ${JSON.stringify(err.response?.data)}`);
    } else {
      console.error(`Unexpected error during eSocial event signing: ${(err as Error).message}`);
    }
    return null;
  }
}
