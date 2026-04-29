import hudson.model.Result
import hudson.model.Run
import jenkins.model.CauseOfInterruption.UserInterruption

// ---------------------------------------------------------------------------
// Abort any previous in-progress builds for the same branch
// ---------------------------------------------------------------------------
def abortPreviousBuilds() {
    Run previousBuild = currentBuild.rawBuild.getPreviousBuildInProgress()
    while (previousBuild != null) {
        if (previousBuild.isInProgress()) {
            def executor = previousBuild.getExecutor()
            if (executor != null) {
                echo "Aborting previous build: #${previousBuild.number}"
                executor.interrupt(Result.ABORTED, new UserInterruption("Aborted by newer build #${currentBuild.number}"))
                sleep(5)
            }
        }
        previousBuild = previousBuild.getPreviousBuildInProgress()
    }
}

// ---------------------------------------------------------------------------
// Bootstrap AWS credentials from ECS task metadata endpoint
// ---------------------------------------------------------------------------
def init() {
    sh '''#!/bin/bash
        mkdir -p ~/.aws

        CREDENTIALS=$(curl -s http://169.254.170.2$AWS_CONTAINER_CREDENTIALS_RELATIVE_URI \
            | python3 -c "import sys, json; data=json.load(sys.stdin); \
              print(str(data['AccessKeyId']), str(data['SecretAccessKey']), str(data['Token']))")

        read -r ACCESS_KEY_ID SECRET_ACCESS_KEY TOKEN <<< $CREDENTIALS

        echo "[default]
aws_access_key_id = $ACCESS_KEY_ID
aws_session_token = $TOKEN
aws_secret_access_key = $SECRET_ACCESS_KEY" > ~/.aws/credentials

        echo "[profile default]
region = ap-southeast-1

[profile escwebsite-dev]
source_profile = default
role_arn = arn:aws:iam::346553907973:role/jenkins-pipeline-dev
region = ap-southeast-1
output = json

[profile escwebsite-prod]
source_profile = default
role_arn = arn:aws:iam::tbd:role/jenkins-pipeline-prod
region = ap-southeast-1
output = json" > ~/.aws/config
    '''
}

// ---------------------------------------------------------------------------
// Assume the environment-specific IAM role and export short-lived credentials
// ---------------------------------------------------------------------------
def assumeRole(String roleArn, String region) {
    sh """#!/bin/bash
        CREDS=\$(aws sts assume-role \
            --role-arn ${roleArn} \
            --role-session-name jenkins-escience-deploy \
            --region ${region} \
            --query 'Credentials.[AccessKeyId,SecretAccessKey,SessionToken]' \
            --output text)

        read -r KEY SECRET TOKEN <<< \$CREDS

        echo "[deploy]
aws_access_key_id = \$KEY
aws_secret_access_key = \$SECRET
aws_session_token = \$TOKEN" >> ~/.aws/credentials

        echo "[profile deploy]
region = ${region}
output = json" >> ~/.aws/config
    """
}

// ---------------------------------------------------------------------------
// Sync public/ to S3 and optionally invalidate CloudFront
// ---------------------------------------------------------------------------
def deploy(String env) {
    // Config defined here to avoid Jenkins sandbox scoping issues with top-level variables
    def ENV_CONFIG = [
        dev: [
            bucket   : 'escwebsite-dev-web',
            region   : 'ap-southeast-1',
            cfDistId : 'E36TVXSCZ97LQM',
            roleArn  : 'arn:aws:iam::346553907973:role/jenkins-pipeline-dev'
        ],
        prod: [
            bucket   : 'escwebsite-prod-web',   // TODO: replace with prod bucket name
            region   : 'ap-southeast-1',
            cfDistId : '',                       // TODO: replace with prod CloudFront distribution ID
            roleArn  : 'arn:aws:iam::tbd:role/jenkins-pipeline-prod'  // TODO: replace tbd with prod AWS account ID
        ]
    ]

    def cfg = ENV_CONFIG[env]

    echo "Deploying to [${env}] — bucket: ${cfg.bucket}, region: ${cfg.region}"

    // Assume the deployment role if one is configured
    if (cfg.roleArn) {
        assumeRole(cfg.roleArn, cfg.region)
    }

    def profile = cfg.roleArn ? '--profile deploy' : '--profile default'

    // Sync public/ folder to S3
    // --delete removes files in S3 that no longer exist locally
    sh """#!/bin/bash
        aws s3 sync public/ s3://${cfg.bucket}/ \
            --region ${cfg.region} \
            ${profile} \
            --delete \
            --cache-control "public, max-age=86400" \
            --exclude "*.DS_Store" \
            --exclude "Thumbs.db"

        # Override cache-control for HTML files — always revalidate
        aws s3 sync public/ s3://${cfg.bucket}/ \
            --region ${cfg.region} \
            ${profile} \
            --exclude "*" \
            --include "*.html" \
            --cache-control "no-cache, no-store, must-revalidate" \
            --content-type "text/html"
    """

    // Invalidate CloudFront if a distribution ID is set
    if (cfg.cfDistId) {
        echo "Invalidating CloudFront distribution: ${cfg.cfDistId}"
        sh """#!/bin/bash
            aws cloudfront create-invalidation \
                --distribution-id ${cfg.cfDistId} \
                --paths "/*" \
                --region ${cfg.region} \
                ${profile}
        """
    } else {
        echo "No CloudFront distribution configured for [${env}] — skipping invalidation."
    }
}

// ---------------------------------------------------------------------------
// Pipeline definition
// ---------------------------------------------------------------------------
pipeline {
    agent { label 'master' }

    options {
        timestamps()
        skipDefaultCheckout()
        skipStagesAfterUnstable()
        timeout(time: 1, unit: 'HOURS')
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    stages {

        // ------------------------------------------------------------------
        stage('Check previous builds') {
        // ------------------------------------------------------------------
            steps {
                script {
                    abortPreviousBuilds()
                }
            }
        }

        // ------------------------------------------------------------------
        stage('Deploy to dev') {
        // ------------------------------------------------------------------
            when {
                branch 'develop'
            }
            stages {
                stage('Deploy') {
                    agent { label 'ecs-agent' }
                    steps {
                        checkout scm
                        script {
                            init()
                            deploy('dev')
                        }
                    }
                    post {
                        success {
                            echo "✅ Dev deployment complete — s3://escwebsite-dev-web"
                        }
                        failure {
                            echo "❌ Dev deployment failed."
                        }
                    }
                }
            }
        }

        // ------------------------------------------------------------------
        stage('Deploy to prod') {
        // ------------------------------------------------------------------
            when {
                branch 'main'
            }
            stages {
                stage('Approval') {
                    steps {
                        timeout(time: 30, unit: 'MINUTES') {
                            input message: "Deploy to PRODUCTION?", ok: "Deploy"
                        }
                    }
                }
                stage('Deploy') {
                    agent { label 'ecs-agent' }
                    steps {
                        checkout scm
                        script {
                            init()
                            deploy('prod')
                        }
                    }
                    post {
                        success {
                            echo "✅ Prod deployment complete — s3://escwebsite-prod-web"
                        }
                        failure {
                            echo "❌ Prod deployment failed."
                        }
                    }
                }
            }
        }

    } // end stages

    post {
        always {
            echo "Pipeline finished — branch: ${env.BRANCH_NAME}, build: #${env.BUILD_NUMBER}"
        }
    }
}

