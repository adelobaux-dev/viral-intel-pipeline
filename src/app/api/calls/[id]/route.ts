import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single<{ role: string }>();

  const isAdmin = profile?.role === "admin";

  // Le client admin contourne la RLS ; on impose nous-mêmes la règle :
  // un admin peut tout supprimer, sinon uniquement ses propres appels.
  const admin = createAdminClient();
  let query = admin.from("calls").delete().eq("id", params.id);
  if (!isAdmin) query = query.eq("user_id", user.id);

  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
