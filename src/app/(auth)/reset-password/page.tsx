import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/reset-password-form";

// The form reads ?token= with useSearchParams, which must sit inside a Suspense boundary for the build.
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
