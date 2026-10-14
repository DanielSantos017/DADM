import { NextResponse } from "next/server";
import { adminDatabase, requireBoard } from "@/lib/firebase-admin";
import { validateGovernancePolicy } from "@/lib/governance";

export const runtime = "nodejs";

type DraftPolicy = {
  version: string;
  treasury: { memberUids: string[]; quorum: number };
  council: { memberUids: string[]; quorum: number };
  reimbursementExceptionBodies: ("treasury" | "council")[];
  updatedAt?: number;
  updatedByUid?: string;
};

async function treasurer(request: Request) {
  const actor = await requireBoard(request);
  return actor?.role === "tesoureiro" ? actor : null;
}

export async function GET(request: Request) {
  try {
    if (!(await treasurer(request))) return NextResponse.json({ error: "Acesso exclusivo do tesoureiro." }, { status: 403 });
    const database = adminDatabase();
    const [rolesSnapshot, policySnapshot] = await Promise.all([database.ref("roles").get(), database.ref("governance_policy").get()]);
    const roles = rolesSnapshot.val() || {};
    const users = Object.entries(roles).map(([uid, value]) => {
      const profile = value as { email?: string; role?: string };
      return { uid, email: profile.email || "", role: profile.role || "pendente" };
    }).sort((a, b) => a.email.localeCompare(b.email, "pt-BR"));
    const policy = policySnapshot.val() as DraftPolicy | null;
    let configured = false;
    try { validateGovernancePolicy(policy); configured = true; } catch { /* Sem quóruns completos, votação permanece indisponível. */ }
    return NextResponse.json({ users, memberUids: policy?.treasury?.memberUids || [], quorum: policy?.treasury?.quorum || 0,
      councilConfigured: !!policy?.council?.memberUids?.length && !!policy.council.quorum, configured }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Erro ao consultar colegiado:", error);
    return NextResponse.json({ error: "Não foi possível consultar o colegiado." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await treasurer(request);
    if (!actor) return NextResponse.json({ error: "Acesso exclusivo do tesoureiro." }, { status: 403 });
    if (Number(request.headers.get("content-length") || 0) > 2048) return NextResponse.json({ error: "Dados acima do limite." }, { status: 413 });
    const input = await request.json();
    const uid = input?.uid;
    const action = input?.action;
    if (typeof uid !== "string" || !/^[A-Za-z0-9_-]{5,128}$/.test(uid) || !["add", "remove"].includes(action)) {
      return NextResponse.json({ error: "Usuário ou ação inválida." }, { status: 400 });
    }
    const database = adminDatabase();
    const profile = (await database.ref(`roles/${uid}`).get()).val() as { email?: string; role?: string } | null;
    if (!profile || !["tesoureiro", "coordenador", "usuario", "usuario_area", "adm_area"].includes(profile.role || "")) {
      return NextResponse.json({ error: "Escolha usuário cadastrado com acesso ativo." }, { status: 400 });
    }
    const now = Date.now();
    const policyRef = database.ref("governance_policy");
    const result = await policyRef.transaction((current: DraftPolicy | null) => {
      const policy: DraftPolicy = current || { version: "draft", treasury: { memberUids: [], quorum: 0 },
        council: { memberUids: [], quorum: 0 }, reimbursementExceptionBodies: [] };
      if (policy.council?.memberUids?.includes(uid) && action === "add") return;
      const members = Array.isArray(policy.treasury?.memberUids) ? policy.treasury.memberUids : [];
      if (action === "add" && members.includes(uid)) return;
      if (action === "remove" && !members.includes(uid)) return;
      const nextMembers = action === "add" ? [...members, uid].sort() : members.filter((member) => member !== uid);
      const quorum = Number.isSafeInteger(policy.treasury?.quorum) && policy.treasury.quorum <= nextMembers.length
        ? policy.treasury.quorum : 0;
      return { ...policy, version: `membership-${now}-${uid.slice(0, 12)}`, treasury: { memberUids: nextMembers, quorum },
        updatedAt: now, updatedByUid: actor.uid };
    }, undefined, false);
    if (!result.committed) return NextResponse.json({ error: "Vínculo já existente ou usuário pertence ao Conselho Administrativo." }, { status: 409 });
    const auditId = database.ref("governance_membership_audit").push().key;
    if (auditId) await database.ref(`governance_membership_audit/${auditId}`).set({ action, uid, email: profile.email || "", at: now, byUid: actor.uid, byEmail: actor.email })
      .catch((error) => console.error("Cargo atualizado, falha no histórico adicional:", error));
    let configured = false;
    try { validateGovernancePolicy(result.snapshot.val()); configured = true; } catch { /* Ainda não há quórum válido. */ }
    return NextResponse.json({ memberUids: result.snapshot.val()?.treasury?.memberUids || [], configured }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Erro ao atualizar colegiado:", error);
    return NextResponse.json({ error: "Não foi possível atualizar o cargo." }, { status: 503 });
  }
}
