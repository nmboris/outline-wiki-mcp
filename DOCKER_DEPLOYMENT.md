# Docker Deployment Guide

This guide covers deploying the Outline MCP Server using Docker and docker-compose, with specific instructions for
Coolify.

## Quick Start

### Local Testing with Docker Compose

```bash
# 1. Copy environment template
cp .env.docker .env

# 2. Edit .env with your Outline instance URL
nano .env

# 3. Build and run
docker-compose up -d

# 4. Check status
docker-compose ps
docker-compose logs -f

# 5. Test
curl http://localhost:3000/health
```

### Stop and Remove

```bash
docker-compose down
```

## Coolify Deployment

### Prerequisites

- Coolify instance running
- Access to Coolify dashboard
- Your Outline instance URL

### Method 1: Git Repository (Recommended)

1. **Push to Git repository** (GitHub, GitLab, etc.)

2. **In Coolify Dashboard:**
   - Go to **Projects** → **New Resource**
   - Select **Public Repository** or **Private Repository**
   - Enter your repository URL: `https://github.com/yourusername/outline-wiki-mcp`
   - Select branch: `feature/http-sse-transport` (or `main` after merge)

3. **Configure Build:**
   - Build Pack: **Dockerfile**
   - Dockerfile Location: `./Dockerfile`
   - Docker Compose: Enable and use `docker-compose.yml`

4. **Set Environment Variables:**

   ```
   OUTLINE_BASE_URL=https://your-instance.getoutline.com
   MCP_TRANSPORT=http
   MCP_PORT=3000
   MCP_PATH=/mcp
   ```

5. **Configure Domain:**
   - Add domain: `mcp.yourdomain.com`
   - Enable HTTPS (Coolify handles Let's Encrypt automatically)

6. **Deploy:**
   - Click **Deploy**
   - Monitor build logs

### Method 2: Docker Compose File

1. **In Coolify Dashboard:**
   - Go to **Projects** → **New Resource**
   - Select **Docker Compose**

2. **Paste docker-compose.yml content**

3. **Set Environment Variables** (same as Method 1)

4. **Deploy**

### Method 3: Pre-built Docker Image

If you publish to Docker Hub:

```bash
# Build and push
docker build -t yourusername/outline-mcp:latest .
docker push yourusername/outline-mcp:latest
```

Then in Coolify:

- Select **Docker Image**
- Image: `yourusername/outline-mcp:latest`
- Set environment variables

## Environment Variables

### Required

| Variable           | Description               | Example                                |
| ------------------ | ------------------------- | -------------------------------------- |
| `OUTLINE_BASE_URL` | Your Outline instance URL | `https://your-instance.getoutline.com` |
| `MCP_TRANSPORT`    | Transport mode            | `http`                                 |

### Optional

| Variable           | Default | Description                  |
| ------------------ | ------- | ---------------------------- |
| `MCP_PORT`         | `3000`  | Internal port                |
| `MCP_PATH`         | `/mcp`  | API endpoint path            |
| `HOST_PORT`        | `3000`  | Host port mapping            |
| `MCP_REQUIRE_AUTH` | `false` | Enable additional auth layer |
| `MCP_BEARER_TOKEN` | -       | Static MCP access token      |

## Network Configuration

### Coolify Networking

Coolify automatically handles:

- **Reverse Proxy**: Traefik or Caddy
- **HTTPS**: Let's Encrypt certificates
- **Domain Routing**: Subdomain configuration

### Port Mapping

By default, the container exposes port 3000. Coolify will map this to:

- Internal: `http://container:3000`
- External: `https://your-domain.com` (via reverse proxy)

## Health Checks

The container includes built-in health checks:

```bash
# Docker health check
docker inspect --format='{{.State.Health.Status}}' outline-mcp-server

# Manual check
curl https://your-domain.com/health
```

## Logging

### View Logs in Coolify

- Dashboard → Your Service → Logs tab

### Docker Compose Logs

```bash
# Follow logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Specific service
docker-compose logs -f outline-mcp
```

### Log Rotation

Configured in docker-compose.yml:

- Max size: 10MB per file
- Max files: 3 (30MB total)

## Monitoring

### Health Endpoint

```bash
curl https://your-domain.com/health
# Expected: {"status":"ok"}
```

### Docker Stats

```bash
docker stats outline-mcp-server
```

### Coolify Monitoring

- CPU usage
- Memory usage
- Network traffic
- Container status

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs

# Inspect container
docker inspect outline-mcp-server

# Check environment variables
docker exec outline-mcp-server env
```

### Connection Refused

1. **Check health endpoint:**

   ```bash
   docker exec outline-mcp-server wget -q -O- http://localhost:3000/health
   ```

2. **Verify environment variables:**

   ```bash
   docker exec outline-mcp-server printenv | grep MCP
   ```

3. **Check port binding:**
   ```bash
   docker ps
   netstat -tlnp | grep 3000
   ```

### SSL/TLS Issues

Coolify handles HTTPS automatically. If issues occur:

- Check domain DNS points to Coolify server
- Verify domain in Coolify settings
- Check Traefik/Caddy logs in Coolify

### Performance Issues

```bash
# Check resource usage
docker stats outline-mcp-server

# Adjust limits in docker-compose.yml:
deploy:
  resources:
    limits:
      cpus: '1.0'      # Increase
      memory: 1024M    # Increase
```

## Updating

### With Coolify

1. Push changes to Git
2. Click **Redeploy** in Coolify dashboard
3. Monitor build logs

### Manual Update

```bash
# Pull latest changes
git pull origin feature/http-sse-transport

# Rebuild and restart
docker-compose down
docker-compose up -d --build
```

## Security Best Practices

1. **Use HTTPS**: Always use Coolify's automatic HTTPS
2. **Environment Variables**: Never commit secrets to Git
3. **Network Isolation**: Use Coolify's internal network
4. **Regular Updates**: Keep Docker and dependencies updated
5. **Resource Limits**: Set appropriate CPU/memory limits
6. **Read-only Filesystem**: Consider enabling in production

## Backup

### Container Data

The container is stateless - no data to backup.

### Configuration

Backup your environment variables from Coolify dashboard.

## Production Checklist

- [ ] HTTPS enabled and working
- [ ] Health checks passing
- [ ] Logs configured and rotating
- [ ] Resource limits set appropriately
- [ ] Monitoring alerts configured
- [ ] Domain name configured
- [ ] Environment variables set correctly
- [ ] Tested with Mistral.ai integration
- [ ] Backup of configuration saved

## Support

For issues:

- Check Docker logs: `docker-compose logs -f`
- Check health endpoint: `curl https://your-domain.com/health`
- Review Coolify logs in the dashboard
- Check main [README.md](README.md) for MCP configuration
- See [MISTRAL_INTEGRATION.md](MISTRAL_INTEGRATION.md) for Mistral.ai setup
