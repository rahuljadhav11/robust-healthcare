import { SignIn } from "@clerk/nextjs";
import { FileHeart } from "lucide-react";

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-muted/40 px-4">
      <div className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <FileHeart className="size-5" />
        </div>
        <div>
          <div className="font-semibold leading-tight">Report Sender</div>
          <div className="text-xs text-muted-foreground leading-tight">Diagnostic reports via WhatsApp</div>
        </div>
      </div>
      <SignIn />
    </div>
  );
}
