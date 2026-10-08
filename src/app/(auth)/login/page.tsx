import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

// useSearchParams() (used inside LoginForm to read ?callbackUrl) opts a page out of static
// rendering, and Next requires it to sit inside a Suspense boundary or the production build fails.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
