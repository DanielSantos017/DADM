import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getStorage } from "firebase-admin/storage";

function adminApp() {
  const existing = getApps()[0];
  if (existing) return existing;

  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!databaseURL || !storageBucket) {
    throw new Error("Firebase Admin não configurado.");
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const credential = serviceAccount
    ? cert(JSON.parse(serviceAccount))
    : applicationDefault();

  return initializeApp({ credential, databaseURL, storageBucket });
}

export function adminDatabase() {
  return getDatabase(adminApp());
}

export function adminStorage() {
  return getStorage(adminApp());
}

export async function requireActiveUser(request: Request) {
  const match = /^Bearer (.+)$/i.exec(request.headers.get("authorization") || "");
  if (!match) return null;

  let decoded;
  try {
    decoded = await getAuth(adminApp()).verifyIdToken(match[1]);
  } catch {
    return null;
  }
  const roleSnapshot = await adminDatabase().ref(`roles/${decoded.uid}/role`).get();
  const role = roleSnapshot.val();
  return ["tesoureiro", "coordenador", "adm_area", "usuario_area", "usuario"].includes(role)
    ? { uid: decoded.uid, email: decoded.email || "", role: role as "tesoureiro" | "coordenador" | "adm_area" | "usuario_area" | "usuario" }
    : null;
}

export async function requireBoard(request: Request) {
  const actor = await requireActiveUser(request);
  return actor?.role === "tesoureiro" || actor?.role === "coordenador" ? actor : null;
}
