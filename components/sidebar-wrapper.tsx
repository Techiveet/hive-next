"use client";

import { Sidebar } from "@/components/sidebar";
import { useState } from "react";

interface SidebarWrapperProps {
  user?: { name: string | null; email: string };
  permissions: string[];
}

export function SidebarWrapper({ user, permissions }: SidebarWrapperProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Sidebar 
      user={user} 
      permissions={permissions} 
      isOpen={isOpen} 
      setIsOpen={setIsOpen} 
    />
  );
}