# Workflow Template Library Configuration

The Workflow Template Library fetches workflow templates from the `elastic/workflows` GitHub repository.

## GitHub Authentication

### For Private Repositories

If the `elastic/workflows` repository is private, you need to configure a GitHub Personal Access Token (PAT) to access it.

#### 1. Create a GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a descriptive name (e.g., "Kibana Workflows Template Library")
4. Select the following scopes:
   - `repo` (Full control of private repositories)
5. Click "Generate token"
6. **Copy the token immediately** (you won't be able to see it again)

#### 2. Configure Kibana

Add the token to your `kibana.yml` or `kibana.dev.yml` configuration file:

```yaml
workflowsManagement:
  templateLibrary:
    githubToken: 'ghp_your_token_here'
```

**For development**, you can also add it to `kibana.dev.yml`:

```yaml
workflowsManagement:
  templateLibrary:
    githubToken: 'ghp_your_token_here'
```

#### 3. Restart Kibana

After adding the configuration, restart Kibana for the changes to take effect.

### For Public Repositories

If the repository is public, no authentication is required. The template library will work without any configuration.

## Security Considerations

- **Never commit your GitHub token to version control**
- Store the token securely (use environment variables or secrets management in production)
- Use a token with minimal required permissions (only `repo` scope for private repos)
- Rotate tokens regularly
- Consider using GitHub Apps for production deployments

## Environment Variables

You can also set the token via environment variable:

```bash
export KIBANA_WORKFLOWS_GITHUB_TOKEN='ghp_your_token_here'
```

Then reference it in your `kibana.yml`:

```yaml
workflowsManagement:
  templateLibrary:
    githubToken: ${KIBANA_WORKFLOWS_GITHUB_TOKEN}
```

## Rate Limits

- **Without authentication**: 60 requests per hour per IP
- **With authentication**: 5,000 requests per hour per user

The template library implements caching (5-minute TTL) to minimize API calls and stay within rate limits.

## Troubleshooting

### "Failed to load templates" error

1. Check that your GitHub token is valid
2. Verify the token has `repo` scope
3. Ensure the repository path is correct
4. Check Kibana logs for detailed error messages

### Rate limit errors

If you see rate limit errors:
1. Add a GitHub token (increases limit from 60 to 5,000 requests/hour)
2. The cache will automatically serve stale data if GitHub is unavailable
3. Wait for the rate limit to reset (shown in error message)

## API Endpoint

The template library exposes the following API endpoint:

```
GET /api/workflows/templates
```

Query parameters:
- `category` - Filter by category (e.g., "examples", "security")
- `search` - Search in name and description
- `tags` - Filter by tags (can be array)

Example:
```bash
curl http://localhost:5601/api/workflows/templates?category=security
```
