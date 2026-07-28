import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  APP_NAME, LEGAL_ENTITY, CONTACT_EMAIL, DMCA_EMAIL, POSTAL_ADDRESS,
  GOVERNING_LAW, VENUE, LAST_UPDATED, LIABILITY_FLOOR_USD, OPTIONAL_INTEGRATIONS,
} from '../data/legal.js';

/* Presentational helpers — these two documents are mostly prose, and repeating
   the same inline style object 30 times made the previous version hard to edit
   without breaking the layout. */
const H = ({ children }) => (
  <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>{children}</h2>
);
const UL = ({ children }) => (
  <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</ul>
);

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '40px 24px', color: 'var(--ink)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', background: 'var(--bg-1)', padding: '40px 48px', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 30, fontSize: 13, fontWeight: 600 }}>
          <i className="ph ph-arrow-left" /> Back
        </button>

        <h1 style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 32, marginBottom: 12 }}>Terms of Service</h1>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 32 }}>Last updated: {LAST_UPDATED}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)' }}>
          <p>
            These Terms of Service ("Terms") are a legally binding agreement between you, whether personally or on behalf of an entity ("you"), and {LEGAL_ENTITY} ("we," "us," or "our"), concerning your access to and use of the {APP_NAME} software-as-a-service platform, website, and related services (collectively, the "Service").
          </p>
          <p>
            By accessing or using the Service, you agree that you have read, understood, and agree to be bound by all of these Terms. IF YOU DO NOT AGREE WITH ALL OF THESE TERMS, YOU ARE EXPRESSLY PROHIBITED FROM USING THE SERVICE AND MUST DISCONTINUE USE IMMEDIATELY.
          </p>
          <p style={{ padding: '12px 16px', background: 'var(--bg-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
            <strong>Please read these sections carefully.</strong> Section 17 disclaims warranties, Section 18 limits our liability, Section 19 requires you to indemnify us, and <strong>Section 20 requires most disputes to be resolved by binding individual arbitration and waives your right to a jury trial and to participate in a class action.</strong> Section 20 explains how to opt out of arbitration within 30 days.
          </p>

          <section>
            <H>1. Changes to These Terms</H>
            <p>We may modify these Terms at any time. If we make material changes, we will update the "Last updated" date above and, where practical, notify you by email or in-app notice before the changes take effect. Your continued use of the Service after changes become effective constitutes acceptance of the revised Terms. If you do not agree, you must stop using the Service and may cancel your subscription.</p>
          </section>

          <section>
            <H>2. Eligibility and Authority</H>
            <p>You must be at least 18 years old and capable of forming a binding contract to use the Service. If you use the Service on behalf of a company or other entity, you represent that you have authority to bind that entity, and "you" refers to that entity.</p>
            <p style={{ marginTop: 8 }}>You represent that you are not located in, and are not a national or resident of, any country subject to a comprehensive government embargo, and that you are not on any government list of prohibited or restricted parties. You agree not to use the Service in violation of any applicable export control or sanctions laws.</p>
          </section>

          <section>
            <H>3. Accounts, Teams, and Security</H>
            <p>You are responsible for maintaining the confidentiality of your credentials and for all activity that occurs under your account. You agree to notify us promptly at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> of any unauthorized use.</p>
            <p style={{ marginTop: 8 }}>If you invite teammates to a brand workspace, you acknowledge that:</p>
            <UL>
              <li>You are responsible for your teammates' use of the Service and their compliance with these Terms.</li>
              <li>Members you invite may be able to view, edit, export, or delete data in that workspace according to the role you assign them, and administrators may access content created by other members.</li>
              <li>You are responsible for having a lawful basis to share any personal information about your teammates with us.</li>
              <li>Removing a member does not retroactively delete content they created, nor recall data they exported.</li>
            </UL>
          </section>

          <section>
            <H>4. What the Service Is — and What It Is Not</H>
            <p>{APP_NAME} is a software platform that helps independent fashion brands manage product design, technical packs, vendor sourcing, quoting, sampling, production tracking, and sales analytics. <strong>We act exclusively as a software provider.</strong></p>
            <p style={{ marginTop: 8 }}>We are not a manufacturer, a sourcing or purchasing agent, a freight forwarder, a customs broker, a quality-control inspector, an escrow or payment intermediary between you and your vendors, or a professional adviser of any kind. Specifically:</p>
            <UL>
              <li><strong>We are not a party to your agreements with vendors, manufacturers, or suppliers.</strong> Any order, quote, sample request, contract, payment, or dispute between you and a vendor is solely between you and that vendor.</li>
              <li>We do not verify, endorse, or guarantee the identity, legitimacy, solvency, certifications, capacity, labour practices, or quality of any vendor surfaced through search or saved in the Service. Vendor information is largely assembled from public web sources and from what you enter yourself, and may be inaccurate or out of date. The "verified" toggle in the Service is a label <em>you</em> set for your own record-keeping; it is not a representation by us.</li>
              <li>We do not guarantee that any product you develop using the Service will be manufacturable, compliant with any law or standard, safe, or fit for sale in any market.</li>
            </UL>
            <p style={{ marginTop: 8 }}>You are solely responsible for your own due diligence on any vendor and for your own regulatory compliance, including product safety, labelling, fibre content, country-of-origin marking, customs, and import/export requirements.</p>
          </section>

          <section>
            <H>5. Plans, Fees, Billing, and Cancellation</H>
            <p><strong>Fees.</strong> Paid plans are billed in advance at the price presented at checkout. All fees are exclusive of taxes, levies, and duties, which are your responsibility unless we are required to collect them.</p>
            <p style={{ marginTop: 8 }}><strong>Auto-renewal.</strong> Subscriptions renew automatically at the end of each billing period at the then-current price until cancelled. You may cancel at any time through your account's billing settings or the Stripe customer portal; cancellation takes effect at the end of the current billing period.</p>
            <p style={{ marginTop: 8 }}><strong>Price changes.</strong> We may change prices. Changes to recurring subscription pricing will not apply to your current billing period and we will give you notice before the change takes effect at your next renewal.</p>
            <p style={{ marginTop: 8 }}><strong>No refunds.</strong> Except where required by law, payments are non-refundable and we do not provide refunds or credits for partial periods, unused AI credits, or unused features. If we suspend or terminate your account for breach of these Terms, you will not receive a refund.</p>
            <p style={{ marginTop: 8 }}><strong>Failed payments.</strong> If a payment fails, we may suspend or downgrade your access until payment succeeds.</p>
          </section>

          <section>
            <H>6. AI Credits</H>
            <p>Certain AI features consume "credits." Credits are a limited, revocable licence to use those features — not property, not currency, and not a stored-value or gift-card instrument. You agree that:</p>
            <UL>
              <li>Credits have <strong>no cash value</strong>, cannot be redeemed for money, and are non-transferable between accounts or brands.</li>
              <li>Subscription credits are granted per billing period and <strong>do not roll over</strong>; any unused balance from that grant expires when the period's allowance is replaced.</li>
              <li>Purchased top-up credits remain available while your account is active but are forfeited without refund if your account is terminated for breach of these Terms.</li>
              <li>Credits are consumed when a request is submitted. If a request fails due to an error on our side, we will restore the credits automatically; we are not obliged to refund credits consumed by a request that completed but produced a result you did not like.</li>
              <li>We may change credit prices and per-feature costs prospectively. Changes will not retroactively reduce a credit balance you already hold.</li>
            </UL>
          </section>

          <section>
            <H>7. Your Content</H>
            <p><strong>You own your content.</strong> You retain all ownership rights to the designs, images, text, tech packs, vendor records, and other data you upload, create, or process within the Service ("User Content").</p>
            <p style={{ marginTop: 8 }}><strong>Licence to us.</strong> You grant us a worldwide, non-exclusive, royalty-free licence to host, store, reproduce, transmit, display, and create technical modifications of your User Content solely to the extent necessary to operate and provide the Service to you and to comply with law. This licence ends when you delete the content or close your account, except for copies retained in routine backups for the period described in our Privacy Policy. <strong>We do not use your User Content to train AI models</strong>, and we do not sell it.</p>
            <p style={{ marginTop: 8 }}><strong>Your responsibility.</strong> You represent and warrant that you own or have all rights necessary to your User Content, and that neither the content nor our permitted use of it infringes any third party's intellectual property, privacy, or other rights, or violates any law. You are solely responsible for your User Content and for keeping your own copies of anything important — see Section 16 on termination.</p>
          </section>

          <section>
            <H>8. AI Features and Outputs</H>
            <p>The Service uses artificial intelligence to generate images, technical specifications, recommendations, and estimates. You acknowledge and agree that:</p>
            <UL>
              <li><strong>AI output can be wrong.</strong> AI systems produce inaccurate, incomplete, biased, or fabricated results ("hallucinations"). Bills of materials, graded measurements, cost breakdowns, duty and shipping estimates, vendor profiles, and readiness scores generated by AI are drafts and estimates only.</li>
              <li><strong>You must review everything before relying on it.</strong> You are solely responsible for verifying and validating any AI-generated content before using it to manufacture a product, place an order, price a product, quote a customer, or make any other business decision. <strong>We are not liable for manufacturing errors, defective or non-compliant goods, rejected shipments, financial loss, lost profit, inventory problems, or vendor disputes arising from your reliance on AI-generated output.</strong></li>
              <li><strong>Ownership of output.</strong> As between you and us, you own the output generated for you, to the extent such output is capable of being owned. We claim no ownership of it.</li>
              <li><strong>Output is not unique and is not warranted to be clear of third-party rights.</strong> AI systems generate similar or identical output for different users given similar prompts. We do not represent that any AI output is original, novel, non-infringing, or registrable, and we give no warranty that using it will not infringe a third party's copyright, trademark, design right, or other rights. <strong>Clearing rights before commercial use — particularly for logos, prints, patterns, and other artwork you intend to put on goods for sale — is your responsibility.</strong></li>
              <li>You must not submit to the AI features any content you lack the rights to submit, and you must not use them to deliberately imitate a third party's protected trademarks, characters, or copyrighted designs.</li>
              <li>AI features depend on third-party providers and may change, degrade, or become unavailable. Requests are processed by the providers listed in our Privacy Policy.</li>
            </UL>
          </section>

          <section>
            <H>9. No Professional Advice</H>
            <p>The Service produces financial figures — landed cost, margin, break-even, cash-flow projections, MOQ comparisons, duty-rate estimates, and similar. <strong>These are informational estimates generated from data you supply and are not financial, accounting, tax, customs, legal, or regulatory-compliance advice.</strong> No fiduciary or advisory relationship is created by your use of the Service. Consult a qualified professional before acting on any figure the Service produces.</p>
          </section>

          <section>
            <H>10. Acceptable Use</H>
            <p>You agree not to, and not to permit anyone else to:</p>
            <UL>
              <li>Use the Service in violation of any applicable law, or to infringe or misappropriate anyone's intellectual property, privacy, or publicity rights.</li>
              <li>Upload malware, or attempt to gain unauthorized access to the Service, other users' accounts or data, or any connected system.</li>
              <li>Probe, scan, or test the vulnerability of the Service, or circumvent any authentication, rate limit, credit metering, plan limit, or other technical restriction.</li>
              <li>Reverse engineer, decompile, or attempt to derive the source code of the Service, except to the extent that restriction is prohibited by law.</li>
              <li>Scrape, crawl, or bulk-extract data from the Service by automated means, or resell, sublicense, or provide the Service to third parties as a service bureau.</li>
              <li>Use the Service to send unsolicited or unlawful messages, or to harass, defame, or impersonate any person or entity.</li>
              <li>Impose an unreasonable load on our infrastructure or that of our providers, or use the Service in a manner that risks our accounts with those providers.</li>
            </UL>
            <p style={{ marginTop: 8 }}>We may investigate and take any action we reasonably consider appropriate for a violation, including removing content, and suspending or terminating access.</p>
          </section>

          <section>
            <H>11. Email, Outreach, and Contact Lists</H>
            <p>The Service can send email on your behalf — team invitations, vendor outreach, and email campaigns to contact lists you supply. With respect to any such message, <strong>you are the sender and you are responsible for its content and its legality.</strong> You represent and warrant that:</p>
            <UL>
              <li>You have a lawful basis and, where required, valid consent to email every address you upload or enter, and you have the right to provide those addresses to us.</li>
              <li>Your messages comply with all applicable laws governing commercial and marketing email, including the CAN-SPAM Act, CASL, GDPR/ePrivacy, and any equivalent law in your recipients' jurisdictions — including honouring opt-out requests promptly and identifying the sender accurately.</li>
              <li>You will not use these features to send spam, deceptive, or unlawful content, or to send on behalf of a third party.</li>
            </UL>
            <p style={{ marginTop: 8 }}>Sending limits apply and may change without notice. We may suspend sending features immediately, without notice, if we reasonably believe they are being misused or are endangering our sending reputation or our providers' accounts. You will indemnify us for claims arising from messages sent through your account under Section 19.</p>
          </section>

          <section>
            <H>12. Third-Party Services and Integrations</H>
            <p>The Service lets you connect third-party accounts, including {OPTIONAL_INTEGRATIONS}. Your use of those services is governed by their own terms and privacy policies, and you are responsible for complying with them.</p>
            <p style={{ marginTop: 8 }}>We do not control those services and are not responsible for their availability, accuracy, security, pricing, or for any act or omission of the provider. When you authorize a connection, you direct us to access and process data from that service on your behalf, within the scope you granted. A third party may change, restrict, deprecate, or terminate its API at any time, which may break or remove a feature of the Service without notice or liability. Where the Service publishes a listing or product to a connected storefront, you remain responsible for the content, accuracy, pricing, and legality of that listing.</p>
          </section>

          <section>
            <H>13. Our Intellectual Property</H>
            <p>The Service, and all source code, databases, functionality, software, designs, text, graphics, and the {APP_NAME} name and logo, are our proprietary property or licensed to us, and are protected by intellectual property laws. We grant you a limited, non-exclusive, non-transferable, revocable licence to access and use the Service for your internal business purposes during your subscription, subject to these Terms. All rights not expressly granted are reserved.</p>
            <p style={{ marginTop: 8 }}><strong>Feedback.</strong> If you send us suggestions, feature requests, or feedback, you grant us an unrestricted, perpetual, irrevocable, royalty-free right to use it for any purpose without obligation or compensation to you.</p>
          </section>

          <section>
            <H>14. Copyright Complaints</H>
            <p>If you believe content on the Service infringes your copyright, send a notice to <a href={`mailto:${DMCA_EMAIL}`}>{DMCA_EMAIL}</a> including: your contact details; identification of the copyrighted work; identification of the material claimed to be infringing and where it is located; a statement that you have a good-faith belief the use is unauthorized; a statement, under penalty of perjury, that the information is accurate and that you are authorized to act on the owner's behalf; and your physical or electronic signature. We may remove material and terminate the accounts of repeat infringers. Knowingly submitting a materially false notice may expose you to liability.</p>
          </section>

          <section>
            <H>15. Availability, Changes, and Beta Features</H>
            <p>We may change, suspend, or discontinue any part of the Service at any time. We aim to give reasonable notice of material adverse changes to paid features, but we do not guarantee uninterrupted or error-free operation, and we are not liable for any modification, suspension, or discontinuance, or for any downtime of our hosting, database, payment, or AI providers.</p>
            <p style={{ marginTop: 8 }}>Free plans and any feature identified as beta, preview, or experimental are provided as-is, with no warranty and no service commitment, and may be changed or withdrawn at any time.</p>
          </section>

          <section>
            <H>16. Term, Suspension, and Termination</H>
            <p>These Terms apply while you use the Service. You may stop at any time by cancelling your subscription and closing your account.</p>
            <p style={{ marginTop: 8 }}>We may suspend or terminate your access, with or without notice, if you materially breach these Terms, if your payment fails, if we reasonably believe your use creates legal risk or harms the Service or other users, or if we discontinue the Service.</p>
            <p style={{ marginTop: 8 }}><strong>Effect of termination.</strong> Your right to use the Service ends immediately. Unless prohibited by law or the account was terminated for abuse, we will make your User Content available for export for <strong>30 days</strong> after termination, after which we may permanently delete it. <strong>You are responsible for maintaining your own copies of anything you need — export your tech packs, designs, and records before you cancel.</strong> Sections 7 (as to the warranties you gave), 8, 9, 13, 17, 18, 19, 20, 21, and 23 survive termination.</p>
          </section>

          <section>
            <H>17. Disclaimer of Warranties</H>
            <p>THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITH ALL FAULTS. YOUR USE OF THE SERVICE IS AT YOUR SOLE RISK. TO THE FULLEST EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS, IMPLIED, OR STATUTORY, INCLUDING THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, QUIET ENJOYMENT, ACCURACY, AND NON-INFRINGEMENT, AND ANY WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE OF TRADE.</p>
            <p style={{ marginTop: 8 }}>WITHOUT LIMITING THE FOREGOING, WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE; THAT DATA WILL NOT BE LOST OR CORRUPTED; THAT AI OUTPUT WILL BE ACCURATE, ORIGINAL, OR NON-INFRINGING; OR THAT ANY VENDOR, ESTIMATE, OR THIRD-PARTY DATA PRESENTED THROUGH THE SERVICE IS ACCURATE OR RELIABLE. SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OF IMPLIED WARRANTIES, SO SOME OF THE ABOVE MAY NOT APPLY TO YOU.</p>
          </section>

          <section>
            <H>18. Limitation of Liability</H>
            <p>TO THE FULLEST EXTENT PERMITTED BY LAW, NEITHER WE NOR OUR OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, OR SUPPLIERS WILL BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOST PROFITS, LOST REVENUE, LOST SALES, LOST GOODWILL, BUSINESS INTERRUPTION, WASTED EXPENDITURE, COST OF SUBSTITUTE SERVICES, OR LOSS OR CORRUPTION OF DATA, ARISING OUT OF OR RELATING TO THE SERVICE, WHETHER IN CONTRACT, TORT (INCLUDING NEGLIGENCE), OR ANY OTHER THEORY, AND EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.</p>
            <p style={{ marginTop: 8 }}>
              <strong>TOTAL LIABILITY CAP.</strong> OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THE SERVICE OR THESE TERMS WILL NOT EXCEED THE GREATER OF (A) THE TOTAL AMOUNTS YOU ACTUALLY PAID US IN THE TWELVE (12) MONTHS IMMEDIATELY BEFORE THE EVENT GIVING RISE TO THE CLAIM, OR (B) US ${LIABILITY_FLOOR_USD}.
            </p>
            <p style={{ marginTop: 8 }}>These limitations apply even if a limited remedy fails of its essential purpose, and are a fundamental basis of the bargain between us — the Service would not be offered at these prices without them. Nothing in these Terms excludes liability that cannot lawfully be excluded, including for fraud, or for death or personal injury caused by negligence. Some jurisdictions do not allow certain limitations, so parts of this section may not apply to you.</p>
          </section>

          <section>
            <H>19. Indemnification</H>
            <p>You agree to defend, indemnify, and hold harmless {LEGAL_ENTITY} and our officers, directors, employees, and agents from and against any claim, demand, loss, liability, damage, judgment, or expense (including reasonable legal fees) brought by a third party and arising out of or relating to: (a) your use of the Service; (b) your breach of these Terms or of any law; (c) your User Content, including any claim that it infringes a third party's rights; (d) your commercial use of AI output, including any claim that it infringes a third party's rights; (e) your dealings, contracts, or disputes with any vendor, manufacturer, or customer; (f) any product you design, manufacture, market, or sell; or (g) any message sent through your account. We will notify you of any such claim and may participate in the defence at our own expense; you may not settle a claim in a way that imposes any obligation or admission on us without our written consent.</p>
          </section>

          <section>
            <H>20. Dispute Resolution — Binding Arbitration and Class Action Waiver</H>
            <p><strong>Please read this section carefully. It affects your legal rights.</strong></p>
            <p style={{ marginTop: 8 }}><strong>Informal resolution first.</strong> Before starting any formal proceeding, you agree to contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with a written description of the dispute and to negotiate in good faith for at least 30 days. Most concerns are resolved this way.</p>
            <p style={{ marginTop: 8 }}><strong>Binding arbitration.</strong> If we cannot resolve it informally, you and we agree that any dispute arising out of or relating to these Terms or the Service will be resolved by final and binding individual arbitration, rather than in court, administered by a recognized arbitration provider under its then-current consumer or commercial rules, before a single arbitrator, conducted in {VENUE} or, at your election, by videoconference or on written submissions. The arbitrator has exclusive authority to resolve disputes about the interpretation, applicability, or enforceability of this agreement to arbitrate.</p>
            <p style={{ marginTop: 8 }}><strong>Exceptions.</strong> Either party may bring an individual claim in small-claims court if it qualifies, and either party may seek injunctive relief in court to protect intellectual property or prevent unauthorized access to the Service.</p>
            <p style={{ marginTop: 8 }}><strong>CLASS ACTION AND JURY WAIVER.</strong> YOU AND WE AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN AN INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE, OR REPRESENTATIVE PROCEEDING. THE ARBITRATOR MAY NOT CONSOLIDATE MORE THAN ONE PERSON'S CLAIMS OR PRESIDE OVER ANY FORM OF REPRESENTATIVE PROCEEDING. YOU AND WE WAIVE ANY RIGHT TO A JURY TRIAL. If this waiver is found unenforceable as to a particular claim, that claim — and only that claim — will proceed in court, and the rest of this section remains in force.</p>
            <p style={{ marginTop: 8 }}><strong>30-day opt-out.</strong> You may opt out of this arbitration agreement by emailing <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with your account email and the words "ARBITRATION OPT-OUT" within 30 days of first accepting these Terms. Opting out does not affect any other part of these Terms.</p>
            <p style={{ marginTop: 8 }}><strong>Time limit.</strong> Any claim must be brought within one (1) year after it arises, or it is permanently barred, unless applicable law prohibits shortening the limitation period.</p>
          </section>

          <section>
            <H>21. Governing Law and Venue</H>
            <p>These Terms and any dispute arising from them are governed by the laws of {GOVERNING_LAW}, without regard to its conflict-of-law rules and excluding the UN Convention on Contracts for the International Sale of Goods. Subject to Section 20, you and we submit to the exclusive jurisdiction of the courts located in {VENUE}. If you are a consumer resident in the EU, UK, or another jurisdiction whose law grants you the protection of mandatory local consumer rules, nothing here deprives you of those rights.</p>
          </section>

          <section>
            <H>22. Force Majeure</H>
            <p>We are not liable for any failure or delay caused by events beyond our reasonable control, including acts of God, natural disasters, war, terrorism, civil unrest, labour disputes, government action, epidemics, internet or power failures, or the failure, outage, suspension, or discontinuation of any third-party hosting, database, payment, email, or AI provider.</p>
          </section>

          <section>
            <H>23. General</H>
            <UL>
              <li><strong>Entire agreement.</strong> These Terms and the Privacy Policy are the entire agreement between you and us about the Service, superseding any prior discussions or representations.</li>
              <li><strong>Severability.</strong> If any provision is held unenforceable, it will be modified to the minimum extent necessary or severed, and the remaining provisions stay in full force.</li>
              <li><strong>No waiver.</strong> Our failure to enforce any provision is not a waiver of it.</li>
              <li><strong>Assignment.</strong> You may not assign these Terms without our written consent. We may assign them to an affiliate or in connection with a merger, acquisition, or sale of assets.</li>
              <li><strong>No third-party beneficiaries.</strong> These Terms create no rights for anyone other than you and us.</li>
              <li><strong>Notices.</strong> We may give notice by email to your account address or by posting in the Service. You may give notice to us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</li>
              <li><strong>Relationship.</strong> Nothing here creates a partnership, joint venture, employment, or agency relationship between us.</li>
            </UL>
          </section>

          <section>
            <H>24. Contact</H>
            <p>Questions about these Terms:</p>
            <p style={{ marginTop: 8 }}>
              <strong>{LEGAL_ENTITY}</strong><br />
              <strong>Email:</strong> <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              {POSTAL_ADDRESS && <><br /><strong>Address:</strong> {POSTAL_ADDRESS}</>}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
