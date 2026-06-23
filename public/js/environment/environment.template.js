// Environment config template — DO NOT put real values here.
// For local development: copy this file to environment.js and fill in values
//   from the team credential store (AWS Console → Cognito, API Gateway).
// For CI/CD: the Jenkins pipeline substitutes __PLACEHOLDER__ tokens
//   automatically using stored credentials before uploading to S3.
// NEVER commit environment.js to version control.
const ENV_CONFIG = {
  API_BASE: '__API_BASE__',
  UPLOADS_BASE: '__UPLOADS_BASE__',
  COGNITO: {
    UserPoolId: '__COGNITO_USER_POOL_ID__',
    ClientId: '__COGNITO_CLIENT_ID__',
  },
};
