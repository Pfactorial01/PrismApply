import { site } from '../config'

export type FaqItem = {
  question: string
  answer: string
}

export function canonicalUrl(pathname: string): string {
  const base = site.url.replace(/\/$/, '')
  const path = pathname === '/' ? '' : pathname.replace(/\/$/, '')
  return `${base}${path}`
}

export function absoluteUrl(path: string): string {
  if (path.startsWith('http')) return path
  return canonicalUrl(path.startsWith('/') ? path : `/${path}`)
}

export function softwareApplicationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: site.name,
    description: site.description,
    url: site.appUrl,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free during beta',
    },
  }
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.name,
    url: site.url,
    logo: absoluteUrl('/favicon.svg'),
    description: site.description,
  }
}

export function faqPageJsonLd(faqs: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

export function articleJsonLd(input: {
  title: string
  description: string
  slug: string
  pubDate: Date
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    datePublished: input.pubDate.toISOString(),
    author: {
      '@type': 'Organization',
      name: site.name,
    },
    publisher: {
      '@type': 'Organization',
      name: site.name,
      logo: {
        '@type': 'ImageObject',
        url: absoluteUrl('/favicon.svg'),
      },
    },
    mainEntityOfPage: absoluteUrl(`/blog/${input.slug}`),
  }
}

export const defaultOgImage = '/og-image.svg'
