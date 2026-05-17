import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    content?: string;
  } | null;
  if (!body?.content?.trim()) {
    return NextResponse.json({ error: "Contenu vide" }, { status: 400 });
  }

  const { error } = await createAdminClient()
    .from("improvement_context")
    .insert({
      user_id: user.id,
      user_email: user.email ?? null,
      content: body.content.trim().slice(0, 4000),
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
