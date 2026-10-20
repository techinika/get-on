import { Globe, Mail, Link2, MousePointerClick, ShieldCheck, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const features: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Globe,
    title: "Your free web address",
    body: "Get yourbusiness.get-on.tech the moment you sign up.",
  },
  {
    icon: Sparkles,
    title: "AI writes your pages",
    body: "Tell us about your business and get ready-to-use pages.",
  },
  {
    icon: MousePointerClick,
    title: "Easy to edit",
    body: "Click on any text or picture and change it. No code, ever.",
  },
  {
    icon: Mail,
    title: "A contact form that works",
    body: "Customers send you messages. You read and reply in one place.",
  },
  {
    icon: Link2,
    title: "Your own domain when you grow",
    body: "Move to yourbusiness.com whenever you are ready.",
  },
  {
    icon: ShieldCheck,
    title: "Automatic backups",
    body: "Your website is saved for you, so nothing gets lost.",
  },
];

export function LandingFeatures() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="scroll-mt-20 bg-bg py-16 lg:py-24"
    >
      <div className="mx-auto w-full max-w-[1120px] px-5 md:px-8">
        <div className="max-w-[640px] md:mx-auto md:text-center">
          <h2 id="features-title" className="text-h2">
            Everything your business needs to be found online
          </h2>
        </div>

        <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <li
                key={feature.title}
                className="rounded-card border border-border bg-surface p-6"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-accent-soft">
                  <Icon size={24} strokeWidth={1.75} className="text-accent-text" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-1.5 text-base text-text-muted">{feature.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
