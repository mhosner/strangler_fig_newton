/**
 * Creates a realistic .NET solution structure on disk for integration testing.
 * Exercises the chunker's extension-based .csproj detection.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function createDotnetSolution(root: string): void {
  writeFile(root, 'AcmeApp.sln', `Microsoft Visual Studio Solution File, Format Version 12.00
Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "AcmeApp.Api", "src\\Api\\AcmeApp.Api.csproj"
Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "AcmeApp.Domain", "src\\Domain\\AcmeApp.Domain.csproj"
Project("{FAE04EC0-301F-11D3-BF4B-00C04F79EFBC}") = "AcmeApp.Tests", "tests\\AcmeApp.Tests\\AcmeApp.Tests.csproj"
EndProject`);

  // Api project
  const api = dir(root, 'src', 'Api');
  writeFile(api, 'AcmeApp.Api.csproj', csproj('net8.0'));
  writeFile(api, 'Program.cs', `var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
app.MapControllers();
app.Run();`);
  const controllers = dir(api, 'Controllers');
  writeFile(controllers, 'OrdersController.cs', `using Microsoft.AspNetCore.Mvc;
[ApiController]
[Route("api/[controller]")]
public class OrdersController : ControllerBase
{
    [HttpGet] public IActionResult Get() => Ok();
}`);
  writeFile(controllers, 'CustomersController.cs', `using Microsoft.AspNetCore.Mvc;
[ApiController]
public class CustomersController : ControllerBase {}`);

  // Domain project
  const domain = dir(root, 'src', 'Domain');
  writeFile(domain, 'AcmeApp.Domain.csproj', csproj('net8.0'));
  const models = dir(domain, 'Models');
  writeFile(models, 'Order.cs', `namespace AcmeApp.Domain.Models;
public class Order { public int Id { get; set; } public decimal Total { get; set; } }`);
  writeFile(models, 'Customer.cs', `namespace AcmeApp.Domain.Models;
public class Customer { public int Id { get; set; } public string Name { get; set; } }`);

  // Tests project
  const tests = dir(root, 'tests', 'AcmeApp.Tests');
  writeFile(tests, 'AcmeApp.Tests.csproj', csproj('net8.0'));
  writeFile(tests, 'OrderTests.cs', `public class OrderTests { [Fact] public void Test1() {} }`);
}

function csproj(targetFramework: string): string {
  return `<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>${targetFramework}</TargetFramework>
  </PropertyGroup>
</Project>`;
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
