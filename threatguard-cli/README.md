# ThreatGuard CLI

Console-based real-time threat detection and behavioral analysis platform.

## Overview

ThreatGuard CLI is a powerful command-line interface for cybersecurity professionals, providing real-time threat detection, behavioral analysis, network monitoring, and threat intelligence capabilities directly from your terminal.

## Features

- 🔍 **Real-time Threat Detection** - Advanced AI-powered threat scanning and monitoring
- 🧠 **Behavioral Analysis** - ML-based user and system behavior analysis
- 🌐 **Network Monitoring** - Comprehensive network security monitoring and scanning  
- 📊 **Interactive Dashboard** - Terminal-based real-time security dashboard
- 🎯 **Threat Intelligence** - Query and correlate threat intelligence from multiple sources
- ⚡ **Live Event Streaming** - Real-time security event monitoring with filtering
- 🔧 **Command Interface** - Full-featured command execution with history and auto-completion

## Installation

### NPM Global Installation
```bash
npm install -g threatguard-cli
```

### From Source
```bash
git clone <repository-url>
cd threatguard-cli
npm install
npm run build
npm link
```

## Quick Start

1. **Install the CLI**
```bash
npm install -g threatguard-cli
```

2. **Login to ThreatGuard Platform**
```bash
threatguard auth login
```

3. **Start Interactive Mode**
```bash
threatguard
```

4. **Or Use Direct Commands**
```bash
threatguard threat scan 192.168.1.0/24
threatguard behavior analyze user123
threatguard network monitor
```

## Usage

### Interactive Mode
Start the interactive terminal interface:
```bash
threatguard
```

**Interface Navigation:**
- `1` - Dashboard view (real-time metrics and threats)
- `2` - Command interface (execute commands with history)  
- `3` - Live event stream (real-time security events)
- `?` - Help and keyboard shortcuts
- `q` - Quit application

### Command Line Mode

#### Authentication
```bash
threatguard auth login                    # Login with credentials
threatguard auth logout                   # Logout
threatguard auth status                   # Check authentication status
```

#### Threat Detection
```bash
threatguard threat scan <target>          # Scan for threats
threatguard threat scan 192.168.1.0/24   # Scan network range
threatguard threat scan example.com       # Scan domain
threatguard threat list --limit 20        # List recent threats
threatguard threat watch                  # Real-time threat monitoring
threatguard threat status                 # System status
```

#### Behavioral Analysis
```bash
threatguard behavior analyze <target>     # Analyze behavioral patterns
threatguard behavior patterns user123     # List user patterns
threatguard behavior anomalies --live     # Live anomaly detection
threatguard behavior interactive          # Interactive analysis
```

#### Network Monitoring
```bash
threatguard network scan <target>         # Network security scan
threatguard network monitor               # Real-time network monitoring
threatguard network events --since 1h     # List network events
threatguard network topology              # Network discovery
```

#### Threat Intelligence
```bash
threatguard intel query <indicator>       # Query threat intelligence
threatguard intel query 1.2.3.4          # IP reputation lookup
threatguard intel search malware          # Search intelligence databases
threatguard intel feeds                   # List intelligence feeds
```

#### Configuration
```bash
threatguard config setup                  # Interactive configuration
threatguard config set apiUrl https://...  # Set API endpoint
threatguard config get preferences         # Get configuration
```

## Command Reference

### Global Options
- `-v, --verbose` - Enable verbose logging
- `--api-url <url>` - Override API base URL  

### Threat Detection Options
- `-t, --targets <targets...>` - Multiple targets
- `-n, --network <cidr>` - Network CIDR (e.g., 192.168.1.0/24)
- `--timeout <seconds>` - Scan timeout
- `--deep` - Enable deep analysis
- `--live` - Show live results

### Behavioral Analysis Options  
- `--type <type>` - Analysis type (user, network, system, application)
- `--since <time>` - Time range (1h, 24h, 7d)
- `--threshold <value>` - Anomaly threshold (0-1)
- `--format <format>` - Output format (table, json)

### Network Monitoring Options
- `-p, --ports <ports>` - Port ranges (22,80,443 or 1-1000)
- `--interface <name>` - Network interface
- `--protocols <protocols...>` - Protocol filters (tcp, udp, icmp)
- `--suspicious-only` - Show only suspicious events

### Intelligence Query Options
- `-t, --type <type>` - Indicator type (ip, domain, hash, url)
- `-s, --sources <sources...>` - Specific sources
- `--verbose` - Include detailed information
- `--batch <file>` - Batch query from file

## Configuration

ThreatGuard CLI stores configuration in `~/.config/threatguard-cli/config.json`

### Default Configuration
```json
{
  "apiUrl": "https://api.threatguard.ai",
  "preferences": {
    "theme": "dark",
    "outputFormat": "table",
    "realTimeUpdates": true,
    "notifications": true
  }
}
```

### Environment Variables
- `THREATGUARD_API_URL` - API base URL
- `THREATGUARD_TOKEN` - Authentication token
- `DEBUG` - Enable debug logging

## Interactive Dashboard

The interactive dashboard provides a real-time view of your security posture:

**Dashboard Widgets:**
- **Active Threats** - Current threat count and severity
- **Risk Score** - Overall security risk assessment  
- **System Status** - Platform health and availability
- **Recent Events** - Latest security events and alerts

**Navigation:**
- `Tab` - Cycle through widgets
- `Enter` - Expand selected widget  
- `↑/↓` - Navigate within widgets
- `Esc` - Return to overview

## Real-time Event Stream

Monitor security events as they happen:

**Stream Controls:**
- `Space` - Pause/Resume stream
- `C` - Clear stream buffer
- `F` - Configure event filters
- `S` - Save stream to file

**Event Types:**
- 🚨 **Threats** - Security threats and alerts
- 🧠 **Behavior** - Behavioral analysis results
- 🌐 **Network** - Network security events  
- 🔍 **Intelligence** - Threat intelligence updates

## Command Interface

Full-featured command execution environment:

**Features:**
- Command history (↑/↓ arrows)
- Auto-completion (Tab key)
- Built-in help system
- Command aliases and shortcuts

**Built-in Commands:**
- `help` - Show available commands
- `clear` - Clear output
- `history` - Show command history

## Output Formats

### Table Format (Default)
Structured tabular output optimized for terminal viewing.

### JSON Format  
Machine-readable JSON for scripting and automation:
```bash
threatguard threat list --format json
```

### Text Format
Plain text output for piping and processing:
```bash
threatguard threat list --format text | grep critical
```

## Examples

### Comprehensive Network Security Assessment
```bash
# Interactive setup
threatguard config setup

# Network discovery and scanning
threatguard network topology -n 192.168.1.0/24
threatguard threat scan 192.168.1.0/24 --deep

# Behavioral analysis of key users
threatguard behavior analyze admin-user --since 7d
threatguard behavior anomalies --threshold 0.8

# Threat intelligence correlation
threatguard intel query 192.168.1.100
threatguard intel search "suspicious domain"

# Real-time monitoring  
threatguard threat watch --severity high
```

### Incident Response Workflow
```bash
# Assess current threats
threatguard threat list --severity critical --since 1h

# Analyze suspicious behavior
threatguard behavior analyze compromised-user
threatguard network events --source 192.168.1.50

# Intelligence gathering
threatguard intel query malicious-ip-address
threatguard intel query suspicious-hash

# Generate incident report
threatguard threat list --format json --since 24h > incident-report.json
```

### Automated Security Monitoring
```bash
#!/bin/bash
# Security monitoring script

# Check system status
STATUS=$(threatguard threat status --format json | jq -r '.systemStatus')

if [ "$STATUS" != "healthy" ]; then
    echo "Alert: System status is $STATUS"
    
    # Get recent threats
    threatguard threat list --limit 10 --format table
    
    # Analyze network activity  
    threatguard network events --suspicious-only --since 1h
fi
```

## Troubleshooting

### Common Issues

**Authentication Failed**
```bash
threatguard auth status
threatguard auth login
```

**Network Connection Issues**  
```bash
threatguard config get apiUrl
threatguard config set apiUrl https://your-api-endpoint.com
```

**Permission Errors**
```bash
sudo npm install -g threatguard-cli
```

### Debug Mode
Enable verbose logging for troubleshooting:
```bash
threatguard --verbose threat scan target
# or
DEBUG=true threatguard threat scan target
```

### Configuration Issues
Reset configuration to defaults:
```bash
threatguard config reset
threatguard config setup
```

## Development

### Building from Source
```bash
git clone <repository-url>
cd threatguard-cli
npm install
npm run build
npm run test
```

### Development Commands
```bash
npm run dev          # Development mode with auto-reload
npm run build        # Build for production
npm run test         # Run unit tests
npm run lint         # Code linting
npm run format       # Code formatting
```

### Project Structure
```
src/
├── commands/        # CLI command implementations
├── ui/             # Interactive terminal UI components  
├── services/       # API clients and external services
├── utils/          # Utility functions and helpers
└── types/          # TypeScript type definitions
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)  
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📖 **Documentation**: Full API documentation available at [docs.threatguard.ai](https://docs.threatguard.ai)
- 💬 **Community**: Join our Discord server for community support
- 🐛 **Issues**: Report bugs and feature requests on GitHub
- 📧 **Enterprise**: Contact enterprise@threatguard.ai for business inquiries

---

**ThreatGuard CLI** - Console-based cybersecurity for modern security operations teams.