const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch package folders
config.watchFolders = [
  path.resolve(monorepoRoot, "packages/mobile-contracts"),
];

// 2. Let Metro know where to resolve packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// 3. Map package alias directly to source
config.resolver.extraNodeModules = {
  "@studentvalue/mobile-contracts": path.resolve(
    monorepoRoot,
    "packages/mobile-contracts/src"
  ),
};

module.exports = config;
