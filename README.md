# Example Module for Foundry VTT

![CI Status](https://github.com/yourusername/foundry-example-module/actions/workflows/ci.yml/badge.svg)
![Release](https://github.com/yourusername/foundry-example-module/actions/workflows/release.yml/badge.svg)
![Foundry Version](https://img.shields.io/badge/Foundry-v11--v12-informational)
![License](https://img.shields.io/badge/License-MIT-green)

An example Foundry VTT module demonstrating best practices, TypeScript integration, and CI/CD workflows.

## Features

- 🔧 TypeScript-based module structure
- 🎨 Custom application with styled UI
- ⚙️ Module settings with client/world scopes
- 🌍 i18n support with language files
- 🧪 Unit testing with Vitest
- 🔄 GitHub Actions CI/CD pipeline
- 📦 Automated releases

## Installation

### Method 1: Manifest URL (Recommended)

1. In Foundry VTT, go to **Add-on Modules**
2. Click **Install Module**
3. Paste this manifest URL:
   ```
   https://github.com/yourusername/foundry-example-module/releases/latest/download/module.json
   ```
4. Click **Install**

### Method 2: Manual Installation

1. Download `module.zip` from the [latest release](https://github.com/yourusername/foundry-example-module/releases/latest)
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
git clone https://github.com/yourusername/foundry-example-module.git
cd foundry-example-module

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
| `npm run format:check` | Check code formatting |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate test coverage report |

### Linking to Foundry VTT

For local development, create a symlink from your build output to Foundry's modules folder:

```bash
# macOS/Linux
ln -s /path/to/foundry-example-module/dist /path/to/FoundryVTT/Data/modules/example-module

# Windows (PowerShell as Administrator)
New-Item -ItemType SymbolicLink -Path "C:\FoundryVTT\Data\modules\example-module" -Target "C:\path\to\foundry-example-module\dist"
```

## Project Structure

```
foundry-example-module/
├── .github/
│   └── workflows/
│       ├── ci.yml          # CI pipeline (lint, test, build)
│       ├── release.yml     # Release automation
│       └── pr-check.yml    # PR validation
├── src/
│   ├── applications/       # Foundry Application classes
│   │   └── ExampleApplication.ts
│   ├── styles/             # CSS styles
│   │   └── module.css
│   ├── utils/              # Utility functions
│   │   ├── helpers.ts
│   │   ├── helpers.test.ts
│   │   └── logger.ts
│   ├── constants.ts        # Module constants
│   ├── constants.test.ts
│   ├── module.ts           # Main entry point
│   └── settings.ts         # Module settings
├── templates/              # Handlebars templates
│   └── example-app.hbs
├── languages/              # Localization files
│   └── en.json
├── module.json             # Foundry manifest
├── package.json
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

## Git Workflow

This project uses a **main + development** branch strategy:

### Branches

- **`main`**: Production-ready code. Releases are created from this branch.
- **`development`**: Active development branch. All features and fixes are merged here first.

### Workflow

1. Create a feature branch from `development`:
   ```bash
   git checkout development
   git pull origin development
   git checkout -b feature/my-new-feature
   ```

2. Make your changes and commit:
   ```bash
   git add .
   git commit -m "feat: add my new feature"
   ```

3. Push and create a PR to `development`:
   ```bash
   git push origin feature/my-new-feature
   # Create PR: feature/my-new-feature → development
   ```

4. After PR is merged, CI runs on `development`

5. When ready to release, create a PR from `development` to `main`:
   ```bash
   # Create PR: development → main
   ```

6. When merged to `main`, the release workflow automatically:
   - Runs all CI checks
   - Builds the module
   - Creates a GitHub release
   - Uploads `module.zip` and `module.json`

## CI/CD Pipeline

### On Push to `development`

1. **Lint** - ESLint & Prettier checks
2. **TypeCheck** - TypeScript compilation
3. **Test** - Unit tests with coverage
4. **Build** - Vite production build
5. **Validate** - Module manifest validation

### On PR to `main`

- All CI checks above
- PR title format validation
- Version bump check
- Bundle size analysis

### On Merge to `main`

- All CI checks
- Automatic release creation
- Module packaging and upload

## Contributing

1. Fork the repository
2. Create a feature branch from `development`
3. Make your changes
4. Write/update tests
5. Submit a PR to `development`

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

- [Issue Tracker](https://github.com/yourusername/foundry-example-module/issues)
- [Discussions](https://github.com/yourusername/foundry-example-module/discussions)


