import { NextResponse } from "next/server";
import { adminDatabase, requireBoard } from "@/lib/firebase-admin";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    if (!(await requireBoard(request))) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    const { id } = await context.params;
    if (!/^[-A-Za-z0-9_]{8,120}$/.test(id)) {
      return NextResponse.json({ error: "Protocolo inválido." }, { status: 400 });
    }

    const snapshot = await adminDatabase().ref(`reimbursement_private/${id}`).get();
    if (!snapshot.exists()) {
      return NextResponse.json({ error: "Dados não encontrados." }, { status: 404 });
    }
    const { email, pixKey, pixHolderName } = snapshot.val();
    return NextResponse.json({ email, pixKey, pixHolderName }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Erro ao consultar reembolso privado:", error);
    return NextResponse.json({ error: "Não foi possível consultar o reembolso." }, { status: 503 });
  }
}
