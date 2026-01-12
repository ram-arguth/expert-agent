# DNS and Domain Configuration

This document describes the DNS architecture and domain setup for the Expert Agent Platform.

## Domain Structure

| Environment | Domain | Cloud DNS Zone | GCP Project |
|-------------|--------|----------------|-------------|
| **Production** | `ai.oz.ly` | `ai-oz-ly` | `expert-ai-prod-484103` |
| **Gamma** | `ai-gamma.oz.ly` | `ai-gamma-oz-ly` | `expert-ai-gamma` |
| **Beta** | `ai-beta.oz.ly` | `ai-beta-oz-ly` | `expert-ai-beta` |
| **Development** | `ai-dev.oz.ly` | `ai-dev-oz-ly` | `expert-ai-dev` |

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Domain Registrar (oz.ly)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ai.oz.ly        NS → Cloud DNS (expert-ai-prod-484103)         │
│  ai-gamma.oz.ly  NS → Cloud DNS (expert-ai-gamma)               │
│  ai-beta.oz.ly   NS → Cloud DNS (expert-ai-beta)                │
│  ai-dev.oz.ly    NS → Cloud DNS (expert-ai-dev)                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Cloud DNS Managed Zones                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Each zone contains:                                             │
│  - CNAME → ghs.googlehosted.com (Cloud Run managed SSL)          │
│  - www CNAME → apex (prod only)                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Cloud Run                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Cloud Run handles:                                              │
│  - SSL certificate provisioning (Google-managed)                 │
│  - Traffic routing to containers                                 │
│  - Auto-scaling                                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Infrastructure as Code

DNS zones are provisioned via Pulumi in `infra/__main__.py`:

```python
# Domain configuration per environment
DOMAIN_CONFIGS = {
    "dev":   {"domain": "ai-dev.oz.ly",   "dns_zone_name": "ai-dev-oz-ly"},
    "beta":  {"domain": "ai-beta.oz.ly",  "dns_zone_name": "ai-beta-oz-ly"},
    "gamma": {"domain": "ai-gamma.oz.ly", "dns_zone_name": "ai-gamma-oz-ly"},
    "prod":  {"domain": "ai.oz.ly",       "dns_zone_name": "ai-oz-ly"},
}
```

Each Pulumi stack creates:
1. **Cloud DNS Managed Zone** - Public zone for the environment's domain
2. **CNAME Record** - Points to `ghs.googlehosted.com` for Cloud Run SSL
3. **WWW CNAME** (prod only) - Points `www.ai.oz.ly` to `ai.oz.ly`

## Nameserver Configuration

After deploying each Pulumi stack, you'll receive nameservers to configure at your registrar.

### Getting Nameservers

After CI/CD deploys infrastructure, get nameservers from Pulumi outputs:

```bash
# For each environment
pulumi stack select dev && pulumi stack output dns_nameservers
pulumi stack select beta && pulumi stack output dns_nameservers
pulumi stack select gamma && pulumi stack output dns_nameservers
pulumi stack select prod && pulumi stack output dns_nameservers
```

Or via GCP Console:
1. Go to Cloud DNS in the respective project
2. Click on the managed zone
3. Copy the NS records

### Registrar Configuration

At your domain registrar for `oz.ly`, create NS records:

```
# Production (ai.oz.ly)
ai   NS   ns-cloud-a1.googledomains.com.
ai   NS   ns-cloud-a2.googledomains.com.
ai   NS   ns-cloud-a3.googledomains.com.
ai   NS   ns-cloud-a4.googledomains.com.

# Gamma (ai-gamma.oz.ly)
ai-gamma   NS   ns-cloud-b1.googledomains.com.
ai-gamma   NS   ns-cloud-b2.googledomains.com.
ai-gamma   NS   ns-cloud-b3.googledomains.com.
ai-gamma   NS   ns-cloud-b4.googledomains.com.

# Beta (ai-beta.oz.ly)
ai-beta   NS   ns-cloud-c1.googledomains.com.
ai-beta   NS   ns-cloud-c2.googledomains.com.
ai-beta   NS   ns-cloud-c3.googledomains.com.
ai-beta   NS   ns-cloud-c4.googledomains.com.

# Dev (ai-dev.oz.ly)
ai-dev   NS   ns-cloud-d1.googledomains.com.
ai-dev   NS   ns-cloud-d2.googledomains.com.
ai-dev   NS   ns-cloud-d3.googledomains.com.
ai-dev   NS   ns-cloud-d4.googledomains.com.
```

> **Note**: The actual nameserver values will be provided by Cloud DNS when the zones are created. The examples above are illustrative.

## Cloud Run Domain Mapping

### Prerequisites (One-Time)

Before Cloud Run can serve traffic on custom domains:

1. **Verify Domain Ownership** (manual, one-time per domain):
   - Go to [Google Search Console](https://search.google.com/search-console)
   - Add `oz.ly` as a property
   - Verify via DNS TXT record
   - This allows Cloud Run to issue SSL certificates

### Automatic Mapping (CI/CD)

The Cloud Build pipeline (`cloudbuild.yaml`) should include domain mapping after deployment:

```yaml
# After deploying Cloud Run service
- name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
  entrypoint: gcloud
  args:
    - 'run'
    - 'services'
    - 'add-iam-policy-binding'
    - '${_SERVICE_NAME}'
    - '--region=${_REGION}'
    - '--member=allUsers'
    - '--role=roles/run.invoker'

- name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
  entrypoint: gcloud
  args:
    - 'beta'
    - 'run'
    - 'domain-mappings'
    - 'create'
    - '--service=${_SERVICE_NAME}'
    - '--domain=${_DOMAIN}'
    - '--region=${_REGION}'
    - '--project=${_PROJECT_ID}'
```

## SSL Certificates

SSL certificates are **automatically provisioned** by Cloud Run when:
1. Domain ownership is verified in Google Search Console
2. DNS is properly delegated to Cloud DNS
3. CNAME record points to `ghs.googlehosted.com`

Certificate provisioning typically takes 15-20 minutes after DNS propagation.

## Monitoring

### Check DNS Propagation

```bash
# Check nameserver delegation
dig NS ai.oz.ly
dig NS ai-dev.oz.ly

# Check CNAME resolution
dig CNAME ai.oz.ly
dig CNAME ai-dev.oz.ly

# Check SSL certificate
curl -I https://ai.oz.ly 2>&1 | grep -i "SSL\|certificate"
```

### Cloud DNS in GCP Console

- [expert-ai-prod-484103 DNS](https://console.cloud.google.com/net-services/dns/zones?project=expert-ai-prod-484103)
- [expert-ai-gamma DNS](https://console.cloud.google.com/net-services/dns/zones?project=expert-ai-gamma)
- [expert-ai-beta DNS](https://console.cloud.google.com/net-services/dns/zones?project=expert-ai-beta)
- [expert-ai-dev DNS](https://console.cloud.google.com/net-services/dns/zones?project=expert-ai-dev)

## Troubleshooting

### SSL Certificate Not Provisioning

1. Verify domain ownership in Search Console
2. Check DNS propagation: `dig CNAME ai.oz.ly`
3. Ensure CNAME points to `ghs.googlehosted.com`
4. Wait up to 24 hours for initial provisioning

### Domain Not Resolving

1. Check NS records at registrar
2. Verify Cloud DNS zone exists: `gcloud dns managed-zones list --project=<project>`
3. Check record sets: `gcloud dns record-sets list --zone=<zone-name> --project=<project>`

### Cloud Run 404

1. Ensure domain mapping exists: `gcloud beta run domain-mappings list --region=us-central1`
2. Check service is deployed and healthy
3. Verify IAM allows unauthenticated access (if public)

## Related Documentation

- [DESIGN.md](./DESIGN.md) - System architecture
- [IMPLEMENTATION.md](./IMPEMENTATION.md) - Implementation checklist
- [GEMINI.md](../GEMINI.md) - Workspace rules and CI/CD policy
