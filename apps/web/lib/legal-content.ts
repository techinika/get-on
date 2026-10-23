import { company } from "@/lib/company";

export type LegalBlock =
  | { kind: "p"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

export type LegalSection = {
  id: string;
  title: string;
  blocks: LegalBlock[];
};

export type LegalDocument = {
  slug: string;
  title: string;
  description: string;
  /** The "short version" bullets. */
  short: string[];
  sections: LegalSection[];
};

const terms: LegalDocument = {
  slug: "terms",
  title: "Terms of Service",
  description: "The simple rules for using Get-On.",
  short: [
    `You own the content you put on your website. We only host and show it for you.`,
    `One free team per person. Free sites keep a small Get-On badge.`,
    `AI can get things wrong. Please check what it writes before you publish it.`,
    `You can cancel at any time. We do not sell your data.`,
  ],
  sections: [
    {
      id: "who-we-are",
      title: "Who we are and what these terms cover",
      blocks: [
        {
          kind: "p",
          text: `${company.name} is a service that helps small businesses build and run a website without technical skills. We are ${company.legalEntity}, registered in ${company.country}.`,
        },
        {
          kind: "p",
          text: `These terms are the agreement between you and us. They cover your use of ${company.name}, the websites you build with it, and the accounts and teams you create.`,
        },
        {
          kind: "p",
          text: "You accept these terms when you create an account, or when you use a website that is hosted on Get-On.",
        },
        {
          kind: "p",
          text: "[[DECISION: which laws these terms must follow, and whether customers outside the company's country can use the service]]",
        },
      ],
    },
    {
      id: "your-account",
      title: "Your account",
      blocks: [
        {
          kind: "p",
          text: `You must be at least [[DECISION: minimum age, for example 16 or 18]] to use ${company.name}. If you are younger than this, please ask a parent or guardian to help you.`,
        },
        {
          kind: "p",
          text: "Give us accurate details, and keep them up to date. Keep your password safe and do not share it with anyone. We cannot be responsible for what happens when a password is shared.",
        },
        {
          kind: "p",
          text: "One person can have one free team. You can invite other people to your team so they can help you.",
        },
      ],
    },
    {
      id: "plans-and-payments",
      title: "Teams, plans and payments",
      blocks: [
        {
          kind: "p",
          text: `A plan is paid for by a team, not by a person. Everyone in the team shares the same plan and the same limits.`,
        },
        {
          kind: "p",
          text: "Each plan has limits. The limits are shown on your plan screen and on the pricing page. If you go over a limit, we ask you to upgrade or delete something first.",
        },
        {
          kind: "p",
          text: "Prices are shown in US dollars.",
        },
        {
          kind: "p",
          text: "Payments are not live yet, so we cannot describe them in full here.",
        },
        {
          kind: "p",
          text: "[[DECISION: payment provider, billing cycle, refunds and cancellation terms]]",
        },
      ],
    },
    {
      id: "free-plan",
      title: "Free plan and the Get-On badge",
      blocks: [
        {
          kind: "p",
          text: "The free plan gives you one website with one page. It stays free.",
        },
        {
          kind: "p",
          text: "A small Get-On badge appears at the bottom of free sites. It helps other small businesses find us. Paid plans do not show the badge.",
        },
        {
          kind: "p",
          text: "We may change the free limits from time to time. We will tell you before a change affects you.",
        },
      ],
    },
    {
      id: "your-content",
      title: "Your website and your content",
      blocks: [
        {
          kind: "p",
          text: "You own everything you put on your website: the words, the pictures, the logo and the details of your business.",
        },
        {
          kind: "p",
          text: "You are responsible for what you publish. Please check it is true, legal and kind.",
        },
        {
          kind: "p",
          text: "You give us permission to store, copy and show your content only for as long as we run the service for you. We do not claim ownership of your content, and we do not sell it.",
        },
      ],
    },
    {
      id: "addresses-and-domains",
      title: "Addresses and domains",
      blocks: [
        {
          kind: "p",
          text: "A free address, such as yourshop.get-on.tech, belongs to Get-On. We can take it back if it is used to hurt people, send spam or break the law.",
        },
        {
          kind: "p",
          text: "We may also take back an address that has not been used for a long time.",
        },
        {
          kind: "p",
          text: "[[DECISION: inactivity period before an unused free address is reclaimed]]",
        },
        {
          kind: "p",
          text: "Your own domain stays yours. We only help you point it at your site.",
        },
      ],
    },
    {
      id: "ai-features",
      title: "AI features",
      blocks: [
        {
          kind: "p",
          text: "Our AI helpers write drafts for you. They can be wrong, out of date, or similar to something another customer received. Please read and check everything before you publish it.",
        },
        {
          kind: "p",
          text: "Each plan includes AI credits. When you run out, we ask you to wait or to upgrade. We may limit heavy or unusual use so the service stays fair and quick for everyone.",
        },
        {
          kind: "p",
          text: "Please do not type private information about other people into the AI helpers. Our AI providers process what you type, so keep it to what you are happy to share.",
        },
      ],
    },
    {
      id: "email-and-subscribers",
      title: "Email, subscribers and contact forms",
      blocks: [
        {
          kind: "p",
          text: "If you collect email addresses through your website, you must have permission from the people you collect them from, and you must follow the anti-spam and privacy laws that apply to you.",
        },
        {
          kind: "p",
          text: "Each plan has a limit on how many emails you can send. We may pause sending if we receive a lot of complaints.",
        },
        {
          kind: "p",
          text: "Contact forms on your site let visitors send you a message. You are responsible for the personal details they send you.",
        },
      ],
    },
    {
      id: "acceptable-use",
      title: "Acceptable use",
      blocks: [
        {
          kind: "p",
          text: "There are things you must not publish or send. They can hurt real people, and they can put our shared get-on.tech address at risk.",
        },
        {
          kind: "p",
          text: "The full list is in our [Acceptable Use Policy](/acceptable-use). Please read it before you publish anything unusual.",
        },
      ],
    },
    {
      id: "backups",
      title: "Backups and availability",
      blocks: [
        {
          kind: "p",
          text: "We take regular backups, so a serious fault is unlikely to lose everything. Still, please keep your own copies of anything that matters to you.",
        },
        {
          kind: "p",
          text: "We do not promise that the service will never be interrupted. We do planned maintenance when we need to, and we try to tell you in advance.",
        },
      ],
    },
    {
      id: "ending",
      title: "Ending things",
      blocks: [
        {
          kind: "p",
          text: "You can cancel your plan and close your account at any time. You do not need to give a reason.",
        },
        {
          kind: "p",
          text: "We may suspend or close an account that breaks these terms or the Acceptable Use Policy. Where it is possible, we will tell you first and give you time to fix the problem.",
        },
        {
          kind: "p",
          text: "When a website is deleted it can be brought back for 14 days. After that it is removed for good.",
        },
      ],
    },
    {
      id: "responsibility",
      title: "Our responsibility",
      blocks: [
        {
          kind: "p",
          text: "We work hard to run a reliable service, but we cannot promise that it will always be perfect or always be available.",
        },
        {
          kind: "p",
          text: "To the extent the law allows, we are not responsible for lost profits, lost customers, or other indirect losses that come from using the service. Our total responsibility for a claim is limited to the amount you paid us in the 12 months before the claim.",
        },
        {
          kind: "p",
          text: "[[DECISION: liability cap and jurisdiction-specific wording; lawyer must review]]",
        },
      ],
    },
    {
      id: "changes",
      title: "Changes to these terms",
      blocks: [
        {
          kind: "p",
          text: "We may change these terms when the service changes or the law changes. We will tell you by email or in the app before a change that affects you takes effect.",
        },
        {
          kind: "p",
          text: "If you keep using the service after that, it means you accept the new terms.",
        },
      ],
    },
    {
      id: "governing-law",
      title: "Governing law and disputes",
      blocks: [
        {
          kind: "p",
          text: "We would like to sort out any problem by talking first. Most questions are quick to answer.",
        },
        {
          kind: "p",
          text: "[[DECISION: governing law, courts or arbitration]]",
        },
      ],
    },
    {
      id: "contact",
      title: "Contact",
      blocks: [
        {
          kind: "p",
          text: `Email us at ${company.supportEmail}. We answer support emails within 1 working day.`,
        },
        {
          kind: "p",
          text: `Our address is ${company.address}, ${company.country}.`,
        },
      ],
    },
  ],
};

const privacy: LegalDocument = {
  slug: "privacy",
  title: "Privacy Policy",
  description: "What we collect, why we collect it, and what you can ask us to do.",
  short: [
    "We collect the details we need to run your account and your website.",
    "We do not sell your personal data.",
    "You can ask for a copy of your data, or ask us to delete it.",
    "We keep personal data only as long as we need it.",
  ],
  sections: [
    {
      id: "who-is-responsible",
      title: "Who is responsible for your data",
      blocks: [
        {
          kind: "p",
          text: `${company.legalEntity} is responsible for the data we hold about our own accounts. Our address is ${company.address}, ${company.country}. You can reach us at ${company.privacyEmail}.`,
        },
        {
          kind: "p",
          text: "There are two kinds of data on Get-On. The first is our own account data: your name, your email address, your teams and your plan. We are responsible for that data.",
        },
        {
          kind: "p",
          text: "The second is the data of the people who visit a website built on Get-On, such as a message sent through a contact form. We handle that data on behalf of the customer who owns the website. The website owner is responsible for it, and they are the ones who must tell their visitors about it.",
        },
      ],
    },
    {
      id: "what-we-collect",
      title: "What we collect",
      blocks: [
        { kind: "h3", text: "Your account" },
        {
          kind: "ul",
          items: [
            "Your full name and email address.",
            "A hashed form of your password. We never see or store the password itself.",
            "Your teams, the websites you create, and the pages and pictures in them.",
            "Your plan and any billing details, once payments are live.",
          ],
        },
        { kind: "h3", text: "From your websites" },
        {
          kind: "ul",
          items: [
            "Messages sent to you through your contact forms.",
            "Names and email addresses of people who subscribe to your mailing list.",
            "Basic technical details needed to deliver a page, such as the request time.",
          ],
        },
        { kind: "h3", text: "From using Get-On" },
        {
          kind: "ul",
          items: [
            "Security logs, including hashed IP addresses, so we can spot abuse.",
            "Details you send us when you ask for a demo.",
            "Messages you send to our support team.",
          ],
        },
      ],
    },
    {
      id: "why-we-use-it",
      title: "Why we use it, and our legal reasons",
      blocks: [
        {
          kind: "p",
          text: "We use your data to run the service: to sign you in, to show your website, to send your email and to keep your work safe. We use it for security and to stop abuse, to answer your support messages, and to meet our legal duties.",
        },
        {
          kind: "p",
          text: "We also look at how the service is used so we can improve it. We only send marketing emails when you have agreed to them, and every marketing email has an unsubscribe link.",
        },
        {
          kind: "p",
          text: "[[DECISION: confirm legal bases and applicable laws such as GDPR or local law]]",
        },
      ],
    },
    {
      id: "who-we-share-it-with",
      title: "Who we share it with",
      blocks: [
        {
          kind: "p",
          text: "We do not sell personal data. We share it only with companies that help us run Get-On:",
        },
        {
          kind: "ul",
          items: [
            "Database and login provider: [Supabase](https://supabase.com).",
            "Hosting and network provider: [Provider name].",
            "Email delivery provider: Amazon Web Services (Amazon SES).",
            "AI generation provider: [Provider name].",
            "Payment provider: [Provider name], once payments are live.",
            "Error monitoring provider: [Provider name].",
          ],
        },
        {
          kind: "p",
          text: "These companies may only use the data to do the job we hired them for.",
        },
      ],
    },
    {
      id: "where-data-is-stored",
      title: "Where your data is stored",
      blocks: [
        {
          kind: "p",
          text: "Your data is stored with our providers, in the places they use.",
        },
        { kind: "p", text: "[[DECISION: data regions]]" },
      ],
    },
    {
      id: "how-long-we-keep-it",
      title: "How long we keep it",
      blocks: [
        {
          kind: "ul",
          items: [
            "Account data: as long as your account is open.",
            "Deleted websites: 14 days, so they can be brought back, then they are removed.",
            "Backups: on a rolling window, then deleted.",
            "Demo requests: [[DECISION: retention period]].",
            "Security logs: a short period, then deleted.",
          ],
        },
      ],
    },
    {
      id: "your-choices",
      title: "Your choices and your rights",
      blocks: [
        {
          kind: "p",
          text: "You can ask us to show you the personal data we hold about you, to correct anything that is wrong, to give you a copy, or to delete it. You can also ask us to stop using your data for marketing, and you can withdraw your consent at any time.",
        },
        {
          kind: "p",
          text: `Email ${company.privacyEmail} and we will help. We aim to answer within 1 working day and to finish the work within [[DECISION: response time for data requests]] of your request.`,
        },
      ],
    },
    {
      id: "security",
      title: "Security",
      blocks: [
        {
          kind: "p",
          text: "We encrypt data in transit, control who inside the company can reach it, keep regular backups, and watch for abuse. No system is perfectly safe, so please use a strong password and tell us quickly if something looks wrong.",
        },
      ],
    },
    {
      id: "children",
      title: "Children",
      blocks: [
        {
          kind: "p",
          text: `Get-On is not for children under [[DECISION: minimum age, for example 16 or 18]]. We do not knowingly collect data from children. If you think a child has given us data, email ${company.privacyEmail} and we will delete it.`,
        },
      ],
    },
    {
      id: "cookies",
      title: "Cookies",
      blocks: [
        {
          kind: "p",
          text: "We use a small number of essential cookies, such as the ones that keep you logged in. The full list is in our [Cookie Policy](/cookies).",
        },
      ],
    },
    {
      id: "visitors-to-websites",
      title: "Visitors to websites built with Get-On",
      blocks: [
        {
          kind: "p",
          text: "When someone opens a website built on Get-On, we process basic technical data, such as the time of the request, so the page can be delivered. The owner of that website is responsible for their own privacy notice.",
        },
      ],
    },
    {
      id: "changes",
      title: "Changes to this policy",
      blocks: [
        {
          kind: "p",
          text: "We will update this page when our data practices change. The date at the top shows when it last changed. If a change matters for you, we will tell you by email or in the app.",
        },
      ],
    },
    {
      id: "contact-and-complaints",
      title: "Contact and complaints",
      blocks: [
        {
          kind: "p",
          text: `Email ${company.privacyEmail} with any question about your data, or write to us at ${company.address}, ${company.country}.`,
        },
        {
          kind: "p",
          text: "If you are not happy with our answer, you can complain to the data protection authority in your country.",
        },
      ],
    },
  ],
};

const cookies: LegalDocument = {
  slug: "cookies",
  title: "Cookie Policy",
  description: "The small number of cookies Get-On sets, and why.",
  short: [
    "We only set cookies that are needed for the site to work.",
    "We do not use advertising cookies.",
    "We do not sell data about your browsing.",
    "You can block cookies in your browser, but you may not be able to log in.",
  ],
  sections: [
    {
      id: "what-cookies-are",
      title: "What cookies are",
      blocks: [
        {
          kind: "p",
          text: "A cookie is a small file that a website asks your browser to remember. It lets the site work properly next time you visit.",
        },
        {
          kind: "p",
          text: "Some pages also use similar storage in your browser, called local storage or session storage. We use that in the same way.",
        },
      ],
    },
    {
      id: "how-we-use-them",
      title: "How we use them",
      blocks: [
        {
          kind: "p",
          text: "Right now we only set cookies that are needed to run the site, such as the cookie that keeps you logged in and the cookie that remembers which team you are looking at.",
        },
        {
          kind: "p",
          text: "We do not use advertising cookies. We do not use third-party tracking. We do not build a profile of you across other websites.",
        },
      ],
    },
    {
      id: "cookies-we-set",
      title: "The cookies we set",
      blocks: [
        {
          kind: "table",
          head: ["Name", "What it does", "Who sets it", "How long it lasts"],
          rows: [
            [
              "sb-*-auth-token",
              "Keeps you logged in.",
              "Get-On",
              "Until you log out, or the session ends.",
            ],
            [
              "gs_team",
              "Remembers the team you last opened.",
              "Get-On",
              "1 year.",
            ],
            [
              "gs_sidebar",
              "Remembers whether the sidebar is open or closed.",
              "Get-On",
              "1 year.",
            ],
            [
              "get-on-theme",
              "Remembers whether you chose light or dark mode.",
              "Get-On",
              "1 year.",
            ],
            [
              "get-on-wizard",
              "Keeps your answers while you set up a new website. This is session storage, not a cookie.",
              "Get-On",
              "Until you close the browser tab.",
            ],
            [
              "get-on-viewed-pages, get-on-checklist",
              "Remembers which steps of your setup checklist you have done. This is local storage, not a cookie.",
              "Get-On",
              "Until you clear your browser data.",
            ],
            [
              "cf_clearance",
              "Only used if we turn on Cloudflare Turnstile, which checks that a form was filled in by a real person.",
              "Cloudflare",
              "Short, usually under 30 minutes.",
            ],
          ],
        },
      ],
    },
    {
      id: "cookies-on-websites",
      title: "Cookies on websites built with Get-On",
      blocks: [
        {
          kind: "p",
          text: "Your website may include tools such as a map, a video or an analytics service. Those tools can set their own cookies. We only set the essential ones listed above.",
        },
        {
          kind: "p",
          text: "If you add your own tools, you are responsible for telling your visitors about them.",
        },
      ],
    },
    {
      id: "how-to-control-cookies",
      title: "How to control cookies in your browser",
      blocks: [
        {
          kind: "p",
          text: "Every browser lets you view, delete and block cookies. Look for a setting called Privacy, Cookies or Site data, usually near the end of the browser settings.",
        },
        {
          kind: "p",
          text: "If you block cookies, some things will not work. You may not be able to log in, and your team or theme choice may be forgotten each time you visit.",
        },
      ],
    },
    {
      id: "changes-and-contact",
      title: "Changes and contact",
      blocks: [
        {
          kind: "p",
          text: "If we add analytics or any other non-essential cookies, we will add a consent banner first and update this page. The date at the top shows when this page last changed.",
        },
        {
          kind: "p",
          text: `Questions? Email ${company.privacyEmail}.`,
        },
      ],
    },
  ],
};

const acceptableUse: LegalDocument = {
  slug: "acceptable-use",
  title: "Acceptable Use Policy",
  description: "What you must not publish or send on Get-On.",
  short: [
    "Do not publish anything illegal, or anything that hurts or deceives people.",
    "Do not send unwanted email or messages.",
    "Do not try to break the limits, or take up more than your share of the service.",
    "Tell us if you see a problem. We will act quickly on serious harm.",
  ],
  sections: [
    {
      id: "why-this-policy-exists",
      title: "Why this policy exists",
      blocks: [
        {
          kind: "p",
          text: "Get-On is used by small businesses and by the people who visit them. This policy protects them, and it protects the shared get-on.tech address that we all share.",
        },
        {
          kind: "p",
          text: "It also keeps our service fast, safe and affordable to run.",
        },
      ],
    },
    {
      id: "what-you-may-not-publish",
      title: "What you may not publish or send",
      blocks: [
        {
          kind: "ul",
          items: [
            "Anything illegal in the country where you are, or in the country of the person you are targeting.",
            "Phishing pages, scams, or pages that pretend to be a company or a bank to trick people.",
            "Pages that pretend to be a person, a business or a brand in order to deceive people.",
            "Malware, viruses, or code that damages a visitor's computer.",
            "Hate speech, threats, harassment, or content that targets someone for who they are.",
            "Content that sexualises children or puts them in danger. This is never allowed. We report it to the authorities.",
            "Content that belongs to someone else, such as photos, text or logos you do not have the right to use.",
            "Health or money claims that mislead people.",
            "Sexual content. [[DECISION: whether adult content is allowed at all]]",
            "Weapons and drugs. [[DECISION: whether these are allowed at all, and any rules about legal trades]]",
          ],
        },
      ],
    },
    {
      id: "email-and-subscriber-rules",
      title: "Email and subscriber rules",
      blocks: [
        {
          kind: "ul",
          items: [
            "Only email people who have agreed to hear from you. Keep a record of that agreement.",
            "Do not buy lists of email addresses.",
            "Stop emailing anyone who unsubscribes, straight away.",
            "Do not use a subject line that hides what the email really is.",
            "Give people a clear way to unsubscribe, such as a link at the bottom of every email.",
          ],
        },
      ],
    },
    {
      id: "platform-abuse",
      title: "Platform abuse",
      blocks: [
        {
          kind: "ul",
          items: [
            "Do not try to go over the limits of your plan on purpose.",
            "Do not create lots of free accounts to get free sites.",
            "Do not resell free sites or pass off a free site as a paid one.",
            "Do not scrape, copy or collect the data of other customers.",
            "Do not overload the service, for example by sending a flood of requests.",
            "Do not look for weaknesses in the service, or test it without asking us first.",
          ],
        },
      ],
    },
    {
      id: "addresses",
      title: "Addresses",
      blocks: [
        {
          kind: "p",
          text: "A free address such as yourshop.get-on.tech is part of the Get-On family. Some names are not allowed, and some are kept for us.",
        },
        {
          kind: "ul",
          items: [
            "Do not use a name that misleads people, such as a bank, a government office or a well-known brand.",
            "Do not use a name that copies someone else's business.",
            "Some names are reserved and cannot be used.",
          ],
        },
      ],
    },
    {
      id: "how-we-enforce",
      title: "How we enforce this policy",
      blocks: [
        {
          kind: "p",
          text: "We use automated checks and we also read reports from visitors. When something goes wrong we may:",
        },
        {
          kind: "ol",
          items: [
            "Remove the content that breaks the rules.",
            "Warn you and ask you to fix it.",
            "Suspend the account for now.",
            "Close the account for good.",
          ],
        },
        {
          kind: "p",
          text: "When there is serious harm, such as a threat to a person's safety or content that sexualises children, we act straight away and do not wait for warnings.",
        },
        {
          kind: "p",
          text: "If you think we have made a mistake, email us and we will look at it again.",
        },
      ],
    },
    {
      id: "reporting-a-problem",
      title: "Reporting a problem",
      blocks: [
        {
          kind: "p",
          text: `Email ${company.abuseEmail} with the web address of the site and a short explanation. We read every report.`,
        },
        {
          kind: "p",
          text: "A \"Report this site\" link will appear on every free site soon.",
        },
      ],
    },
    {
      id: "changes-and-contact",
      title: "Changes and contact",
      blocks: [
        {
          kind: "p",
          text: "We may update this policy when the service changes. The date at the top shows when it last changed. If a change matters for you, we will tell you by email or in the app.",
        },
        {
          kind: "p",
          text: `Questions? Email ${company.abuseEmail}.`,
        },
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS: LegalDocument[] = [terms, privacy, cookies, acceptableUse];

export const LEGAL_BY_SLUG: Record<string, LegalDocument> = Object.fromEntries(
  LEGAL_DOCUMENTS.map((document) => [document.slug, document]),
);

export function legalDocument(slug: string): LegalDocument {
  return LEGAL_BY_SLUG[slug];
}

/** The other three legal pages, used for the links at the end of a page. */
export function otherLegalDocuments(slug: string): LegalDocument[] {
  return LEGAL_DOCUMENTS.filter((document) => document.slug !== slug);
}
