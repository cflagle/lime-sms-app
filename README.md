# Lime SMS Engine 🚀

**A High-Performance, Compliance-First Enterprise Messaging Platform.**

built for **Scale**, **Safety**, and **Speed**.

---

## 1. The Architecture: Built for Scale 🏗️

> *"We didn't just build an app; we built a system that sleeps when you sleep and sprints when you sprint."*

Our architecture utilizes Google Cloud Platform's serverless infrastructure to handle 150,000+ subscriber synchronizations and high-volume message delivery without breaking a sweat.

*   **Serverless Autoscaling**: Powered by Cloud Run.
*   **Data Integrity**: Secured by Postgres Cloud SQL.
*   **Bank-Grade Security**: Credentials managed by Secret Manager.

[📘 Read the full Architecture Guide (Beginner Friendly)](docs/CLOUD_ARCHITECTURE.md)

---

## 2. Safety & Compliance: Built for Trust 🛡️

> *"Sending messages is easy. Sending them safely, legally, and respectfully is an art."*

We assume nothing. Every message passes through a rigorous 5-layer safety check before it ever leaves the system.

*   **TCPA Timezone Enforcement**: Automatic 8am-8pm windowing.
*   **Real-Time Opt-in Verification**: Pre-flight checks with Lime Cellular.
*   **Global Frequency Caps**: Prevents runaway costs and user fatigue.
*   **Smart Segmentation**: Precision targeting to ensure relevance.

[🛡️ Review our Safeguards & Constraints protocols](docs/SAFEGUARDS.md)

---

## 3. Integration: Built for Developers 🔌

> *"Your data, accessible where you need it. Instantly."*

Whether you are connecting a marketing funnel (ClickFunnels, Zapier) or syncing with a CRM, our standardised API puts you in control.

*   **RESTful Design**: Simple `POST` requests.
*   **Unified Auth**: Secure `api_key` authentication.
*   **Real-time Enrichment**: Update user traits on the fly.

[⚡ Explore the Internal API Documentation](docs/API_INTEGRATION.md)

---

## 4. Deployment: Built for Action 🚀

Ready to go live? Our deployment pipeline is automated, ensuring that what you test is exactly what you ship.

*   **One-Command Deploy**: Push to git, and Cloud Build handles the rest.
*   **Zero-Downtime**: Rolling updates ensure users never notice a blip.

[🚀 Launch Guide & Checklist](docs/LAUNCH.md)

---

### Key Commands

```bash
# Start Development Server
npm run dev

# Run Background Worker Locally
npm run worker

# Deploy to Production
git push origin master
```
