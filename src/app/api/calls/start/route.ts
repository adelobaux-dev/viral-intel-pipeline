import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    patientName?: string;
  };

  const { data, error } = await supabase
    .from("calls")
    .insert({
      user_id: user.id,
      patient_name: body.patientName?.trim() || null,
      start_time: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ callId: data.id });
}
