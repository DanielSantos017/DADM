import { createHmac } from "node:crypto";
import { ServerValue } from "firebase-admin/database";
import { NextResponse } from "next/server";
import { adminDatabase, adminStorage } from "@/lib/firebase-admin";
import { MAX_RECEIPT_SIZE, receiptContentType, validatePublicReimbursement } from "@/lib/reimbursement-validation";

export const runtime = "nodejs";

async function verifyTurnstile(token: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token) return false;
  const body = new URLSearchParams({ secret, response: token });
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return false;
  const result: { success?: boolean; hostname?: string } = await response.json();
  const expectedHostname = process.env.TURNSTILE_EXPECTED_HOSTNAME;
  return result.success === true && (!expectedHostname || result.hostname === expectedHostname);
}

async function checkRateLimit(request: Request) {
  const secret = process.env.PUBLIC_FORM_RATE_SECRET;
  if (!secret) throw new Error("Limite de envios não configurado.");

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip") || "unknown";
  const key = createHmac("sha256", secret).update(ip).digest("hex");
  const now = Date.now();
  const limitRef = adminDatabase().ref(`public_submission_limits/${key}`);
  const result = await limitRef.transaction((current: { start?: number; count?: number } | null) => {
    if (!current?.start || now - current.start >= 60 * 60 * 1000) return { start: now, count: 1 };
    if ((current.count || 0) >= 5) return;
    return { start: current.start, count: (current.count || 0) + 1 };
  }, undefined, false);
  return result.committed;
}

export async function POST(request: Request) {
  if (!process.env.TURNSTILE_SECRET_KEY || !process.env.PUBLIC_FORM_RATE_SECRET) {
    return NextResponse.json({ error: "Formulário temporariamente indisponível." }, { status: 503 });
  }
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 7 * 1024 * 1024) {
    return NextResponse.json({ error: "Arquivo muito grande." }, { status: 413 });
  }

  try {
    const form = await request.formData();
    if (form.get("website")) {
      return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 });
    }
    if (!(await verifyTurnstile(String(form.get("turnstileToken") || "")))) {
      return NextResponse.json({ error: "Verificação de segurança inválida. Tente novamente." }, { status: 400 });
    }
    if (!(await checkRateLimit(request))) {
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 });
    }

    const data = validatePublicReimbursement(form);
    const file = form.get("receipt");
    if (!(file instanceof File) || file.size === 0 || file.size > MAX_RECEIPT_SIZE) {
      return NextResponse.json({ error: "Envie um comprovante de até 5 MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { type, extension } = receiptContentType(buffer);
    const database = adminDatabase();
    const id = database.ref("reimbursements").push().key;
    if (!id) throw new Error("Não foi possível criar o protocolo.");

    const receiptPath = `reimbursements/${id}/receipt.${extension}`;
    const storedFile = adminStorage().bucket().file(receiptPath);
    await storedFile.save(buffer, { resumable: false, contentType: type, metadata: { cacheControl: "private, no-store" } });

    try {
      await database.ref().update({
        [`reimbursements/${id}`]: {
          requestedByName: data.name,
          description: data.justification,
          amount: data.amount,
          category: "Geral",
          status: "pendente",
          source: "public",
          timestamp: ServerValue.TIMESTAMP,
          expenseAt: data.expenseAt,
          authorizationProtocol: data.authorizationProtocol || null,
        },
        [`reimbursement_private/${id}`]: {
          email: data.email,
          pixKey: data.pixKey,
          pixHolderName: data.pixHolderName,
          receiptPath,
        },
      });
    } catch (error) {
      await storedFile.delete().catch(() => undefined);
      throw error;
    }

    return NextResponse.json({ protocol: id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && (/Informe|justificativa|valor|comprovante|Envie/.test(error.message))) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Erro ao receber reembolso público:", error);
    return NextResponse.json({ error: "Não foi possível enviar a solicitação." }, { status: 503 });
  }
}
