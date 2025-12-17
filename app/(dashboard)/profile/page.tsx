import ProfileClient from "./profile-client";
import { getCurrentSession } from "@/lib/auth-server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function ProfilePageRoot() {
  const { user } = await getCurrentSession();
  
  if (!user) {
      redirect("/sign-in");
  }

  // Fetch fresh data to ensure 2FA status is accurate
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
        id: true,
        name: true,
        email: true,
        image: true,
        twoFactorEnabled: true,
        twoFactorRecoveryCodes: true,
        // SECURITY: Do NOT select password or secret
    }
  });

  if (!dbUser) redirect("/sign-in");

  return <ProfileClient user={dbUser} />;
}