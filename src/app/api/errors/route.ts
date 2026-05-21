import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Enregistre une erreur remontée par un utilisateur (toujours autorisé).
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    message?: string;
    detail?: string;
    path?: string;
  } | null;

  if (!body?.message?.trim()) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let email: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    email = user?.email ?? null;
  } catch {
    /* utilisateur non connecté : on logue quand même */
  }

  await createAdminClient()
    .from("error_logs")
    .insert({
      user_email: email,
      message: body.message.slice(0, 500),
      detail: body.detail?.slice(0, 3000) ?? null,
      path: body.path?.slice(0, 300) ?? null,
    });

  return NextResponse.json({ ok: true });
}

// Liste des erreurs : RÉSERVÉ au Dr Delobaux.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = (user?.email ?? "").toLowerCase();
  if (!email.includes("delobaux")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { data } = await createAdminClient()
    .from("error_logs")
    .select("id, user_email, message, detail, path, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return NextResponse.json({ errors: data ?? [] });
}

// Vider le journal : RÉSERVÉ au Dr Delobaux.
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = (user?.email ?? "").toLowerCase();
  if (!email.includes("delobaux")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  await createAdminClient()
    .from("error_logs")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  return NextResponse.json({ ok: true });
}
