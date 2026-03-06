import type { MonitoringConfig, TrafficDiversionConfig } from '../core/types.js';

/**
 * Generates monitoring and alerting configurations for the newly extracted
 * microservice. Ensures divergence between old and new is detected immediately.
 */
export class MonitoringGenerator {
  generate(
    serviceName: string,
    diversionConfig: TrafficDiversionConfig,
    platform: MonitoringConfig['platform'] = 'prometheus',
  ): MonitoringConfig {
    return {
      serviceName,
      platform,
      healthChecks: [
        { endpoint: '/health', interval: '10s', timeout: '5s' },
        { endpoint: '/ready', interval: '30s', timeout: '10s' },
      ],
      alerts: this.generateAlerts(serviceName, diversionConfig),
      sloTargets: [
        { metric: 'availability', target: 0.999, window: '30d' },
        { metric: 'latency_p99', target: 500, window: '1h' },
        { metric: 'error_rate', target: 0.01, window: '1h' },
      ],
      configSnippet: this.generateConfigSnippet(serviceName, platform),
    };
  }

  private generateAlerts(
    serviceName: string,
    diversionConfig: TrafficDiversionConfig,
  ): MonitoringConfig['alerts'] {
    const maxErrorRate = Math.max(
      ...diversionConfig.stages.map((s) => s.rollbackThreshold.errorRate),
    );

    return [
      {
        name: `${serviceName}_high_error_rate`,
        condition: `error_rate > ${maxErrorRate}`,
        severity: 'critical',
      },
      {
        name: `${serviceName}_high_latency`,
        condition: 'latency_p99 > 2000ms',
        severity: 'warning',
      },
      {
        name: `${serviceName}_divergence_detected`,
        condition: 'response_divergence_rate > 0.001',
        severity: 'critical',
      },
      {
        name: `${serviceName}_health_check_failed`,
        condition: 'health_check_consecutive_failures > 3',
        severity: 'critical',
      },
    ];
  }

  private generateConfigSnippet(serviceName: string, platform: MonitoringConfig['platform']): string {
    switch (platform) {
      case 'prometheus':
        return this.generatePrometheusConfig(serviceName);
      case 'datadog':
        return this.generateDatadogConfig(serviceName);
      case 'cloudwatch':
        return this.generateCloudWatchConfig(serviceName);
      default:
        return `# Custom monitoring for ${serviceName}\n# Configure alerts for error rate, latency, and divergence`;
    }
  }

  private generatePrometheusConfig(serviceName: string): string {
    return [
      '# Prometheus alerting rules',
      'groups:',
      `  - name: ${serviceName}_alerts`,
      '    rules:',
      `      - alert: ${serviceName}HighErrorRate`,
      '        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.01',
      '        for: 5m',
      '        labels:',
      '          severity: critical',
      '        annotations:',
      `          summary: "High error rate on ${serviceName}"`,
      '',
      `      - alert: ${serviceName}HighLatency`,
      '        expr: histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) > 2',
      '        for: 5m',
      '        labels:',
      '          severity: warning',
      '',
      `      - alert: ${serviceName}DivergenceDetected`,
      '        expr: response_divergence_rate > 0.001',
      '        for: 1m',
      '        labels:',
      '          severity: critical',
    ].join('\n');
  }

  private generateDatadogConfig(serviceName: string): string {
    return [
      `# Datadog monitors for ${serviceName}`,
      '{',
      `  "name": "${serviceName} - High Error Rate",`,
      '  "type": "metric alert",',
      `  "query": "avg(last_5m):sum:http.requests.errors{service:${serviceName}} / sum:http.requests.total{service:${serviceName}} > 0.01",`,
      '  "message": "Error rate exceeds 1% - consider rollback",',
      '  "priority": 1',
      '}',
    ].join('\n');
  }

  private generateCloudWatchConfig(serviceName: string): string {
    return [
      `# CloudWatch alarms for ${serviceName}`,
      `aws cloudwatch put-metric-alarm \\`,
      `  --alarm-name "${serviceName}-high-error-rate" \\`,
      `  --metric-name 5XXError \\`,
      `  --namespace "AWS/ApplicationELB" \\`,
      `  --statistic Sum \\`,
      `  --period 300 \\`,
      `  --threshold 10 \\`,
      `  --comparison-operator GreaterThanThreshold \\`,
      `  --evaluation-periods 2`,
    ].join('\n');
  }

  renderMonitoringSetup(config: MonitoringConfig): string {
    const lines = [
      `## Monitoring Setup: ${config.serviceName}`,
      '',
      `Platform: ${config.platform}`,
      '',
      '### Health Checks:',
    ];

    for (const hc of config.healthChecks) {
      lines.push(`- ${hc.endpoint} (every ${hc.interval}, timeout ${hc.timeout})`);
    }

    lines.push('');
    lines.push('### Alerts:');
    for (const alert of config.alerts) {
      lines.push(`- **${alert.name}** [${alert.severity}]: ${alert.condition}`);
    }

    lines.push('');
    lines.push('### SLO Targets:');
    for (const slo of config.sloTargets) {
      lines.push(`- ${slo.metric}: ${slo.target} (${slo.window} window)`);
    }

    lines.push('');
    lines.push('### Configuration:');
    lines.push('```');
    lines.push(config.configSnippet);
    lines.push('```');

    return lines.join('\n');
  }
}
