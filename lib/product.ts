export const product = {
  id: 'pharma' as 'pharma' | 'loyer',
  name: 'Pharma',
  domain: 'pharma.helveticlens.ch',
  eyebrow: 'PHARMACEUTICAL INTELLIGENCE',
  noun: 'product',
  description:
    'Regulatory intelligence for medicines, safety and market access.',
  examples: [
    {
      name: 'Medicine safety',
      goal: 'Monitor safety communications and regulatory changes affecting GLP-1 medicines in Switzerland.',
      sector: 'Pharmaceuticals · Pharmacovigilance',
    },
    {
      name: 'Market access',
      goal: 'Track Swiss reimbursement, authorisation and market access developments for our medicine portfolio.',
      sector: 'Pharmaceuticals · Market access',
    },
    {
      name: 'Clinical development',
      goal: 'Follow Swiss clinical trial requirements and regulatory guidance for biologics.',
      sector: 'Pharmaceuticals · Clinical development',
    },
  ],
  recommended: [
    {
      id: 'swissmedic-vigilance',
      name: 'Swissmedic · Vigilance',
      jurisdiction: 'Switzerland',
      url: 'https://www.swissmedic.ch/swissmedic/en/home/humanarzneimittel/market-surveillance/pharmacovigilance/vigilance-news.html',
      description:
        'Safety information from the Swiss medicines authority. Monitor changes to this page.',
    },
    {
      id: 'ema-news',
      name: 'EMA · News and events',
      jurisdiction: 'European Union',
      url: 'https://www.ema.europa.eu/en/news-events',
      description:
        'European medicines regulatory news. A page watch, not a complete EU regulatory feed.',
    },
    {
      id: 'fda-safety',
      name: 'FDA · Drug safety',
      jurisdiction: 'United States',
      url: 'https://www.fda.gov/drugs/drug-safety-and-availability/drug-safety-communications',
      description:
        'FDA safety communications. Monitor the selected index page for changes.',
    },
  ],
} as const;
