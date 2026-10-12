import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Calendar, Eye, EyeOff, Lock, Mail, MailCheck, Phone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/kasho/auth-layout";
import { cn } from "@/lib/utils";
import { COUNTRIES } from "@/lib/countries";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create account | Kasho Pay" },
      { name: "description", content: "Create your Kasho Pay account." },
      { property: "og:title", content: "Create account | Kasho Pay" },
      { property: "og:description", content: "Create your Kasho Pay account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignupPage,
});

const STEPS = ["Basic info", "Personal details", "Secure account"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [verifying, setVerifying] = useState(false); // "check your email" screen
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  // Step 2
  const [dob, setDob] = useState("");
  const [phoneCode, setPhoneCode] = useState("+509");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("HT");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Step 3
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);

  // Verification
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // If the user opens the link from the email on this device, the session appears: finish.
  useEffect(() => {
    if (!verifying) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) setDone(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [verifying]);

  const nextFromStep1 = () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) return toast.error("Please fill in every field");
    if (!EMAIL_RE.test(email.trim())) return toast.error("Enter a valid email address");
    setStep(2);
  };

  const nextFromStep2 = () => {
    if (!dob || !phone.trim() || !street.trim() || !city.trim() || !stateRegion.trim() || !postalCode.trim()) return toast.error("Please fill in every field");
    const age = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000);
    if (!(age >= 18)) return toast.error("You must be at least 18 years old");
    if (phone.replace(/\D/g, "").length < 7) return toast.error("Enter a valid phone number");
    setStep(3);
  };

  const handleCreateAccount = async () => {
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (!agreed) return toast.error("Please agree to the Terms and Privacy Policy");

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        // The verification email contains a link back to the app (and a code if your email template shows {{ .Token }}).
        emailRedirectTo: `${window.location.origin}/auth`,
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone_code: phoneCode.trim() || "+509",
          phone_number: phone.replace(/\D/g, ""),
          date_of_birth: dob,
          country,
          address_street: street.trim(),
          address_city: city.trim(),
          address_state: stateRegion.trim(),
          address_postal_code: postalCode.trim(),
        },
      },
    });
    setLoading(false);

    if (error) return toast.error(error.message);
    // Supabase hides whether an email exists: an already-registered address comes back without identities.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      return toast.error("An account with this email already exists. Please log in.");
    }
    if (data.session) {
      // Email confirmation is switched off in the Supabase project: already signed in.
      setDone(true);
      return;
    }
    setVerifying(true);
    setCooldown(45);
    toast.success(`Verification email sent to ${email.trim()}`);
  };

  const resend = async () => {
    if (cooldown > 0) return;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth` },
    });
    if (error) return toast.error(error.message);
    setCooldown(45);
    toast.success("Verification email sent again");
  };

  // The email holds a link. After tapping it (on any device), this signs the user in with the password just chosen.
  const checkVerified = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) return toast.error(/confirm/i.test(error.message) ? "Your email is not verified yet. Open the email and tap the link." : error.message);
    setDone(true);
  };

  if (done) {
    return (
      <AuthLayout>
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-neon">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-2xl font-semibold">Welcome, {firstName || "there"}!</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your email is verified and your Kasho Pay account is ready.</p>
          <Button className="mt-8 h-12 w-full rounded-xl shadow-neon" onClick={() => navigate({ to: "/" })}>
            Go to your wallet
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (verifying) {
    return (
      <AuthLayout>
        <div className="w-full max-w-sm">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-secondary text-primary">
            <MailCheck className="h-8 w-8" />
          </div>
          <h1 className="mt-6 text-center text-2xl font-semibold">Verify your email</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            We sent a verification email to <span className="text-foreground">{email}</span>. Open it and tap the link, then come back here.
          </p>

          <Button className="mt-8 h-12 w-full rounded-xl shadow-neon" disabled={loading} onClick={checkVerified}>
            {loading ? "Checking..." : "I have verified my email"}
          </Button>

          <div className="mt-6 flex items-center justify-between text-sm">
            <button onClick={resend} disabled={cooldown > 0} className="font-medium text-primary hover:underline disabled:text-muted-foreground disabled:no-underline">
              {cooldown > 0 ? `Resend email in ${cooldown}s` : "Resend email"}
            </button>
            <button onClick={() => { setVerifying(false); setStep(1); }} className="text-muted-foreground hover:text-foreground">
              Use another email
            </button>
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Already verified? <Link to="/auth" className="font-medium text-primary hover:underline">Log in</Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-sm">

        <div className="mb-6 text-center lg:text-left">
          <h1 className="text-2xl font-semibold">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Step {step} of 3 · {STEPS[step - 1]}</p>
        </div>

        <div className="mb-7 flex gap-2">
          {STEPS.map((_, i) => (
            <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors", i + 1 <= step ? "bg-primary" : "bg-secondary")} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" autoComplete="given-name" className="h-11 rounded-xl" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" autoComplete="family-name" className="h-11 rounded-xl" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" className="h-11 rounded-xl pl-10" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <Button className="h-12 w-full rounded-xl shadow-neon" onClick={nextFromStep1}>Continue</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="dob">Date of birth</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="dob" type="date" autoComplete="bday" className="h-11 rounded-xl pl-10" value={dob} onChange={(e) => setDob(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
                <Input aria-label="Country code" inputMode="tel" className="h-11 rounded-xl text-center" value={phoneCode} onChange={(e) => setPhoneCode(e.target.value.replace(/[^\d+]/g, ""))} />
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="phone" type="tel" autoComplete="tel-national" placeholder="3xxx xxxx" className="h-11 rounded-xl pl-10" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{COUNTRIES.map(([code, name]) => <SelectItem key={code} value={code}>{name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="street">Street address</Label>
              <Input id="street" autoComplete="address-line1" className="h-11 rounded-xl" value={street} onChange={(e) => setStreet(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2"><Label htmlFor="city">City</Label><Input id="city" autoComplete="address-level2" className="h-11 rounded-xl" value={city} onChange={(e) => setCity(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="region">State</Label><Input id="region" autoComplete="address-level1" className="h-11 rounded-xl" value={stateRegion} onChange={(e) => setStateRegion(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="zip">Postal code</Label><Input id="zip" autoComplete="postal-code" className="h-11 rounded-xl" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} /></div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" className="h-12 rounded-xl" onClick={() => setStep(1)}>Back</Button>
              <Button className="h-12 flex-1 rounded-xl shadow-neon" onClick={nextFromStep2}>Continue</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className="h-11 rounded-xl pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">We will email you a link to verify your address before you can log in.</p>

            <label className="flex items-start gap-2.5 text-xs text-muted-foreground">
              <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
              I agree to the Terms of Service and Privacy Policy.
            </label>

            <div className="flex gap-2">
              <Button variant="ghost" className="h-12 rounded-xl" onClick={() => setStep(2)}>Back</Button>
              <Button className="h-12 flex-1 rounded-xl shadow-neon" disabled={loading} onClick={handleCreateAccount}>
                {loading ? "Creating..." : "Create account"}
              </Button>
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-sm text-muted-foreground lg:text-left">
          Already have an account?{" "}
          <Link to="/auth" className="font-medium text-primary hover:underline">Log in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
