export interface NavItem {
  href: string;
  labelKey: string;
  icon: string;
}

export const appNavItems: NavItem[] = [
  { href: "/painel", labelKey: "painel", icon: "Home" },
  { href: "/ferramentas", labelKey: "ferramentas", icon: "Wrench" },
  { href: "/jogos", labelKey: "jogos", icon: "Gamepad2" },
  { href: "/historico", labelKey: "historico", icon: "History" },
  { href: "/perfil", labelKey: "perfil", icon: "UserRound" },
  { href: "/configuracoes", labelKey: "configuracoes", icon: "Settings" },
  { href: "/suporte", labelKey: "suporte", icon: "LifeBuoy" },
];

export const adminNavItems: NavItem[] = [
  { href: "/admin", labelKey: "painel", icon: "LayoutDashboard" },
  { href: "/admin/usuarios", labelKey: "usuarios", icon: "Users" },
  { href: "/admin/suporte", labelKey: "suporte", icon: "LifeBuoy" },
  { href: "/admin/planos", labelKey: "planos", icon: "CreditCard" },
];
