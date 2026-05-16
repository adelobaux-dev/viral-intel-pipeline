import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-medical-600">
            Cabinet Dr Alexis Delobaux
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-800">
            Assistant de closing
          </h1>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
