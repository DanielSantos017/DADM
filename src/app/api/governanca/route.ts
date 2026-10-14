import { NextResponse } from "next/server";
import { adminDatabase, requireActiveUser } from "@/lib/firebase-admin";
import { validateGovernancePolicy, validateGovernanceRequest, type GovernanceRequest } from "@/lib/governance";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await requireActiveUser(request);
    if (!actor) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    const database = adminDatabase();
    const snapshot = await database.ref("governance_requests").orderByKey().limitToLast(200).get();
    const records = (Object.entries(snapshot.val() || {}) as [string, GovernanceRequest][])
      .map(([id, value]) => ({ ...value, id }))
      .sort((a, b) => b.createdAt - a.createdAt);
    let myBodies: ("treasury" | "council")[] = [];
    let exceptionBodies: ("treasury" | "council")[] = [];
    let policyConfigured = false;
    try {
      const policy = validateGovernancePolicy((await database.ref("governance_policy").get()).val());
      policyConfigured = true;
      myBodies = (["treasury", "council"] as const).filter((body) => policy[body].memberUids.includes(actor.uid));
      exceptionBodies = policy.reimbursementExceptionBodies;
    } catch { /* Política ausente: somente diretoria e autor consultam. */ }
    const visible = actor.role === "tesoureiro" || actor.role === "coordenador" || myBodies.length > 0
      ? records : records.filter((record) => record.createdByUid === actor.uid);
    const projectsSnapshot = actor.role === "usuario" ? null : await database.ref("projects").get();
    const projects = Object.entries(projectsSnapshot?.val() || {}).map(([id, value]) => {
      const name = value && typeof value === "object" && "name" in value && typeof value.name === "string" ? value.name : id;
      return { id, name };
    });
    return NextResponse.json({ requests: visible, projects, myBodies, exceptionBodies, policyConfigured }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Erro ao listar solicitações de governança:", error);
    return NextResponse.json({ error: "Não foi possível consultar as solicitações." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActiveUser(request);
    if (!actor) return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    if (Number(request.headers.get("content-length") || 0) > 16_384) {
      return NextResponse.json({ error: "Solicitação muito grande." }, { status: 413 });
    }
    const input = validateGovernanceRequest(await request.json());
    if (actor.role === "usuario" || (input.kind === "reserve_release" && actor.role !== "tesoureiro")
      || (input.kind === "reimbursement_exception" && actor.role !== "tesoureiro" && actor.role !== "coordenador")) {
      return NextResponse.json({ error: "Seu perfil não pode criar essa solicitação." }, { status: 403 });
    }
    if (input.kind === "project_budget" && !input.projectId) {
      return NextResponse.json({ error: "Vincule o orçamento a um projeto." }, { status: 400 });
    }
    const database = adminDatabase();
    if (input.projectId && !(await database.ref(`projects/${input.projectId}`).get()).exists()) {
      return NextResponse.json({ error: "Projeto não encontrado." }, { status: 400 });
    }
    if (input.kind === "reimbursement_exception") {
      const reimbursement = (await database.ref(`reimbursements/${input.reimbursementId}`).get()).val();
      if (!reimbursement || reimbursement.source !== "public" || reimbursement.status !== "pendente") {
        return NextResponse.json({ error: "Reembolso público pendente não encontrado." }, { status: 400 });
      }
      if (input.amountCents < Math.round(Number(reimbursement.amount) * 100)) {
        return NextResponse.json({ error: "A exceção não cobre o valor solicitado." }, { status: 400 });
      }
    }
    const id = input.kind === "reimbursement_exception"
      ? `exception_${input.reimbursementId}`
      : database.ref("governance_requests").push().key;
    if (!id) throw new Error("Não foi possível gerar o protocolo.");
    const record: GovernanceRequest = {
      ...input,
      createdAt: Date.now(),
      createdByUid: actor.uid,
      createdByEmail: actor.email,
      status: "pending",
    };
    if (input.kind === "reimbursement_exception") {
      const created = await database.ref(`governance_requests/${id}`).transaction((current) => current === null ? record : undefined, undefined, false);
      if (!created.committed) return NextResponse.json({ error: "Já existe uma exceção para esse reembolso." }, { status: 409 });
    } else {
      await database.ref(`governance_requests/${id}`).set(record);
    }
    return NextResponse.json({ protocol: id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && /inválid|Informe|Descreva/.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Erro ao criar solicitação de governança:", error);
    return NextResponse.json({ error: "Não foi possível registrar a solicitação." }, { status: 503 });
  }
}
