import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  APP_NAME, LEGAL_ENTITY, PRIVACY_EMAIL, POSTAL_ADDRESS, LAST_UPDATED,
  SUBPROCESSORS, OPTIONAL_INTEGRATIONS,
} from '../data/legal.js';

const H = ({ children }) => (
  <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{children}</h2>
);
const UL = ({ children }) => (
  <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</ul>
);

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '40px 24px', color: 'var(--ink)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', background: 'var(--bg-1)', padding: '40px 48px', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 30, fontSize: 13, fontWeight: 600 }}>
          <i className="ph ph-arrow-left" /> Back
        </button>

        <h1 style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 32, marginBottom: 12 }}>Privacy Policy</h1>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 32 }}>Last updated: {LAST_UPDATED}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)' }}>
          <p>
            This Privacy Policy explains how {LEGAL_ENTITY} ("we," "our," or "us") collects, uses, shares, and protects information when you use the {APP_NAME} platform and website (the "Service"). If you do not agree with it, please do not use the Service.
          </p>

          <section>
            <H>1. Our Role</H>
            <p>For your own account information, we are the "controller" (or "business") — we decide how it is handled, and this policy explains how.</p>
            <p style={{ marginTop: 8 }}>For personal information <em>you</em> put into the Service about other people — your teammates, your vendor contacts, and any email contact lists you upload — <strong>you are the controller and we act as your processor</strong>, handling that data on your instructions to provide the Service. You are responsible for having a lawful basis to collect and share that information with us, for telling those people how their data is used, and for honouring their rights. See Section 11.</p>
          </section>

          <section>
            <H>2. Information We Collect</H>
            <UL>
              <li><strong>Account information.</strong> Your email address, password (stored only as a salted hash by our authentication provider — we never see it), display name, and, if you sign in with Google, the basic profile information Google returns.</li>
              <li><strong>Brand and production content.</strong> Everything you create in the Service: product records, designs and uploaded images, layered canvas working files, tech packs, measurements and bills of materials, materials, vendor records, RFQs and quotes, samples and photos, production orders, payments you log, notes, comments, and chat messages.</li>
              <li><strong>Payment information.</strong> Subscriptions and credit purchases are processed by Stripe. <strong>We never receive or store your full card number.</strong> We store a Stripe customer identifier, your subscription status and plan tier, and your credit balance and transaction ledger.</li>
              <li><strong>Connected platform data.</strong> If you connect a storefront or social account ({OPTIONAL_INTEGRATIONS}), we store the access token that connection issues and the data the connection returns — typically orders, product and stock levels, shop identifiers, and the connected account handle.</li>
              <li><strong>AI inputs and outputs.</strong> The prompts, images, and brand context you submit to AI features, and the results returned. See Section 4.</li>
              <li><strong>Technical and usage data.</strong> IP address, browser and device type, operating system, timestamps, pages viewed, and error diagnostics collected automatically when you use the Service.</li>
              <li><strong>Communications.</strong> Messages you send us for support, feedback, or bug reports submitted in-app.</li>
            </UL>
          </section>

          <section>
            <H>3. Cookies and Local Storage</H>
            <p>We do not use advertising cookies, and we do not run third-party analytics or advertising trackers. We use only what the Service needs to work:</p>
            <UL>
              <li><strong>Authentication tokens</strong> stored in your browser by our authentication provider to keep you signed in.</li>
              <li><strong>Local storage preferences</strong> held only in your own browser — which brand you last had open, your recently-viewed items, your theme, and which sticky note is expanded. These never reach our servers, which is also why they don't follow you to another device.</li>
            </UL>
            <p style={{ marginTop: 8 }}>Because we set no advertising or cross-site tracking cookies, there is nothing to consent to for those purposes. Clearing your browser storage will sign you out and reset those preferences.</p>
          </section>

          <section>
            <H>4. Artificial Intelligence</H>
            <p>{APP_NAME} uses third-party AI providers to power its generation and analysis features. When you use one of those features, the data needed for that specific request is transmitted to the relevant provider over an encrypted connection:</p>
            <UL>
              <li><strong>OpenAI</strong> processes every AI feature — image generation and editing, and text generation and analysis (tech packs, vendor extraction, cost estimates, design critique, and the AI assistant) — receiving the text of your request, a summary of the relevant brand data, and any design image you attach.</li>
              <li><strong>Tavily</strong> processes web searches for vendor discovery, receiving your search terms only — never your designs.</li>
            </UL>
            <p style={{ marginTop: 8 }}><strong>We do not train any AI model on your content</strong>, and we do not permit our providers to use content submitted through our accounts to train their models. We send only what the requested feature needs. We cannot, however, control a provider's own retention practices beyond our agreements with them — providers typically retain request data briefly for abuse monitoring.</p>
            <p style={{ marginTop: 8 }}>Do not submit information to AI features that you are not comfortable transmitting to these providers, including anything you hold under a confidentiality obligation to someone else.</p>
          </section>

          <section>
            <H>5. The Design Canvas</H>
            <p>The in-app design canvas is an embedded third-party editor provided by <strong>Photopea</strong>, loaded in a frame within your browser. Design files you open, edit, or save on the canvas are processed by that embedded editor. Your saved results are stored by us; the editing session itself takes place in the third-party frame. Photopea's own privacy policy governs its handling of that data.</p>
          </section>

          <section>
            <H>6. How We Use Information</H>
            <UL>
              <li>To create and operate your account and workspaces, and to deliver the features you use.</li>
              <li>To process payments, manage subscriptions and AI credits, and send billing confirmations.</li>
              <li>To send transactional and service messages — invitations, account notices, and changes to these policies.</li>
              <li>To provide support and respond to your requests.</li>
              <li>To secure the Service — detecting and preventing fraud, abuse, and unauthorized access, and enforcing rate limits and plan entitlements.</li>
              <li>To diagnose errors and improve reliability and performance, using aggregated or technical data.</li>
              <li>To comply with law and to establish, exercise, or defend legal claims.</li>
            </UL>
            <p style={{ marginTop: 8 }}><strong>Legal bases (EU/UK users).</strong> We process your data to perform our contract with you (operating the Service and billing), on the basis of legitimate interests (securing and improving the Service, defending claims), to comply with legal obligations (tax and accounting records), and on consent where we ask for it — which you may withdraw at any time.</p>
          </section>

          <section>
            <H>7. How We Share Information</H>
            <p><strong>We do not sell your personal information, and we do not share it for cross-context behavioural advertising.</strong> We have never done so. We share it only:</p>
            <UL>
              <li><strong>With service providers (sub-processors)</strong> who process data on our behalf under contract, listed in Section 8.</li>
              <li><strong>At your direction</strong> — with a platform you choose to connect, a recipient you choose to email, or teammates you invite to a workspace.</li>
              <li><strong>For legal reasons</strong> — where we reasonably believe disclosure is required by law or legal process, or is necessary to protect the rights, property, or safety of {APP_NAME}, our users, or the public.</li>
              <li><strong>In a business transfer</strong> — in connection with a merger, acquisition, financing, or sale of assets. We will notify you before your information becomes subject to a materially different privacy policy.</li>
            </UL>
          </section>

          <section>
            <H>8. Sub-processors</H>
            <p>These third parties process data on our behalf so the Service can run:</p>
            <div style={{ marginTop: 12, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '8px 8px 8px 0', color: 'var(--ink)' }}>Provider</th>
                    <th style={{ padding: '8px', color: 'var(--ink)' }}>Purpose</th>
                    <th style={{ padding: '8px 0 8px 8px', color: 'var(--ink)', whiteSpace: 'nowrap' }}>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {SUBPROCESSORS.map((s) => (
                    <tr key={s.name} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                      <td style={{ padding: '8px 8px 8px 0', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{s.name}</td>
                      <td style={{ padding: '8px' }}>{s.purpose}</td>
                      <td style={{ padding: '8px 0 8px 8px' }}>{s.region}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: 12 }}>We may update this list as our infrastructure changes; the "Last updated" date above reflects the current version.</p>
          </section>

          <section>
            <H>9. International Transfers</H>
            <p>We operate from, and most of our providers are located in, the United States. If you are in the European Economic Area, the United Kingdom, or Switzerland, your information will be transferred to and processed in countries that may not provide the same level of data protection as your home country. Where required, we rely on appropriate safeguards for those transfers, such as the European Commission's Standard Contractual Clauses in our agreements with providers. You may request more detail at the contact address below.</p>
          </section>

          <section>
            <H>10. Retention and Deletion</H>
            <UL>
              <li>We keep your account and content for as long as your account is active.</li>
              <li>Deleting an item in the Service removes it from your workspace; residual copies may persist in encrypted backups for up to <strong>30 days</strong> before being overwritten.</li>
              <li>If you close your account or we terminate it, we retain your content for <strong>30 days</strong> to allow export or recovery, then delete or anonymize it.</li>
              <li>We keep billing and transaction records for as long as required by tax and accounting law, typically seven years, even after account closure.</li>
              <li>We may retain limited information longer where necessary to resolve disputes, prevent abuse, or comply with a legal obligation.</li>
            </UL>
            <p style={{ marginTop: 8 }}>Disconnecting a third-party platform deletes the stored access token for that platform. Data already imported from it remains until you delete it.</p>
          </section>

          <section>
            <H>11. Teammates, Vendor Contacts, and Email Lists</H>
            <p>When you invite a teammate, upload a contact list, or record a vendor's contact details, you are providing us with someone else's personal information. You represent that you are permitted to do so. Those people may contact us at the address below, and we will refer their request to you as the controller and assist you in responding.</p>
            <p style={{ marginTop: 8 }}>If you use the email campaign feature, you — not us — are the sender of those messages, and you are responsible for consent, disclosure, and unsubscribe handling under applicable law.</p>
          </section>

          <section>
            <H>12. Security</H>
            <p>We use administrative, technical, and organizational measures to protect your information, including encryption in transit, row-level security in the database so one brand's data is not readable by another, authentication on every server endpoint that touches your data, scoped credit metering, and rate limiting.</p>
            <p style={{ marginTop: 8 }}>No system is perfectly secure, and we cannot guarantee absolute security. You are responsible for keeping your password confidential and your account access limited to people you trust. If we become aware of a breach affecting your personal information, we will notify you and any regulator as required by applicable law and without undue delay.</p>
          </section>

          <section>
            <H>13. Your Rights</H>
            <p>Depending on where you live, you may have the right to:</p>
            <UL>
              <li>Access the personal information we hold about you, and receive a copy in a portable format.</li>
              <li>Correct inaccurate information.</li>
              <li>Delete your information, subject to our legal retention obligations.</li>
              <li>Object to or restrict certain processing, and withdraw consent where processing is based on it.</li>
              <li>Not be discriminated against for exercising these rights.</li>
            </UL>
            <p style={{ marginTop: 8 }}><strong>California (CCPA/CPRA).</strong> The categories we collect and the purposes are described in Sections 2 and 6, and the categories disclosed to service providers in Sections 7 and 8. <strong>We do not sell personal information and do not share it for cross-context behavioural advertising</strong>, including of anyone under 16. You may exercise your rights, or use an authorized agent, via the contact below.</p>
            <p style={{ marginTop: 8 }}><strong>EU/UK.</strong> You may lodge a complaint with your local supervisory authority. We ask that you contact us first so we can try to resolve it.</p>
            <p style={{ marginTop: 8 }}>To exercise any right, email <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> from your account address. We will verify your identity and respond within the period required by law. Much of this is also self-service: you can edit your profile and brand data in the app, export tech packs and reports to PDF or CSV, and delete records directly.</p>
          </section>

          <section>
            <H>14. Do Not Track and Global Privacy Control</H>
            <p>We do not track users across third-party websites, so we do not respond differently to Do Not Track or Global Privacy Control signals — there is no cross-site tracking to disable.</p>
          </section>

          <section>
            <H>15. Children</H>
            <p>The Service is a business tool intended for adults and is not directed to children. You must be at least 18 to hold an account. We do not knowingly collect personal information from anyone under 16. If you believe a child has provided us information, contact us and we will delete it.</p>
          </section>

          <section>
            <H>16. Changes to This Policy</H>
            <p>We may update this policy. When we do, we will revise the "Last updated" date above, and for material changes we will provide notice by email or in-app before they take effect. Your continued use after the effective date constitutes acceptance.</p>
          </section>

          <section>
            <H>17. Contact Us</H>
            <p>Questions, requests, or complaints about privacy:</p>
            <p style={{ marginTop: 8 }}>
              <strong>{LEGAL_ENTITY}</strong><br />
              <strong>Email:</strong> <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
              {POSTAL_ADDRESS && <><br /><strong>Address:</strong> {POSTAL_ADDRESS}</>}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
