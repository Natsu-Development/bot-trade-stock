Deploy the trading bot to production.

## Pre-deployment Checklist

1. Ensure all tests pass
2. Verify environment variables are set in GitHub
3. Confirm secrets are configured (DOCKER_*, TELEGRAM_*, cloud provider)

## Deployment Steps

```bash
# 1. Run tests locally
make docker-test

# 2. Build for production
make golang-build
cd frontend && yarn build

# 3. Commit and push to trigger CI/CD
git add .
git commit -m "Deploy: <your message>"
git push origin master
```

## What Happens

1. GitHub Actions builds Docker image
2. Pushes to Docker Hub
3. Creates deployment package (no secrets inside)
4. Deploys to cloud provider via SSH
5. Sends Telegram notification

## Cloud Providers

- Oracle Cloud (OCI_HOST, OCI_USER, OCI_SSH_KEY)
- AWS EC2 (AWS_HOST, AWS_USER, AWS_SSH_KEY)
- Generic VPS (VPS_HOST, VPS_USER, VPS_SSH_KEY)

## Troubleshooting

```bash
# Check deployment logs in GitHub Actions
# SSH to VM and check container status
ssh user@your-server
cd /opt/trading-app
docker-compose logs
```
