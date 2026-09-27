'use strict';
/**
 * [EN]    eSocial use case — single sign-evento endpoint, KMS custody.
 *         Dev: npm run dev
 *         POST http://localhost:8103/api/esocial/sign-evento
 * [PT-BR] Caso de uso eSocial — endpoint único de assinatura, custódia KMS.
 */
import 'dotenv/config';
import express, { Request, Response } from 'express';
import multer from 'multer';
import { sign } from './service';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/esocial/sign-evento', upload.single('document'), async (req: Request, res: Response) => {
  const document = req.file;
  const b = req.body as Record<string, string>;
  if (!document || !b.kmsCode) return res.status(400).json({ error: 'document and kmsCode are required' });

  const signed = await sign(document, b.kmsCode);
  if (!signed) return res.status(500).json({ error: 'Signing failed. Check logs.' });

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Content-Disposition', 'attachment; filename="evento_esocial_signed.xml"');
  return res.send(signed);
});

const PORT = Number(process.env.PORT ?? 8103);
app.listen(PORT, () => console.info(`SolidSign eSocial use-case example (TS) running on port ${PORT}`));
