import type { Composition, TemplatePackage } from "../src/types";
import { metaFor } from "../src/catalog";
import { b, page, textDoc, theme } from "../src/kit";

const contactLink = { type: "page" as const, pageId: "{{contactPageId}}" };
const aboutLink = { type: "page" as const, pageId: "{{aboutPageId}}" };
const servicesLink = { type: "page" as const, pageId: "{{servicesPageId}}" };

type StarterLook = {
  id: string;
  label: string;
  businessTypes: Composition["businessTypes"];
  hero: Record<string, unknown>;
  theme: ReturnType<typeof theme>;
  features: Record<string, unknown>;
  story: Record<string, unknown>;
  steps: Record<string, unknown>;
  quote: Record<string, unknown>;
  cta: Record<string, unknown>;
  heroSec?: Record<string, unknown>;
  featuresSec?: Record<string, unknown>;
  storySec?: Record<string, unknown>;
  stepsSec?: Record<string, unknown>;
  quoteSec?: Record<string, unknown>;
  ctaSec?: Record<string, unknown>;
};

function pagesFor(look: StarterLook) {
  return [
    page({
      key: "home",
      title: "Home",
      home: true,
      priority: 0,
      description: "A clear welcome, what you offer and an easy way to get in touch.",
      blocks: [
        b("hero", look.hero, look.heroSec),
        b("features", look.features, look.featuresSec),
        b("image-text", look.story, look.storySec),
        b("steps", look.steps, look.stepsSec),
        b("quote", look.quote, look.quoteSec),
        b("cta", look.cta, look.ctaSec),
      ],
    }),
    page({
      key: "services",
      title: "What we offer",
      path: "/what-we-offer",
      priority: 1,
      description: "The main things we can help with.",
      blocks: [
        b("heading", { eyebrow: "What we offer", text: "The main things we can help with", level: "h1", align: "left" }, { spaceTop: "xlarge", spaceBottom: "small" }),
        b("services", {
          heading: "Ways we can help",
          intro: "Sample services. Replace these with your own before publishing.",
          items: [
            { icon: "star", title: "Sample service", description: "A short description of what this includes.", price: "", imageId: null, linkLabel: "Ask about this", link: contactLink },
            { icon: "heart", title: "Sample service", description: "A short description of what this includes.", price: "", imageId: null, linkLabel: "Ask about this", link: contactLink },
            { icon: "clock", title: "Sample service", description: "A short description of what this includes.", price: "", imageId: null, linkLabel: "Ask about this", link: contactLink },
          ],
          layout: "columns-rules",
          columns: 3,
        }, { spaceTop: "large", spaceBottom: "large" }),
        b("cta", { heading: "Not sure where to start?", text: "Tell us what you need and we will suggest a sensible next step.", primaryLabel: "Get in touch", primaryLink: contactLink, layout: "card", align: "center" }, { spaceTop: "large", spaceBottom: "xlarge" }),
      ],
    }),
    page({
      key: "about",
      title: "About",
      path: "/about",
      priority: 2,
      description: "Our story and how we work.",
      blocks: [
        b("heading", { eyebrow: "About", text: "A business built on care and trust", level: "h1", align: "left" }, { spaceTop: "xlarge", spaceBottom: "small" }),
        b("text", { content: textDoc("We are a small team who prefer to do a few things properly. That means listening first, explaining clearly and keeping our promises."), columns: 2, size: "large", align: "left" }, { spaceTop: "none", spaceBottom: "large", width: "narrow" }),
        b("features", {
          heading: "What matters to us",
          items: [
            { icon: "check", title: "Honesty first", text: "Clear advice and no surprises.", imageId: null, link: { type: "none" } },
            { icon: "star", title: "Quality matters", text: "Work we are glad to put our name to.", imageId: null, link: { type: "none" } },
            { icon: "heart", title: "People come first", text: "Your goals become our goals from day one.", imageId: null, link: { type: "none" } },
          ],
          layout: "icons",
          columns: 3,
        }, { spaceTop: "large", spaceBottom: "large", bg: { type: "soft" } }),
        b("cta", { heading: "Ready to work together?", text: "We would love to hear what you have in mind.", primaryLabel: "Get in touch", primaryLink: contactLink, layout: "ribbon", align: "center" }, { spaceTop: "large", spaceBottom: "xlarge" }),
      ],
    }),
    page({
      key: "contact",
      title: "Contact",
      path: "/contact",
      priority: 3,
      description: "Get in touch with us.",
      blocks: [
        b("heading", { eyebrow: "Contact", text: "Let's start a conversation", level: "h1", align: "left" }, { spaceTop: "xlarge", spaceBottom: "small" }),
        b("text", { content: textDoc("Have a question or ready to get started? Send a message and we will get back to you as soon as we can."), columns: 1, size: "large", align: "left" }, { spaceTop: "none", spaceBottom: "normal" }),
        b("quick-contact", { showCall: true, showEmail: true, showWhatsApp: false, layout: "row" }, { spaceTop: "normal", spaceBottom: "large", includeIf: "phone" }),
        b("contact-form", { heading: "Send us a message", intro: "Tell us a little about what you need and we will be in touch.", variation: "boxed", showName: true, showPhone: false, submitLabel: "Send message" }, { spaceTop: "normal", spaceBottom: "xlarge" }),
      ],
    }),
  ];
}

const looks: StarterLook[] = [
  {
    id: "restaurant", label: "Restaurant", businessTypes: ["restaurant"],
    hero: { eyebrow: "{{business.type|Restaurant}}", heading: "A warm table and a menu worth staying for", subheading: "{{business.description|Seasonal food, served with care in a room where everyone can settle in.}}", buttonLabel: "See what we offer", buttonLink: servicesLink, button2Label: "Book a table", button2Link: contactLink, layout: "fullbleed", align: "center", valign: "center", height: "tall" },
    heroSec: { spaceTop: "xlarge", spaceBottom: "xlarge", bg: { type: "color", color: "#3A1F14", textOn: "light" }, pattern: "noise" },
    theme: theme({ primary: "#8A3B24", accent: "#D08A3E", background: "#FFF7EE", text: "#2B1B14", soft: "#F6E8D8", heading: "Fraunces", body: "Nunito Sans", headingWeight: 700, density: "comfortable", corners: "soft", design: { display: "normal", rhythm: "alternate", imageStyle: "rounded", eyebrowStyle: "line", linkStyle: "underline", rules: "none", wordmark: { font: "heading", weight: 700, size: 28, case: "normal" } }, header: { style: "overlay", sticky: false, border: false, background: "plain", cta: { enabled: true, label: "Book a table", link: contactLink, style: "solid" } }, footer: { layout: "centered", background: "soft", showContact: true, showHours: true, showSocial: true } }),
    features: { heading: "Why people come back", items: [{ icon: "utensils", title: "Cooked to order", text: "A short menu that changes with the season.", imageId: null, link: { type: "none" } }, { icon: "heart", title: "A warm room", text: "Space to settle in, whether it is two people or ten.", imageId: null, link: { type: "none" } }, { icon: "coffee", title: "Something for later", text: "Coffee, pudding or a glass of something good.", imageId: null, link: { type: "none" } }], layout: "tiles", columns: 3 },
    featuresSec: { spaceTop: "large", spaceBottom: "large" },
    story: { eyebrow: "Our kitchen", heading: "Food that brings people together", text: textDoc("We cook the kind of food we want to share at our own table. Simple ingredients, proper care and no rush."), imagePosition: "right", imageStyle: "rounded", layout: "fullbleed-split", ratio: "4:3", buttonLabel: "More about us", buttonLink: aboutLink },
    storySec: { spaceTop: "large", spaceBottom: "large", bg: { type: "soft" } },
    steps: { heading: "Your evening with us", items: [{ title: "Choose a table", text: "Book online or call and we will find a time.", icon: "calendar" }, { title: "Order what sounds good", text: "Ask us about the menu and any allergies.", icon: "utensils" }, { title: "Stay a while", text: "No rush. The table is yours for the evening.", icon: "coffee" }], layout: "horizontal" },
    stepsSec: { spaceTop: "large", spaceBottom: "large" },
    quote: { text: "A lovely evening from start to finish. Warm service and food full of care.", author: "Sample guest", style: "big" },
    quoteSec: { spaceTop: "large", spaceBottom: "large", bg: { type: "color", color: "#3A1F14", textOn: "light" } },
    cta: { heading: "Come and eat with us", text: "Book a table for lunch, dinner or something in between.", primaryLabel: "Book a table", primaryLink: contactLink, secondaryLabel: "See what we offer", secondaryLink: servicesLink, layout: "banner", align: "center" },
    ctaSec: { spaceTop: "large", spaceBottom: "xlarge", bg: { type: "accent" } },
  },
  {
    id: "salon-beauty", label: "Salon and beauty", businessTypes: ["salon-beauty"],
    hero: { eyebrow: "{{business.type|Salon}}", heading: "Care that makes you feel like yourself", subheading: "{{business.description|A quiet studio for considered hair, skin and nail care.}}", buttonLabel: "See treatments", buttonLink: servicesLink, button2Label: "Book a visit", button2Link: contactLink, layout: "offset-frame", align: "left", imageSide: "right", imageRatio: "4:5", badgeText: "", frame: "offset", height: "auto" },
    heroSec: { spaceTop: "xlarge", spaceBottom: "xlarge" },
    theme: theme({ primary: "#8E4A5D", accent: "#B5835A", background: "#FFF9F6", text: "#2E2024", soft: "#F8E9E6", heading: "Playfair Display", body: "Karla", headingWeight: 600, density: "airy", corners: "round", buttonShape: "pill", design: { display: "dramatic", rhythm: "alternate", imageStyle: "arch", eyebrowStyle: "line", linkStyle: "arrow", rules: "hairline", wordmark: { font: "heading", weight: 600, size: 34, case: "normal", sub: "type" } }, header: { style: "centered", sticky: false, border: false, background: "plain", cta: { enabled: true, label: "Book now", link: contactLink, style: "outline" } }, footer: { layout: "centered", background: "soft", showContact: true, showHours: true, showSocial: true } }),
    features: { heading: "A slower kind of care", items: [{ icon: "scissors", title: "Hair", text: "Cuts and colour with time to talk it through.", imageId: null, link: { type: "none" } }, { icon: "droplet", title: "Skin", text: "Simple treatments for a calm, healthy routine.", imageId: null, link: { type: "none" } }, { icon: "sparkles", title: "Nails", text: "Neat, considered finishes without the rush.", imageId: null, link: { type: "none" } }], layout: "icons", columns: 3 },
    featuresSec: { spaceTop: "large", spaceBottom: "large" },
    story: { eyebrow: "The studio", heading: "A quiet room, close to home", text: textDoc("We keep the studio small so appointments never feel hurried. Come in, put your things down and let us take it from there."), imagePosition: "left", imageStyle: "arch", layout: "overlap", ratio: "3:4", buttonLabel: "Meet the team", buttonLink: aboutLink },
    storySec: { spaceTop: "large", spaceBottom: "large", bg: { type: "soft" } },
    steps: { heading: "Your first visit", items: [{ title: "Tell us what you like", text: "Bring a picture or just a feeling.", icon: "message-circle" }, { title: "We talk it through", text: "An honest view of what will suit you.", icon: "heart" }, { title: "Leave with a plan", text: "Simple advice for looking after it at home.", icon: "sparkles" }], layout: "horizontal" },
    stepsSec: { spaceTop: "large", spaceBottom: "large" },
    quote: { text: "The first appointment in ages where I did not feel rushed or talked into anything.", author: "Sample client", style: "plain" },
    quoteSec: { spaceTop: "large", spaceBottom: "large", bg: { type: "color", color: "#3A1F2A", textOn: "light" }, shape: { top: "curve", bottom: "none" } },
    cta: { heading: "Make time for yourself", text: "Book a visit and we will find an appointment that fits.", primaryLabel: "Book a visit", primaryLink: contactLink, layout: "card", align: "center" },
    ctaSec: { spaceTop: "large", spaceBottom: "xlarge", bg: { type: "soft" }, pattern: "dots" },
  },
  {
    id: "shop", label: "Shop", businessTypes: ["shop"],
    hero: { eyebrow: "{{business.type|Shop}}", heading: "Useful things, chosen with care", subheading: "{{business.description|A small shop for everyday objects made to be used and kept.}}", buttonLabel: "Shop the collection", buttonLink: servicesLink, button2Label: "Visit the shop", button2Link: contactLink, layout: "card-over-image", cardSide: "left", align: "left", height: "auto" },
    heroSec: { spaceTop: "xlarge", spaceBottom: "xlarge", bg: { type: "color", color: "#1C1B1A", textOn: "light" } },
    theme: theme({ primary: "#B33A2B", accent: "#D98324", background: "#FFF8F3", text: "#221A17", soft: "#F6E8DE", heading: "Outfit", body: "Inter", headingWeight: 600, density: "comfortable", corners: "soft", buttonShape: "pill", design: { display: "normal", rhythm: "tinted", imageStyle: "rounded", eyebrowStyle: "caps", linkStyle: "underline", rules: "none", wordmark: { font: "heading", weight: 600, size: 28, case: "normal" } }, header: { style: "split", sticky: true, border: true, background: "plain", cta: { enabled: true, label: "Shop", link: servicesLink, style: "solid" }, announcement: { enabled: false, text: "", bg: "accent" } }, footer: { layout: "bigbrand", background: "dark", showContact: true, showHours: true, showSocial: true } }),
    features: { heading: "Why shop small", items: [{ icon: "heart", title: "Chosen by hand", text: "Every piece is picked, not chosen by an algorithm.", imageId: null, link: { type: "none" } }, { icon: "clock", title: "Made to last", text: "We look for things that get better with use.", imageId: null, link: { type: "none" } }, { icon: "mail", title: "A real person replies", text: "Questions go to the shop, not a call centre.", imageId: null, link: { type: "none" } }], layout: "tiles", columns: 3 },
    featuresSec: { spaceTop: "large", spaceBottom: "large" },
    story: { eyebrow: "Our shop", heading: "A room full of useful things", text: textDoc("We keep the shelves small on purpose. It means we can tell you where something came from, how it is made and how to look after it."), imagePosition: "right", imageStyle: "rounded", layout: "fullbleed-split", ratio: "4:3", buttonLabel: "Read our story", buttonLink: aboutLink },
    storySec: { spaceTop: "large", spaceBottom: "large", bg: { type: "soft" } },
    steps: { heading: "How to buy", items: [{ title: "Browse the edit", text: "A small selection, updated as we find things.", icon: "briefcase" }, { title: "Ask a question", text: "Message us about size, care or delivery.", icon: "mail" }, { title: "Collect or arrange", text: "Pick it up in the shop or ask us to send it.", icon: "bus" }], layout: "big-numbers" },
    stepsSec: { spaceTop: "large", spaceBottom: "large" },
    quote: { text: "A lovely shop with things you will still be using in ten years.", author: "Sample customer", style: "plain" },
    quoteSec: { spaceTop: "large", spaceBottom: "large", rule: "top" },
    cta: { heading: "Come and see for yourself", text: "The shop is open for browsing, questions and a chat.", primaryLabel: "Visit the shop", primaryLink: contactLink, secondaryLabel: "What we offer", secondaryLink: servicesLink, layout: "split", align: "left" },
    ctaSec: { spaceTop: "large", spaceBottom: "xlarge", bg: { type: "color", color: "#1C1B1A", textOn: "light" } },
  },
  {
    id: "portfolio", label: "Portfolio", businessTypes: ["portfolio"],
    hero: { eyebrow: "{{business.type|Portfolio}}", heading: "Work with a clear point of view", subheading: "{{business.description|Design and build for people who care about the details.}}", buttonLabel: "View selected work", buttonLink: servicesLink, button2Label: "Start a conversation", button2Link: contactLink, layout: "editorial", align: "left", height: "auto", highlights: ["{{business.city}}"] },
    heroSec: { spaceTop: "xlarge", spaceBottom: "xlarge" },
    theme: theme({ primary: "#141414", accent: "#C9A227", background: "#F7F4EC", text: "#111111", soft: "#ECE7DC", heading: "Space Grotesk", body: "Inter", headingWeight: 700, density: "comfortable", corners: "sharp", buttonShape: "square", cardStyle: "flat", design: { display: "dramatic", headingCase: "upper", headingTracking: "tight", rhythm: "even", imageStyle: "sharp", eyebrowStyle: "caps", linkStyle: "arrow", rules: "bold", wordmark: { font: "heading", weight: 700, size: 20, tracking: 0.14, case: "upper" } }, header: { style: "classic", sticky: false, border: true, background: "plain", cta: { enabled: false, label: "", link: { type: "none" }, style: "outline" } }, footer: { layout: "bigbrand", background: "dark", showContact: true, showSocial: true } }),
    features: { heading: "What I make", items: [{ icon: "pen-tool", title: "Identity", text: "A clear look and voice that holds together.", imageId: null, link: { type: "none" } }, { icon: "hammer", title: "Websites", text: "Fast, accessible builds with room to grow.", imageId: null, link: { type: "none" } }, { icon: "paintbrush", title: "Art direction", text: "Pictures and type chosen with intent.", imageId: null, link: { type: "none" } }], layout: "numbered", columns: 3 },
    featuresSec: { spaceTop: "large", spaceBottom: "large", rule: "top" },
    story: { eyebrow: "Approach", heading: "A small studio, close to the work", text: textDoc("You work directly with the person doing the work. That keeps decisions quick and the result honest."), imagePosition: "right", imageStyle: "sharp", layout: "fullbleed-split", ratio: "4:3", buttonLabel: "About the studio", buttonLink: aboutLink },
    storySec: { spaceTop: "large", spaceBottom: "large", bg: { type: "soft" } },
    steps: { heading: "How a project runs", items: [{ title: "Talk", text: "Understand the problem and the people.", icon: "message-circle" }, { title: "Shape", text: "Agree the structure and the words.", icon: "pen-tool" }, { title: "Make", text: "Build in short passes with real feedback.", icon: "hammer" }, { title: "Hand over", text: "Leave you with work you can use.", icon: "check" }], layout: "vertical" },
    stepsSec: { spaceTop: "large", spaceBottom: "large" },
    quote: { text: "Clear, considered and completely unstuffy. The work speaks for itself.", author: "Sample client", style: "big" },
    quoteSec: { spaceTop: "large", spaceBottom: "large", bg: { type: "color", color: "#141414", textOn: "light" } },
    cta: { heading: "Have a project in mind?", text: "Tell me what you are making and what is getting in the way.", primaryLabel: "Start a conversation", primaryLink: contactLink, layout: "ribbon", align: "center" },
    ctaSec: { spaceTop: "large", spaceBottom: "xlarge", bg: { type: "accent" } },
  },
  {
    id: "consultant", label: "Consultant", businessTypes: ["consultant"],
    hero: { eyebrow: "{{business.type|Consultant}}", heading: "Clear thinking for the decisions that matter", subheading: "{{business.description|Practical advice, plain language and a plan you can actually use.}}", buttonLabel: "See how I help", buttonLink: servicesLink, button2Label: "Book a call", button2Link: contactLink, layout: "split", align: "left", imageSide: "left", frame: "none", height: "auto" },
    heroSec: { spaceTop: "xlarge", spaceBottom: "xlarge", bg: { type: "soft" } },
    theme: theme({ primary: "#334E68", accent: "#B7791F", background: "#FBFCFD", text: "#1B2733", soft: "#EDF2F7", heading: "Source Serif 4", body: "Source Sans 3", headingWeight: 700, density: "comfortable", corners: "soft", design: { display: "normal", rhythm: "even", imageStyle: "rounded", eyebrowStyle: "caps", linkStyle: "plain", rules: "hairline", wordmark: { font: "heading", weight: 700, size: 26, case: "normal" } }, header: { style: "classic", sticky: false, border: true, background: "plain", cta: { enabled: true, label: "Book a call", link: contactLink, style: "outline" } }, footer: { layout: "columns", background: "soft", showContact: true, showSocial: true } }),
    features: { heading: "Where I can help", items: [{ icon: "target", title: "Strategy", text: "A clear view of what to do next and what to leave alone.", imageId: null, link: { type: "none" } }, { icon: "chart-line", title: "Planning", text: "A realistic plan with owners and dates.", imageId: null, link: { type: "none" } }, { icon: "users", title: "Workshops", text: "Bring the right people together and make decisions.", imageId: null, link: { type: "none" } }], layout: "cards", columns: 3 },
    featuresSec: { spaceTop: "large", spaceBottom: "large" },
    story: { eyebrow: "How I work", heading: "Straightforward help, no theatre", text: textDoc("Most problems are clearer once they are written down. I help you separate the real decision from the noise, then stay close enough to keep things moving."), imagePosition: "right", imageStyle: "rounded", layout: "standard", ratio: "4:3", buttonLabel: "More about me", buttonLink: aboutLink },
    storySec: { spaceTop: "large", spaceBottom: "large" },
    steps: { heading: "A simple way in", items: [{ title: "A short call", text: "Tell me what is happening and what you have tried.", icon: "phone" }, { title: "A clear proposal", text: "Scope, time and cost in writing before we start.", icon: "notebook" }, { title: "The work", text: "Short, focused sessions with something to show each time.", icon: "check" }], layout: "horizontal" },
    stepsSec: { spaceTop: "large", spaceBottom: "large", bg: { type: "soft" } },
    quote: { text: "We left the room with a decision and a plan. That was worth the time on its own.", author: "Sample client", style: "plain" },
    quoteSec: { spaceTop: "large", spaceBottom: "large" },
    cta: { heading: "Let's talk it through", text: "A short conversation is usually enough to know whether I can help.", primaryLabel: "Book a call", primaryLink: contactLink, layout: "card", align: "center" },
    ctaSec: { spaceTop: "large", spaceBottom: "xlarge" },
  },
  {
    id: "church-community", label: "Community", businessTypes: ["church-community"],
    hero: { eyebrow: "{{business.type|Community}}", heading: "There is room for you here", subheading: "{{business.description|A warm community with space for questions, quiet and company.}}", buttonLabel: "What to expect", buttonLink: aboutLink, button2Label: "Plan a visit", button2Link: contactLink, layout: "centered", align: "center", imageRatio: "16:9", height: "auto" },
    heroSec: { spaceTop: "xlarge", spaceBottom: "xlarge" },
    theme: theme({ primary: "#355E4B", accent: "#D9A441", background: "#FFFBF2", text: "#25302B", soft: "#EEF3E7", heading: "Lora", body: "Nunito Sans", headingWeight: 700, density: "comfortable", corners: "round", buttonShape: "round", design: { display: "normal", rhythm: "alternate", imageStyle: "rounded", eyebrowStyle: "line", linkStyle: "arrow", rules: "none", wordmark: { font: "heading", weight: 700, size: 26, case: "normal" } }, header: { style: "classic", sticky: false, border: false, background: "plain", cta: { enabled: true, label: "Plan a visit", link: contactLink, style: "solid" } }, footer: { layout: "columns", background: "soft", showContact: true, showHours: true, showSocial: true } }),
    features: { heading: "What happens here", items: [{ icon: "users", title: "Gatherings", text: "A weekly space to sing, listen and be together.", imageId: null, link: { type: "none" } }, { icon: "heart", title: "Practical care", text: "Help with meals, lifts and the ordinary things.", imageId: null, link: { type: "none" } }, { icon: "sprout", title: "Space to grow", text: "Groups for children, young people and adults.", imageId: null, link: { type: "none" } }], layout: "icons", columns: 3 },
    featuresSec: { spaceTop: "large", spaceBottom: "large" },
    story: { eyebrow: "Our community", heading: "Ordinary people, making room", text: textDoc("We are a mix of ages and backgrounds. You do not need to have it all worked out to belong here. Come as you are and take your time."), imagePosition: "right", imageStyle: "rounded", layout: "standard", ratio: "4:3", buttonLabel: "More about us", buttonLink: aboutLink },
    storySec: { spaceTop: "large", spaceBottom: "large", bg: { type: "soft" } },
    steps: { heading: "Your first visit", items: [{ title: "Come in", text: "Someone will welcome you at the door.", icon: "door-open" }, { title: "Sit anywhere", text: "There is no reserved seating and no dress code.", icon: "users" }, { title: "Stay for a drink", text: "Tea and coffee after the gathering, if you would like.", icon: "coffee" }], layout: "horizontal" },
    stepsSec: { spaceTop: "large", spaceBottom: "large" },
    quote: { text: "I came with questions and found people who were happy to sit with them.", author: "Sample visitor", style: "plain" },
    quoteSec: { spaceTop: "large", spaceBottom: "large", bg: { type: "color", color: "#F4E8D0", textOn: "dark" } },
    cta: { heading: "Come and see", text: "You are welcome to visit before deciding anything.", primaryLabel: "Plan a visit", primaryLink: contactLink, layout: "banner", align: "center" },
    ctaSec: { spaceTop: "large", spaceBottom: "xlarge", bg: { type: "color", color: "#F4E8D0", textOn: "dark" }, pattern: "dots" },
  },
  {
    id: "repair-services", label: "Repair services", businessTypes: ["repair-services"],
    hero: { eyebrow: "{{business.type|Repairs}}", heading: "The job done properly, first time", subheading: "{{business.description|Clear quotes, tidy work and a local team who turn up when they say they will.}}", buttonLabel: "See services", buttonLink: servicesLink, button2Label: "Call the team", button2Link: { type: "phone", number: "{{business.phone}}" }, layout: "diagonal", align: "left", height: "auto" },
    heroSec: { spaceTop: "xlarge", spaceBottom: "xlarge", bg: { type: "color", color: "#0A2540", textOn: "light" } },
    theme: theme({ primary: "#0A58CA", accent: "#FF7A00", background: "#FFFFFF", text: "#0F172A", soft: "#EAF2FF", heading: "Oswald", body: "Open Sans", headingWeight: 600, density: "compact", corners: "sharp", buttonShape: "square", buttonSize: "large", cardStyle: "shadow", design: { display: "normal", headingCase: "upper", rhythm: "bold", imageStyle: "rounded", eyebrowStyle: "chip", linkStyle: "arrow", rules: "bold", wordmark: { font: "heading", weight: 600, size: 26, tracking: 0.04, case: "upper" } }, header: { style: "classic", sticky: true, border: true, background: "plain", cta: { enabled: true, label: "Call us", link: { type: "phone", number: "{{business.phone}}" }, style: "solid" } }, footer: { layout: "columns", background: "dark", showContact: true, showHours: true } }),
    features: { heading: "What we fix", items: [{ icon: "wrench", title: "Repairs", text: "Small jobs done properly, with a clear price.", imageId: null, link: { type: "none" } }, { icon: "home", title: "Improvements", text: "Practical work that makes the place easier to live in.", imageId: null, link: { type: "none" } }, { icon: "plug", title: "Safety checks", text: "A careful look at the things you cannot see.", imageId: null, link: { type: "none" } }], layout: "image-cards", columns: 3 },
    featuresSec: { spaceTop: "large", spaceBottom: "large" },
    story: { eyebrow: "How we work", heading: "Turn up, tidy up, explain the work", text: textDoc("We agree the price before we start, protect your floors and leave the room as we found it. If something changes, we tell you before doing anything else."), imagePosition: "left", imageStyle: "rounded", layout: "standard", ratio: "4:3", buttonLabel: "More about us", buttonLink: aboutLink },
    storySec: { spaceTop: "large", spaceBottom: "large", bg: { type: "soft" } },
    steps: { heading: "How it works", items: [{ title: "Call or message", text: "Tell us what is wrong and send a photo if you can.", icon: "phone" }, { title: "Get a clear quote", text: "A fixed price before any work starts.", icon: "calculator" }, { title: "Book a time", text: "A window that suits you, not just us.", icon: "calendar" }, { title: "Work done", text: "Tidy finish and a short explanation of what we did.", icon: "check" }], layout: "big-numbers" },
    stepsSec: { spaceTop: "large", spaceBottom: "large", bg: { type: "color", color: "#0A2540", textOn: "light" }, shape: { top: "slant", bottom: "none" } },
    quote: { text: "Turned up on time, quoted a fair price and left everything spotless.", author: "Sample customer", style: "plain" },
    quoteSec: { spaceTop: "large", spaceBottom: "large" },
    cta: { heading: "Need something fixed?", text: "Call us or send a message and we will tell you what is possible.", primaryLabel: "Call the team", primaryLink: { type: "phone", number: "{{business.phone}}" }, secondaryLabel: "See services", secondaryLink: servicesLink, layout: "split", align: "left" },
    ctaSec: { spaceTop: "large", spaceBottom: "xlarge", bg: { type: "brand" } },
  },
  {
    id: "farm-agriculture", label: "Farm and agriculture", businessTypes: ["farm-agriculture"],
    hero: { eyebrow: "{{business.type|Farm}}", heading: "Good food, grown close to home", subheading: "{{business.description|Seasonal produce from a farm that cares about the soil, the animals and the people nearby.}}", buttonLabel: "See what we grow", buttonLink: servicesLink, button2Label: "Visit the farm", button2Link: contactLink, layout: "fullbleed", align: "left", valign: "end", height: "tall" },
    heroSec: { spaceTop: "xlarge", spaceBottom: "xlarge", bg: { type: "color", color: "#2F3A1F", textOn: "light" } },
    theme: theme({ primary: "#4F6B2A", accent: "#D9A441", background: "#FBFAF2", text: "#25301D", soft: "#EEF0DD", heading: "Young Serif", body: "Figtree", headingWeight: 400, density: "airy", corners: "soft", design: { display: "normal", rhythm: "tinted", imageStyle: "rounded", eyebrowStyle: "line", linkStyle: "underline", rules: "none", wordmark: { font: "heading", weight: 400, size: 30, case: "normal" } }, header: { style: "overlay", sticky: false, border: false, background: "plain", cta: { enabled: true, label: "Visit the farm", link: contactLink, style: "solid" } }, footer: { layout: "columns", background: "soft", showContact: true, showHours: true, showSocial: true } }),
    features: { heading: "From the farm", items: [{ icon: "sprout", title: "Seasonal produce", text: "Picked when it is ready, not before.", imageId: null, link: { type: "none" } }, { icon: "leaf", title: "Careful growing", text: "Healthy soil and a long view.", imageId: null, link: { type: "none" } }, { icon: "apple", title: "Local delivery", text: "To nearby homes and a few good shops.", imageId: null, link: { type: "none" } }], layout: "rows", columns: 3 },
    featuresSec: { spaceTop: "large", spaceBottom: "large" },
    story: { eyebrow: "The farm", heading: "A slower way to grow", text: textDoc("We work with the seasons and the weather. Some weeks are plentiful, others are quiet. That is part of what makes the food taste the way it does."), imagePosition: "right", imageStyle: "rounded", layout: "fullbleed-split", ratio: "4:3", buttonLabel: "More about us", buttonLink: aboutLink },
    storySec: { spaceTop: "large", spaceBottom: "large", bg: { type: "soft" } },
    steps: { heading: "How to buy", items: [{ title: "See what is ready", text: "The list changes through the year.", icon: "leaf" }, { title: "Place an order", text: "Message us or find us at the market.", icon: "apple" }, { title: "Collect or receive", text: "Pick up at the farm or arrange a local drop.", icon: "bus" }], layout: "horizontal" },
    stepsSec: { spaceTop: "large", spaceBottom: "large" },
    quote: { text: "You can taste the difference when food has been grown with this much care.", author: "Sample customer", style: "big" },
    quoteSec: { spaceTop: "large", spaceBottom: "large", bg: { type: "color", color: "#2F3A1F", textOn: "light" } },
    cta: { heading: "Come and see the farm", text: "Visit, ask questions and meet the people growing your food.", primaryLabel: "Plan a visit", primaryLink: contactLink, layout: "banner", align: "center" },
    ctaSec: { spaceTop: "large", spaceBottom: "xlarge", bg: { type: "accent" } },
  },
  {
    id: "education-tutoring", label: "Education and tutoring", businessTypes: ["education-tutoring"],
    hero: { eyebrow: "{{business.type|Tutoring}}", heading: "Learning that builds real confidence", subheading: "{{business.description|Patient, personal teaching for young people who need a little more time or a fresh explanation.}}", buttonLabel: "See how it works", buttonLink: servicesLink, button2Label: "Book a chat", button2Link: contactLink, layout: "arch", align: "left", imageSide: "right", imageRatio: "4:5", frame: "arch", height: "auto" },
    heroSec: { spaceTop: "xlarge", spaceBottom: "xlarge", bg: { type: "soft" } },
    theme: theme({ primary: "#5B3E96", accent: "#D97706", background: "#FCFBFF", text: "#241C33", soft: "#F1ECFB", heading: "Lexend", body: "Nunito Sans", headingWeight: 700, density: "comfortable", corners: "round", buttonShape: "round", design: { display: "normal", rhythm: "alternate", imageStyle: "arch", eyebrowStyle: "chip", linkStyle: "plain", rules: "none", wordmark: { font: "heading", weight: 700, size: 26, case: "normal" } }, header: { style: "centered", sticky: false, border: false, background: "plain", cta: { enabled: true, label: "Book a chat", link: contactLink, style: "outline" } }, footer: { layout: "centered", background: "soft", showContact: true, showSocial: true } }),
    features: { heading: "How tutoring helps", items: [{ icon: "graduation-cap", title: "One to one", text: "Teaching shaped around the person in front of us.", imageId: null, link: { type: "none" } }, { icon: "brain", title: "Understanding first", text: "We build the idea before practising the exam.", imageId: null, link: { type: "none" } }, { icon: "heart", title: "Confidence grows", text: "Small wins that make the next step feel possible.", imageId: null, link: { type: "none" } }], layout: "tiles", columns: 3 },
    featuresSec: { spaceTop: "large", spaceBottom: "large" },
    story: { eyebrow: "Our approach", heading: "A patient person in your corner", text: textDoc("Some students need the explanation told a different way. We take time to find the version that clicks, then practise until it feels steady."), imagePosition: "left", imageStyle: "arch", layout: "overlap", ratio: "3:4", buttonLabel: "More about us", buttonLink: aboutLink },
    storySec: { spaceTop: "large", spaceBottom: "large" },
    steps: { heading: "Getting started", items: [{ title: "A short chat", text: "Tell us what is feeling difficult at school.", icon: "message-circle" }, { title: "A first session", text: "Meet the tutor and try a real piece of work.", icon: "graduation-cap" }, { title: "A simple plan", text: "Agree how often to meet and what to focus on.", icon: "calendar" }], layout: "horizontal" },
    stepsSec: { spaceTop: "large", spaceBottom: "large", bg: { type: "soft" } },
    quote: { text: "For the first time in a while, my child said maths made sense.", author: "Sample parent", style: "plain" },
    quoteSec: { spaceTop: "large", spaceBottom: "large" },
    cta: { heading: "Let's talk about learning", text: "A short chat is enough to know whether we are the right fit.", primaryLabel: "Book a chat", primaryLink: contactLink, layout: "card", align: "center" },
    ctaSec: { spaceTop: "large", spaceBottom: "xlarge" },
  },
  {
    id: "other", label: "Other business", businessTypes: ["other"],
    hero: { eyebrow: "{{business.type|Business}}", heading: "A simple website that feels like you", subheading: "{{business.description|Tell people what you do, show what you offer and make it easy to get in touch.}}", buttonLabel: "See what we offer", buttonLink: servicesLink, button2Label: "Get in touch", button2Link: contactLink, layout: "split", align: "left", imageSide: "right", height: "auto" },
    heroSec: { spaceTop: "xlarge", spaceBottom: "xlarge" },
    theme: theme({ primary: "#0B6B4F", accent: "#F59E0B", background: "#FFFBF7", text: "#1F1A17", soft: "#F0F7F4", heading: "Bricolage Grotesque", body: "Figtree", headingWeight: 700, density: "comfortable", corners: "soft", design: { display: "normal", rhythm: "even", imageStyle: "rounded", eyebrowStyle: "caps", linkStyle: "plain", rules: "hairline", wordmark: { font: "heading", weight: 700, size: 28, case: "normal" } }, header: { style: "classic", sticky: false, border: true, background: "plain", cta: { enabled: true, label: "Get in touch", link: contactLink, style: "solid" } }, footer: { layout: "simple", background: "soft", showContact: true, showHours: true, showSocial: true } }),
    features: { heading: "What sets us apart", items: [{ icon: "sparkles", title: "Personal touch", text: "Every customer is treated as an individual, not a number.", imageId: null, link: { type: "none" } }, { icon: "heart", title: "Care in every detail", text: "We take pride in doing things properly from start to finish.", imageId: null, link: { type: "none" } }, { icon: "clock", title: "Always responsive", text: "Clear communication and quick replies when you need us.", imageId: null, link: { type: "none" } }], layout: "cards", columns: 3 },
    featuresSec: { spaceTop: "large", spaceBottom: "large" },
    story: { eyebrow: "Our story", heading: "Built on trust, shaped by care", text: textDoc("We believe great service starts with listening. By taking time to understand your needs, we deliver solutions that feel effortless and stand the test of time."), imagePosition: "right", imageStyle: "rounded", layout: "standard", ratio: "4:3", buttonLabel: "Learn more about us", buttonLink: aboutLink },
    storySec: { spaceTop: "large", spaceBottom: "large" },
    steps: { heading: "What happens next", items: [{ title: "Tell us what you need", text: "A short message is enough to start.", icon: "message-circle" }, { title: "We suggest a plan", text: "Clear next steps, with no pressure.", icon: "notebook" }, { title: "We get to work", text: "You know what is happening and when.", icon: "check" }], layout: "horizontal" },
    stepsSec: { spaceTop: "large", spaceBottom: "large", bg: { type: "soft" } },
    quote: { text: "Absolutely lovely to work with. Professional, friendly and nothing was too much trouble.", author: "A happy customer", style: "big" },
    quoteSec: { spaceTop: "large", spaceBottom: "large" },
    cta: { heading: "Let's bring your vision to life", text: "Tell us what you need and we will get back to you with a friendly response.", primaryLabel: "Get in touch", primaryLink: contactLink, layout: "card", align: "center" },
    ctaSec: { spaceTop: "large", spaceBottom: "xlarge" },
  },
];

export const starterTemplate: TemplatePackage = {
  packageVersion: 1,
  meta: metaFor("starter"),
  sampleProfile: {
    businessName: "Your business",
    tagline: "A beautiful website that grows with you",
    description: "Tell your story, showcase what you offer, and welcome new customers with a website that feels effortless.",
    phone: "012 345 6789",
    email: "hello@example.com",
    address: "12 High Street, Your Town",
    hoursNote: "Monday to Friday, 9am to 5pm",
    social: [],
    businessType: "other",
    city: "Your Town",
    country: "United Kingdom",
  },
  aiHints: {
    brief: "A flexible starter with ten designs, one for each business type. Each has a different hero, header, font pairing and rhythm.",
    audience: "People looking for a polished, trustworthy business online.",
    tone: ["refined", "warm", "confident"],
    doNot: ["invent awards", "invent prices", "make legal claims"],
    pagePurposes: {
      home: "Make a strong first impression with a clear offer.",
      services: "Explain what is available without inventing prices.",
      about: "Build trust through story and values.",
      contact: "Make it effortless to reach you.",
    },
  },
  assets: [],
  compositions: [looks.find((look) => look.id === "other")!, ...looks.filter((look) => look.id !== "other")].map((look) => ({
    id: look.id,
    label: look.label,
    businessTypes: look.businessTypes,
    theme: look.theme,
    pages: pagesFor(look),
  })),
};
