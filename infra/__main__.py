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
ENV_CONFIGS = {
    "dev": {
        "cloud_sql_tier": "db-f1-micro",
        "cloud_run_memory": "512Mi",
        "cloud_run_cpu": "1",
        "cloud_run_min_instances": 0,
        "cloud_run_max_instances": 5,
    },
    "beta": {
        "cloud_sql_tier": "db-g1-small",
        "cloud_run_memory": "1Gi",
        "cloud_run_cpu": "1",
        "cloud_run_min_instances": 0,
        "cloud_run_max_instances": 10,
    },
    "gamma": {
        "cloud_sql_tier": "db-g1-small",
        "cloud_run_memory": "1Gi",
        "cloud_run_cpu": "2",
        "cloud_run_min_instances": 1,
        "cloud_run_max_instances": 20,
    },
    "prod": {
        "cloud_sql_tier": "db-custom-2-4096",
        "cloud_run_memory": "2Gi",
        "cloud_run_cpu": "2",
        "cloud_run_min_instances": 2,
        "cloud_run_max_instances": 100,
    },
}

env_config = ENV_CONFIGS[env]

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
)

# Session summaries bucket (cold storage)
summaries_bucket = gcp.storage.Bucket(
    f"expert-agent-summaries-{env}",
    project=project_id,
    name=f"expert-agent-summaries-{env}",
    location=region,
    force_destroy=env != "prod",
    uniform_bucket_level_access=True,
    storage_class="NEARLINE",  # Cost-effective for infrequent access
)

# ============================================
# Service Account for Cloud Run
# ============================================
# Import existing SA if it exists (created before Pulumi management)
sa_import_id = f"projects/{project_id}/serviceAccounts/expert-agent-sa@{project_id}.iam.gserviceaccount.com"

cloud_run_sa = gcp.serviceaccount.Account(
    f"expert-agent-sa-{env}",
    project=project_id,
    account_id="expert-agent-sa",
    display_name=f"Expert Agent Cloud Run Service Account ({env})",
    opts=pulumi.ResourceOptions(
        import_=sa_import_id,
        ignore_changes=["account_id"],  # Don't try to update immutable field
    ),
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
# Cross-Project Permissions (GitHub Actions SA from root)
# ============================================
# The github-actions SA in root project needs permissions across all stages
# This enables centralized CI/CD control from the root project
github_actions_sa = f"serviceAccount:github-actions@{root_project_id}.iam.gserviceaccount.com"

# Grant GitHub Actions SA editor access to this project (for Pulumi deployments)
gcp.projects.IAMMember(
    f"github-actions-editor-{env}",
    project=project_id,
    role="roles/editor",
    member=github_actions_sa,
)

# Grant GitHub Actions SA ability to manage IAM (for creating service accounts)
gcp.projects.IAMMember(
    f"github-actions-iam-admin-{env}",
    project=project_id,
    role="roles/iam.securityAdmin",
    member=github_actions_sa,
)

# Grant GitHub Actions SA ability to manage Cloud Run
gcp.projects.IAMMember(
    f"github-actions-run-admin-{env}",
    project=project_id,
    role="roles/run.admin",
    member=github_actions_sa,
)

# Grant GitHub Actions SA ability to manage Artifact Registry
gcp.projects.IAMMember(
    f"github-actions-artifact-admin-{env}",
    project=project_id,
    role="roles/artifactregistry.admin",
    member=github_actions_sa,
)

# ============================================
# Artifact Registry (per project for isolation)
# ============================================
# Import existing repository if it exists
ar_import_id = f"projects/{project_id}/locations/{region}/repositories/expert-agent"

artifact_registry = gcp.artifactregistry.Repository(
    f"expert-agent-docker-repo-{env}",
    project=project_id,
    location=region,
    repository_id="expert-agent",
    format="DOCKER",
    description=f"Docker images for Expert Agent Platform ({env})",
    opts=pulumi.ResourceOptions(
        import_=ar_import_id,
        ignore_changes=["repository_id"],
    ),
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
    secret = gcp.secretmanager.Secret(
        f"secret-{secret_name}-{env}",
        project=project_id,
        secret_id=secret_name,
        replication=gcp.secretmanager.SecretReplicationArgs(
            auto=gcp.secretmanager.SecretReplicationAutoArgs(),
        ),
    )

# ============================================
# Pub/Sub Topics (for async processing)
# ============================================

# Session summarization topic
summarization_topic = gcp.pubsub.Topic(
    f"session-summarization-{env}",
    project=project_id,
    name=f"session-summarization-{env}",
)

# File processing topic
file_processing_topic = gcp.pubsub.Topic(
    f"file-processing-{env}",
    project=project_id,
    name=f"file-processing-{env}",
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
dns_zone = gcp.dns.ManagedZone(
    f"dns-zone-{env}",
    project=project_id,
    name=domain_config["dns_zone_name"],
    dns_name=f"{domain_config['domain']}.",  # Trailing dot required
    description=f"DNS zone for Expert Agent Platform ({env})",
    visibility="public",
    opts=pulumi.ResourceOptions(depends_on=[dns_api]),
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

# ============================================
# Cloud Run Domain Mapping
# ============================================
# Maps the custom domain to Cloud Run service
# SSL certificates are provisioned automatically by Cloud Run
#
# ⚠️ ONE-TIME PREREQUISITE: Domain verification
#
# The Site Verification API requires OAuth scopes not available via Workload
# Identity Federation. Domain verification must be done once manually:
#
# 1. Go to: https://search.google.com/search-console
# 2. Add property: "URL prefix" → https://ai-dev.oz.ly (your subdomain)
# 3. Verify using DNS TXT record method
# 4. Once verified, set 'domain_verified: true' in Pulumi.{env}.yaml
#
# After verification, domain mapping will be created automatically on next deploy.

# Check if domain has been verified (set in stack config)
domain_verified = config.get_bool("domain_verified") or False

if domain_verified:
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
        opts=pulumi.ResourceOptions(depends_on=[dns_zone]),
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

