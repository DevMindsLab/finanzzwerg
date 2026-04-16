import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BarChart3 } from "lucide-react";
import { authApi } from "@/api/auth";
import { useAuth } from "@/contexts/AuthContext";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function RegisterPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.register({ email, password });
      login(res.access_token, res.user);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-xl tracking-tight">Financeless</span>
        </div>

        {/* Card */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8">
          <h1 className="text-white text-xl font-semibold mb-6">{t("auth.register_title")}</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t("auth.email")}
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <Input
              label={t("auth.password")}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint={t("auth.password_min")}
              autoComplete="new-password"
              minLength={8}
              required
            />

            {error && (
              <p className="text-sm text-rose-400 bg-rose-950 border border-rose-800 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" loading={loading} className="w-full" size="lg">
              {t("auth.register_btn")}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            {t("auth.have_account")}{" "}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">
              {t("auth.login_link")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
