import { setRequestLocale } from "next-intl/server";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { ToolsShowcase } from "@/components/marketing/tools-showcase";
import { SocialProof } from "@/components/marketing/social-proof";
import { Pricing } from "@/components/marketing/pricing";
import { Faq } from "@/components/marketing/faq";
import { FinalCta } from "@/components/marketing/final-cta";
import { billingRepository } from "@/lib/data";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const price = await billingRepository.getPremiumPrice();

  return (
    <>
      <Hero />
      <HowItWorks />
      <ToolsShowcase />
      <SocialProof />
      <Pricing price={price} />
      <Faq />
      <FinalCta />
    </>
  );
}
