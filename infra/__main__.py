"""Expert Agent Platform - Pulumi Infrastructure as Code

This module defines the core GCP infrastructure for the Expert Agent Platform.
Supports multiple environments: dev, beta, gamma, prod

Domain Configuration:
- prod:  ai.oz.ly
- gamma: ai-gamma.oz.ly
- beta:  ai-beta.oz.ly
- dev:   ai-dev.oz.ly
"""

import pulumi
from pulumi import Config, export, Output
import pulumi_gcp as gcp

# ============================================
# Configuration
# ============================================
config = Config()
env = config.require("env")  # dev, beta, gamma, prod
region = config.get("region") or "us-west1"

# Project IDs (must match actual GCP project IDs)
projects = {
    "root": "expert-ai-root",
    "dev": "expert-ai-dev",
    "beta": "expert-ai-beta",
    "gamma": "expert-ai-gamma",
    "prod": "expert-ai-prod-484103",  # Actual prod project ID
}

project_id = projects[env]
root_project_id = projects["root"]

# Domain configuration
# - prod gets the apex subdomain: ai.oz.ly
# - other envs get prefixed: ai-{env}.oz.ly
DOMAIN_CONFIGS = {
    "dev": {
        "domain": "ai-dev.oz.ly",
        "dns_zone_name": "ai-dev-oz-ly",
    },
    "beta": {
        "domain": "ai-beta.oz.ly",
        "dns_zone_name": "ai-beta-oz-ly",
    },
    "gamma": {
        "domain": "ai-gamma.oz.ly",
        "dns_zone_name": "ai-gamma-oz-ly",
    },
    "prod": {
        "domain": "ai.oz.ly",
        "dns_zone_name": "ai-oz-ly",
    },
}

domain_config = DOMAIN_CONFIGS[env]

# Environment-specific configurations
# Note: For serverless/cost-optimization:
# - Cloud SQL: db-f1-micro is cheapest (~$7/mo), no true serverless option in GCP
# - Cloud Run: min_instances=0 = serverless (pay only when running)
# - Prod is skipped to avoid costs until ready
ENV_CONFIGS = {
    "dev": {
        "cloud_sql_tier": "db-f1-micro",  # Cheapest: ~$7/mo
        "cloud_run_memory": "512Mi",
        "cloud_run_cpu": "1",
        "cloud_run_min_instances": 0,  # Serverless: scale to zero
        "cloud_run_max_instances": 3,
        "skip_resources": False,
    },
    "beta": {
        "cloud_sql_tier": "db-f1-micro",  # Cheapest: ~$7/mo
        "cloud_run_memory": "512Mi",
        "cloud_run_cpu": "1",
        "cloud_run_min_instances": 0,  # Serverless: scale to zero
        "cloud_run_max_instances": 5,
        "skip_resources": False,
    },
    "gamma": {
        "cloud_sql_tier": "db-f1-micro",  # Cheapest for now
        "cloud_run_memory": "1Gi",
        "cloud_run_cpu": "1",
        "cloud_run_min_instances": 0,  # Serverless: scale to zero
        "cloud_run_max_instances": 10,
        "skip_resources": False,
    },
    "prod": {
        "cloud_sql_tier": "db-g1-small",  # Not used - prod skipped
        "cloud_run_memory": "1Gi",
        "cloud_run_cpu": "2",
        "cloud_run_min_instances": 0,
        "cloud_run_max_instances": 50,
        "skip_resources": True,  # Skip prod to avoid costs
    },
}

env_config = ENV_CONFIGS[env]

# ============================================
# Skip Resources Check (for prod cost savings)
# ============================================
if env_config.get("skip_resources", False):
    # For environments we're skipping (like prod), just export minimal info
    export("project_id", project_id)
    export("env", env)
    export("skip_resources", True)
    export("message", f"Resources skipped for {env} environment to avoid costs. Set skip_resources: False when ready to deploy.")
    # Exit early - don't create any resources
    import sys
    sys.exit(0)

# ============================================
# Enable Required APIs
# ============================================
required_apis = [
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "compute.googleapis.com",  # Required for GCP provider region listing
    "storage.googleapis.com",
    "aiplatform.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudbuild.googleapis.com",
    "cloudscheduler.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "pubsub.googleapis.com",
    "iam.googleapis.com",
    "artifactregistry.googleapis.com",
]

enabled_apis = []
for api in required_apis:
    enabled_api = gcp.projects.Service(
        f"enable-{api.replace('.', '-')}",
        project=project_id,
        service=api,
        disable_on_destroy=False,
    )
    enabled_apis.append(enabled_api)

# ============================================
# Cloud SQL (PostgreSQL)
# ============================================
sql_instance = gcp.sql.DatabaseInstance(
    f"expert-agent-db-{env}",
    project=project_id,
    region=region,
    database_version="POSTGRES_15",
    deletion_protection=env == "prod",
    settings=gcp.sql.DatabaseInstanceSettingsArgs(
        tier=env_config["cloud_sql_tier"],
        disk_size=20,
        disk_type="PD_SSD",
        disk_autoresize=True,
        ip_configuration=gcp.sql.DatabaseInstanceSettingsIpConfigurationArgs(
            ipv4_enabled=True,
            authorized_networks=[
                # Add authorized networks as needed
            ],
        ),
        database_flags=[
            gcp.sql.DatabaseInstanceSettingsDatabaseFlagArgs(
                name="max_connections",
                value="100",
            ),
        ],
        backup_configuration=gcp.sql.DatabaseInstanceSettingsBackupConfigurationArgs(
            enabled=True,
            start_time="03:00",
            point_in_time_recovery_enabled=env == "prod",
        ),
        maintenance_window=gcp.sql.DatabaseInstanceSettingsMaintenanceWindowArgs(
            day=7,  # Sunday
            hour=4,
        ),
    ),
    opts=pulumi.ResourceOptions(depends_on=enabled_apis),
)

# Database
database = gcp.sql.Database(
    f"expert-agent-database-{env}",
    project=project_id,
    instance=sql_instance.name,
    name="expert_agent",
)

# Database User - Generate password automatically for CI/CD
import pulumi_random as random

db_password_resource = random.RandomPassword(
    f"db-password-{env}",
    length=32,
    special=True,
    override_special="!#$%&*()-_=+[]{}<>:?",  # Cloud SQL compatible special chars
)
db_password = pulumi.Output.secret(db_password_resource.result)

db_user = gcp.sql.User(
    f"expert-agent-db-user-{env}",
    project=project_id,
    instance=sql_instance.name,
    name="expert_agent",
    password=db_password,
)

# ============================================
# Cloud Storage Buckets
# ============================================

# User uploads bucket
# Only import for dev where resource was created before Pulumi management
uploads_bucket_opts = pulumi.ResourceOptions(
    import_=f"{project_id}/expert-agent-uploads-{env}" if env == "dev" else None,
    ignore_changes=["name", "forceDestroy"] if env == "dev" else [],
)
uploads_bucket = gcp.storage.Bucket(
    f"expert-agent-uploads-{env}",
    project=project_id,
    name=f"expert-agent-uploads-{env}",
    location=region,
    force_destroy=env != "prod",
    uniform_bucket_level_access=True,
    versioning=gcp.storage.BucketVersioningArgs(
        enabled=env == "prod",
    ),
    lifecycle_rules=[
        gcp.storage.BucketLifecycleRuleArgs(
            condition=gcp.storage.BucketLifecycleRuleConditionArgs(
                age=90,  # Delete old files after 90 days
            ),
            action=gcp.storage.BucketLifecycleRuleActionArgs(
                type="Delete",
            ),
        ),
    ],
    cors=[
        gcp.storage.BucketCorArgs(
            origins=["*"],
            methods=["GET", "PUT", "POST"],
            response_headers=["Content-Type"],
            max_age_seconds=3600,
        ),
    ],
    opts=uploads_bucket_opts,
)

# Session summaries bucket (cold storage)
# Only import for dev where resource was created before Pulumi management
summaries_bucket_opts = pulumi.ResourceOptions(
    import_=f"{project_id}/expert-agent-summaries-{env}" if env == "dev" else None,
    ignore_changes=["name", "forceDestroy"] if env == "dev" else [],
)
summaries_bucket = gcp.storage.Bucket(
    f"expert-agent-summaries-{env}",
    project=project_id,
    name=f"expert-agent-summaries-{env}",
    location=region,
    force_destroy=env != "prod",
    uniform_bucket_level_access=True,
    storage_class="NEARLINE",  # Cost-effective for infrequent access
    opts=summaries_bucket_opts,
)

# ============================================
# Service Account for Cloud Run
# ============================================
# Only import for dev where SA was created before Pulumi management
sa_import_id = f"projects/{project_id}/serviceAccounts/expert-agent-sa@{project_id}.iam.gserviceaccount.com"
sa_opts = pulumi.ResourceOptions(
    import_=sa_import_id if env == "dev" else None,
    ignore_changes=["account_id"] if env == "dev" else [],
)

cloud_run_sa = gcp.serviceaccount.Account(
    f"expert-agent-sa-{env}",
    project=project_id,
    account_id="expert-agent-sa",
    display_name=f"Expert Agent Cloud Run Service Account ({env})",
    opts=sa_opts,
)

# Service account permissions
sa_roles = [
    "roles/cloudsql.client",
    "roles/storage.objectAdmin",
    "roles/secretmanager.secretAccessor",
    "roles/aiplatform.user",
    "roles/logging.logWriter",
    "roles/cloudtrace.agent",
]

for role in sa_roles:
    gcp.projects.IAMMember(
        f"sa-{role.replace('/', '-').replace('.', '-')}-{env}",
        project=project_id,
        role=role,
        member=cloud_run_sa.email.apply(lambda email: f"serviceAccount:{email}"),
    )

# ============================================
# CI/CD IAM Permissions
# ============================================
# These permissions are required for Cloud Build to deploy to Cloud Run

# Get the Cloud Build service account for this project
# Format: PROJECT_NUMBER@cloudbuild.gserviceaccount.com
project_info = gcp.organizations.get_project(project_id)
cloud_build_sa_email = f"{project_info.number}@cloudbuild.gserviceaccount.com"

# Also need the Compute Engine default SA (used by some Cloud Build steps)
compute_sa_email = f"{project_info.number}-compute@developer.gserviceaccount.com"

# Grant Cloud Build SA permission to act as Cloud Run SA (for deployments)
gcp.serviceaccount.IAMBinding(
    f"cloud-build-acts-as-cloud-run-sa-{env}",
    service_account_id=cloud_run_sa.id,
    role="roles/iam.serviceAccountUser",
    members=[
        f"serviceAccount:{cloud_build_sa_email}",
        f"serviceAccount:{compute_sa_email}",
    ],
)

# Grant Cloud Build SA permission to deploy Cloud Run services
gcp.projects.IAMMember(
    f"cloud-build-run-admin-{env}",
    project=project_id,
    role="roles/run.admin",
    member=f"serviceAccount:{cloud_build_sa_email}",
)

# Grant Cloud Build SA permission to write to Artifact Registry
gcp.projects.IAMMember(
    f"cloud-build-artifact-writer-{env}",
    project=project_id,
    role="roles/artifactregistry.writer",
    member=f"serviceAccount:{cloud_build_sa_email}",
)

# ============================================
# Cloud Build Infrastructure SA (Dedicated)
# ============================================
# Dedicated SA for Pulumi infrastructure deployments via Cloud Build
# This replaces the default Cloud Build SA per least-privilege principles
#
# Bootstrap: Create the SA once via gcloud (documented in GEMINI.md bootstrap section)
#   gcloud iam service-accounts create cloud-build-infra --project={project_id}
#
# The SA email: cloud-build-infra@{project_id}.iam.gserviceaccount.com
cloud_build_infra_sa_email = f"cloud-build-infra@{project_id}.iam.gserviceaccount.com"

# Grant editor access for infrastructure provisioning
gcp.projects.IAMMember(
    f"cloud-build-infra-editor-{env}",
    project=project_id,
    role="roles/editor",
    member=f"serviceAccount:{cloud_build_infra_sa_email}",
)

# Grant IAM admin for creating service accounts and bindings
gcp.projects.IAMMember(
    f"cloud-build-infra-iam-admin-{env}",
    project=project_id,
    role="roles/resourcemanager.projectIamAdmin",
    member=f"serviceAccount:{cloud_build_infra_sa_email}",
)

# Grant access to Cloud Build source bucket (for build sources)
gcp.projects.IAMMember(
    f"cloud-build-infra-storage-{env}",
    project=project_id,
    role="roles/storage.admin",
    member=f"serviceAccount:{cloud_build_infra_sa_email}",
)

# Grant secret access for Pulumi passphrase
gcp.projects.IAMMember(
    f"cloud-build-infra-secrets-{env}",
    project=project_id,
    role="roles/secretmanager.secretAccessor",
    member=f"serviceAccount:{cloud_build_infra_sa_email}",
)

# Grant logging for build logs
gcp.projects.IAMMember(
    f"cloud-build-infra-logging-{env}",
    project=project_id,
    role="roles/logging.logWriter",
    member=f"serviceAccount:{cloud_build_infra_sa_email}",
)

# ============================================
# Artifact Registry (per project for isolation)
# ============================================
# Only import for dev where repository was created before Pulumi management
ar_import_id = f"projects/{project_id}/locations/{region}/repositories/expert-agent"
ar_opts = pulumi.ResourceOptions(
    import_=ar_import_id if env == "dev" else None,
    ignore_changes=["repository_id"] if env == "dev" else [],
)

artifact_registry = gcp.artifactregistry.Repository(
    f"expert-agent-docker-repo-{env}",
    project=project_id,
    location=region,
    repository_id="expert-agent",
    format="DOCKER",
    description=f"Docker images for Expert Agent Platform ({env})",
    opts=ar_opts,
)

# ============================================
# Secret Manager Secrets (placeholders)
# ============================================
secrets = [
    "database-url",
    "google-client-id",
    "google-client-secret",
    "apple-client-id",
    "apple-client-secret",
    "stripe-secret-key",
    "stripe-webhook-secret",
]

for secret_name in secrets:
    # Only import for dev where secrets were created before Pulumi management
    secret_import_id = f"projects/{project_id}/secrets/{secret_name}"
    secret_opts = pulumi.ResourceOptions(
        import_=secret_import_id if env == "dev" else None,
        ignore_changes=["secret_id"] if env == "dev" else [],
    )
    secret = gcp.secretmanager.Secret(
        f"secret-{secret_name}-{env}",
        project=project_id,
        secret_id=secret_name,
        replication=gcp.secretmanager.SecretReplicationArgs(
            auto=gcp.secretmanager.SecretReplicationAutoArgs(),
        ),
        opts=secret_opts,
    )

# ============================================
# Pub/Sub Topics (for async processing)
# ============================================

# Session summarization topic - only import for dev
summarization_topic_opts = pulumi.ResourceOptions(
    import_=f"projects/{project_id}/topics/session-summarization-{env}" if env == "dev" else None,
    ignore_changes=["name"] if env == "dev" else [],
)
summarization_topic = gcp.pubsub.Topic(
    f"session-summarization-{env}",
    project=project_id,
    name=f"session-summarization-{env}",
    opts=summarization_topic_opts,
)

# File processing topic - only import for dev
file_processing_topic_opts = pulumi.ResourceOptions(
    import_=f"projects/{project_id}/topics/file-processing-{env}" if env == "dev" else None,
    ignore_changes=["name"] if env == "dev" else [],
)
file_processing_topic = gcp.pubsub.Topic(
    f"file-processing-{env}",
    project=project_id,
    name=f"file-processing-{env}",
    opts=file_processing_topic_opts,
)

# ============================================
# Cloud Scheduler (for periodic jobs)
# ============================================
if env != "dev":  # Skip scheduler in dev
    # Memory summarization job (runs daily)
    summarization_job = gcp.cloudscheduler.Job(
        f"memory-summarization-job-{env}",
        project=project_id,
        name=f"memory-summarization-{env}",
        region=region,
        schedule="0 3 * * *",  # 3 AM daily
        time_zone="America/Los_Angeles",
        http_target=gcp.cloudscheduler.JobHttpTargetArgs(
            uri=f"https://expert-agent-{project_id}.{region}.run.app/api/internal/summarize-sessions",
            http_method="POST",
            oidc_token=gcp.cloudscheduler.JobHttpTargetOidcTokenArgs(
                service_account_email=cloud_run_sa.email,
            ),
        ),
        opts=pulumi.ResourceOptions(depends_on=enabled_apis),
    )

# NOTE: Artifact Registry is now created per-project (see line ~340) for isolation

# ============================================
# Cloud DNS Configuration
# ============================================
# Enable Cloud DNS API
dns_api = gcp.projects.Service(
    "enable-dns-api",
    project=project_id,
    service="dns.googleapis.com",
    disable_on_destroy=False,
)

# Create managed DNS zone for this environment's domain
# - prod:  ai.oz.ly
# - gamma: ai-gamma.oz.ly
# - beta:  ai-beta.oz.ly
# - dev:   ai-dev.oz.ly
# Only import for dev where zone was created before Pulumi management
dns_zone_import_id = f"projects/{project_id}/managedZones/{domain_config['dns_zone_name']}"
dns_zone_opts = pulumi.ResourceOptions(
    depends_on=[dns_api],
    import_=dns_zone_import_id if env == "dev" else None,
    ignore_changes=["name"] if env == "dev" else [],
)
dns_zone = gcp.dns.ManagedZone(
    f"dns-zone-{env}",
    project=project_id,
    name=domain_config["dns_zone_name"],
    dns_name=f"{domain_config['domain']}.",  # Trailing dot required
    description=f"DNS zone for Expert Agent Platform ({env})",
    visibility="public",
    opts=dns_zone_opts,
)

# Note: Cloud Run domain mapping requires:
# 1. Domain verification via Google Search Console (manual one-time step)
# 2. SSL certificate is provisioned automatically by Cloud Run
#
# IMPORTANT: CNAME records cannot be created at zone apex (e.g., ai-dev.oz.ly)
# They can only be created for subdomains (e.g., www.ai-dev.oz.ly)
#
# For apex domains with Cloud Run, you must use Cloud Run Domain Mappings which:
# - Automatically provisions SSL certificates
# - Creates the necessary DNS records (A/AAAA) for the domain
#
# The nameservers are exported below for delegation at your registrar.

# Cloud Run Domain Mapping DNS Records (required for apex domains)
# These are Google's standard Cloud Run frontend IPs
# Without these records, SSL certificate provisioning will remain pending

# A records for apex domain (IPv4)
apex_a_record_opts = pulumi.ResourceOptions(
    depends_on=[dns_zone],
    import_=f"{project_id}/ai-dev-oz-ly/ai-dev.oz.ly./A" if env == "dev" else None,
    ignore_changes=["name", "type"] if env == "dev" else [],
)
apex_a_record = gcp.dns.RecordSet(
    f"dns-apex-a-{env}",
    project=project_id,
    managed_zone=dns_zone.name,
    name=f"{domain_config['domain']}.",
    type="A",
    ttl=300,
    rrdatas=[
        "216.239.32.21",
        "216.239.34.21",
        "216.239.36.21",
        "216.239.38.21",
    ],
    opts=apex_a_record_opts,
)

# AAAA records for apex domain (IPv6)
apex_aaaa_record_opts = pulumi.ResourceOptions(
    depends_on=[dns_zone],
    import_=f"{project_id}/ai-dev-oz-ly/ai-dev.oz.ly./AAAA" if env == "dev" else None,
    ignore_changes=["name", "type"] if env == "dev" else [],
)
apex_aaaa_record = gcp.dns.RecordSet(
    f"dns-apex-aaaa-{env}",
    project=project_id,
    managed_zone=dns_zone.name,
    name=f"{domain_config['domain']}.",
    type="AAAA",
    ttl=300,
    rrdatas=[
        "2001:4860:4802:32::15",
        "2001:4860:4802:34::15",
        "2001:4860:4802:36::15",
        "2001:4860:4802:38::15",
    ],
    opts=apex_aaaa_record_opts,
)

# WWW subdomain CNAME (required since www. is a subdomain, not apex)
www_cname_record = gcp.dns.RecordSet(
    f"dns-www-cname-{env}",
    project=project_id,
    managed_zone=dns_zone.name,
    name=f"www.{domain_config['domain']}.",
    type="CNAME",
    ttl=300,
    rrdatas=["ghs.googlehosted.com."],  # Google-managed SSL endpoint
    opts=pulumi.ResourceOptions(depends_on=[dns_zone]),
)

# Google Site Verification TXT record (for domain mapping)
# Each env has its own verification token from Google Search Console
site_verification_token = config.get("site_verification_token")
if site_verification_token:
    site_verification_txt = gcp.dns.RecordSet(
        f"dns-site-verification-{env}",
        project=project_id,
        managed_zone=dns_zone.name,
        name=f"{domain_config['domain']}.",
        type="TXT",
        ttl=300,
        rrdatas=[f'"{site_verification_token}"'],
        opts=pulumi.ResourceOptions(depends_on=[dns_zone]),
    )

# ============================================
# Cloud Run Domain Mapping
# ============================================
# Maps the custom domain to Cloud Run service
# SSL certificates are provisioned automatically by Cloud Run
#
# ⚠️ ONE-TIME PREREQUISITE: Domain verification + SA authorization
#
# The Site Verification API requires OAuth scopes not available via Service Accounts.
# Domain verification must be done once manually per environment:
#
# 1. Go to: https://search.google.com/search-console
# 2. Add property: "URL prefix" → https://ai-{env}.oz.ly (your subdomain)
# 3. Verify using DNS TXT record method (token is already in stack config)
# 4. In Search Console Settings → Users and permissions:
#    Add cloud-build-infra@{project_id}.iam.gserviceaccount.com as OWNER
# 5. Set 'domain_verified: true' in Pulumi.{env}.yaml
#
# Without step 4, SSL provisioning fails with "Caller is not authorized to administer the domain"
# After verification, domain mapping will be created automatically on next deploy.

# Check if domain has been verified (set in stack config)
domain_verified = config.get_bool("domain_verified") or False

if domain_verified:
    # Only import for dev where domain mapping was created before Pulumi management
    domain_mapping_import_id = f"locations/{region}/namespaces/{project_id}/domainmappings/{domain_config['domain']}"
    domain_mapping_opts = pulumi.ResourceOptions(
        depends_on=[dns_zone],
        import_=domain_mapping_import_id if env == "dev" else None,
        ignore_changes=["name"] if env == "dev" else [],
        # Don't wait forever for domain mapping to become ready
        # The Cloud Run service is deployed separately by app build
        custom_timeouts=pulumi.CustomTimeouts(
            create="2m",
            update="2m",
        ),
    )
    domain_mapping = gcp.cloudrun.DomainMapping(
        f"domain-mapping-{env}",
        project=project_id,
        location=region,
        name=domain_config["domain"],
        metadata=gcp.cloudrun.DomainMappingMetadataArgs(
            namespace=project_id,
        ),
        spec=gcp.cloudrun.DomainMappingSpecArgs(
            route_name="expert-agent",  # Cloud Run service name
        ),
        opts=domain_mapping_opts,
    )
    export("domain_mapping_url", f"https://{domain_config['domain']}")
else:
    export("domain_mapping_url", "Domain mapping pending verification - set domain_verified: true in config after verifying domain")

# ============================================
# Exports
# ============================================
export("project_id", project_id)
export("env", env)
export("sql_instance_name", sql_instance.name)
export("sql_connection_name", sql_instance.connection_name)
export("uploads_bucket", uploads_bucket.name)
export("summaries_bucket", summaries_bucket.name)
export("cloud_run_sa_email", cloud_run_sa.email)
export("summarization_topic", summarization_topic.name)
export("file_processing_topic", file_processing_topic.name)

# DNS exports - these are the nameservers to configure at your registrar
export("domain", domain_config["domain"])
export("dns_zone_name", dns_zone.name)
export("dns_nameservers", dns_zone.name_servers)

