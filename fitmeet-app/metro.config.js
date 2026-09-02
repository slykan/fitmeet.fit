// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Local dev machine runs low on free RAM during release bundling; Metro's
// default worker count (cpus - 1) spawns enough parallel transform workers
// to hit "Zone Allocation failed - process out of memory" mid-bundle.
config.maxWorkers = 1;

module.exports = config;
