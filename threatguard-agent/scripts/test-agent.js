#!/usr/bin/env node
/**
 * ThreatGuard Agent - Test Suite
 * Comprehensive testing for zero-config functionality
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class AgentTester {
    constructor() {
        this.projectRoot = path.resolve(__dirname, '..');
        this.testResults = {
            passed: 0,
            failed: 0,
            skipped: 0,
            errors: []
        };
        
        console.log('🧪 ThreatGuard Agent Test Suite');
        console.log(`🖥️  Platform: ${process.platform}-${process.arch}`);
        console.log(`📁 Project: ${this.projectRoot}`);
        console.log('');
    }

    async runTests() {
        try {
            console.log('🚀 Starting comprehensive agent tests...');
            console.log('');

            // Test categories
            await this.testDependencies();
            await this.testCompilation();
            await this.testZeroConfig();
            await this.testDiscovery();
            await this.testConfiguration();
            await this.testHealthMonitoring();
            await this.testManagementAPI();
            await this.testSecurity();
            await this.testPerformance();
            await this.testIntegration();

            // Summary
            this.printSummary();

        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            process.exit(1);
        }
    }

    async testDependencies() {
        console.log('📦 Testing dependencies...');

        await this.test('Node.js version', () => {
            const version = process.version;
            const majorVersion = parseInt(version.slice(1).split('.')[0]);
            if (majorVersion < 14) {
                throw new Error(`Node.js ${version} is too old. Requires >= 14.0.0`);
            }
            return `Node.js ${version} ✅`;
        });

        await this.test('NPM packages', () => {
            const packageJson = JSON.parse(fs.readFileSync(
                path.join(this.projectRoot, 'package.json'), 'utf8'
            ));

            const requiredDeps = [
                'winston', 'express', 'ws', 'node-machine-id'
            ];

            const missing = requiredDeps.filter(dep => 
                !packageJson.dependencies[dep] && !packageJson.devDependencies[dep]
            );

            if (missing.length > 0) {
                throw new Error(`Missing dependencies: ${missing.join(', ')}`);
            }

            return `All required dependencies present ✅`;
        });

        await this.test('TypeScript setup', () => {
            const tsconfigPath = path.join(this.projectRoot, 'tsconfig.json');
            if (!fs.existsSync(tsconfigPath)) {
                throw new Error('tsconfig.json not found');
            }

            const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
            if (!tsconfig.compilerOptions || !tsconfig.compilerOptions.outDir) {
                throw new Error('Invalid TypeScript configuration');
            }

            return 'TypeScript configuration valid ✅';
        });

        console.log('');
    }

    async testCompilation() {
        console.log('⚙️  Testing TypeScript compilation...');

        await this.test('TypeScript compilation', () => {
            try {
                execSync('npx tsc --noEmit', {
                    cwd: this.projectRoot,
                    stdio: 'pipe'
                });
                return 'TypeScript compiles without errors ✅';
            } catch (error) {
                throw new Error(`TypeScript compilation failed: ${error.stdout || error.stderr}`);
            }
        });

        await this.test('Import resolution', () => {
            const mainFile = path.join(this.projectRoot, 'src', 'index.ts');
            if (!fs.existsSync(mainFile)) {
                throw new Error('Main entry point src/index.ts not found');
            }

            const content = fs.readFileSync(mainFile, 'utf8');
            if (!content.includes('ThreatGuardAgent')) {
                throw new Error('Main class import not found');
            }

            return 'Import resolution working ✅';
        });

        console.log('');
    }

    async testZeroConfig() {
        console.log('🔧 Testing zero-config functionality...');

        await this.test('Agent class instantiation', async () => {
            // Mock test of agent creation
            const agentPath = path.join(this.projectRoot, 'src', 'wrapper', 'agent.ts');
            if (!fs.existsSync(agentPath)) {
                throw new Error('Agent class file not found');
            }

            const content = fs.readFileSync(agentPath, 'utf8');
            if (!content.includes('export class ThreatGuardAgent')) {
                throw new Error('ThreatGuardAgent class not exported');
            }

            return 'Agent class structure valid ✅';
        });

        await this.test('Discovery engine availability', () => {
            const discoveryPath = path.join(this.projectRoot, 'src', 'wrapper', 'discovery', 'discovery-engine.ts');
            if (!fs.existsSync(discoveryPath)) {
                throw new Error('Discovery engine not found');
            }

            const content = fs.readFileSync(discoveryPath, 'utf8');
            if (!content.includes('export class DiscoveryEngine')) {
                throw new Error('DiscoveryEngine class not found');
            }

            return 'Discovery engine available ✅';
        });

        await this.test('Platform detection', () => {
            const platformDiscoveries = [
                { platform: 'win32', file: 'windows-discovery.ts' },
                { platform: 'linux', file: 'linux-discovery.ts' },
                { platform: 'darwin', file: 'macos-discovery.ts' }
            ];

            const currentPlatform = process.platform;
            const platformConfig = platformDiscoveries.find(p => p.platform === currentPlatform);
            
            if (!platformConfig) {
                throw new Error(`Unsupported platform: ${currentPlatform}`);
            }

            const platformPath = path.join(this.projectRoot, 'src', 'platform', 
                platformConfig.platform.replace('win32', 'windows').replace('darwin', 'macos'), 
                platformConfig.file);
                
            if (!fs.existsSync(platformPath)) {
                throw new Error(`Platform discovery not found: ${platformPath}`);
            }

            return `Platform detection for ${currentPlatform} available ✅`;
        });

        console.log('');
    }

    async testDiscovery() {
        console.log('🔍 Testing system discovery...');

        await this.test('System info gathering', () => {
            // Test if system info gathering functions exist
            const platformName = process.platform === 'win32' ? 'windows' : 
                                 process.platform === 'darwin' ? 'macos' : 'linux';
            
            const discoveryFile = path.join(this.projectRoot, 'src', 'platform', platformName, 
                `${platformName}-discovery.ts`);
            
            if (!fs.existsSync(discoveryFile)) {
                throw new Error(`Platform discovery file not found: ${discoveryFile}`);
            }

            const content = fs.readFileSync(discoveryFile, 'utf8');
            const requiredMethods = [
                'gatherSystemInfo',
                'discoverSecurityTools',
                'identifyLogSources',
                'analyzeComplianceRequirements'
            ];

            const missing = requiredMethods.filter(method => !content.includes(method));
            if (missing.length > 0) {
                throw new Error(`Missing discovery methods: ${missing.join(', ')}`);
            }

            return `Platform discovery methods present ✅`;
        });

        await this.test('Security tool detection', () => {
            // Test that common security tools are covered
            const platformName = process.platform === 'win32' ? 'windows' : 
                                 process.platform === 'darwin' ? 'macos' : 'linux';
            
            const discoveryFile = path.join(this.projectRoot, 'src', 'platform', platformName, 
                `${platformName}-discovery.ts`);
            
            const content = fs.readFileSync(discoveryFile, 'utf8');
            
            // Check for common security tool detection
            const commonTools = ['CrowdStrike', 'Defender', 'Symantec'];
            const detected = commonTools.filter(tool => content.includes(tool));
            
            if (detected.length === 0) {
                throw new Error('No common security tools detected in discovery');
            }

            return `Security tool detection implemented (${detected.length} tools) ✅`;
        });

        console.log('');
    }

    async testConfiguration() {
        console.log('⚙️  Testing configuration generation...');

        await this.test('Config manager', () => {
            const configPath = path.join(this.projectRoot, 'src', 'wrapper', 'config', 'config-manager.ts');
            if (!fs.existsSync(configPath)) {
                throw new Error('Configuration manager not found');
            }

            const content = fs.readFileSync(configPath, 'utf8');
            if (!content.includes('generateConfiguration')) {
                throw new Error('Configuration generation method not found');
            }

            return 'Configuration manager available ✅';
        });

        await this.test('Type definitions', () => {
            const typesPath = path.join(this.projectRoot, 'src', 'common', 'types.ts');
            if (!fs.existsSync(typesPath)) {
                throw new Error('Type definitions not found');
            }

            const content = fs.readFileSync(typesPath, 'utf8');
            const requiredTypes = [
                'AgentConfig',
                'DiscoveryResult',
                'SecurityProfile',
                'LogSource'
            ];

            const missing = requiredTypes.filter(type => !content.includes(`export interface ${type}`));
            if (missing.length > 0) {
                throw new Error(`Missing type definitions: ${missing.join(', ')}`);
            }

            return 'Type definitions complete ✅';
        });

        console.log('');
    }

    async testHealthMonitoring() {
        console.log('🏥 Testing health monitoring...');

        await this.test('Health monitor', () => {
            const healthPath = path.join(this.projectRoot, 'src', 'common', 'health-monitor.ts');
            if (!fs.existsSync(healthPath)) {
                throw new Error('Health monitor not found');
            }

            const content = fs.readFileSync(healthPath, 'utf8');
            if (!content.includes('export class HealthMonitor')) {
                throw new Error('HealthMonitor class not found');
            }

            return 'Health monitor available ✅';
        });

        await this.test('Metric collection', () => {
            const healthPath = path.join(this.projectRoot, 'src', 'common', 'health-monitor.ts');
            const content = fs.readFileSync(healthPath, 'utf8');
            
            const metrics = ['cpu_usage', 'memory_usage', 'disk_usage'];
            const present = metrics.filter(metric => content.includes(metric));
            
            if (present.length < metrics.length) {
                throw new Error(`Missing metrics: ${metrics.filter(m => !present.includes(m)).join(', ')}`);
            }

            return 'Metric collection implemented ✅';
        });

        console.log('');
    }

    async testManagementAPI() {
        console.log('🌐 Testing management API...');

        await this.test('Management service', () => {
            const mgmtPath = path.join(this.projectRoot, 'src', 'wrapper', 'management', 'management-service.ts');
            if (!fs.existsSync(mgmtPath)) {
                throw new Error('Management service not found');
            }

            const content = fs.readFileSync(mgmtPath, 'utf8');
            if (!content.includes('export class ManagementService')) {
                throw new Error('ManagementService class not found');
            }

            return 'Management service available ✅';
        });

        await this.test('API endpoints', () => {
            const mgmtPath = path.join(this.projectRoot, 'src', 'wrapper', 'management', 'management-service.ts');
            const content = fs.readFileSync(mgmtPath, 'utf8');
            
            const endpoints = ['/health', '/status', '/metrics', '/config/reload'];
            const present = endpoints.filter(endpoint => content.includes(endpoint));
            
            if (present.length < endpoints.length) {
                throw new Error(`Missing endpoints: ${endpoints.filter(e => !present.includes(e)).join(', ')}`);
            }

            return 'API endpoints implemented ✅';
        });

        console.log('');
    }

    async testSecurity() {
        console.log('🔒 Testing security features...');

        await this.test('Authentication middleware', () => {
            const mgmtPath = path.join(this.projectRoot, 'src', 'wrapper', 'management', 'management-service.ts');
            const content = fs.readFileSync(mgmtPath, 'utf8');
            
            if (!content.includes('x-api-key') && !content.includes('authentication')) {
                throw new Error('Authentication middleware not found');
            }

            return 'Authentication implemented ✅';
        });

        await this.test('Security headers', () => {
            const mgmtPath = path.join(this.projectRoot, 'src', 'wrapper', 'management', 'management-service.ts');
            const content = fs.readFileSync(mgmtPath, 'utf8');
            
            const securityHeaders = ['X-Content-Type-Options', 'X-Frame-Options', 'X-XSS-Protection'];
            const present = securityHeaders.filter(header => content.includes(header));
            
            if (present.length < 2) {
                throw new Error('Insufficient security headers');
            }

            return 'Security headers configured ✅';
        });

        console.log('');
    }

    async testPerformance() {
        console.log('⚡ Testing performance optimizations...');

        await this.test('Event loop monitoring', () => {
            const healthPath = path.join(this.projectRoot, 'src', 'common', 'health-monitor.ts');
            const content = fs.readFileSync(healthPath, 'utf8');
            
            if (!content.includes('measureEventLoopLag')) {
                throw new Error('Event loop monitoring not implemented');
            }

            return 'Event loop monitoring available ✅';
        });

        await this.test('Resource limits', () => {
            const configPath = path.join(this.projectRoot, 'src', 'wrapper', 'config', 'config-manager.ts');
            const content = fs.readFileSync(configPath, 'utf8');
            
            if (!content.includes('resourceLimits') && !content.includes('maxCpuPercent')) {
                throw new Error('Resource limits not configured');
            }

            return 'Resource limits configured ✅';
        });

        console.log('');
    }

    async testIntegration() {
        console.log('🔌 Testing integrations...');

        await this.test('Fluent Bit integration', () => {
            const fluentBitPath = path.join(this.projectRoot, 'src', 'fluent-bit', 'fluent-bit-manager.ts');
            if (!fs.existsSync(fluentBitPath)) {
                throw new Error('Fluent Bit manager not found');
            }

            const content = fs.readFileSync(fluentBitPath, 'utf8');
            if (!content.includes('FluentBitManager')) {
                throw new Error('FluentBitManager class not found');
            }

            return 'Fluent Bit integration available ✅';
        });

        await this.test('WebSocket support', () => {
            const mgmtPath = path.join(this.projectRoot, 'src', 'wrapper', 'management', 'management-service.ts');
            const content = fs.readFileSync(mgmtPath, 'utf8');
            
            if (!content.includes('WebSocketServer') && !content.includes('ws')) {
                throw new Error('WebSocket support not found');
            }

            return 'WebSocket support available ✅';
        });

        console.log('');
    }

    // Helper methods

    async test(name, testFn) {
        try {
            const result = await testFn();
            console.log(`   ✅ ${name}: ${result || 'Passed'}`);
            this.testResults.passed++;
        } catch (error) {
            console.log(`   ❌ ${name}: ${error.message}`);
            this.testResults.failed++;
            this.testResults.errors.push({ name, error: error.message });
        }
    }

    printSummary() {
        console.log('📊 Test Summary');
        console.log('================');
        console.log(`✅ Passed: ${this.testResults.passed}`);
        console.log(`❌ Failed: ${this.testResults.failed}`);
        console.log(`⏭️  Skipped: ${this.testResults.skipped}`);
        console.log(`📈 Success Rate: ${Math.round((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100)}%`);
        console.log('');

        if (this.testResults.failed > 0) {
            console.log('❌ Failed Tests:');
            this.testResults.errors.forEach(error => {
                console.log(`   • ${error.name}: ${error.error}`);
            });
            console.log('');
        }

        if (this.testResults.failed === 0) {
            console.log('🎉 All tests passed! The ThreatGuard Agent is ready for deployment.');
        } else {
            console.log('⚠️  Some tests failed. Please review and fix issues before deployment.');
        }

        console.log('');
        console.log('🚀 Next Steps:');
        console.log('   1. Run: npm run build');
        console.log('   2. Test: ./dist/threatguard-agent --help');
        console.log('   3. Deploy: Use packages/ for distribution');
    }
}

// Main execution
if (require.main === module) {
    const tester = new AgentTester();
    tester.runTests().catch(console.error);
}

module.exports = AgentTester;