# FAX-BANK for Foundry VTT

![CI Status](https://github.com/epistemophoros/FAX-BANK/actions/workflows/ci.yml/badge.svg)
![Foundry Version](https://img.shields.io/badge/Foundry-v11--v12-informational)
![License](https://img.shields.io/badge/License-MIT-green)

A Foundry VTT module with TypeScript, CI/CD, and automated releases.

## Features

- 🔧 TypeScript-based module structure
- 🎨 Custom application with styled UI
- ⚙️ Module settings with client/world scopes
- 🌍 i18n support with language files
- 🧪 Unit testing with Vitest
- 🔄 GitHub Actions CI/CD pipeline
- 📦 Automated releases with auto-versioning

## Installation

### Method 1: Manifest URL (Recommended)

1. In Foundry VTT, go to **Add-on Modules**
2. Click **Install Module**
3. Paste this manifest URL:
   ```
   https://github.com/epistemophoros/FAX-BANK/releases/latest/download/module.json
   ```
4. Click **Install**

### Method 2: Manual Installation

1. Download `module.zip` from the [latest release](https://github.com/epistemophoros/FAX-BANK/releases/latest)
2. Extract to your Foundry VTT `Data/modules/` directory
3. Restart Foundry VTT
4. Enable the module in your world

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/epistemophoros/FAX-BANK.git
cd FAX-BANK

# Install dependencies
npm install

# Build the module
npm run build
```

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Watch mode - rebuilds on file changes |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint errors |
| `npm run format` | Format code with Prettier |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run unit tests |

## Git Workflow

```
development → PR → main → auto-release
```

1. Push changes to `development`
2. CI runs (Build → Test)
3. PR auto-created to `main`
4. Merge PR
5. Release auto-created with version bump

## CI/CD Pipeline

**On push to `development`:**
- Build → Test → Auto-create PR

**On merge to `main`:**
- Build → Test → Auto-release (with version bump)

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- [Issue Tracker](https://github.com/epistemophoros/FAX-BANK/issues)
- [Releases](https://github.com/epistemophoros/FAX-BANK/releases)
