import { GoogleG } from "@/components/auth/google-g";
import { Button } from "@/components/ui/button";

export function GoogleAuth() {
  return (
    <>
      <div className="my-5 flex items-center gap-3">
        <span aria-hidden className="h-px flex-1 bg-border" />
        <span className="text-sm text-text-muted">or</span>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>
      <form action="/auth/google" method="post">
        <Button type="submit" variant="secondary" size="lg" className="w-full">
          <GoogleG />
          Continue with Google
        </Button>
      </form>
    </>
  );
}
