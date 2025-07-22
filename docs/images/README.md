# Visual assets for documentation

This directory contains images and visual assets used throughout the XMTP QA Tools documentation.

## Image organization

### Architecture diagrams

- `architecture-overview.png` - Complete XMTP protocol stack visualization
- `test-workflows.png` - Visual timeline of automated test suite execution

### Monitoring and dashboards

- `datadog-main-dashboard.png` - Primary monitoring dashboard screenshot
- `slack-alerts.png` - Examples of automated Slack notifications
- `metrics-trends.png` - Key performance metrics over time
- `dashboard-widgets.png` - Gallery of dashboard widget types
- `performance-correlations.png` - Performance metric correlation charts

### Testing and QA

- `test-execution-flow.png` - Test suite execution workflow
- `compatibility-matrix.png` - Cross-platform compatibility visualization
- `agent-monitoring.png` - Agent and bot monitoring interface
- `bot-response-times.png` - Bot performance graphs

### Incident management

- `incident-escalation.png` - Incident response flowchart
- `pagerduty-setup.png` - PagerDuty integration configuration

## Image standards

### Technical requirements

- Format: PNG or JPG
- Max width: 1200px for readability
- Dark theme preferred to match documentation
- Include alt text in markdown for accessibility

### Content guidelines

- Screenshots should show real data when possible
- Blur or anonymize sensitive information
- Include timestamps for dashboard screenshots
- Use consistent styling and color schemes

## Adding new images

1. Place image files in this directory
2. Reference using relative paths: `![Description](./images/filename.png)`
3. Update this README when adding new categories
4. Test image display in both GitHub and local markdown viewers
