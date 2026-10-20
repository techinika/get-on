const steps = [
  {
    title: "Tell us about your business",
    body: "Type your business name and a few words about what you do. That is all we need.",
  },
  {
    title: "Pick AI or a template",
    body: "Let AI write your pages for you, or start from a ready-made design.",
  },
  {
    title: "Publish with one tap",
    body: "Press Publish and your website is live at your own web address.",
  },
];

export function LandingHowItWorks() {
  return (
    <section
      id="how"
      aria-labelledby="how-title"
      className="scroll-mt-20 bg-surface-muted py-16 lg:py-24"
    >
      <div className="mx-auto w-full max-w-[1120px] px-5 md:px-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-eyebrow">How it works</p>
          <h2 id="how-title" className="text-h2">
            Three steps to your first website
          </h2>
          <p className="max-w-[560px] text-lg text-text-muted">
            Answer a few plain questions, pick a design, and press publish. No technical setup
            on your side.
          </p>
        </div>

        <ol className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-dialog border border-border bg-surface p-7 shadow-card"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-on-primary">
                {index + 1}
              </span>
              <h3 className="mt-4 text-h3">{step.title}</h3>
              <p className="mt-2 text-base text-text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
