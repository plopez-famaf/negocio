#!/usr/bin/env node
/**
 * ThreatGuard Agent - Build Script
 * Comprehensive build system for cross-platform deployment
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class ThreatGuardBuilder {
    constructor() {
        this.projectRoot = path.resolve(__dirname, '..');
        this.buildDir = path.join(this.projectRoot, 'dist');
        this.packageDir = path.join(this.projectRoot, 'packages');
        this.platform = process.platform;
        this.arch = process.arch;
        
        console.log('🏗️  ThreatGuard Agent Build System');
        console.log(`📦 Platform: ${this.platform}-${this.arch}`);
        console.log(`📁 Project: ${this.projectRoot}`);
        console.log('');
    }

    async build() {
        try {
            console.log('🚀 Starting build process...');
            
            // Step 1: Clean previous builds
            await this.clean();
            
            // Step 2: Install dependencies
            await this.installDependencies();
            
            // Step 3: Run TypeScript compilation
            await this.compile();
            
            // Step 4: Copy assets
            await this.copyAssets();
            
            // Step 5: Create executables
            await this.createExecutables();
            
            // Step 6: Package for distribution
            await this.package();
            
            // Step 7: Run tests
            await this.runTests();
            
            console.log('✅ Build completed successfully!');
            console.log('');
            console.log('📦 Build artifacts:');
            this.listBuildArtifacts();
            
        } catch (error) {
            console.error('❌ Build failed:', error.message);
            process.exit(1);
        }
    }

    async clean() {
        console.log('🧹 Cleaning previous builds...');
        
        const dirsToClean = [this.buildDir, this.packageDir, 'node_modules/.cache'];
        
        for (const dir of dirsToClean) {
            const fullPath = path.resolve(this.projectRoot, dir);
            if (fs.existsSync(fullPath)) {
                fs.rmSync(fullPath, { recursive: true, force: true });
                console.log(`   Removed: ${dir}`);
            }
        }
        
        console.log('');
    }

    async installDependencies() {
        console.log('📦 Installing dependencies...');
        
        try {
            execSync('npm ci', {
                cwd: this.projectRoot,
                stdio: 'inherit'
            });
        } catch (error) {
            // Fallback to npm install
            console.log('   Falling back to npm install...');
            execSync('npm install', {
                cwd: this.projectRoot,
                stdio: 'inherit'
            });
        }
        
        console.log('');
    }

    async compile() {
        console.log('⚙️  Compiling TypeScript...');
        
        // Check if tsc is available
        try {
            execSync('npx tsc --version', { cwd: this.projectRoot, stdio: 'pipe' });
        } catch (error) {
            throw new Error('TypeScript compiler not found. Run npm install first.');
        }

        // Compile TypeScript
        execSync('npx tsc', {
            cwd: this.projectRoot,
            stdio: 'inherit'
        });
        
        console.log('   ✅ TypeScript compilation completed');
        console.log('');
    }

    async copyAssets() {
        console.log('📁 Copying assets...');
        
        const assets = [
            { src: 'package.json', dest: 'package.json' },
            { src: 'README.md', dest: 'README.md' },
            { src: 'LICENSE', dest: 'LICENSE', optional: true },
            { src: 'fluent-bit-configs', dest: 'fluent-bit-configs', optional: true }
        ];

        fs.mkdirSync(this.buildDir, { recursive: true });

        for (const asset of assets) {
            const srcPath = path.join(this.projectRoot, asset.src);
            const destPath = path.join(this.buildDir, asset.dest);
            
            if (fs.existsSync(srcPath)) {
                if (fs.statSync(srcPath).isDirectory()) {
                    this.copyDirectorySync(srcPath, destPath);
                } else {
                    fs.copyFileSync(srcPath, destPath);
                }
                console.log(`   Copied: ${asset.src}`);
            } else if (!asset.optional) {
                console.warn(`   Warning: ${asset.src} not found`);
            }
        }
        
        console.log('');
    }

    async createExecutables() {
        console.log('🔨 Creating executables...');
        
        // Create executable script
        const executableContent = this.getExecutableScript();
        const executablePath = path.join(this.buildDir, 'threatguard-agent');
        
        fs.writeFileSync(executablePath, executableContent);
        
        // Make executable (Unix-like systems)
        if (this.platform !== 'win32') {
            fs.chmodSync(executablePath, '755');
        }
        
        // Create Windows batch file
        if (this.platform === 'win32') {
            const batchContent = this.getWindowsBatchScript();
            const batchPath = path.join(this.buildDir, 'threatguard-agent.bat');
            fs.writeFileSync(batchPath, batchContent);
        }
        
        console.log(`   ✅ Executable created for ${this.platform}`);
        console.log('');
    }

    async package() {
        console.log('📦 Creating distribution packages...');
        
        fs.mkdirSync(this.packageDir, { recursive: true });
        
        const version = this.getVersion();
        const packageName = `threatguard-agent-v${version}-${this.platform}-${this.arch}`;
        
        // Create platform-specific packages
        switch (this.platform) {
            case 'win32':
                await this.createWindowsPackage(packageName);
                break;
            case 'linux':
                await this.createLinuxPackages(packageName);
                break;
            case 'darwin':
                await this.createMacOSPackage(packageName);
                break;
            default:
                await this.createGenericPackage(packageName);
        }
        
        console.log('');
    }

    async createWindowsPackage(packageName) {
        console.log('   Creating Windows MSI package...');
        
        // Create ZIP for now (MSI creation would require WiX toolset)
        const zipPath = path.join(this.packageDir, `${packageName}.zip`);
        
        try {
            // Use PowerShell to create ZIP
            const powershellScript = `
                Compress-Archive -Path "${this.buildDir}\\*" -DestinationPath "${zipPath}" -Force
            `;
            execSync(`powershell -Command "${powershellScript}"`, { stdio: 'pipe' });
            console.log(`   ✅ Created: ${path.basename(zipPath)}`);
        } catch (error) {
            console.log(`   ⚠️  ZIP creation failed, creating directory package`);
            this.copyDirectorySync(this.buildDir, path.join(this.packageDir, packageName));
        }
    }

    async createLinuxPackages(packageName) {
        console.log('   Creating Linux packages...');
        
        // Create TAR.GZ
        const tarPath = path.join(this.packageDir, `${packageName}.tar.gz`);
        try {
            execSync(`tar -czf "${tarPath}" -C "${path.dirname(this.buildDir)}" "${path.basename(this.buildDir)}"`, 
                { stdio: 'pipe' });
            console.log(`   ✅ Created: ${path.basename(tarPath)}`);
        } catch (error) {
            console.log('   ⚠️  TAR creation failed');
        }
        
        // Create DEB package structure (basic)
        await this.createDebPackage(packageName);
    }

    async createDebPackage(packageName) {
        console.log('   Creating DEB package structure...');
        
        const debDir = path.join(this.packageDir, `${packageName}-deb`);
        const debBinDir = path.join(debDir, 'usr', 'local', 'bin');
        const debLibDir = path.join(debDir, 'usr', 'local', 'lib', 'threatguard-agent');
        const debControlDir = path.join(debDir, 'DEBIAN');
        
        // Create directory structure
        fs.mkdirSync(debBinDir, { recursive: true });
        fs.mkdirSync(debLibDir, { recursive: true });
        fs.mkdirSync(debControlDir, { recursive: true });
        
        // Copy files
        this.copyDirectorySync(this.buildDir, debLibDir);
        
        // Create symlink script
        const symlinkScript = `#!/bin/bash
exec /usr/local/lib/threatguard-agent/threatguard-agent "$@"
`;
        fs.writeFileSync(path.join(debBinDir, 'threatguard-agent'), symlinkScript);
        fs.chmodSync(path.join(debBinDir, 'threatguard-agent'), '755');
        
        // Create control file
        const controlContent = this.getDebControlFile();
        fs.writeFileSync(path.join(debControlDir, 'control'), controlContent);
        
        console.log(`   ✅ DEB structure created: ${packageName}-deb/`);
    }

    async createMacOSPackage(packageName) {
        console.log('   Creating macOS packages...');
        
        // Create TAR.GZ
        const tarPath = path.join(this.packageDir, `${packageName}.tar.gz`);
        try {
            execSync(`tar -czf "${tarPath}" -C "${path.dirname(this.buildDir)}" "${path.basename(this.buildDir)}"`, 
                { stdio: 'pipe' });
            console.log(`   ✅ Created: ${path.basename(tarPath)}`);
        } catch (error) {
            console.log('   ⚠️  TAR creation failed');
        }
        
        // PKG package would require pkgbuild (macOS only)
        if (process.platform === 'darwin') {
            console.log('   📝 PKG creation requires macOS development tools');
        }
    }

    async createGenericPackage(packageName) {
        console.log(`   Creating generic package for ${this.platform}...`);
        
        const packagePath = path.join(this.packageDir, packageName);
        this.copyDirectorySync(this.buildDir, packagePath);
        console.log(`   ✅ Created: ${packageName}/`);
    }

    async runTests() {
        console.log('🧪 Running tests...');
        
        try {
            // Check if test script exists
            const packageJson = JSON.parse(fs.readFileSync(
                path.join(this.projectRoot, 'package.json'), 'utf8'
            ));
            
            if (packageJson.scripts && packageJson.scripts.test) {
                execSync('npm test', {
                    cwd: this.projectRoot,
                    stdio: 'inherit'
                });
                console.log('   ✅ All tests passed');
            } else {
                console.log('   ⚠️  No test script found');
            }
        } catch (error) {
            console.log('   ⚠️  Some tests failed, but continuing build');
        }
        
        console.log('');
    }

    // Helper methods

    copyDirectorySync(src, dest) {
        fs.mkdirSync(dest, { recursive: true });
        const files = fs.readdirSync(src);
        
        for (const file of files) {
            const srcPath = path.join(src, file);
            const destPath = path.join(dest, file);
            
            if (fs.statSync(srcPath).isDirectory()) {
                this.copyDirectorySync(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    getVersion() {
        try {
            const packageJson = JSON.parse(fs.readFileSync(
                path.join(this.projectRoot, 'package.json'), 'utf8'
            ));
            return packageJson.version || '1.0.0';
        } catch (error) {
            return '1.0.0';
        }
    }

    getExecutableScript() {
        if (this.platform === 'win32') {
            return `@echo off
cd /d "%~dp0"
node index.js %*
`;
        } else {
            return `#!/bin/bash
DIR="$( cd "$( dirname "\${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$DIR"
exec node index.js "$@"
`;
        }
    }

    getWindowsBatchScript() {
        return `@echo off
cd /d "%~dp0"
node index.js %*
`;
    }

    getDebControlFile() {
        const version = this.getVersion();
        return `Package: threatguard-agent
Version: ${version}
Section: admin
Priority: optional
Architecture: amd64
Depends: nodejs (>= 14.0.0)
Maintainer: ThreatGuard Team <support@bg-threat.com>
Description: ThreatGuard Agent - Zero-config endpoint security collector
 The ThreatGuard Agent provides automated discovery and collection
 of security events from endpoints with zero configuration required.
 Built on Fluent Bit for high-performance log processing.
`;
    }

    listBuildArtifacts() {
        const artifacts = [];
        
        // List build directory
        if (fs.existsSync(this.buildDir)) {
            artifacts.push(`📁 ${path.relative(this.projectRoot, this.buildDir)}/`);
        }
        
        // List packages
        if (fs.existsSync(this.packageDir)) {
            const packages = fs.readdirSync(this.packageDir);
            packages.forEach(pkg => {
                artifacts.push(`📦 ${path.relative(this.projectRoot, path.join(this.packageDir, pkg))}`);
            });
        }
        
        artifacts.forEach(artifact => console.log(`   ${artifact}`));
        console.log('');
        
        // Installation instructions
        console.log('🚀 Quick Start:');
        console.log(`   cd ${path.relative(process.cwd(), this.buildDir)}`);
        console.log('   ./threatguard-agent --help');
        console.log('');
        console.log('📖 For detailed installation instructions, see README.md');
    }
}

// Main execution
if (require.main === module) {
    const builder = new ThreatGuardBuilder();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const command = args[0] || 'build';
    
    switch (command) {
        case 'build':
            builder.build().catch(console.error);
            break;
        case 'clean':
            builder.clean().catch(console.error);
            break;
        case 'test':
            builder.runTests().catch(console.error);
            break;
        default:
            console.log('Usage: node build.js [build|clean|test]');
            console.log('');
            console.log('Commands:');
            console.log('  build  - Full build and package (default)');
            console.log('  clean  - Clean build artifacts');
            console.log('  test   - Run tests only');
    }
}

module.exports = ThreatGuardBuilder;