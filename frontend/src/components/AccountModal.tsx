import { useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { authApi } from "@/api/auth";
import { useAuth } from "@/contexts/AuthContext";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AccountModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { user, login } = useAuth();

  const [email, setEmail] = useState(user?.email ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setEmail(user?.email ?? "");
    setCurrentPassword("");
    setNewPassword("");
    setError("");
    onClose();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const payload: { email?: string; current_password?: string; new_password?: string } = {};

    if (email && email !== user?.email) payload.email = email;
    if (newPassword) {
      payload.current_password = currentPassword;
      payload.new_password = newPassword;
    }

    if (Object.keys(payload).length === 0) {
      handleClose();
      return;
    }

    setLoading(true);
    try {
      const updated = await authApi.updateProfile(payload);
      login(localStorage.getItem("fl_token")!, updated);
      toast.success(t("auth.profile_saved"));
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={handleClose} title={t("auth.profile_title")}>
      <form onSubmit={handleSave} className="space-y-4">
        {/* Email */}
        <Input
          label={t("auth.email")}
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-600" />
          </div>
          <div className="relative flex justify-center text-xs text-slate-400">
            <span className="bg-white dark:bg-slate-800 px-2">{t("auth.change_password")}</span>
          </div>
        </div>

        {/* Password fields */}
        <Input
          label={t("auth.current_password")}
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          hint={t("auth.password_required_hint")}
        />
        <Input
          label={t("auth.new_password")}
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          hint={t("auth.password_min")}
          autoComplete="new-password"
          minLength={newPassword ? 8 : undefined}
        />

        {error && (
          <p className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">
            {t("common.cancel")}
          </Button>
          <Button type="submit" loading={loading} className="flex-1">
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
