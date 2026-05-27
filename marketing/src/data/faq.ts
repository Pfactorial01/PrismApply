import type { FaqItem } from '../lib/seo'

/** Shared FAQ content — used on /faq and for FAQ schema. */
export const faqItems: FaqItem[] = [
  {
    question: 'Does PrismApply submit applications automatically?',
    answer:
      'No. PrismApply prepares tailored application packages — resume, cover letter, and form answers — and puts them in your dashboard. You review each package and submit it yourself when you are ready. Nothing is sent on your behalf without you.',
  },
  {
    question: 'Is auto-apply safe for my job search?',
    answer:
      'Blind auto-apply tools optimize for volume, not fit. They often spray generic resumes to hundreds of roles, which can hurt your reputation with recruiters and waste interview prep time. PrismApply is the opposite: we match semantically, tailor honestly, and keep you in control of every submission.',
  },
  {
    question: 'Can AI write my resume without lying?',
    answer:
      'Yes — if the system is designed around a truth pledge. PrismApply only uses facts from your profile: employers, dates, projects, and metrics you provide. We reframe and emphasize relevant experience for each role, but never invent credentials, titles, or achievements.',
  },
  {
    question: 'How is this different from ChatGPT for resumes?',
    answer:
      'ChatGPT can draft text, but it does not know your full career story, cannot match you to live roles, and has no guardrails against fabrication. PrismApply stores your profile once, embeds it for semantic matching, extracts real job requirements, and generates packages grounded in cited evidence from your background.',
  },
  {
    question: 'What ATS platforms do you support?',
    answer:
      'We discover and enrich jobs from Lever, Greenhouse, and Ashby — where a large share of tech roles are posted. Application form fields are captured at discovery time so tailored answers map to the fields you will actually fill in.',
  },
  {
    question: 'Will recruiters know I used AI?',
    answer:
      'The goal is not to hide that you used tools — it is to present your real experience clearly for each role. Packages should read like a strong human-written application because they are built from your actual story, not generic AI filler.',
  },
  {
    question: 'How does matching work?',
    answer:
      'We use a three-layer match: hard preference checks (remote, visa, seniority, dealbreakers), semantic similarity between your profile sections and job requirements via embeddings, and an LLM adjudication step for borderline cases. Only strong fits become tailored packages.',
  },
  {
    question: 'How much does PrismApply cost?',
    answer:
      'PrismApply is free during beta. You can build your profile, receive matches, and review tailored packages at no charge while we refine the product with early users.',
  },
  {
    question: 'What data do you store?',
    answer:
      'We store your account credentials (hashed password), profile JSON, resume text, embedding vectors for matching, and generated application packages. See our Privacy Policy for full details on retention and your rights.',
  },
  {
    question: 'Can I edit a tailored package before applying?',
    answer:
      'Yes. Every package is a starting point. Copy form answers, download PDFs, and adjust anything before you submit. You are always the final editor.',
  },
]

export const faqByTopic = {
  honesty: faqItems.filter((_, i) => [2, 3, 5].includes(i)),
  safety: faqItems.filter((_, i) => [0, 1].includes(i)),
  product: faqItems.filter((_, i) => [4, 6, 7, 9].includes(i)),
}
