# Phase 7 — Deploy & Validate Guide

Step-by-step guide for deploying the eScience website serverless backend and static frontend to AWS.

---

## Prerequisites

- AWS CLI v2 installed and configured (`aws configure`)
- AWS SAM CLI installed (`brew install aws-sam-cli`)
- An AWS account with permissions for IAM, Lambda, API Gateway, S3, DynamoDB, CloudFront, Cognito, SES, and EventBridge
- Node.js 20.x installed locally (for `sam build`)

---

## Step 1 — Create DynamoDB Tables

```bash
# esc-content
aws dynamodb create-table \
  --table-name esc-content-dev \
  --attribute-definitions AttributeName=sectionKey,AttributeType=S \
  --key-schema AttributeName=sectionKey,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# esc-subscribers
aws dynamodb create-table \
  --table-name esc-subscribers-dev \
  --attribute-definitions AttributeName=email,AttributeType=S \
  --key-schema AttributeName=email,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# esc-analytics
aws dynamodb create-table \
  --table-name esc-analytics-dev \
  --attribute-definitions AttributeName=date,AttributeType=S \
  --key-schema AttributeName=date,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# esc-analytics-archives
aws dynamodb create-table \
  --table-name esc-analytics-archives-dev \
  --attribute-definitions AttributeName=archiveId,AttributeType=S \
  --key-schema AttributeName=archiveId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# esc-reset-tokens (with TTL)
aws dynamodb create-table \
  --table-name esc-reset-tokens-dev \
  --attribute-definitions AttributeName=token,AttributeType=S \
  --key-schema AttributeName=token,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

aws dynamodb update-time-to-live \
  --table-name esc-reset-tokens-dev \
  --time-to-live-specification Enabled=true,AttributeName=expiresAt
```

---

## Step 2 — Create S3 Buckets

```bash
REGION=ap-southeast-1

# Static website bucket
aws s3 mb s3://esc-website-static --region $REGION

# Uploads bucket (private)
aws s3 mb s3://esc-uploads --region $REGION

# Block all public access on uploads bucket
aws s3api put-public-access-block \
  --bucket esc-uploads \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Enable CORS on uploads bucket (for pre-signed PUT from browser)
aws s3api put-bucket-cors --bucket esc-uploads --cors-configuration '{
  "CORSRules": [{
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }]
}'
```

---

## Step 3 — Set Up Amazon Cognito

```bash
# Create User Pool
aws cognito-idp create-user-pool \
  --pool-name esc-admin-pool \
  --auto-verified-attributes email \
  --username-attributes email \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": false
    }
  }' \
  --schema '[{"Name":"email","Required":true,"Mutable":true}]' \
  --query 'UserPool.Id' --output text
```

Save the returned User Pool ID (e.g. `ap-southeast-1_XXXXXXXXX`), then:

```bash
USER_POOL_ID=<your-user-pool-id>

# Create App Client (no secret — required for SPA)
aws cognito-idp create-user-pool-client \
  --user-pool-id $USER_POOL_ID \
  --client-name esc-admin-client \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH ALLOW_USER_SRP_AUTH \
  --query 'UserPoolClient.ClientId' --output text
```

Save the returned Client ID.

```bash
CLIENT_ID=<your-client-id>

# Create the admin user
aws cognito-idp admin-create-user \
  --user-pool-id $USER_POOL_ID \
  --username admin@electronicscience.net \
  --temporary-password "TempPass123!" \
  --user-attributes Name=email,Value=admin@electronicscience.net Name=email_verified,Value=true

# Set a permanent password (skip force-change on first login)
aws cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username admin@electronicscience.net \
  --password "<your-permanent-password>" \
  --permanent
```

---

## Step 4 — Verify SES Email Identity

```bash
# Verify the sending domain or email
aws ses verify-email-identity --email-address sales@electronicscience.net

# Check verification status
aws ses get-identity-verification-attributes \
  --identities sales@electronicscience.net
```

> To send to any recipient, request SES production access via the AWS Console:
> **SES → Account dashboard → Request production access**

---

## Step 5 — Deploy Lambda + API Gateway (SAM)

```bash
cd lambda/

# Install dependencies
npm install

# Build the SAM application
sam build

# Deploy (guided for first time)
sam deploy --guided
```

During guided deploy, provide these parameter values:

| Parameter | Value |
|---|---|
| Stack name | `esc-website-backend` |
| Region | `ap-southeast-1` |
| `CognitoUserPoolId` | Your User Pool ID from Step 3 |
| `CloudFrontDistributionId` | Enter a placeholder — update after Step 6 |
| Confirm changeset | `y` |
| Allow SAM CLI IAM role creation | `y` |
| Save arguments to `samconfig.toml` | `y` |

After deployment completes, note the output:

```
Key                 ApiUrl
Value               https://<api-id>.execute-api.ap-southeast-1.amazonaws.com/dev
```

This is your `API_BASE` URL.

---

## Step 6 — Create CloudFront Distribution

### 6a — Request ACM Certificate (must be in us-east-1)

```bash
aws acm request-certificate \
  --domain-name electronicscience.com \
  --subject-alternative-names "*.electronicscience.com" \
  --validation-method DNS \
  --region us-east-1 \
  --query 'CertificateArn' --output text
```

Complete DNS validation by adding the CNAME record shown in the ACM console to your DNS provider.

### 6b — Create Origin Access Control for S3

```bash
aws cloudfront create-origin-access-control \
  --origin-access-control-config '{
    "Name": "esc-static-oac",
    "OriginAccessControlOriginType": "s3",
    "SigningBehavior": "always",
    "SigningProtocol": "sigv4"
  }' --query 'OriginAccessControl.Id' --output text
```

Create a second OAC for the uploads bucket:

```bash
aws cloudfront create-origin-access-control \
  --origin-access-control-config '{
    "Name": "esc-uploads-oac",
    "OriginAccessControlOriginType": "s3",
    "SigningBehavior": "always",
    "SigningProtocol": "sigv4"
  }' --query 'OriginAccessControl.Id' --output text
```

### 6c — Create the Distribution

Use the AWS Console or a JSON config file for full control. Key settings:

| Setting | Value |
|---|---|
| Default origin | `esc-website-static.s3.<region>.amazonaws.com` with OAC |
| Second origin | `esc-uploads.s3.<region>.amazonaws.com` with OAC |
| Third origin | `<api-id>.execute-api.<region>.amazonaws.com` (custom origin, HTTPS only) |
| Default behavior | Origin = static bucket, Viewer Protocol = Redirect HTTP to HTTPS |
| `/uploads/*` behavior | Origin = uploads bucket |
| `/api/*` behavior | Origin = API Gateway, Allowed Methods = GET/HEAD/OPTIONS/PUT/POST/PATCH/DELETE, Cache Policy = CachingDisabled, Origin Request Policy = AllViewerExceptHostHeader |
| Default root object | `index.html` |
| Custom error responses | 403 → `/index.html` (200), 404 → `/index.html` (200) |
| Alternate domain names | `electronicscience.com`, `www.electronicscience.com` |
| SSL certificate | The ACM cert from Step 6a |

After creation, save the Distribution ID and domain name (e.g. `d1234abcdef.cloudfront.net`).

### 6d — Add S3 Bucket Policies for OAC

```bash
DISTRIBUTION_ARN=arn:aws:cloudfront::<account-id>:distribution/<distribution-id>

# Static bucket policy
aws s3api put-bucket-policy --bucket esc-website-static --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontOAC",
    "Effect": "Allow",
    "Principal": {"Service": "cloudfront.amazonaws.com"},
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::esc-website-static/*",
    "Condition": {
      "StringEquals": {"AWS:SourceArn": "'"$DISTRIBUTION_ARN"'"}
    }
  }]
}'

# Uploads bucket policy
aws s3api put-bucket-policy --bucket esc-uploads --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontOAC",
    "Effect": "Allow",
    "Principal": {"Service": "cloudfront.amazonaws.com"},
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::esc-uploads/*",
    "Condition": {
      "StringEquals": {"AWS:SourceArn": "'"$DISTRIBUTION_ARN"'"}
    }
  }]
}'
```

### 6e — Update SAM Stack with Real CloudFront Distribution ID

```bash
cd lambda/
sam deploy \
  --parameter-overrides \
    CognitoUserPoolId=$USER_POOL_ID \
    CloudFrontDistributionId=<your-distribution-id>
```

---

## Step 7 — Update config.js with Real URLs

Edit `public/js/config.js`:

```js
const CONFIG = {
  API_BASE: 'https://electronicscience.com/api',
  UPLOADS_BASE: 'https://electronicscience.com/uploads',
  COGNITO: {
    UserPoolId: 'ap-southeast-1_XXXXXXXXX',  // real value from Step 3
    ClientId: 'XXXXXXXXXXXXXXXXXXXXXXXXXX',   // real value from Step 3
  },
};
```

> If using the CloudFront domain directly before DNS cutover, use `https://d1234abcdef.cloudfront.net` as the base.

---

## Step 8 — Deploy Frontend to S3

```bash
# Sync the public directory to the static bucket
aws s3 sync public/ s3://escwebsite-dev-web/ \
  --delete \
  --cache-control "public, max-age=86400" \
  --exclude ".DS_Store"

# Set shorter cache for HTML files (so updates propagate faster)
aws s3 sync public/ s3://escwebsite-dev-web/ \
  --exclude "*" \
  --include "*.html" \
  --cache-control "public, max-age=300"
 
# Set no-cache for config.js (always fetch latest)
aws s3 cp public/js/config.js s3://escwebsite-dev-web/js/config.js \
  --cache-control "no-cache, no-store, must-revalidate"

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id E36TVXSCZ97LQM \
  --paths "/*"
```

---

## Step 9 — Run Data Migration

```bash
# Sync uploads to S3
aws s3 sync public/uploads/ s3://esc-uploads/uploads/ --exclude ".DS_Store"
```

For DynamoDB data migration, create and run a migration script that reads the legacy JSON files and writes to DynamoDB. Example using the AWS CLI for a single content item:

```bash
# Example: migrate one content section
aws dynamodb put-item \
  --table-name esc-content \
  --item '{
    "sectionKey": {"S": "hero"},
    "data": {"S": "{\"title\":\"...\",\"subtitle\":\"...\"}"}
  }'
```

> For bulk migration, write a Node.js script that reads each JSON file, splits by key, and uses `BatchWriteItem` to load all records into the corresponding DynamoDB tables.

---

## Step 10 — End-to-End Validation

Test each flow against the live CloudFront URL:

| Test | How to Verify |
|---|---|
| Public content load | Visit the site — homepage content renders from DynamoDB |
| Admin login | Go to `/admin/`, sign in with Cognito credentials |
| Content save | Edit a section in admin, save, verify it persists on refresh |
| Image upload | Upload an image in admin, confirm it appears via the CDN URL |
| File list/delete | View uploads list, delete a file, confirm removal from S3 |
| Subscribe | Submit the newsletter form, check DynamoDB + SES email delivery |
| Analytics tracking | Visit a page, verify `esc-analytics` table updates |
| Analytics archive | Trigger an archive from admin, verify `esc-analytics-archives` |
| Backup/restore | Download a backup JSON, restore it, verify content integrity |
| Save page | Edit a page (blog/careers/contact), save, confirm S3 + CloudFront invalidation |

---

## Step 11 — Cut Over DNS to CloudFront

At your DNS provider, update the records:

| Record | Type | Value |
|---|---|---|
| `electronicscience.com` | A (Alias) | `d1234abcdef.cloudfront.net` |
| `www.electronicscience.com` | CNAME | `d1234abcdef.cloudfront.net` |

> If using Route 53, create an Alias record pointing to the CloudFront distribution.

After DNS propagation (up to 48h, typically minutes), verify:
- `https://electronicscience.com` loads the site via CloudFront
- `https://electronicscience.com/api/content` returns DynamoDB content
- SSL certificate is valid (padlock icon in browser)

---

## Quick Reference — All Resource IDs to Track

| Resource | Value |
|---|---|
| Cognito User Pool ID | `ap-southeast-1_XXXXXXXXX` |
| Cognito App Client ID | `XXXXXXXXXXXXXXXXXXXXXXXXXX` |
| API Gateway URL | `https://<api-id>.execute-api.ap-southeast-1.amazonaws.com/dev` |
| CloudFront Distribution ID | `EXXXXXXXXXX` |
| CloudFront Domain | `d1234abcdef.cloudfront.net` |
| Static Bucket | `esc-website-static` |
| Uploads Bucket | `esc-uploads` |
| ACM Certificate ARN | `arn:aws:acm:us-east-1:<account>:certificate/<id>` |
| SAM Stack Name | `esc-website-backend` |

---
---

# Production Deployment Procedures

Everything above covers the initial setup. The sections below cover repeatable production deployment workflows, CI/CD automation, hardening, monitoring, and rollback.

---

## CI/CD Pipeline — GitHub Actions

Create `.github/workflows/deploy.yml` in the repository root.

### Required GitHub Secrets

Configure these in **Settings > Secrets and variables > Actions**:

| Secret | Description |
|---|---|
| `AWS_ACCESS_KEY_ID` | IAM deploy user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM deploy user secret key |
| `AWS_REGION` | `ap-southeast-1` |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront distribution ID |
| `COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `S3_STATIC_BUCKET` | `esc-website-static` |
| `SAM_STACK_NAME` | `esc-website-backend` |

### Workflow File

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

jobs:
  # Backend: Lambda + API Gateway
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - uses: aws-actions/setup-sam@v2
        with:
          use-installer: true

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Install dependencies
        working-directory: lambda
        run: npm ci

      - name: SAM build
        working-directory: lambda
        run: sam build

      - name: SAM deploy
        working-directory: lambda
        run: |
          sam deploy \
            --stack-name ${{ secrets.SAM_STACK_NAME }} \
            --no-confirm-changeset \
            --no-fail-on-empty-changeset \
            --parameter-overrides \
              CognitoUserPoolId=${{ secrets.COGNITO_USER_POOL_ID }} \
              CloudFrontDistributionId=${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --capabilities CAPABILITY_IAM

  # Frontend: S3 + CloudFront
  deploy-frontend:
    runs-on: ubuntu-latest
    needs: deploy-backend
    steps:
      - uses: actions/checkout@v4

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Sync static assets to S3
        run: |
          aws s3 sync public/ s3://${{ secrets.S3_STATIC_BUCKET }}/ \
            --delete \
            --cache-control "public, max-age=86400" \
            --exclude ".DS_Store" \
            --exclude ".git/*"

      - name: Set HTML cache headers
        run: |
          aws s3 sync public/ s3://${{ secrets.S3_STATIC_BUCKET }}/ \
            --exclude "*" \
            --include "*.html" \
            --cache-control "public, max-age=300"

      - name: Set config.js no-cache
        run: |
          aws s3 cp public/js/config.js \
            s3://${{ secrets.S3_STATIC_BUCKET }}/js/config.js \
            --cache-control "no-cache, no-store, must-revalidate"

      - name: Invalidate CloudFront cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

### Deploy IAM User (Least Privilege)

Create a dedicated IAM user for CI/CD with only the permissions needed:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SAMDeploy",
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "lambda:*",
        "apigateway:*",
        "iam:CreateRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:PassRole",
        "iam:TagRole",
        "s3:*",
        "events:*",
        "scheduler:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "FrontendDeploy",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetObject",
        "cloudfront:CreateInvalidation"
      ],
      "Resource": [
        "arn:aws:s3:::esc-website-static",
        "arn:aws:s3:::esc-website-static/*",
        "arn:aws:cloudfront::<account-id>:distribution/<distribution-id>"
      ]
    }
  ]
}
```

> For better security, use OIDC federation with GitHub Actions instead of long-lived access keys. See [Configuring OpenID Connect in AWS](https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services).

---

## Manual Production Deployment (Without CI/CD)

For deploying manually from a local machine.

### Backend Deploy

```bash
cd lambda/
npm ci
sam build
sam deploy \
  --stack-name esc-website-backend \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    CognitoUserPoolId=<your-pool-id> \
    CloudFrontDistributionId=<your-dist-id> \
  --capabilities CAPABILITY_IAM
```

### Frontend Deploy

```bash
# Full sync
aws s3 sync public/ s3://esc-website-static/ \
  --delete \
  --cache-control "public, max-age=86400" \
  --exclude ".DS_Store"

# HTML overrides
aws s3 sync public/ s3://esc-website-static/ \
  --exclude "*" --include "*.html" \
  --cache-control "public, max-age=300"

# Config override
aws s3 cp public/js/config.js s3://esc-website-static/js/config.js \
  --cache-control "no-cache, no-store, must-revalidate"

# Invalidate
aws cloudfront create-invalidation \
  --distribution-id <your-dist-id> \
  --paths "/*"
```

### Deploy Only a Single Lambda (Hot Fix)

When you need to patch one function without redeploying the entire stack:

```bash
cd lambda/
npm ci
zip -r function.zip content.js email.js node_modules/ package.json

aws lambda update-function-code \
  --function-name <stack-name>-ContentFunction-<id> \
  --zip-file fileb://function.zip

rm function.zip
```

Find the exact function name:

```bash
aws lambda list-functions \
  --query "Functions[?starts_with(FunctionName, 'esc-website-backend')].FunctionName" \
  --output table
```

---

## Production Hardening

### S3 Bucket Security

```bash
# Enable versioning on both buckets (protects against accidental deletes)
aws s3api put-bucket-versioning \
  --bucket esc-website-static \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-versioning \
  --bucket esc-uploads \
  --versioning-configuration Status=Enabled

# Block all public access on static bucket (CloudFront OAC handles access)
aws s3api put-public-access-block \
  --bucket esc-website-static \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Enable server-side encryption
aws s3api put-bucket-encryption \
  --bucket esc-uploads \
  --server-side-encryption-configuration '{"Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]}'

aws s3api put-bucket-encryption \
  --bucket esc-website-static \
  --server-side-encryption-configuration '{"Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]}'
```

### DynamoDB Backups

```bash
# Enable point-in-time recovery on all tables
for TABLE in esc-content esc-subscribers esc-analytics esc-analytics-archives; do
  aws dynamodb update-continuous-backups \
    --table-name $TABLE \
    --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
done
```

### CloudFront Security Headers

Create a response headers policy via the AWS Console or CLI:

| Header | Value |
|---|---|
| Strict-Transport-Security | `max-age=31536000; includeSubdomains; preload` |
| X-Content-Type-Options | `nosniff` |
| X-Frame-Options | `DENY` |
| X-XSS-Protection | `1; mode=block` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Content-Security-Policy | `default-src 'self' https:; script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self' https:` |

Attach the policy to the CloudFront distribution's default behavior.

### API Gateway Throttling

```bash
API_ID=$(aws apigateway get-rest-apis \
  --query "items[?name=='esc-website-backend'].id" --output text)

aws apigateway update-stage \
  --rest-api-id $API_ID \
  --stage-name dev \
  --patch-operations \
    op=replace,path=/throttling/rateLimit,value=100 \
    op=replace,path=/throttling/burstLimit,value=200
```

### Cognito Advanced Security

```bash
aws cognito-idp update-user-pool \
  --user-pool-id $USER_POOL_ID \
  --user-pool-add-ons AdvancedSecurityMode=ENFORCED
```

### Lock Down CORS for Production

Update `template.yaml` CORS AllowOrigin from `'*'` to your domain before deploying:

```yaml
Globals:
  Api:
    Cors:
      AllowOrigin: "'https://electronicscience.com'"
```

Also update the uploads bucket CORS:

```bash
aws s3api put-bucket-cors --bucket esc-uploads --cors-configuration '{
  "CORSRules": [{
    "AllowedOrigins": ["https://electronicscience.com"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }]
}'
```

---

## Monitoring and Alerting

### Create SNS Topic for Alerts

```bash
aws sns create-topic --name esc-prod-alerts --query 'TopicArn' --output text

SNS_TOPIC_ARN=<your-topic-arn>

aws sns subscribe \
  --topic-arn $SNS_TOPIC_ARN \
  --protocol email \
  --notification-endpoint admin@electronicscience.net
```

### Lambda Error Alarms

```bash
for FUNC in ContentFunction SubscribersFunction UploadFunction UploadsListFunction \
  AnalyticsTrackFunction AnalyticsFunction AnalyticsArchiveFunction \
  IconsFunction SavePageFunction BackupRestoreFunction; do

  aws cloudwatch put-metric-alarm \
    --alarm-name "esc-${FUNC}-errors" \
    --metric-name Errors \
    --namespace AWS/Lambda \
    --statistic Sum \
    --period 300 \
    --threshold 5 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 1 \
    --dimensions Name=FunctionName,Value=esc-website-backend-${FUNC} \
    --alarm-actions $SNS_TOPIC_ARN \
    --treat-missing-data notBreaching
done
```

### API Gateway 5xx Alarm

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name esc-api-5xx-errors \
  --metric-name 5XXError \
  --namespace AWS/ApiGateway \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=ApiName,Value=esc-website-backend \
  --alarm-actions $SNS_TOPIC_ARN
```

### DynamoDB Throttle Alarm

```bash
for TABLE in esc-content esc-subscribers esc-analytics esc-analytics-archives; do
  aws cloudwatch put-metric-alarm \
    --alarm-name "esc-${TABLE}-throttles" \
    --metric-name ThrottledRequests \
    --namespace AWS/DynamoDB \
    --statistic Sum \
    --period 300 \
    --threshold 1 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 1 \
    --dimensions Name=TableName,Value=$TABLE \
    --alarm-actions $SNS_TOPIC_ARN \
    --treat-missing-data notBreaching
done
```

### CloudFront Error Rate Alarm

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name esc-cloudfront-5xx \
  --metric-name 5xxErrorRate \
  --namespace AWS/CloudFront \
  --statistic Average \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=DistributionId,Value=<your-distribution-id> Name=Region,Value=Global \
  --alarm-actions $SNS_TOPIC_ARN
```

### Set CloudWatch Logs Retention

By default Lambda logs are retained forever. Set a retention policy:

```bash
for FUNC in ContentFunction SubscribersFunction UploadFunction UploadsListFunction \
  AnalyticsTrackFunction AnalyticsFunction AnalyticsArchiveFunction \
  IconsFunction SavePageFunction BackupRestoreFunction; do

  aws logs put-retention-policy \
    --log-group-name "/aws/lambda/esc-website-backend-${FUNC}" \
    --retention-in-days 30
done
```

---

## Rollback Procedures

### Rollback Backend (Lambda + API Gateway)

SAM/CloudFormation tracks every deployment as a changeset. To roll back:

```bash
# List recent stack events to find the last successful deployment
aws cloudformation describe-stack-events \
  --stack-name esc-website-backend \
  --query "StackEvents[?ResourceStatus=='UPDATE_COMPLETE'].Timestamp" \
  --output table

# Roll back to previous version
aws cloudformation rollback-stack \
  --stack-name esc-website-backend

# Or cancel a failed update and revert
aws cloudformation cancel-update-stack \
  --stack-name esc-website-backend
```

Alternatively, redeploy a known-good commit:

```bash
git checkout <last-good-commit>
cd lambda/
npm ci && sam build && sam deploy \
  --stack-name esc-website-backend \
  --no-confirm-changeset \
  --parameter-overrides \
    CognitoUserPoolId=$USER_POOL_ID \
    CloudFrontDistributionId=<dist-id> \
  --capabilities CAPABILITY_IAM
```

### Rollback Frontend

Since S3 versioning is enabled, restore previous file versions:

```bash
# List previous versions of a specific file
aws s3api list-object-versions \
  --bucket esc-website-static \
  --prefix js/config.js \
  --query 'Versions[0:5].{VersionId:VersionId,LastModified:LastModified,IsLatest:IsLatest}'

# Restore a specific version by copying it over the current
aws s3api copy-object \
  --bucket esc-website-static \
  --copy-source esc-website-static/js/config.js?versionId=<version-id> \
  --key js/config.js
```

Or redeploy from a known-good commit:

```bash
git checkout <last-good-commit>
aws s3 sync public/ s3://esc-website-static/ --delete
aws cloudfront create-invalidation \
  --distribution-id <dist-id> --paths "/*"
```

### Rollback DynamoDB Data

With point-in-time recovery enabled:

```bash
# Restore table to a point in time (creates a new table)
aws dynamodb restore-table-to-point-in-time \
  --source-table-name esc-content \
  --target-table-name esc-content-restored \
  --restore-date-time 2025-01-15T10:00:00Z

# After verifying the restored data, swap tables:
# 1. Export data from restored table
# 2. Delete the broken table
# 3. Recreate with the original name
# 4. Import data from the restored table
```

---

## Production Health Checks

Run these after every deployment to verify the site is healthy:

```bash
DOMAIN=https://electronicscience.com

# Public endpoints (should return 200)
curl -s -o /dev/null -w "%{http_code}" $DOMAIN/
curl -s -o /dev/null -w "%{http_code}" $DOMAIN/api/content
curl -s -o /dev/null -w "%{http_code}" $DOMAIN/api/icons

# Verify content is not empty
curl -s $DOMAIN/api/content | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(f'{len(d)} keys loaded')"

# Verify SSL certificate
echo | openssl s_client -servername electronicscience.com \
  -connect electronicscience.com:443 2>/dev/null | \
  openssl x509 -noout -dates

# Verify CloudFront is serving (check x-cache header)
curl -s -I $DOMAIN/ | grep -i x-cache
```

---

## Ongoing Operations Runbook

### Weekly
- Check CloudWatch dashboards for error spikes
- Review Lambda invocation counts and durations
- Verify SES sending reputation in the SES console

### Monthly
- Review and rotate IAM access keys for the deploy user
- Check DynamoDB consumed capacity and adjust if needed
- Review CloudFront access logs for anomalies
- Run `npm audit` on the lambda dependencies and update if needed

### On Demand
- **Scale up**: DynamoDB is already on-demand (PAY_PER_REQUEST) — no action needed
- **Increase Lambda memory**: Update `MemorySize` in `template.yaml` and redeploy
- **Add a new admin user**: `aws cognito-idp admin-create-user --user-pool-id $USER_POOL_ID --username <email> --temporary-password "<temp-pass>" --user-attributes Name=email,Value=<email> Name=email_verified,Value=true`
- **Disable a user**: `aws cognito-idp admin-disable-user --user-pool-id $USER_POOL_ID --username <email>`

### Cost Monitoring

```bash
# Check current month estimated charges
aws ce get-cost-and-usage \
  --time-period Start=$(date -u +%Y-%m-01),End=$(date -u +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --query 'ResultsByTime[0].Groups[*].{Service:Keys[0],Cost:Metrics.BlendedCost.Amount}' \
  --output table
```

Set a billing alarm:

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name esc-monthly-billing \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 86400 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=Currency,Value=USD \
  --alarm-actions $SNS_TOPIC_ARN \
  --region us-east-1
```
