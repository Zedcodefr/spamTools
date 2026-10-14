// Adaptateurs techniques (source spamgame.com, stockage des images, persistance).
// À n'importer que depuis la racine de composition (apps/*).
export * from './FileSystemAssetStore.js';
export * from './InMemoryCatalogRepository.js';
export * from './spamgame/JsonReader.js';
export * from './spamgame/SpamGameCatalogSource.js';
