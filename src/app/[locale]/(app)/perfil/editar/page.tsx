import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { EditProfileForm } from "@/components/profile/edit-profile-form";

export const metadata: Metadata = {
  title: "Editar perfil — Labia.ia",
};

export default async function EditarPerfilPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser();

  return <EditProfileForm user={user} />;
}
