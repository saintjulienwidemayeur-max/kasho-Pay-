// Admin > Account: who is signed in, 2FA status, change password.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { KeyRound, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword, type AdminStatus } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { isCancelled, useStepUp } from "@/lib/stepup";
import { Pill, Section, Stat } from "./shared";

export function AccountTab({ status }: { status: AdminStatus }) {
  const stepUp = useStepUp();
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const tooShort = next.length > 0 && next.length < 8;
  const mismatch = again.length > 0 && next !== again;
  const valid = next.length >= 8 && next === again;

  const submit = async () => {
    setBusy(true);
    try {
      await stepUp.ask((currentPassword) => changePassword({ data: { currentPassword, newPassword: next } }));
      toast.success("Password changed. Your other devices are signed out.");
      setNext(""); setAgain("");
    } catch (e) {
      if (!isCancelled(e)) toast.error(errorMessage(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Section title="Your administrator account">
        <div className="grid gap-3 sm:grid-cols-2">
          <Stat label="Signed in as" value={<span className="text-base">{status.email}</span>} />
          <Stat label="Role" value={<span className="text-base">{status.role === "super" ? "Super administrator" : "Administrator"}</span>} sub={status.role === "super" ? "Full access, including customer money" : "Read access and the customer fee schedule"} />
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-border p-4 text-sm">
          {status.hasTotp ? <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />}
          <div className="min-w-0">
            <p className="font-medium">Two-factor authentication {status.hasTotp ? <Pill tone="good">On</Pill> : <Pill tone="warn">Off</Pill>}</p>
            <p className="mt-1 text-muted-foreground">The admin tools only work with 2FA, because they can move money. {status.hasTotp ? "You are asked for your authenticator code when you open them." : "Turn it on first."}</p>
            <Button asChild variant="outline" size="sm" className="mt-3"><Link to="/security">Open security settings</Link></Button>
          </div>
        </div>
      </Section>

      <Section title="Change your password" description="You are asked for your current password (and your 2FA code). Your other devices are signed out.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid) void submit(); }}>
          <div className="space-y-2">
            <Label htmlFor="ad-new">New password</Label>
            <Input id="ad-new" type="password" autoComplete="new-password" className="h-11 rounded-xl" value={next} onChange={(e) => setNext(e.target.value)} />
            {tooShort && <p className="text-xs text-destructive">Use at least 8 characters.</p>}
            <p className="text-xs text-muted-foreground">Choose a long password you use nowhere else: this account can move customer money.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ad-again">Repeat the new password</Label>
            <Input id="ad-again" type="password" autoComplete="new-password" className="h-11 rounded-xl" value={again} onChange={(e) => setAgain(e.target.value)} />
            {mismatch && <p className="text-xs text-destructive">The two passwords are different.</p>}
          </div>
          <Button type="submit" className="h-11 w-full rounded-xl" disabled={!valid || busy}><KeyRound className="h-4 w-4" /> Change password</Button>
        </form>
        {stepUp.dialog}
      </Section>
    </div>
  );
}
