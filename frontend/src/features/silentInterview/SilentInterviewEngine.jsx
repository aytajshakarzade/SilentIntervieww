import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import Diversity3RoundedIcon from '@mui/icons-material/Diversity3Rounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import aiAssistantLogo from '../../assets/ai-assistant-logo.png';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { useTranslation } from '../../i18n';
import { useSubscriptionPlans } from '../../hooks/useSubscriptionPlans';
import './silentInterview.css';

const THEME_KEY = 'silentinterview.theme';
const languages = ['az', 'en', 'ru'];

// Google OAuth only accepts the configured production origin. When a Vercel
// preview deployment is opened, keep the public landing page usable but send
// authentication actions to the stable production deployment instead of a
// random preview hostname. Local development stays local.
const PRODUCTION_APP_URL = 'https://silent-interview-7db6.vercel.app';
function authUrl(path) {
  const hostname = window.location.hostname;
  const isVercelPreview = hostname.endsWith('.vercel.app') && hostname !== 'silent-interview-7db6.vercel.app';
  return isVercelPreview ? `${PRODUCTION_APP_URL}${path}` : path;
}

function readPreference(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

export default function SilentInterviewEngine() {
  const { t, language, setLanguage } = useTranslation();
  const [theme, setTheme] = useState(() => readPreference(THEME_KEY, 'light'));

  const tr = (key) => t(`landing.${key}`);

  const features = [
    [AutoAwesomeRoundedIcon, tr('feature1Title'), tr('feature1Body')],
    [DescriptionRoundedIcon, tr('feature2Title'), tr('feature2Body')],
    [Diversity3RoundedIcon, tr('feature3Title'), tr('feature3Body')],
  ];
  const [pricingAudience, setPricingAudience] = useState('candidate');
  const { plans: livePlans } = useSubscriptionPlans(pricingAudience);
  const plans = useMemo(() => livePlans.map((plan) => {
    const l = plan.limits || {};
    const c = plan.capabilities || {};
    const unlimited = (n) => Number(n) < 0 ? (language === 'az' ? 'Limitsiz' : language === 'ru' ? 'Безлимитно' : 'Unlimited') : n;
    const text = (az, en, ru) => language === 'az' ? az : language === 'ru' ? ru : en;
    const features = pricingAudience === 'recruiter'
      ? [
          `${unlimited(l.activeJobs)} ${text('aktiv vakansiya', 'active jobs', 'активных вакансий')}`,
          `${unlimited(l.monthlyAiActions)} ${text('AI müsahibə / hesabat əməliyyatları / ay', 'AI interview/report actions / month', 'AI-операций интервью / отчётов в месяц')}`,
          c.aiHrAssistant ? text('AI HR Köməkçisi aktivdir', 'AI HR Assistant included', 'AI HR Ассистент включён') : text('AI HR Köməkçisi Free planında bağlıdır', 'AI HR Assistant locked on Free', 'AI HR Ассистент недоступен на Free'),
          c.aiHrAssistant
            ? `${unlimited(l.monthlyAssistantMessages)} ${text('AI HR mesajı / ay', 'AI HR messages / month', 'сообщений AI HR / месяц')}`
            : text('Namizəd idarəetməsi', 'Candidate management', 'Управление кандидатами'),
          c.advancedAnalytics ? text('Qabaqcıl analitika', 'Advanced analytics', 'Расширенная аналитика') : text('Əsas analitika', 'Core analytics', 'Базовая аналитика'),
          c.priorityAi ? text('Prioritet AI emalı', 'Priority AI processing', 'Приоритетная обработка AI') : text('Standart AI emalı', 'Standard AI processing', 'Стандартная обработка AI'),
        ]
      : [
          `${unlimited(l.monthlyInterviews)} ${text('müsahibə / ay', 'interviews / month', 'интервью / месяц')}`,
          `${unlimited(l.monthlyAiActions)} ${text('AI müsahibə / hesabat əməliyyatları / ay', 'AI interview/report actions / month', 'AI-операций интервью / отчётов в месяц')}`,
          c.aiInterview ? text('AI müsahibə rəyi aktivdir', 'AI interview feedback included', 'AI-отзыв по интервью включён') : text('AI müsahibə funksiyaları bağlıdır', 'AI interview features locked', 'AI-функции интервью недоступны'),
          c.advancedAnalytics ? text('Qabaqcıl analitika', 'Advanced analytics', 'Расширенная аналитика') : text('Əsas hesabatlar', 'Core reports', 'Базовые отчёты'),
          c.priorityAi ? text('Prioritet AI emalı', 'Priority AI processing', 'Приоритетная обработка AI') : text('Standart AI emalı', 'Standard AI processing', 'Стандартная обработка AI'),
        ];
    return {
      name: plan.name,
      price: plan.price === 0 ? text('Pulsuz', 'Free', 'Бесплатно') : `$${Number(plan.price).toFixed(2)}`,
      suffix: plan.price === 0 ? '' : tr('perMonth'),
      description: plan.description || '',
      features,
      featured: plan.id === 'Go',
    };
  }), [livePlans, pricingAudience, language]);
  const faq = [[tr('faq1Q'), tr('faq1A')], [tr('faq2Q'), tr('faq2A')], [tr('faq3Q'), tr('faq3A')]];

  return <main className="silent-interview" data-theme={theme} onPointerMove={(event) => { const r = event.currentTarget.getBoundingClientRect(); event.currentTarget.style.setProperty('--mx', `${((event.clientX-r.left)/r.width*100).toFixed(2)}%`); event.currentTarget.style.setProperty('--my', `${((event.clientY-r.top)/r.height*100).toFixed(2)}%`); }}>
    <div className="si-ambient" aria-hidden="true"><span className="si-ambient-blob a"/><span className="si-ambient-blob b"/><span className="si-ambient-blob c"/><span className="si-ambient-ring r1"/><span className="si-ambient-ring r2"/></div>
    <div className="si-wrap">
      <nav className="si-nav" aria-label={tr('primaryNav')}>
        <Link className="si-logo" to="/"><b>Silent</b><span>Interview</span></Link>
        <div className="si-links"><a href="#product">{tr('navProduct')}</a><a href="#workflow">{tr('navWorkflow')}</a><a href="#pricing">{tr('navPricing')}</a><a href="#faq">{tr('navFaq')}</a></div>
        <div className="si-actions">
          <div className="si-language" aria-label={tr('language')}>{languages.map((code) => <button className="si-lang" type="button" key={code} onClick={() => setLanguage(code)} aria-pressed={language === code}>{code.toUpperCase()}</button>)}</div>
          <button className="si-icon-button" type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={tr('theme')}>{theme === 'light' ? <DarkModeRoundedIcon fontSize="small"/> : <LightModeRoundedIcon fontSize="small"/>}</button>
          <a className="si-button si-button-secondary" href={authUrl("/login")}>{tr('signIn')}</a><a className="si-button si-button-primary" href={authUrl("/register")}>{tr('startFree')}</a>
        </div>
      </nav>

      <section className="si-hero">
        <div><div className="si-eyebrow">{tr('eyebrow')}</div><h1>{tr('heroTitle')}</h1><p>{tr('heroBody')}</p><div className="si-hero-actions"><a className="si-button si-button-primary" href={authUrl("/register")}>{tr('startFree')}<ArrowForwardRoundedIcon fontSize="small"/></a><a className="si-button si-button-secondary" href="#product">{tr('exploreProduct')}</a></div><div className="si-trust">{tr('trusted')}</div></div>
        <div className="si-visual"><div className="si-visual-main"><div className="si-visual-top"><span className="si-visual-label">{tr('visualLabel')}</span><span className="si-status">●</span></div><h3>{tr('visualTitle')}</h3><p>{tr('visualBody')}</p><div className="si-pills"><span className="si-pill">{tr('visualPill1')}</span><span className="si-pill">{tr('visualPill2')}</span><span className="si-pill">{tr('visualPill3')}</span></div><div className="si-orbit"/><div className="si-ai-orb"><span className="si-ai-ring"/><img src={aiAssistantLogo} alt="AI HR Assistant"/><span className="si-ai-live"><SmartToyRoundedIcon fontSize="inherit"/> AI HR</span></div></div></div>
      </section>

      <section className="si-section" id="workflow"><div className="si-section-heading"><div className="si-eyebrow">{tr('workflowEyebrow')}</div><h2>{tr('workflowTitle')}</h2></div><div className="si-workflow"><Flow title={tr('workflowCandidateTitle')} steps={[tr('candidateStep1'),tr('candidateStep2'),tr('candidateStep3')]}/><Flow title={tr('workflowRecruiterTitle')} steps={[tr('recruiterStep1'),tr('recruiterStep2'),tr('recruiterStep3')]}/></div></section>
      <section className="si-section" id="product"><div className="si-section-heading"><div className="si-eyebrow">{tr('featuresEyebrow')}</div><h2>{tr('featuresTitle')}</h2></div><div className="si-features">{features.map(([Icon,title,body]) => <article className="si-feature" key={title}><Icon/><h3>{title}</h3><p>{body}</p></article>)}</div></section>
      <section className="si-section" id="pricing"><div className="si-section-heading"><div className="si-eyebrow">{tr('pricingEyebrow')}</div><h2>{tr('pricingTitle')}</h2><div className="si-pricing-switch" role="tablist" aria-label="Pricing audience"><button type="button" className={pricingAudience === 'candidate' ? 'active' : ''} onClick={() => setPricingAudience('candidate')}>Candidate</button><button type="button" className={pricingAudience === 'recruiter' ? 'active' : ''} onClick={() => setPricingAudience('recruiter')}>Recruiter</button></div></div><div className="si-plans">{plans.map((plan) => <article className={`si-plan ${plan.featured ? 'si-plan-featured' : ''}`} key={plan.name}>{plan.featured && <div className="si-plan-badge">★ {tr('recommended')}</div>}<div className="si-plan-name">{plan.name}</div><div className="si-plan-price">{plan.price}</div><small>{plan.suffix}</small><p>{plan.description}</p><hr/><div className="si-plan-includes">{tr('includes')}</div><ul className="si-plan-list">{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul><a className="si-plan-action" href={authUrl("/register")}>{plan.name === 'Free' ? tr('startFree') : plan.name === 'Go' ? tr('chooseGo') : tr('choosePro')} <ArrowForwardRoundedIcon fontSize="small" /></a></article>)}</div><figure className="si-quote"><blockquote>{tr('quote')}</blockquote><figcaption>{tr('quoteRole')}</figcaption></figure></section>
      <section className="si-section" id="faq"><div className="si-section-heading"><div className="si-eyebrow">{tr('faqEyebrow')}</div><h2>{tr('faqTitle')}</h2></div><div className="si-faqs">{faq.map(([question,answer]) => <article className="si-faq" key={question}><h3>{question}</h3><p>{answer}</p></article>)}</div></section>
      <section className="si-cta"><h2>{tr('ctaTitle')}</h2><p>{tr('ctaBody')}</p><a className="si-button si-button-secondary" href={authUrl("/register")}>{tr('startFree')}<ArrowForwardRoundedIcon fontSize="small"/></a></section>
      <footer className="si-footer"><div><span className="si-logo"><b>Silent</b><span>Interview</span></span><span> · {tr('footerTagline')}</span></div><div className="si-footer-links"><a href="#privacy">{tr('privacy')}</a><a href="#terms">{tr('terms')}</a><a href="#support">{tr('support')}</a></div><span>{tr('copyright')}</span></footer>
    </div>
  </main>;
}

function Flow({ title, steps }) { return <article className="si-flow-card"><h3>{title}</h3>{steps.map((step,index) => <div className="si-step" key={step}><strong>0{index + 1}</strong><span>{step}</span></div>)}</article>; }
