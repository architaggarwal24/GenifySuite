import { after } from "next/server";

/**
 * Runs `task` after the HTTP response has been sent (Next's `after`, which keeps a serverless function
 * alive until it finishes). Used so "forgot password" answers in the same time whether or not the email
 * has an account - otherwise a slow email send would reveal which addresses are registered.
 * Outside a request scope (e.g. in tests) it simply runs the task inline. Failures are logged, never thrown.
 */
export async function runAfterResponse(task: () => Promise<void>): Promise<void> {
  const safe = async () => {
    try {
      await task();
    } catch (err) {
      console.error("[after-response] background task failed:", err);
    }
  };
  try {
    after(safe);
  } catch {
    await safe();
  }
}
