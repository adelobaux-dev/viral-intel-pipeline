import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function authorize(callId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié", status: 401 as const };

  // Seul le Dr Delobaux peut supprimer / restaurer.
  if (!(user.email ?? "").toLowerCase().includes("delobaux")) {
    return {
      error: "Action réservée au Dr Delobaux",
      status: 403 as const,
    };
  }

  const admin = createAdminClient();
  return { user, isAdmin: true, admin, callId };
}

// Suppression douce (→ corbeille), ou définitive si ?purge=1
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await authorize(params.id);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }
  const purge = new URL(request.url).searchParams.get("purge") === "1";

  let query = purge
    ? ctx.admin.from("calls").delete().eq("id", params.id)
    : ctx.admin
        .from("calls")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", params.id);
  if (!ctx.isAdmin) query = query.eq("user_id", ctx.user.id);

  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// Restauration depuis la corbeille
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const ctx = await authorize(params.id);
  if ("error" in ctx) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  let query = ctx.admin
    .from("calls")
    .update({ deleted_at: null })
    .eq("id", params.id);
  if (!ctx.isAdmin) query = query.eq("user_id", ctx.user.id);

  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
