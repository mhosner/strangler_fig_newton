/**
 * Creates a realistic multi-module Maven project on disk for integration testing.
 * Exercises the chunker's ability to discover multiple sub-modules via pom.xml.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function createJavaMultiModule(root: string): void {
  // Root parent POM
  writeFile(root, 'pom.xml', `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.acme</groupId>
  <artifactId>acme-parent</artifactId>
  <version>1.0.0</version>
  <packaging>pom</packaging>
  <modules>
    <module>api</module>
    <module>core</module>
    <module>persistence</module>
    <module>web</module>
  </modules>
</project>`);

  writeFile(root, 'README.md', '# Acme Multi-Module Project');

  // api module
  const api = dir(root, 'api');
  writeFile(api, 'pom.xml', pomXml('acme-api'));
  const apiSrc = dir(api, 'src', 'main', 'java', 'com', 'acme', 'api');
  writeFile(apiSrc, 'OrderController.java', `package com.acme.api;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/orders")
public class OrderController {
    @GetMapping public String list() { return "[]"; }
    @PostMapping public String create() { return "{}"; }
}`);
  writeFile(apiSrc, 'PaymentController.java', `package com.acme.api;
@RestController
@RequestMapping("/payments")
public class PaymentController {}`);

  // core module
  const core = dir(root, 'core');
  writeFile(core, 'pom.xml', pomXml('acme-core'));
  const coreSrc = dir(core, 'src', 'main', 'java', 'com', 'acme', 'core');
  writeFile(coreSrc, 'OrderService.java', `package com.acme.core;
public class OrderService {}`);
  writeFile(coreSrc, 'PaymentService.java', `package com.acme.core;
public class PaymentService {}`);
  writeFile(coreSrc, 'NotificationService.java', `package com.acme.core;
public class NotificationService {}`);

  // persistence module
  const persistence = dir(root, 'persistence');
  writeFile(persistence, 'pom.xml', pomXml('acme-persistence'));
  const persistSrc = dir(persistence, 'src', 'main', 'java', 'com', 'acme', 'persistence');
  writeFile(persistSrc, 'OrderRepository.java', `package com.acme.persistence;
public interface OrderRepository {}`);
  writeFile(persistSrc, 'PaymentRepository.java', `package com.acme.persistence;
public interface PaymentRepository {}`);

  // web module
  const web = dir(root, 'web');
  writeFile(web, 'pom.xml', pomXml('acme-web'));
  const webSrc = dir(web, 'src', 'main', 'java', 'com', 'acme', 'web');
  writeFile(webSrc, 'Application.java', `package com.acme.web;
import org.springframework.boot.SpringApplication;
@SpringBootApplication
public class Application {
    public static void main(String[] args) { SpringApplication.run(Application.class, args); }
}`);
  writeFile(webSrc, 'WebConfig.java', `package com.acme.web;
public class WebConfig {}`);
  const webResources = dir(web, 'src', 'main', 'resources');
  writeFile(webResources, 'application.properties', 'server.port=8080');
}

function pomXml(artifactId: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>com.acme</groupId>
    <artifactId>acme-parent</artifactId>
    <version>1.0.0</version>
  </parent>
  <artifactId>${artifactId}</artifactId>
</project>`;
}

function dir(...parts: string[]): string {
  const p = join(...parts);
  mkdirSync(p, { recursive: true });
  return p;
}

function writeFile(dirPath: string, name: string, content: string): void {
  mkdirSync(dirPath, { recursive: true });
  writeFileSync(join(dirPath, name), content);
}
