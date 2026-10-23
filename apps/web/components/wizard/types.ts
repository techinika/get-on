export type AddressStatusState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available" }
  | { status: "taken"; suggestions: string[] }
  | { status: "invalid"; reason: string };

export type StartChoice = "ai" | "template" | "blank";

export type WizardState = {
  step: number;
  name: string;
  address: string;
  customAddress: boolean;
  customAddressValue: string;
  addressStatus: AddressStatusState;
  businessType: string;
  about: string;
  startChoice: StartChoice;
  contact: { phone: string; email: string; address: string };
  includeContactForm: boolean;
  logoData: string | null;
  logoError: string | null;
};

export const TOTAL_STEPS = 6;

export const DEFAULT_STATE: WizardState = {
  step: 1,
  name: "",
  address: "",
  customAddress: false,
  customAddressValue: "",
  addressStatus: { status: "idle" },
  businessType: "",
  about: "",
  startChoice: "blank",
  contact: { phone: "", email: "", address: "" },
  includeContactForm: true,
  logoData: null,
  logoError: null,
};

export const STEP_META: ReadonlyArray<{
  title: string;
  sub: string;
  skippable: boolean;
}> = [
  {
    title: "What is your business called?",
    sub: "We will use this for your website and your web address.",
    skippable: false,
  },
  {
    title: "What kind of business is it?",
    sub: "This helps us suggest the right look and wording.",
    skippable: false,
  },
  {
    title: "Tell us about your business",
    sub: "In a few words, what do you do? You can skip this.",
    skippable: true,
  },
  {
    title: "How would you like to start?",
    sub: "You can change everything later.",
    skippable: false,
  },
  {
    title: "How can customers reach you?",
    sub: "These go on your website. All of this is optional.",
    skippable: true,
  },
  {
    title: "You are all set",
    sub: "Check the details, then create your website.",
    skippable: false,
  },
];
