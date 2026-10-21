// Builds the Kasho Pay showcase site (static HTML, no dependencies).
//   node website/build.mjs
// Writes website/index.html (Kreyòl), website/fr/index.html (Français), sitemap.xml and robots.txt.
// Settings come from environment variables so the same files can be rebuilt for another domain:
//   SITE_URL       public address of this site          (default https://www.kashopay.ht  <- CHANGE to the real domain)
//   APP_URL        address of the Kasho Pay web app      (default https://kasho-pay-1.onrender.com)
//   CONTACT_EMAIL  shown in the footer when set
//   WHATSAPP       international number without + (e.g. 50937001234), shown in the footer when set
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SITE_URL = (process.env.SITE_URL ?? "https://www.kashopay.ht").replace(/\/+$/, "");
const APP_URL = (process.env.APP_URL ?? "https://kasho-pay-1.onrender.com").replace(/\/+$/, "");
const CONTACT_EMAIL = process.env.CONTACT_EMAIL ?? "";
const WHATSAPP = (process.env.WHATSAPP ?? "").replace(/\D/g, "");
const TODAY = new Date().toISOString().slice(0, 10);

// ------------------------------------------------------------------ texts
const T = {
  ht: {
    lang: "ht", locale: "ht_HT", path: "/", other: "fr",
    title: "Kasho Pay | Pòtfèy dijital ak kat Visa ak Mastercard pou Ayiti",
    description: "Kasho Pay: rechaje pòtfèy ou ak MonCash ak NatCash, voye lajan bay lòt moun, epi kreye kat vityèl Visa oswa Mastercard nan dola ameriken. Senp, rapid, sekirize.",
    keywords: "Kasho Pay, pòtfèy dijital Ayiti, kat Visa Ayiti, kat Mastercard Ayiti, kat vityèl, MonCash, NatCash, voye lajan Ayiti, peman sou entènèt Ayiti, kat dola",
    nav: { features: "Sèvis", cards: "Kat", app: "App la", fees: "Frè", faq: "Kesyon", start: "Kòmanse", menu: "Meni", skip: "Ale nan kontni an", lang: "Français", langTitle: "Wè sit la an fransè" },
    hero: {
      eyebrow: "Pòtfèy dijital pou Ayiti",
      lead: "Solisyon finans entelijan pou senplifye peman dijital ou yo epi jere lajan ou san pwoblèm.",
      cta: "Kòmanse", secure: "Sistèm sekirize", f1: "MonCash · NatCash", f1s: "pou mete ak retire lajan", f2: "Visa · Mastercard", f2s: "kat vityèl an USD",
    },
    wallet: {
      kicker: "Pòtfèy entelijan",
      h2: "Yon pòtfèy modèn pou tranzaksyon senp ak sekirize",
      p: "Mete lajan nan pòtfèy Kasho Pay ou, voye l bay nenpòt moun ki gen Kasho Pay, epi retire l sou MonCash oswa NatCash lè ou vle.",
      items: [
        ["Rechaje ak MonCash ak NatCash", "Chwazi montan an ak mwayen an. Ou jwenn paj peman sekirize a dirèkteman."],
        ["Voye lajan an yon klè", "Chèche yon moun pa non, @itilizatè oswa kòd QR, epi wè frè a anvan ou konfime."],
        ["Retire lè ou vle", "Retire sou MonCash oswa NatCash, ak konfimasyon modpas pou pwoteje ou."],
      ],
      cta: "Louvri app la",
    },
    cards: {
      kicker: "Kat vityèl",
      h2: "Kat Visa ak Mastercard ou, nan yon minit",
      p: "Peye sou entènèt nan dola ameriken (USD). Chwazi rezo a, koulè a, epi chaje kat la depi 2 $ nan pòtfèy ou.",
      perks: ["Visa oswa Mastercard", "7 koulè pou chwazi", "Jele, retire oswa fèmen kat la nan app la", "Detay kat yo pwoteje ak yon kòd 4 chif"],
      from: "Kreyasyon kat: 10 $",
      names: { mint: "Mint", sunset: "Sunset", ocean: "Ocean", gold: "Gold", midnight: "Midnight", forest: "Forest", chrome: "Chrome" },
      note: "Kat yo mache sou sit ak apps ki aksepte kat USD, sitou machann ameriken. Kèk kategori (jwèt aza, kripto, transfè lajan...) pa pèmèt.",
      holder: "TITILÈ", expires: "EKSPIRE", name: "MARIE JEAN",
    },
    app: {
      kicker: "App la",
      h2: "Tout sa ou bezwen, nan pòch ou",
      p: "Kasho Pay mache nan navigatè telefòn ou epi ou ka mete l sou ekran akèy la. Pa gen anyen pou telechaje.",
      shots: [["home", "Akèy", "Balans ou, rechaj ak retrè nan yon kout je."], ["deposit", "Rechaj", "MonCash oswa NatCash, ak frè a ki klè."], ["transfer", "Transfè", "Voye ak resevwa lajan ant moun Kasho."], ["card", "Kat", "Jere kat Visa ou ak Mastercard ou."], ["transactions", "Istorik", "Tout mouvman ou yo, ranje pa dat."]],
      alt: "Ekran app Kasho Pay:",
    },
    fees: {
      kicker: "Frè klè",
      h2: "Frè yo senp epi ou wè yo anvan ou konfime",
      p: "Pa gen frè kache. App la montre frè a ak total la chak fwa.",
      th: ["Operasyon", "Frè"],
      groups: [
        ["Kreyasyon kat", [["Kreye yon kat vityèl", "10,00 $"]]],
        ["Rechaj pòtfèy (depo)", [["5 $ – 10 $", "0,80 $"], ["10 $ – 25 $", "1,15 $"], ["25 $ – 50 $", "1,50 $"], ["50 $ – 100 $", "2,00 $"]]],
        ["Retrè pòtfèy", [["5 $ – 10 $", "0,70 $"], ["10 $ – 25 $", "1,00 $"], ["25 $ – 50 $", "1,25 $"], ["50 $ – 100 $", "1,75 $"]]],
        ["Kat vityèl", [["Rechaj kat", "2,30 $"], ["Retrè kat", "2,15 $"]]],
        ["Transfè Kasho → Kasho", [["Pou chak transfè", "1,5 %"]]],
      ],
      note: "Frè yo ka chanje. App la toujou montre frè ki an vigè a anvan ou konfime yon operasyon.",
    },
    security: {
      kicker: "Sekirite",
      h2: "Sekirite anvan tout bagay",
      items: [
        ["Verifikasyon idantite", "Yon verifikasyon ofisyèl (pyès idantite ak selfi) pou pwoteje kont ou."],
        ["Otantifikasyon 2 etap", "Ajoute yon kòd nan app otantifikasyon ou pou konfime aksyon ki sansib."],
        ["Kòd 4 chif pou kat la", "Pa gen pèsonn ki wè nimewo kat la san kòd ou a."],
        ["Done chifre", "Nimewo pyès idantite ou yo chifre nan baz done a."],
        ["Limit chak jou", "Limit sou transfè ak retrè pou pwoteje ou kont fwod."],
        ["Konfimasyon modpas", "Nou mande modpas ou anvan chak retrè."],
      ],
    },
    faq: {
      kicker: "Kesyon",
      h2: "Kesyon moun poze souvan",
      items: [
        ["Kisa Kasho Pay ye?", "Kasho Pay se yon pòtfèy dijital ak kat vityèl Visa ak Mastercard ki fèt pou Ayiti. Ou ka rechaje l ak MonCash oswa NatCash, voye lajan bay lòt moun, epi peye sou entènèt ak kat la."],
        ["Kijan pou m mete lajan nan pòtfèy mwen?", "Nan app la, chwazi Ajoute lajan, antre montan an (5 $ rive 100 $) epi chwazi MonCash oswa NatCash. Ou ap jwenn paj peman sekirize a, epi pòtfèy ou kredite otomatikman lè peman an konfime."],
        ["Kat la mache ki kote?", "Kat yo se kat vityèl nan dola ameriken (USD). Yo aksepte nan machann ki pran kat USD, sitou machann ameriken. Gen kèk kategori ak kèk peyi ki pa pèmèt."],
        ["Konbyen sa koute?", "Kreyasyon kat la se 10 $. Rechaj ak retrè gen frè ki depann de montan an, epi transfè ant moun Kasho se 1,5 %. Wè tablo frè a pi wo a."],
        ["Eske mwen dwe verifye idantite m?", "Wi. Pou kreye yon kat, ou bezwen verifye idantite ou (pyès idantite ak selfi) epi ou dwe gen omwen 18 an."],
        ["Eske m bezwen telechaje yon app?", "Non. Kasho Pay louvri nan navigatè telefòn ou epi ou ka ajoute l sou ekran akèy la."],
      ],
    },
    cta: { h2: "Kòmanse ak Kasho Pay jodi a", p: "Kreye kont ou gratis nan kèk minit.", btn: "Kreye kont mwen" },
    footer: { rights: "Tout dwa rezève.", links: "Lyen", contact: "Kontakte nou", note: "Kasho Pay se yon sèvis KASHOPAY LLC." },
    og: "Pòtfèy dijital ak kat Visa ak Mastercard pou Ayiti",
  },
  fr: {
    lang: "fr", locale: "fr_HT", path: "/fr/", other: "ht",
    title: "Kasho Pay | Portefeuille et cartes Visa Mastercard pour Haïti",
    description: "Rechargez avec MonCash et NatCash, envoyez de l'argent et créez une carte virtuelle Visa ou Mastercard en dollars. Simple, rapide, sécurisé.",
    keywords: "Kasho Pay, portefeuille numérique Haïti, carte Visa Haïti, carte Mastercard Haïti, carte virtuelle, MonCash, NatCash, envoyer de l'argent Haïti, paiement en ligne Haïti, carte en dollars",
    nav: { features: "Services", cards: "Cartes", app: "L'app", fees: "Frais", faq: "Questions", start: "Commencer", menu: "Menu", skip: "Aller au contenu", lang: "Kreyòl", langTitle: "Voir le site en créole" },
    hero: {
      eyebrow: "Le portefeuille numérique pour Haïti",
      lead: "Des solutions financières intelligentes pour simplifier vos paiements numériques et gérer votre argent sans souci.",
      cta: "Commencer", secure: "Système sécurisé", f1: "MonCash · NatCash", f1s: "pour déposer et retirer", f2: "Visa · Mastercard", f2s: "cartes virtuelles en USD",
    },
    wallet: {
      kicker: "Portefeuille intelligent",
      h2: "Une solution moderne pour des transactions simples et sécurisées",
      p: "Rechargez votre portefeuille Kasho Pay, envoyez de l'argent à toute personne qui a Kasho Pay et retirez-le sur MonCash ou NatCash quand vous voulez.",
      items: [
        ["Rechargez avec MonCash et NatCash", "Choisissez le montant et le moyen de paiement. Vous arrivez directement sur la page de paiement sécurisée."],
        ["Envoyez de l'argent clairement", "Trouvez quelqu'un par son nom, son @utilisateur ou un code QR, et voyez les frais avant de confirmer."],
        ["Retirez quand vous voulez", "Retrait sur MonCash ou NatCash, avec confirmation du mot de passe pour vous protéger."],
      ],
      cta: "Ouvrir l'app",
    },
    cards: {
      kicker: "Cartes virtuelles",
      h2: "Votre carte Visa ou Mastercard, en une minute",
      p: "Payez en ligne en dollars américains (USD). Choisissez le réseau, la couleur, et chargez la carte dès 2 $ depuis votre portefeuille.",
      perks: ["Visa ou Mastercard", "7 couleurs au choix", "Gelez, retirez ou fermez la carte dans l'app", "Détails de la carte protégés par un code à 4 chiffres"],
      from: "Création de la carte : 10 $",
      names: { mint: "Mint", sunset: "Sunset", ocean: "Ocean", gold: "Gold", midnight: "Midnight", forest: "Forest", chrome: "Chrome" },
      note: "Les cartes fonctionnent sur les sites et apps qui acceptent les cartes USD, surtout des commerçants américains. Certaines catégories (jeux d'argent, crypto, transferts d'argent...) sont refusées.",
      holder: "TITULAIRE", expires: "EXPIRE", name: "MARIE JEAN",
    },
    app: {
      kicker: "L'application",
      h2: "Tout ce qu'il vous faut, dans votre poche",
      p: "Kasho Pay fonctionne dans le navigateur de votre téléphone et peut être ajoutée à l'écran d'accueil. Rien à télécharger.",
      shots: [["home", "Accueil", "Votre solde, recharges et retraits en un coup d'œil."], ["deposit", "Recharge", "MonCash ou NatCash, avec des frais clairs."], ["transfer", "Transfert", "Envoyez et recevez de l'argent entre membres Kasho."], ["card", "Carte", "Gérez vos cartes Visa et Mastercard."], ["transactions", "Historique", "Tous vos mouvements, classés par date."]],
      alt: "Écran de l'application Kasho Pay :",
    },
    fees: {
      kicker: "Frais clairs",
      h2: "Des frais simples, visibles avant de confirmer",
      p: "Aucun frais caché. L'app affiche les frais et le total à chaque fois.",
      th: ["Opération", "Frais"],
      groups: [
        ["Création de carte", [["Créer une carte virtuelle", "10,00 $"]]],
        ["Recharge du portefeuille (dépôt)", [["5 $ – 10 $", "0,80 $"], ["10 $ – 25 $", "1,15 $"], ["25 $ – 50 $", "1,50 $"], ["50 $ – 100 $", "2,00 $"]]],
        ["Retrait du portefeuille", [["5 $ – 10 $", "0,70 $"], ["10 $ – 25 $", "1,00 $"], ["25 $ – 50 $", "1,25 $"], ["50 $ – 100 $", "1,75 $"]]],
        ["Carte virtuelle", [["Recharge de la carte", "2,30 $"], ["Retrait de la carte", "2,15 $"]]],
        ["Transfert Kasho → Kasho", [["Par transaction", "1,5 %"]]],
      ],
      note: "Les frais peuvent évoluer. L'app affiche toujours les frais en vigueur avant de confirmer une opération.",
    },
    security: {
      kicker: "Sécurité",
      h2: "La sécurité avant tout",
      items: [
        ["Vérification d'identité", "Une vérification officielle (pièce d'identité et selfie) pour protéger votre compte."],
        ["Double authentification", "Ajoutez un code de votre app d'authentification pour confirmer les actions sensibles."],
        ["Code à 4 chiffres pour la carte", "Personne ne voit le numéro de votre carte sans votre code."],
        ["Données chiffrées", "Vos numéros de pièce d'identité sont chiffrés en base de données."],
        ["Limites quotidiennes", "Des plafonds sur les transferts et les retraits pour vous protéger de la fraude."],
        ["Confirmation du mot de passe", "Nous demandons votre mot de passe avant chaque retrait."],
      ],
    },
    faq: {
      kicker: "Questions",
      h2: "Questions fréquentes",
      items: [
        ["Qu'est-ce que Kasho Pay ?", "Kasho Pay est un portefeuille numérique avec cartes virtuelles Visa et Mastercard, conçu pour Haïti. Vous le rechargez avec MonCash ou NatCash, envoyez de l'argent à d'autres membres et payez en ligne avec la carte."],
        ["Comment mettre de l'argent dans mon portefeuille ?", "Dans l'app, choisissez Ajouter de l'argent, saisissez le montant (de 5 $ à 100 $) et choisissez MonCash ou NatCash. Vous arrivez sur la page de paiement sécurisée et votre portefeuille est crédité automatiquement une fois le paiement confirmé."],
        ["Où la carte fonctionne-t-elle ?", "Les cartes sont des cartes virtuelles en dollars américains (USD). Elles sont acceptées chez les commerçants qui acceptent les cartes USD, surtout américains. Certaines catégories et certains pays sont refusés."],
        ["Combien ça coûte ?", "La création de la carte coûte 10 $. Les recharges et retraits ont des frais selon le montant, et un transfert entre membres Kasho coûte 1,5 %. Voir le tableau des frais ci-dessus."],
        ["Dois-je vérifier mon identité ?", "Oui. Pour créer une carte, vous devez vérifier votre identité (pièce d'identité et selfie) et avoir au moins 18 ans."],
        ["Dois-je télécharger une application ?", "Non. Kasho Pay s'ouvre dans le navigateur de votre téléphone et vous pouvez l'ajouter à l'écran d'accueil."],
      ],
    },
    cta: { h2: "Commencez avec Kasho Pay aujourd'hui", p: "Créez votre compte gratuitement en quelques minutes.", btn: "Créer mon compte" },
    footer: { rights: "Tous droits réservés.", links: "Liens", contact: "Nous contacter", note: "Kasho Pay est un service de KASHOPAY LLC." },
    og: "Portefeuille numérique et cartes Visa et Mastercard pour Haïti",
  },
};

// ------------------------------------------------------------------ pieces
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const visa = (c = "#fff") => `<svg class="brand" viewBox="0 0 64 22" role="img" aria-label="Visa"><text x="32" y="18" text-anchor="middle" font-size="22" font-weight="900" font-style="italic" letter-spacing="-0.5" font-family="Arial Black, Arial, Helvetica, sans-serif" fill="${c}">VISA</text></svg>`;
const mc = () => `<svg class="brand" viewBox="0 0 40 24" role="img" aria-label="Mastercard"><circle cx="15" cy="12" r="10" fill="#EB001B"/><circle cx="25" cy="12" r="10" fill="#F79E1B"/><path d="M20 4.3a10 10 0 0 1 0 15.4 10 10 0 0 1 0-15.4z" fill="#FF5F00"/></svg>`;
// Same gradients as the app card colours (src/lib/card-colors.ts).
const GRAD = {
  mint: "linear-gradient(135deg,#22c55e 0%,#0f766e 100%)", sunset: "linear-gradient(135deg,#fb7185 0%,#7c3aed 100%)",
  ocean: "linear-gradient(135deg,#38bdf8 0%,#1e1b4b 100%)", gold: "linear-gradient(135deg,#f59e0b 0%,#7c2d12 100%)",
  midnight: "linear-gradient(135deg,#334155 0%,#000000 100%)", forest: "linear-gradient(135deg,#16a34a 0%,#064e3b 100%)",
  chrome: "linear-gradient(135deg,#cbd5e1 0%,#475569 100%)",
};
const kcard = (t, color, brand, last4, extra = "") => `<div class="kcard ${extra}" style="--g:${GRAD[color]}" aria-hidden="true">
  <div class="kc-top"><img src="/img/kasho-mark.webp" alt="" width="34" height="34" loading="lazy"><span class="kc-label">Kasho Pay</span></div>
  <div class="kc-num">•••• •••• •••• ${last4}</div>
  <div class="kc-bot"><div><small>${esc(t.cards.holder)}</small><b>${esc(t.cards.name)}</b></div><div><small>${esc(t.cards.expires)}</small><b>08/29</b></div>${brand === "visa" ? visa() : mc()}</div>
</div>`;
const arrow = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const check = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const abs = (p) => `${SITE_URL}${p}`;

function jsonLd(t) {
  const org = {
    "@type": "Organization", "@id": `${SITE_URL}/#org`, name: "Kasho Pay", legalName: "KASHOPAY LLC", url: abs("/"),
    logo: abs("/img/icon-192.png"), areaServed: { "@type": "Country", name: "Haiti" },
  };
  const site = { "@type": "WebSite", "@id": `${SITE_URL}/#site`, url: abs("/"), name: "Kasho Pay", inLanguage: ["ht", "fr"], publisher: { "@id": `${SITE_URL}/#org` } };
  const appl = {
    "@type": "WebApplication", "@id": `${SITE_URL}/#app`, name: "Kasho Pay", url: APP_URL, applicationCategory: "FinanceApplication",
    operatingSystem: "Any (web browser)", inLanguage: t.lang, description: t.description, publisher: { "@id": `${SITE_URL}/#org` },
    image: abs("/img/og.jpg"),
  };
  const faq = {
    "@type": "FAQPage", inLanguage: t.lang,
    mainEntity: t.faq.items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  return JSON.stringify({ "@context": "https://schema.org", "@graph": [org, site, appl, faq] });
}

function page(t) {
  const o = T[t.other];
  const url = abs(t.path), otherUrl = abs(o.path);
  const base = t.lang === "ht" ? "" : "";
  const contact = [
    CONTACT_EMAIL && `<a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>`,
    WHATSAPP && `<a href="https://wa.me/${WHATSAPP}" rel="noopener">WhatsApp</a>`,
  ].filter(Boolean).join(" · ");
  const feeRows = t.fees.groups.map(([g, rows]) => `<tbody><tr class="grp"><th colspan="2" scope="colgroup">${esc(g)}</th></tr>${rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="amt">${esc(b)}</td></tr>`).join("")}</tbody>`).join("");
  return `<!doctype html>
<html lang="${t.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.description)}">
<meta name="keywords" content="${esc(t.keywords)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#020604">
<meta name="geo.region" content="HT"><meta name="geo.placename" content="Haïti">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="ht" href="${abs("/")}">
<link rel="alternate" hreflang="fr" href="${abs("/fr/")}">
<link rel="alternate" hreflang="x-default" href="${abs("/")}">
<link rel="icon" href="/img/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta property="og:type" content="website"><meta property="og:site_name" content="Kasho Pay">
<meta property="og:title" content="${esc(t.title)}"><meta property="og:description" content="${esc(t.description)}">
<meta property="og:url" content="${url}"><meta property="og:locale" content="${t.locale}"><meta property="og:locale:alternate" content="${o.locale}">
<meta property="og:image" content="${abs("/img/og.jpg")}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(t.og)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(t.title)}">
<meta name="twitter:description" content="${esc(t.description)}"><meta name="twitter:image" content="${abs("/img/og.jpg")}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="/style.css">
<script type="application/ld+json">${jsonLd(t)}</script>
<script>document.documentElement.classList.add("js")</script>
</head>
<body>
<a class="skip" href="#main">${esc(t.nav.skip)}</a>
<header class="top">
  <a class="logo" href="${t.path}" aria-label="Kasho Pay"><img src="/img/kasho-mark.webp" alt="" width="40" height="40"><span>Kasho Pay</span></a>
  <nav id="nav" aria-label="${esc(t.nav.menu)}">
    <a href="#sevis">${esc(t.nav.features)}</a><a href="#kat">${esc(t.nav.cards)}</a><a href="#app">${esc(t.nav.app)}</a><a href="#fre">${esc(t.nav.fees)}</a><a href="#faq">${esc(t.nav.faq)}</a>
    <a class="langsw" href="${o.path}" hreflang="${o.lang}" lang="${o.lang}" title="${esc(t.nav.langTitle)}">${esc(t.nav.lang)}</a>
  </nav>
  <a class="pill small" href="${APP_URL}/signup">${esc(t.nav.start)}</a>
  <button class="burger" aria-label="${esc(t.nav.menu)}" aria-expanded="false" aria-controls="nav"><span></span><span></span></button>
</header>

<main id="main">
<section class="hero">
  <div class="grid-lines" aria-hidden="true"></div>
  <p class="giant" aria-hidden="true">Kasho Pay</p>
  <div class="hero-cards" aria-hidden="true">
    ${kcard(t, "ocean", "visa", "4821", "c1")}${kcard(t, "midnight", "mc", "7710", "c2")}${kcard(t, "mint", "visa", "0392", "c3")}
  </div>
  <div class="hero-copy">
    <p class="eyebrow">${esc(t.hero.eyebrow)}</p>
    <h1>Kasho Pay</h1>
    <p class="lead">${esc(t.hero.lead)}</p>
    <a class="pill" href="${APP_URL}/signup">${esc(t.hero.cta)}<span class="dot">${arrow}</span></a>
  </div>
  <ul class="facts">
    <li class="glass"><b>${esc(t.hero.f1)}</b><span>${esc(t.hero.f1s)}</span></li>
    <li class="glass"><b>${esc(t.hero.f2)}</b><span>${esc(t.hero.f2s)}</span></li>
    <li class="secure"><i></i>${esc(t.hero.secure)}</li>
  </ul>
</section>

<section class="sec wallet" id="sevis">
  <div class="wrap two">
    <div class="reveal">
      <p class="kicker">${esc(t.wallet.kicker)}</p>
      <h2>${esc(t.wallet.h2)}</h2>
      <p class="sub">${esc(t.wallet.p)}</p>
      <ul class="steps">${t.wallet.items.map(([a, b], i) => `<li><span class="num">${i + 1}</span><div><h3>${esc(a)}</h3><p>${esc(b)}</p></div></li>`).join("")}</ul>
      <a class="pill" href="${APP_URL}">${esc(t.wallet.cta)}<span class="dot">${arrow}</span></a>
    </div>
    <div class="phone-wrap reveal">
      <div class="phone"><img src="/img/app-home.webp" width="390" height="844" alt="${esc(t.app.alt)} ${esc(t.app.shots[0][1])}" loading="lazy"></div>
      <div class="glass float-badge"><b>MonCash</b><span>NatCash</span></div>
    </div>
  </div>
</section>

<section class="sec cards" id="kat">
  <div class="wrap">
    <div class="center reveal">
      <p class="kicker">${esc(t.cards.kicker)}</p>
      <h2>${esc(t.cards.h2)}</h2>
      <p class="sub">${esc(t.cards.p)}</p>
    </div>
    <div class="card-row">
      ${[["ocean", "visa", "4821"], ["mint", "mc", "7710"], ["sunset", "visa", "1156"], ["gold", "mc", "8034"], ["midnight", "visa", "2290"], ["forest", "mc", "6617"], ["chrome", "visa", "5503"]]
        .map(([c, b, l]) => `<figure class="reveal">${kcard(t, c, b, l)}<figcaption>${esc(t.cards.names[c])}</figcaption></figure>`).join("")}
    </div>
    <ul class="perks reveal">${t.cards.perks.map((p) => `<li>${check}${esc(p)}</li>`).join("")}<li class="price">${esc(t.cards.from)}</li></ul>
    <p class="fine center">${esc(t.cards.note)}</p>
  </div>
</section>

<section class="sec shots" id="app">
  <div class="wrap">
    <div class="center reveal"><p class="kicker">${esc(t.app.kicker)}</p><h2>${esc(t.app.h2)}</h2><p class="sub">${esc(t.app.p)}</p></div>
    <div class="shot-row">
      ${t.app.shots.map(([f, name, cap]) => `<figure class="shot reveal"><div class="phone sm"><img src="/img/app-${f}.webp" width="390" height="844" alt="${esc(t.app.alt)} ${esc(name)}" loading="lazy"></div><figcaption><b>${esc(name)}</b><span>${esc(cap)}</span></figcaption></figure>`).join("")}
    </div>
  </div>
</section>

<section class="sec fees" id="fre">
  <div class="wrap narrow">
    <div class="center reveal"><p class="kicker">${esc(t.fees.kicker)}</p><h2>${esc(t.fees.h2)}</h2><p class="sub">${esc(t.fees.p)}</p></div>
    <div class="glass table-wrap reveal"><table><thead><tr><th scope="col">${esc(t.fees.th[0])}</th><th scope="col" class="amt">${esc(t.fees.th[1])}</th></tr></thead>${feeRows}</table></div>
    <p class="fine center">${esc(t.fees.note)}</p>
  </div>
</section>

<section class="sec security" id="sekirite">
  <div class="wrap">
    <div class="center reveal"><p class="kicker">${esc(t.security.kicker)}</p><h2>${esc(t.security.h2)}</h2></div>
    <ul class="sec-grid">${t.security.items.map(([a, b]) => `<li class="glass reveal"><span class="ic">${check}</span><h3>${esc(a)}</h3><p>${esc(b)}</p></li>`).join("")}</ul>
  </div>
</section>

<section class="sec faq" id="faq">
  <div class="wrap narrow">
    <div class="center reveal"><p class="kicker">${esc(t.faq.kicker)}</p><h2>${esc(t.faq.h2)}</h2></div>
    ${t.faq.items.map(([q, a]) => `<details class="glass reveal"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}
  </div>
</section>

<section class="sec final">
  <div class="wrap center reveal">
    <h2>${esc(t.cta.h2)}</h2><p class="sub">${esc(t.cta.p)}</p>
    <a class="pill big" href="${APP_URL}/signup">${esc(t.cta.btn)}<span class="dot">${arrow}</span></a>
  </div>
</section>
</main>

<footer class="foot">
  <div class="wrap foot-in">
    <a class="logo" href="${t.path}"><img src="/img/kasho-mark.webp" alt="" width="36" height="36" loading="lazy"><span>Kasho Pay</span></a>
    <p>${esc(t.footer.note)}<br>© ${new Date().getFullYear()} KASHOPAY LLC. ${esc(t.footer.rights)}</p>
    <p class="fl"><a href="${APP_URL}">${esc(t.nav.app)}</a> · <a href="#fre">${esc(t.nav.fees)}</a> · <a href="#faq">${esc(t.nav.faq)}</a>${contact ? `<br>${esc(t.footer.contact)}: ${contact}` : ""}</p>
  </div>
</footer>
<script src="/site.js" defer></script>
</body>
</html>
`;
}

// ------------------------------------------------------------------ write
const write = (rel, data) => { const f = join(ROOT, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, data); };
write("index.html", page(T.ht));
write("fr/index.html", page(T.fr));
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${["/", "/fr/"].map((p) => `  <url><loc>${abs(p)}</loc><lastmod>${TODAY}</lastmod><changefreq>monthly</changefreq><priority>${p === "/" ? "1.0" : "0.9"}</priority>
    <xhtml:link rel="alternate" hreflang="ht" href="${abs("/")}"/><xhtml:link rel="alternate" hreflang="fr" href="${abs("/fr/")}"/><xhtml:link rel="alternate" hreflang="x-default" href="${abs("/")}"/></url>`).join("\n")}
</urlset>
`);
write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${abs("/sitemap.xml")}\n`);
write("site.webmanifest", JSON.stringify({
  name: "Kasho Pay", short_name: "Kasho Pay", start_url: "/", display: "browser", background_color: "#020604", theme_color: "#020604", lang: "ht",
  icons: [{ src: "/img/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/img/kasho-mark.png", sizes: "512x512", type: "image/png" }],
}, null, 2) + "\n");
console.log(`Built for ${SITE_URL} (app: ${APP_URL})`);
