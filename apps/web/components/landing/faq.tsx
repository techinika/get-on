import { ChevronDown } from "lucide-react";

const faqItems = [
  {
    question: "What is a web address?",
    answer:
      "It is what people type to find your website, like rosebakery.get-on.tech. You get one free.",
  },
  {
    question: "Do I need to know how websites work?",
    answer:
      "No. We ask simple questions and set everything up. If you can send a message on your phone, you can do this.",
  },
  {
    question: "Can I use my own domain, like mybusiness.com?",
    answer: "Yes, on paid plans. We will guide you step by step.",
  },
  {
    question: "What happens on the free plan?",
    answer:
      "You get one website with one page and a contact form on a free get-on.tech address. A small Get-On badge appears at the bottom of your page.",
  },
  {
    question: "Can I cancel any time?",
    answer: "Yes. You can change or cancel your plan whenever you want.",
  },
];

export function LandingFaq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      className="scroll-mt-20 bg-bg py-16 lg:py-24"
    >
      <div className="mx-auto w-full max-w-[1120px] px-5 md:px-8">
        <div className="text-center">
          <h2 id="faq-title" className="text-h2">
            Questions people ask
          </h2>
        </div>

        <div className="mx-auto mt-8 w-full max-w-[760px]">
          {faqItems.map((item) => (
            <details key={item.question} className="group border-b border-border">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-5 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {item.question}
                <ChevronDown
                  size={20}
                  strokeWidth={1.75}
                  className="shrink-0 transition-transform duration-150 group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="max-w-[65ch] pb-5 text-base text-text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
