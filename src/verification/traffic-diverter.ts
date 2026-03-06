import type { ParallelRunConfig, TrafficDiversionConfig } from '../core/types.js';
import type { PluginConfig } from '../core/config.js';

/**
 * Generates gradual traffic diversion plans. Traffic is shifted from monolith
 * to new service in stages, with rollback thresholds at each stage.
 */
export class TrafficDiverter {
  constructor(private readonly config: PluginConfig) {}

  generateDiversionPlan(
    runConfig: ParallelRunConfig,
    loadBalancerType: TrafficDiversionConfig['loadBalancerType'] = 'nginx',
  ): TrafficDiversionConfig {
    const stages = this.config.trafficDiversionStages.map((percentage) => ({
      percentage,
      duration: this.suggestDuration(percentage),
      rollbackThreshold: {
        errorRate: this.suggestErrorThreshold(percentage),
        latencyP99Ms: this.suggestLatencyThreshold(percentage),
      },
    }));

    return {
      stages,
      loadBalancerType,
      configSnippet: this.generateConfigSnippet(loadBalancerType, runConfig),
    };
  }

  private suggestDuration(percentage: number): string {
    if (percentage <= 5) return '1h';
    if (percentage <= 25) return '4h';
    if (percentage <= 50) return '12h';
    return '24h';
  }

  private suggestErrorThreshold(percentage: number): number {
    // Tighter thresholds at lower percentages (more cautious early on)
    if (percentage <= 5) return 0.001; // 0.1%
    if (percentage <= 25) return 0.005; // 0.5%
    return 0.01; // 1%
  }

  private suggestLatencyThreshold(percentage: number): number {
    if (percentage <= 5) return 500;
    if (percentage <= 25) return 1000;
    return 2000;
  }

  private generateConfigSnippet(
    type: TrafficDiversionConfig['loadBalancerType'],
    runConfig: ParallelRunConfig,
  ): string {
    switch (type) {
      case 'nginx':
        return this.generateNginxConfig(runConfig);
      case 'envoy':
        return this.generateEnvoyConfig(runConfig);
      case 'aws-alb':
        return this.generateAlbConfig(runConfig);
      default:
        return this.generateGenericConfig(runConfig);
    }
  }

  private generateNginxConfig(runConfig: ParallelRunConfig): string {
    return [
      '# nginx weighted upstream configuration',
      '# Adjust weights to control traffic split',
      'upstream backend {',
      `    server ${runConfig.oldEndpoint} weight=95;  # monolith`,
      `    server ${runConfig.newEndpoint} weight=5;    # new service`,
      '}',
      '',
      'server {',
      '    location / {',
      '        proxy_pass http://backend;',
      '    }',
      '}',
    ].join('\n');
  }

  private generateEnvoyConfig(runConfig: ParallelRunConfig): string {
    return [
      '# Envoy weighted cluster configuration',
      'route_config:',
      '  virtual_hosts:',
      '    - name: service',
      '      routes:',
      '        - match: { prefix: "/" }',
      '          route:',
      '            weighted_clusters:',
      '              clusters:',
      `                - name: monolith  # ${runConfig.oldEndpoint}`,
      '                  weight: 95',
      `                - name: new_service  # ${runConfig.newEndpoint}`,
      '                  weight: 5',
    ].join('\n');
  }

  private generateAlbConfig(runConfig: ParallelRunConfig): string {
    return [
      '# AWS ALB weighted target group (via CLI)',
      `# Old: ${runConfig.oldEndpoint}`,
      `# New: ${runConfig.newEndpoint}`,
      'aws elbv2 modify-rule \\',
      '  --rule-arn <rule-arn> \\',
      '  --actions \'[',
      '    {"Type":"forward","ForwardConfig":{"TargetGroups":[',
      '      {"TargetGroupArn":"<monolith-tg>","Weight":95},',
      '      {"TargetGroupArn":"<new-service-tg>","Weight":5}',
      '    ]}}',
      '  ]\'',
    ].join('\n');
  }

  private generateGenericConfig(runConfig: ParallelRunConfig): string {
    return [
      '# Generic traffic split configuration',
      `# Old endpoint: ${runConfig.oldEndpoint}`,
      `# New endpoint: ${runConfig.newEndpoint}`,
      '# Split: 95% old, 5% new',
      '# Update percentages at each diversion stage',
    ].join('\n');
  }

  renderDiversionPlan(config: TrafficDiversionConfig): string {
    const lines = [
      '## Traffic Diversion Plan',
      '',
      `Load balancer: ${config.loadBalancerType}`,
      '',
      '### Stages:',
      '',
    ];

    for (const stage of config.stages) {
      lines.push(`**${stage.percentage}% to new service** (duration: ${stage.duration})`);
      lines.push(`  Rollback if: error rate > ${(stage.rollbackThreshold.errorRate * 100).toFixed(1)}% OR p99 latency > ${stage.rollbackThreshold.latencyP99Ms}ms`);
      lines.push('');
    }

    lines.push('### Configuration Snippet:');
    lines.push('```');
    lines.push(config.configSnippet);
    lines.push('```');

    return lines.join('\n');
  }
}
