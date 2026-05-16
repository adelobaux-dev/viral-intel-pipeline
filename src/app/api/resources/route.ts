import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("closing_resources")
    .select("id, title, content, kind, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ resources: data ?? [] });
}

export async function POST(request: Request) {
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
  if (profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Réservé aux administrateurs (Dr Delobaux / Prescillia)" },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    title?: string;
    content?: string;
  } | null;

  if (!body?.title?.trim() || !body.content?.trim()) {
    return NextResponse.json(
      { error: "Titre et contenu requis" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("closing_resources")
    .insert({
      title: body.title.trim(),
      content: body.content.trim(),
      kind: "text",
      created_by: user.id,
    })
    .select("id, title, content, kind, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ resource: data });
}
