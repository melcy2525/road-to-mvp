import AuthGate from "@/components/auth-gate";
import Dashboard from "@/components/dashboard";
export default function Page() {
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  );
}
